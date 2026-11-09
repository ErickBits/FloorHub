import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createOrg, createTestContext, ownerClient, redisReady } from '../../../test/helpers.js';
import { createApp } from '../src/app.js';

describe('comunicados con confirmación', () => {
  let context;
  let app;
  let org;

  const publish = (user, body) => request(app).post('/api/announcements').set(bearer(user)).send({
    title: 'Cambio de proceso',
    body: 'Desde hoy se valida el documento antes de la venta.',
    priority: 'critical',
    reminderIntervalMinutes: 10,
    ...body,
  });

  beforeAll(async () => {
    context = createTestContext();
    await redisReady(context);
    app = createApp(context);
    org = await createOrg(context);
  });
  afterAll(() => context.close());

  it('calcula el porcentaje de confirmación con la lista de pendientes', async () => {
    const published = await publish(org.supervisor, { targets: { teamIds: [org.teamId] } });
    expect(published.status).toBe(201);
    expect(published.body.announcement.recipients_count).toBe(2);
    const { id } = published.body.announcement;

    const ack = await request(app).post(`/api/announcements/${id}/ack`).set(bearer(org.agent));
    expect(ack.status).toBe(200);

    const { body: { status } } = await request(app).get(`/api/announcements/${id}/status`).set(bearer(org.supervisor));
    expect(status).toMatchObject({ total: 2, acknowledgedCount: 1, percent: 50 });
    expect(status.acknowledged[0].id).toBe(org.agent.id);
    expect(status.pending[0].id).toBe(org.agent2.id);
  });

  it('una campaña alcanza a sus equipos y no a los de otra', async () => {
    const res = await publish(org.supervisor, { priority: 'info', reminderIntervalMinutes: undefined, targets: { campaignIds: [org.campaignId] } });
    const { id } = res.body.announcement;
    const { body: other } = await request(app).get('/api/announcements').set(bearer(org.otherAgent));
    const { body: own } = await request(app).get('/api/announcements').set(bearer(org.agent));
    expect(other.announcements.map((item) => item.id)).not.toContain(id);
    expect(own.announcements.map((item) => item.id)).toContain(id);
  });

  it('confirmar dos veces conserva la fecha original', async () => {
    const { body } = await publish(org.supervisor, { targets: { userIds: [org.agent2.id] } });
    const { id } = body.announcement;
    const first = await request(app).post(`/api/announcements/${id}/ack`).set(bearer(org.agent2));
    const second = await request(app).post(`/api/announcements/${id}/ack`).set(bearer(org.agent2));
    expect(second.body.acknowledgedAt).toBe(first.body.acknowledgedAt);
  });

  it('impide publicar fuera del alcance del supervisor', async () => {
    const res = await publish(org.supervisor, { targets: { teamIds: [org.otherTeamId] } });
    expect(res.status).toBe(403);
    const direct = await publish(org.supervisor, { targets: { userIds: [org.otherAgent.id] } });
    expect(direct.status).toBe(403);
  });

  it('impide confirmar o consultar comunicados ajenos', async () => {
    const { body } = await publish(org.supervisor, { targets: { teamIds: [org.teamId] } });
    const { id } = body.announcement;
    expect((await request(app).post(`/api/announcements/${id}/ack`).set(bearer(org.otherAgent))).status).toBe(404);
    expect((await request(app).get(`/api/announcements/${id}/status`).set(bearer(org.otherSupervisor))).status).toBe(404);
  });

  it('un comunicado crítico exige intervalo de recordatorio', async () => {
    const res = await publish(org.supervisor, { reminderIntervalMinutes: undefined, targets: { teamIds: [org.teamId] } });
    expect(res.status).toBe(400);
  });

  it('la caché se invalida cuando llega un comunicado nuevo', async () => {
    await request(app).get('/api/announcements').set(bearer(org.agent));
    const { body } = await publish(org.supervisor, { targets: { userIds: [org.agent.id] } });
    await expect.poll(async () => {
      const res = await request(app).get('/api/announcements').set(bearer(org.agent));
      return res.body.announcements.map((item) => item.id);
    }).toContain(body.announcement.id);
  });

  it('la app sigue funcionando si la consulta no puede usar Redis', async () => {
    const failing = { ...context.cache, getOrSet: (_key, _ttl, load) => load() };
    const degraded = createApp({ ...context, cache: failing });
    const res = await request(degraded).get('/api/announcements').set(bearer(org.agent));
    expect(res.status).toBe(200);
  });

  describe('registro de auditoría', () => {
    let announcementId;

    beforeAll(async () => {
      const { body } = await publish(org.supervisor, { targets: { userIds: [org.agent.id] } });
      announcementId = body.announcement.id;
      await request(app).post(`/api/announcements/${announcementId}/ack`).set(bearer(org.agent));
    });

    it('el rol de la aplicación no puede editar ni borrar confirmaciones', async () => {
      await expect(context.pool.query('UPDATE announcement_acks SET acknowledged_at = now()')).rejects.toThrow(/permission denied/);
      await expect(context.pool.query('DELETE FROM announcement_acks')).rejects.toThrow(/permission denied/);
      await expect(context.pool.query('TRUNCATE announcement_acks')).rejects.toThrow(/permission denied/);
    });

    it('los triggers lo impiden incluso al dueño de las tablas', async () => {
      const owner = ownerClient();
      await owner.connect();
      try {
        await expect(owner.query('UPDATE announcement_acks SET acknowledged_at = now()')).rejects.toThrow(/auditoría/);
        await expect(owner.query('DELETE FROM announcement_acks')).rejects.toThrow(/auditoría/);
        await expect(owner.query('TRUNCATE announcement_acks CASCADE')).rejects.toThrow(/auditoría/);
      } finally {
        await owner.end();
      }
    });

    it('el contenido de un comunicado publicado no se puede cambiar', async () => {
      await expect(
        context.pool.query('UPDATE announcements SET title = $1 WHERE id = $2', ['Otro', announcementId]),
      ).rejects.toThrow(/permission denied/);
      const owner = ownerClient();
      await owner.connect();
      try {
        await expect(
          owner.query('UPDATE announcements SET title = $1 WHERE id = $2', ['Otro', announcementId]),
        ).rejects.toThrow(/no se puede modificar/);
      } finally {
        await owner.end();
      }
    });
  });
});
