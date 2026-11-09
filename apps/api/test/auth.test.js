import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { bearer, createOrg, createTestContext, redisReady, TEST_PASSWORD } from '../../../test/helpers.js';
import { createApp } from '../src/app.js';

describe('autenticación y autorización', () => {
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

  it('inicia sesión y devuelve al usuario sin su hash', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: org.agent.email, password: TEST_PASSWORD });
    expect(login.status).toBe(200);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ id: org.agent.id, role: 'agent', teamIds: [org.teamId] });
    expect(JSON.stringify(me.body)).not.toContain('password');
  });

  it('rechaza credenciales incorrectas con el mismo mensaje', async () => {
    const wrong = await request(app).post('/api/auth/login').send({ email: org.agent2.email, password: 'incorrecta' });
    const missing = await request(app).post('/api/auth/login').send({ email: `${randomUUID()}@floorhub.test`, password: 'incorrecta' });
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.body).toEqual(missing.body);
  });

  it('limita los intentos de login', async () => {
    const email = `${randomUUID()}@floorhub.test`;
    const statuses = [];
    // Reloj fijo: la ventana del límite es por minuto y cruzarla reiniciaría el contador.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      for (let attempt = 0; attempt < 7; attempt += 1) {
        const res = await request(app).post('/api/auth/login').send({ email, password: 'incorrecta' });
        statuses.push(res.status);
      }
    } finally {
      vi.useRealTimers();
    }
    expect(statuses.slice(0, 5).every((status) => status === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it('exige un token válido', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer falso')).status).toBe(401);
  });

  it('bloquea las rutas de administración a otros roles', async () => {
    const res = await request(app).get('/api/admin/users').set(bearer(org.supervisor));
    expect(res.status).toBe(403);
  });

  it('un usuario desactivado pierde el acceso de inmediato', async () => {
    const created = await request(app).post('/api/admin/users').set(bearer(org.admin)).send({
      email: `${randomUUID()}@floorhub.test`,
      password: 'password-largo',
      fullName: 'Temporal',
      role: 'supervisor',
    });
    expect(created.status).toBe(201);
    const login = await request(app).post('/api/auth/login').send({ email: created.body.user.email, password: 'password-largo' });
    const auth = { Authorization: `Bearer ${login.body.token}` };
    expect((await request(app).get('/api/auth/me').set(auth)).status).toBe(200);

    await request(app).patch(`/api/admin/users/${created.body.user.id}`).set(bearer(org.admin)).send({ isActive: false });
    expect((await request(app).get('/api/auth/me').set(auth)).status).toBe(401);
  });

  it('valida las reglas de rol y equipo', async () => {
    const res = await request(app).post('/api/admin/users').set(bearer(org.admin)).send({
      email: `${randomUUID()}@floorhub.test`,
      password: 'password-largo',
      fullName: 'Sin equipo',
      role: 'agent',
    });
    expect(res.status).toBe(422);
  });

  it('/health informa del estado de sus dependencias', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', checks: { postgres: 'ok', redis: 'ok' } });
  });
});
