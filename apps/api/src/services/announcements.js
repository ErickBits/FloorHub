import { cacheKeys, EVENTS, rooms, withTransaction } from '@floorhub/shared';
import { AppError, forbidden, notFound } from '../errors.js';

const ACTIVE_TTL_SECONDS = 120;

function assertTargetsAllowed(user, targets, agentTeams) {
  const teams = new Set(user.teamIds);
  const campaigns = new Set(user.campaignIds);
  const allowed = targets.teamIds.every((id) => teams.has(id))
    && targets.campaignIds.every((id) => campaigns.has(id))
    && agentTeams.every((teamId) => teams.has(teamId));
  if (!allowed) throw forbidden('Solo puedes publicar a tus equipos, tus campañas o tus agentes');
}

export async function publishAnnouncement(context, user, input) {
  const { pool, cache, emitter, queues } = context;
  const { targets } = input;

  const { announcement, recipients } = await withTransaction(pool, async (client) => {
    const direct = await client.query(
      "SELECT id, team_id FROM users WHERE id = ANY($1) AND role = 'agent' AND is_active",
      [targets.userIds],
    );
    if (direct.rowCount !== new Set(targets.userIds).size) {
      throw new AppError(422, 'invalid_target', 'Algún destinatario no es un agente activo');
    }
    assertTargetsAllowed(user, targets, direct.rows.map((row) => row.team_id));

    const { rows: [created] } = await client.query(
      `INSERT INTO announcements (author_id, title, body, priority, reminder_interval_minutes, next_reminder_at, expires_at)
       VALUES ($1, $2, $3, $4, $5::integer, now() + make_interval(mins => $5::integer), $6)
       RETURNING *`,
      [
        user.id,
        input.title,
        input.body,
        input.priority,
        input.priority === 'critical' ? input.reminderIntervalMinutes : null,
        input.expiresAt ?? null,
      ],
    );

    await client.query(
      `INSERT INTO announcement_targets (announcement_id, campaign_id, team_id, user_id)
       SELECT $1::uuid, c, NULL::uuid, NULL::uuid FROM unnest($2::uuid[]) AS c
       UNION ALL SELECT $1::uuid, NULL, t, NULL FROM unnest($3::uuid[]) AS t
       UNION ALL SELECT $1::uuid, NULL, NULL, u FROM unnest($4::uuid[]) AS u`,
      [created.id, targets.campaignIds, targets.teamIds, targets.userIds],
    );

    // Foto fija de la audiencia: los agentes activos alcanzados al publicar.
    const { rows: audience } = await client.query(
      `INSERT INTO announcement_recipients (announcement_id, user_id)
       SELECT $1::uuid, u.id
         FROM users u
         JOIN teams t ON t.id = u.team_id
        WHERE u.role = 'agent' AND u.is_active
          AND (u.id = ANY($4::uuid[]) OR t.id = ANY($3::uuid[]) OR t.campaign_id = ANY($2::uuid[]))
       RETURNING user_id`,
      [created.id, targets.campaignIds, targets.teamIds, targets.userIds],
    );
    if (audience.length === 0) {
      throw new AppError(422, 'empty_audience', 'El comunicado no alcanza a ningún agente activo');
    }
    return { announcement: created, recipients: audience.map((row) => row.user_id) };
  });

  context.background(
    (async () => {
      await cache.invalidate(...recipients.map(cacheKeys.activeAnnouncements));
      const teams = await recipientTeams(pool, announcement.id);
      emitter.to(recipients.map(rooms.user)).emit(EVENTS.announcementNew, serializeForAgent(announcement, user));
      emitter
        .to([rooms.user(user.id), ...teams.map(rooms.teamSupervisors)])
        .emit(EVENTS.announcementPublished, { announcementId: announcement.id });
      if (announcement.priority === 'critical') {
        await queues.enqueueReminder({
          announcementId: announcement.id,
          round: 0,
          delayMs: announcement.reminder_interval_minutes * 60000,
        });
      }
    })(),
    'No se pudieron enviar los efectos de la publicación',
  );

  return { ...announcement, recipients_count: recipients.length };
}

function serializeForAgent(announcement, author) {
  return {
    id: announcement.id,
    title: announcement.title,
    body: announcement.body,
    priority: announcement.priority,
    published_at: announcement.published_at,
    author_name: author.fullName,
    acknowledged_at: null,
  };
}

async function recipientTeams(pool, announcementId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT u.team_id
       FROM announcement_recipients r JOIN users u ON u.id = r.user_id
      WHERE r.announcement_id = $1 AND u.team_id IS NOT NULL`,
    [announcementId],
  );
  return rows.map((row) => row.team_id);
}

export function listForAgent({ pool, cache }, user) {
  return cache.getOrSet(cacheKeys.activeAnnouncements(user.id), ACTIVE_TTL_SECONDS, async () => {
    const { rows } = await pool.query(
      `SELECT a.id, a.title, a.body, a.priority, a.published_at, author.full_name AS author_name,
              ack.acknowledged_at
         FROM announcement_recipients r
         JOIN announcements a ON a.id = r.announcement_id
         JOIN users author ON author.id = a.author_id
         LEFT JOIN announcement_acks ack
           ON ack.announcement_id = r.announcement_id AND ack.user_id = r.user_id
        WHERE r.user_id = $1 AND (a.expires_at IS NULL OR a.expires_at > now())
        ORDER BY ack.acknowledged_at IS NULL DESC, a.published_at DESC
        LIMIT 100`,
      [user.id],
    );
    return rows;
  });
}

export async function listForSupervisor({ pool }, user) {
  const { rows } = await pool.query(
    `SELECT a.id, a.title, a.body, a.priority, a.published_at, a.reminder_interval_minutes,
            a.reminders_sent, author.full_name AS author_name,
            (SELECT count(*)::int FROM announcement_recipients r WHERE r.announcement_id = a.id) AS recipients_count,
            (SELECT count(*)::int FROM announcement_acks k WHERE k.announcement_id = a.id) AS acks_count
       FROM announcements a
       JOIN users author ON author.id = a.author_id
      WHERE a.author_id = $1 OR EXISTS (
              SELECT 1 FROM announcement_recipients r JOIN users u ON u.id = r.user_id
               WHERE r.announcement_id = a.id AND u.team_id = ANY($2))
      ORDER BY a.published_at DESC
      LIMIT 50`,
    [user.id, user.teamIds],
  );
  return rows;
}

// El autor ve toda la audiencia; otros supervisores solo a los agentes de sus equipos.
export async function announcementStatus({ pool }, user, announcementId) {
  const { rows: [announcement] } = await pool.query(
    'SELECT id, author_id, title, priority FROM announcements WHERE id = $1',
    [announcementId],
  );
  if (!announcement) throw notFound('Comunicado no encontrado');

  const isAuthor = announcement.author_id === user.id;
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, t.name AS team_name, r.reminder_count, r.last_reminded_at, k.acknowledged_at
       FROM announcement_recipients r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN teams t ON t.id = u.team_id
       LEFT JOIN announcement_acks k ON k.announcement_id = r.announcement_id AND k.user_id = r.user_id
      WHERE r.announcement_id = $1 AND ($2 OR u.team_id = ANY($3))
      ORDER BY k.acknowledged_at DESC NULLS LAST, u.full_name`,
    [announcementId, isAuthor, user.teamIds],
  );
  if (!isAuthor && rows.length === 0) throw notFound('Comunicado no encontrado');

  const acknowledged = rows.filter((row) => row.acknowledged_at);
  return {
    id: announcement.id,
    title: announcement.title,
    priority: announcement.priority,
    total: rows.length,
    acknowledgedCount: acknowledged.length,
    percent: rows.length === 0 ? 0 : Math.round((acknowledged.length / rows.length) * 100),
    acknowledged,
    pending: rows.filter((row) => !row.acknowledged_at),
  };
}

export async function acknowledgeAnnouncement(context, user, announcementId) {
  const { pool, cache, emitter } = context;
  const result = await withTransaction(pool, async (client) => {
    const { rows: [recipient] } = await client.query(
      `SELECT a.author_id FROM announcement_recipients r
         JOIN announcements a ON a.id = r.announcement_id
        WHERE r.announcement_id = $1 AND r.user_id = $2`,
      [announcementId, user.id],
    );
    if (!recipient) throw notFound('Comunicado no encontrado');

    // Confirmar dos veces no duplica ni altera la fecha original del registro.
    const inserted = await client.query(
      `INSERT INTO announcement_acks (announcement_id, user_id) VALUES ($1, $2)
       ON CONFLICT (announcement_id, user_id) DO NOTHING
       RETURNING acknowledged_at`,
      [announcementId, user.id],
    );
    if (inserted.rowCount === 0) {
      const existing = await client.query(
        'SELECT acknowledged_at FROM announcement_acks WHERE announcement_id = $1 AND user_id = $2',
        [announcementId, user.id],
      );
      return { acknowledgedAt: existing.rows[0].acknowledged_at, created: false, authorId: recipient.author_id };
    }

    // Cuando todos confirman ya no hay nada que recordar.
    await client.query(
      `UPDATE announcements a SET next_reminder_at = NULL
        WHERE a.id = $1 AND a.next_reminder_at IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM announcement_recipients r
            LEFT JOIN announcement_acks k ON k.announcement_id = r.announcement_id AND k.user_id = r.user_id
           WHERE r.announcement_id = a.id AND k.user_id IS NULL)`,
      [announcementId],
    );
    return { acknowledgedAt: inserted.rows[0].acknowledged_at, created: true, authorId: recipient.author_id };
  });

  await cache.invalidate(cacheKeys.activeAnnouncements(user.id));
  if (result.created) {
    context.background(
      Promise.resolve(
        emitter
          .to([rooms.user(result.authorId), ...user.teamIds.map(rooms.teamSupervisors)])
          .emit(EVENTS.announcementAcknowledged, {
            announcementId,
            userId: user.id,
            acknowledgedAt: result.acknowledgedAt,
          }),
      ),
      'No se pudo emitir la confirmación',
    );
  }
  return { acknowledgedAt: result.acknowledgedAt };
}
