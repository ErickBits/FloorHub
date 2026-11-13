import { EVENTS, expirePresence, rooms, withTransaction } from '@floorhub/shared';

// Envía una ronda de recordatorios. El candado de fila y la comprobación de la ronda
// hacen que un trabajo repetido no notifique dos veces.
export async function sendReminder(context, { announcementId, round }) {
  const { pool, queues, config } = context;

  // Actaliza la base de datos y obtiene los destinatarios pendientes. Si no hay ninguno, cancela la siguiente ronda.
  const outcome = await withTransaction(pool, async (client) => {
    const { rows: [announcement] } = await client.query(
      `SELECT id, title, reminder_interval_minutes, reminders_sent, expires_at
         FROM announcements
        WHERE id = $1 AND reminders_sent = $2 AND next_reminder_at IS NOT NULL AND next_reminder_at <= now() + interval '5 seconds'
        FOR UPDATE`,
      [announcementId, round],
    );
    if (!announcement) return null;

    //Quien no ha confirmado
    const { rows: pending } = await client.query(
      `SELECT r.user_id
         FROM announcement_recipients r
         LEFT JOIN announcement_acks k ON k.announcement_id = r.announcement_id AND k.user_id = r.user_id
        WHERE r.announcement_id = $1 AND k.user_id IS NULL`,
      [announcementId],
    );

    //Verificar si el comunicado ha expirado o si no hay destinatarios pendientes. Si es así, cancelar la siguiente ronda.
    const expired = announcement.expires_at && new Date(announcement.expires_at) <= new Date();
    if (pending.length === 0 || expired) {
      await client.query('UPDATE announcements SET next_reminder_at = NULL WHERE id = $1', [announcementId]);
      return null;
    }

    // Actualizar la base de datos para reflejar que se envió un recordatorio y programar la siguiente ronda si corresponde.
    const userIds = pending.map((row) => row.user_id);
    await client.query(
      `UPDATE announcement_recipients SET reminder_count = reminder_count + 1, last_reminded_at = now()
        WHERE announcement_id = $1 AND user_id = ANY($2)`,
      [announcementId, userIds],
    );

    const nextRound = announcement.reminders_sent + 1;
    const hasMoreRounds = nextRound < config.reminderMaxRounds;
    await client.query(
      `UPDATE announcements
          SET reminders_sent = $2,
              next_reminder_at = CASE WHEN $3::boolean THEN now() + make_interval(mins => $4::integer) END
        WHERE id = $1`,
      [announcementId, nextRound, hasMoreRounds, announcement.reminder_interval_minutes],
    );
    return { announcement, userIds, nextRound, hasMoreRounds };
  });
  if (!outcome) return { sent: 0 };

  const { announcement, userIds, nextRound, hasMoreRounds } = outcome;
  await queues.enqueueNotifications(
    userIds.map((userId) => ({
      room: rooms.user(userId),
      event: EVENTS.announcementReminder,
      payload: { announcementId, title: announcement.title, round: nextRound },
    })),
  );
  if (hasMoreRounds) {
    await queues.enqueueReminder({
      announcementId,
      round: nextRound,
      delayMs: announcement.reminder_interval_minutes * 60000,
    });
  }
  context.log.info({ announcementId, round: nextRound, recipients: userIds.length }, 'Recordatorios enviados');
  return { sent: userIds.length };
}


// Envía notificaciones en tiempo real a los clientes conectados. No es obligatorio: si falla, se ignora.
export function deliverNotification({ emitter }, { room, event, payload }) {
  emitter.to(room).emit(event, payload);
}

// Los trabajos con retraso viven solo en Redis. Si Redis se reinicia, este proceso los
// reconstruye desde PostgreSQL. El id determinista evita duplicar los que siguen en cola.
export async function reconcileReminders({ pool, queues, log }) {
  const { rows } = await pool.query(
    'SELECT id, reminders_sent FROM announcements WHERE next_reminder_at <= now()',
  );
  for (const row of rows) {
    await queues.enqueueReminder({ announcementId: row.id, round: row.reminders_sent, delayMs: 0 });
  }
  if (rows.length > 0) log.info({ count: rows.length }, 'Recordatorios vencidos reencolados');
  return rows.length;
}

// Avisa de quienes dejaron de enviar heartbeats, por ejemplo si murió su gateway.
export async function sweepPresence({ redis, emitter }) {
  const expired = await expirePresence(redis);
  for (const { teamId, userId } of expired) {
    emitter.to(rooms.teamSupervisors(teamId)).emit(EVENTS.presenceChanged, { userId, online: false });
  }
  return expired.length;
}

// Simulado: el resumen diario va a los logs en lugar de enviarse por correo.
export async function dailySummary({ pool, log }) {
  const { rows: [summary] } = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM announcements WHERE published_at > now() - interval '24 hours') AS announcements,
       (SELECT count(*)::int FROM announcement_acks WHERE acknowledged_at > now() - interval '24 hours') AS acks,
       (SELECT count(*)::int FROM help_requests WHERE created_at > now() - interval '24 hours') AS help_requests,
       (SELECT round(avg(EXTRACT(EPOCH FROM claimed_at - created_at)))::int FROM help_requests
         WHERE claimed_at > now() - interval '24 hours') AS avg_wait_seconds`,
  );
  log.info({ summary }, 'Resumen diario');
  return summary;
}
