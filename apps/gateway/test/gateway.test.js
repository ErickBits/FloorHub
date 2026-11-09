import { io as connect } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EVENTS, onlineUsers, rooms } from '@floorhub/shared';
import { createOrg, createTestContext, redisReady } from '../../../test/helpers.js';
import { createGateway } from '../src/server.js';

function listen(gateway) {
  return new Promise((resolve) => {
    gateway.httpServer.listen(0, '127.0.0.1', () => resolve(gateway.httpServer.address().port));
  });
}

describe('gateway de WebSockets', () => {
  let context;
  let org;
  let replicaA;
  let replicaB;
  let portA;
  let portB;
  const sockets = [];

  const open = (port, token) => new Promise((resolve, reject) => {
    const socket = connect(`http://127.0.0.1:${port}`, {
      path: '/ws', transports: ['websocket'], auth: { token }, reconnection: false, forceNew: true,
    });
    sockets.push(socket);
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
  const nextEvent = (socket, event) => new Promise((resolve) => socket.once(event, resolve));

  beforeAll(async () => {
    context = createTestContext();
    await redisReady(context);
    org = await createOrg(context);
    // Dos réplicas reales que solo se comunican a través de Redis.
    replicaA = createGateway(context);
    replicaB = createGateway(context);
    portA = await listen(replicaA);
    portB = await listen(replicaB);
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  afterAll(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await replicaA.close();
    await replicaB.close();
    await context.close();
  });

  it('rechaza conexiones sin un token válido', async () => {
    await expect(open(portA, 'falso')).rejects.toThrow('unauthorized');
  });

  it('un evento publicado por la API llega a clientes de cualquier réplica', async () => {
    const onA = await open(portA, org.agent.token);
    const onB = await open(portB, org.agent2.token);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const received = Promise.all([nextEvent(onA, 'prueba'), nextEvent(onB, 'prueba')]);
    context.emitter.to(rooms.team(org.teamId)).emit('prueba', { ok: true });
    await expect(received).resolves.toEqual([{ ok: true }, { ok: true }]);
  });

  it('un agente no recibe eventos de otro equipo', async () => {
    const outsider = await open(portA, org.otherAgent.token);
    let leaked = false;
    outsider.on('secreto', () => { leaked = true; });
    const insider = await open(portB, org.agent.token);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const received = nextEvent(insider, 'secreto');
    context.emitter.to(rooms.team(org.teamId)).emit('secreto', {});
    await received;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(leaked).toBe(false);
  });

  it('informa la presencia al conectar y al desconectar', async () => {
    const fresh = await createOrg(context);
    const supervisor = await open(portA, fresh.supervisor.token);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const connected = nextEvent(supervisor, EVENTS.presenceChanged);
    const agent = await open(portB, fresh.agent.token);
    await expect(connected).resolves.toEqual({ userId: fresh.agent.id, online: true });
    expect(await onlineUsers(context.redis, [fresh.teamId])).toContain(fresh.agent.id);

    const disconnected = nextEvent(supervisor, EVENTS.presenceChanged);
    agent.disconnect();
    await expect(disconnected).resolves.toEqual({ userId: fresh.agent.id, online: false });
    expect(await onlineUsers(context.redis, [fresh.teamId])).not.toContain(fresh.agent.id);
  });

  it('con dos pestañas sigue conectado hasta cerrar la última', async () => {
    const fresh = await createOrg(context);
    const first = await open(portA, fresh.agent.token);
    await open(portB, fresh.agent.token);
    first.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await onlineUsers(context.redis, [fresh.teamId])).toContain(fresh.agent.id);
  });

  it('/health responde', async () => {
    const res = await fetch(`http://127.0.0.1:${portA}/health`);
    expect(res.status).toBe(200);
  });
});
