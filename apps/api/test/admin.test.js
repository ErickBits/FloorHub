import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createOrg, createTestContext, redisReady } from '../../../test/helpers.js';
import { createApp } from '../src/app.js';

describe('administración, directorio y presencia', () => {
  let context;
  let app;
  let org;

  beforeAll(async () => {
    context = createTestContext();
    await redisReady(context);
    app = createApp(context);
    org = await createOrg(context);
  });
  afterAll(() => context.close());

  const asAdmin = (req) => req.set(bearer(org.admin));

  it('crea, lista y edita campañas', async () => {
    const name = `Campaña admin ${randomUUID().slice(0, 8)}`;
    const created = await asAdmin(request(app).post('/api/admin/campaigns')).send({ name });
    expect(created.status).toBe(201);
    expect(created.body.campaign).toMatchObject({ name, is_active: true });

    const list = await asAdmin(request(app).get('/api/admin/campaigns'));
    expect(list.body.campaigns.map((campaign) => campaign.id)).toContain(created.body.campaign.id);

    const updated = await asAdmin(request(app).patch(`/api/admin/campaigns/${created.body.campaign.id}`))
      .send({ isActive: false });
    expect(updated.status).toBe(200);
    expect(updated.body.campaign.is_active).toBe(false);
  });

  it('rechaza ediciones vacías o de registros inexistentes', async () => {
    const empty = await asAdmin(request(app).patch(`/api/admin/campaigns/${org.campaignId}`)).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('empty_update');

    const missingTeam = await asAdmin(request(app).patch(`/api/admin/teams/${randomUUID()}`)).send({ name: 'X' });
    expect(missingTeam.status).toBe(404);

    const missingUser = await asAdmin(request(app).patch(`/api/admin/users/${randomUUID()}`)).send({ fullName: 'X' });
    expect(missingUser.status).toBe(404);
  });

  it('crea equipos y los lista con sus supervisores', async () => {
    const created = await asAdmin(request(app).post('/api/admin/teams'))
      .send({ campaignId: org.campaignId, name: 'Equipo nuevo' });
    expect(created.status).toBe(201);

    const list = await asAdmin(request(app).get('/api/admin/teams'));
    const team = list.body.teams.find((row) => row.id === org.teamId);
    expect(list.body.teams.map((row) => row.id)).toContain(created.body.team.id);
    expect(team.supervisors.map((supervisor) => supervisor.id).sort())
      .toEqual([org.supervisor.id, org.supervisor2.id].sort());
  });

  it('reasigna supervisores y actualiza su alcance de inmediato', async () => {
    const assigned = await asAdmin(request(app).put(`/api/admin/teams/${org.otherTeamId}/supervisors`))
      .send({ userIds: [org.supervisor.id] });
    expect(assigned.status).toBe(200);

    const me = await request(app).get('/api/auth/me').set(bearer(org.supervisor));
    expect(me.body.user.teamIds).toContain(org.otherTeamId);
    const previous = await request(app).get('/api/auth/me').set(bearer(org.otherSupervisor));
    expect(previous.body.user.teamIds).not.toContain(org.otherTeamId);

    const invalid = await asAdmin(request(app).put(`/api/admin/teams/${org.teamId}/supervisors`))
      .send({ userIds: [org.agent.id] });
    expect(invalid.status).toBe(404);
  });

  it('edita usuarios sin exponer el hash de la contraseña', async () => {
    const updated = await asAdmin(request(app).patch(`/api/admin/users/${org.agent2.id}`))
      .send({ fullName: 'Nombre editado', password: 'una-clave-nueva-segura' });
    expect(updated.status).toBe(200);
    expect(updated.body.user).toMatchObject({ id: org.agent2.id, full_name: 'Nombre editado' });
    expect(JSON.stringify(updated.body)).not.toContain('password');
  });

  it('el directorio solo muestra lo que el supervisor puede elegir', async () => {
    const directory = await request(app).get('/api/directory').set(bearer(org.supervisor2));
    expect(directory.status).toBe(200);
    expect(directory.body.campaigns.map((campaign) => campaign.id)).toEqual([org.campaignId]);
    expect(directory.body.teams.map((team) => team.id)).toEqual([org.teamId]);
    const agentIds = directory.body.agents.map((agent) => agent.id);
    expect(agentIds).toContain(org.agent.id);
    expect(agentIds).not.toContain(org.otherAgent.id);

    expect((await request(app).get('/api/directory').set(bearer(org.agent))).status).toBe(403);
  });

  it('la presencia lista a los agentes del equipo con su estado', async () => {
    const presence = await request(app).get('/api/presence').set(bearer(org.supervisor2));
    expect(presence.status).toBe(200);
    const agent = presence.body.agents.find((row) => row.id === org.agent.id);
    expect(agent).toMatchObject({ team_id: org.teamId, online: false });
    expect(presence.body.agents.map((row) => row.id)).not.toContain(org.otherAgent.id);
  });
});
