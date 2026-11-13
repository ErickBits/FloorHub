import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { bearer, createOrg, createTestContext, redisReady } from '../../../test/helpers.js';
import { createApp } from '../src/app.js';

describe('cola de ayuda', () => {
  let context;
  let app;
  let org;

  const create = (user, type = 'approval', summary = 'Cliente pide excepción') =>
    request(app).post('/api/help-requests').set(bearer(user)).send({ type, summary });

  beforeAll(async () => {
    context = createTestContext();
    await redisReady(context);
    app = createApp(context);
  });
  beforeEach(async () => {
    org = await createOrg(context);
  });
  afterAll(() => context.close());

  it('dos supervisores nunca toman la misma solicitud al mismo tiempo', async () => {
    const { body: { request: helpRequest } } = await create(org.agent);

    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, index) => request(app)
        .post(`/api/help-requests/${helpRequest.id}/claim`)
        .set(bearer(index % 2 === 0 ? org.supervisor : org.supervisor2))),
    );

    const statuses = responses.map((res) => res.status).sort();
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(9);

    const winner = responses.find((res) => res.status === 200).body.request;
    const { rows } = await context.pool.query('SELECT status, claimed_by FROM help_requests WHERE id = $1', [helpRequest.id]);
    expect(rows[0]).toEqual({ status: 'in_progress', claimed_by: winner.claimed_by });
  });

  it('recorre pendiente, en atención y resuelta, y mide los tiempos', async () => {
    const { body: { request: created } } = await create(org.agent);
    expect(created).toMatchObject({ status: 'pending', claimed_by: null });

    const claimed = await request(app).post(`/api/help-requests/${created.id}/claim`).set(bearer(org.supervisor));
    expect(claimed.body.request).toMatchObject({ status: 'in_progress', claimed_by: org.supervisor.id });
    expect(claimed.body.request.wait_seconds).toBeGreaterThanOrEqual(0);

    const resolved = await request(app).post(`/api/help-requests/${created.id}/resolve`).set(bearer(org.supervisor));
    expect(resolved.body.request.status).toBe('resolved');
    expect(resolved.body.request.resolution_seconds).toBeGreaterThanOrEqual(0);
  });

  it('ordena la cola por prioridad y luego por antigüedad', async () => {
    await create(org.agent, 'process_question');
    await create(org.agent2, 'difficult_customer');
    const { body } = await request(app).get('/api/help-requests').set(bearer(org.supervisor));
    expect(body.requests.map((item) => item.type)).toEqual(['difficult_customer', 'process_question']);
  });

  it('el servidor ignora una prioridad enviada por el agente', async () => {
    const res = await request(app).post('/api/help-requests').set(bearer(org.agent)).send({
      type: 'process_question', summary: 'Duda', priority: 99,
    });
    expect(res.body.request.priority).toBe(1);
  });

  it('solo permite una solicitud activa por agente', async () => {
    await create(org.agent);
    const second = await create(org.agent);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('active_request_exists');
  });

  it('un supervisor de otro equipo no ve ni toma la solicitud', async () => {
    const { body: { request: created } } = await create(org.agent);
    const list = await request(app).get('/api/help-requests').set(bearer(org.otherSupervisor));
    expect(list.body.requests).toEqual([]);
    const claim = await request(app).post(`/api/help-requests/${created.id}/claim`).set(bearer(org.otherSupervisor));
    expect(claim.status).toBe(404);
  });

  it('solo quien atiende la solicitud puede resolverla', async () => {
    const { body: { request: created } } = await create(org.agent);
    await request(app).post(`/api/help-requests/${created.id}/claim`).set(bearer(org.supervisor));
    const res = await request(app).post(`/api/help-requests/${created.id}/resolve`).set(bearer(org.supervisor2));
    expect(res.status).toBe(409);
  });

  it('el agente y quien tomó la solicitud conversan hasta que se resuelve', async () => {
    const { body: { request: created } } = await create(org.agent);
    const send = (user, body) =>
      request(app).post(`/api/help-requests/${created.id}/replies`).set(bearer(user)).send({ body });

    expect((await send(org.supervisor, 'Hola')).status).toBe(409); // Aún está pendiente.
    expect((await send(org.agent, 'Hola')).status).toBe(409);
    await request(app).post(`/api/help-requests/${created.id}/claim`).set(bearer(org.supervisor));

    expect((await send(org.supervisor, 'Ofrécele el plan de retención')).status).toBe(201);
    const res = await send(org.agent, '¿Y si no acepta?');
    expect(res.status).toBe(201);
    expect(res.body.request.replies).toMatchObject([
      { body: 'Ofrécele el plan de retención', author_id: org.supervisor.id, author_role: 'supervisor' },
      { body: '¿Y si no acepta?', author_id: org.agent.id, author_role: 'agent' },
    ]);

    expect((await send(org.supervisor2, 'Hola')).status).toBe(409);
    expect((await send(org.agent2, 'Hola')).status).toBe(404);
    expect((await send(org.otherSupervisor, 'Hola')).status).toBe(404);
    expect((await send(org.supervisor, '')).status).toBe(400);

    const { body } = await request(app).get('/api/help-requests').set(bearer(org.supervisor));
    expect(body.requests.find((item) => item.id === created.id).replies).toHaveLength(2);

    await request(app).post(`/api/help-requests/${created.id}/resolve`).set(bearer(org.supervisor));
    expect((await send(org.supervisor, 'Hola')).status).toBe(409);
    expect((await send(org.agent, 'Hola')).status).toBe(409);
  });

  it('valida las entradas', async () => {
    const res = await request(app).post('/api/help-requests').set(bearer(org.agent)).send({ type: 'otro', summary: '' });
    expect(res.status).toBe(400);
    const badId = await request(app).post('/api/help-requests/no-es-uuid/claim').set(bearer(org.supervisor));
    expect(badId.status).toBe(400);
  });

  it('limita la creación de solicitudes', async () => {
    const statuses = [];
    // Reloj fijo: la ventana del límite es por minuto y cruzarla reiniciaría el contador.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) statuses.push((await create(org.agent)).status);
    } finally {
      vi.useRealTimers();
    }
    expect(statuses.at(-1)).toBe(429);
  });

  it('una inyección SQL se trata como texto', async () => {
    const res = await create(org.agent, 'approval', "'); DROP TABLE help_requests; --");
    expect(res.status).toBe(201);
    expect(res.body.request.summary).toContain('DROP TABLE');
  });
});
