import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expirePresence, markPresent, onlineUsers, PRESENCE_TIMEOUT_SECONDS } from '@floorhub/shared';
import { createOrg, createTestContext, redisReady } from '../../../test/helpers.js';
import { dailySummary, reconcileReminders, sendReminder } from '../src/jobs.js';

describe('trabajos del worker', () => {
  let context;
  let fake;

  // Cola en memoria para comprobar qué se encolaría, sin depender de tiempos reales.
  const fakeQueues = () => {
    const state = { reminders: [], notifications: [] };
    return {
      state,
      enqueueReminder: async (job) => { state.reminders.push(job); },
      enqueueNotifications: async (items) => { state.notifications.push(...items); },
    };
  };

  async function createDueAnnouncement(org, recipients, overrides = {}) {
    const { rows: [announcement] } = await context.pool.query(
      `INSERT INTO announcements (author_id, title, body, priority, reminder_interval_minutes, next_reminder_at, reminders_sent)
       VALUES ($1, 'Crítico', 'Texto', 'critical', 10, now() - interval '1 minute', $2) RETURNING id`,
      [org.supervisor.id, overrides.remindersSent ?? 0],
    );
    for (const recipient of recipients) {
      await context.pool.query(
        'INSERT INTO announcement_recipients (announcement_id, user_id) VALUES ($1, $2)',
        [announcement.id, recipient.id],
      );
    }
    return announcement.id;
  }

  beforeAll(async () => {
    context = createTestContext('worker-test');
    await redisReady(context);
  });
  afterAll(() => context.close());

  it('recuerda solo a quien no ha confirmado y programa la siguiente ronda', async () => {
    const org = await createOrg(context);
    const id = await createDueAnnouncement(org, [org.agent, org.agent2]);
    await context.pool.query('INSERT INTO announcement_acks (announcement_id, user_id) VALUES ($1, $2)', [id, org.agent.id]);
    fake = fakeQueues();

    const result = await sendReminder({ ...context, queues: fake }, { announcementId: id, round: 0 });

    expect(result.sent).toBe(1);
    expect(fake.state.notifications.map((item) => item.room)).toEqual([`user:${org.agent2.id}`]);
    expect(fake.state.reminders[0]).toMatchObject({ announcementId: id, round: 1, delayMs: 600000 });
    const { rows } = await context.pool.query(
      'SELECT reminder_count FROM announcement_recipients WHERE announcement_id = $1 AND user_id = $2',
      [id, org.agent2.id],
    );
    expect(rows[0].reminder_count).toBe(1);
  });

  it('un trabajo repetido no notifica dos veces', async () => {
    const org = await createOrg(context);
    const id = await createDueAnnouncement(org, [org.agent]);
    fake = fakeQueues();
    await sendReminder({ ...context, queues: fake }, { announcementId: id, round: 0 });
    const again = await sendReminder({ ...context, queues: fake }, { announcementId: id, round: 0 });
    expect(again.sent).toBe(0);
    expect(fake.state.notifications).toHaveLength(1);
  });

  it('se detiene al alcanzar el máximo de rondas', async () => {
    const org = await createOrg(context);
    const id = await createDueAnnouncement(org, [org.agent], { remindersSent: 1 });
    fake = fakeQueues();
    await sendReminder({ ...context, queues: fake }, { announcementId: id, round: 1 });
    expect(fake.state.reminders).toHaveLength(0);
    const { rows } = await context.pool.query('SELECT next_reminder_at FROM announcements WHERE id = $1', [id]);
    expect(rows[0].next_reminder_at).toBeNull();
  });

  it('deja de recordar cuando todos confirmaron', async () => {
    const org = await createOrg(context);
    const id = await createDueAnnouncement(org, [org.agent]);
    await context.pool.query('INSERT INTO announcement_acks (announcement_id, user_id) VALUES ($1, $2)', [id, org.agent.id]);
    fake = fakeQueues();
    const result = await sendReminder({ ...context, queues: fake }, { announcementId: id, round: 0 });
    expect(result.sent).toBe(0);
    const { rows } = await context.pool.query('SELECT next_reminder_at FROM announcements WHERE id = $1', [id]);
    expect(rows[0].next_reminder_at).toBeNull();
  });

  it('reconstruye desde PostgreSQL los recordatorios perdidos con un reinicio de Redis', async () => {
    const org = await createOrg(context);
    const id = await createDueAnnouncement(org, [org.agent]);
    fake = fakeQueues();
    await reconcileReminders({ ...context, queues: fake });
    expect(fake.state.reminders).toContainEqual({ announcementId: id, round: 0, delayMs: 0 });
  });

  it('expira la presencia de quien dejó de enviar heartbeats', async () => {
    const org = await createOrg(context);
    const old = Date.now() - (PRESENCE_TIMEOUT_SECONDS + 5) * 1000;
    await markPresent(context.redis, [org.teamId], org.agent.id, old);
    await markPresent(context.redis, [org.teamId], org.agent2.id);
    const expired = await expirePresence(context.redis);
    expect(expired).toContainEqual({ teamId: org.teamId, userId: org.agent.id });
    expect(await onlineUsers(context.redis, [org.teamId])).toEqual([org.agent2.id]);
  });

  it('genera el resumen diario', async () => {
    const summary = await dailySummary(context);
    expect(summary).toHaveProperty('announcements');
    expect(summary).toHaveProperty('avg_wait_seconds');
  });
});
