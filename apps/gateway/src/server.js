import { createServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server } from 'socket.io';
import {
  authenticateToken,
  createDurableRedis,
  EVENTS,
  markAbsent,
  markPresent,
  rooms,
} from '@floorhub/shared';

function roomsFor(user) {
  const joined = [rooms.user(user.id)];
  if (user.role === 'agent') joined.push(...user.teamIds.map(rooms.team));
  if (user.role === 'supervisor') joined.push(...user.teamIds.map(rooms.teamSupervisors));
  return joined;
}

export function createGateway(context) {
  const { log, redis, pool } = context;

  const httpServer = createServer(async (req, res) => {
    if (req.url === '/livez') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end('{"status":"ok"}');
    }
    if (req.url === '/health') {
      // A diferencia de la API, sin Redis este servicio no puede entregar eventos.
      let healthy = true;
      try {
        await Promise.all([pool.query('SELECT 1'), redis.ping()]);
      } catch {
        healthy = false;
      }
      res.writeHead(healthy ? 200 : 503, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ status: healthy ? 'ok' : 'error', service: 'gateway' }));
    }
    res.writeHead(404);
    return res.end();
  });

  // Solo WebSocket: el long-polling exigiría sesiones pegajosas entre réplicas.
  const io = new Server(httpServer, { path: '/ws', transports: ['websocket'], serveClient: false });

  // El adaptador usa dos conexiones porque una conexión suscrita no puede publicar.
  const pubClient = createDurableRedis(context.config.redisUrl, log);
  const subClient = pubClient.duplicate();
  subClient.on('error', (error) => log.warn({ err: error.message }, 'Error de Redis (suscripción)'));
  io.adapter(createAdapter(pubClient, subClient));

  io.use(async (socket, next) => {
    try {
      const user = await authenticateToken(context, socket.handshake.auth?.token);
      if (!user) return next(new Error('unauthorized'));
      socket.data.user = user;
      return next();
    } catch (error) {
      log.error({ err: error }, 'Error al autenticar un socket');
      return next(new Error('unavailable'));
    }
  });

  const announcePresence = (user, online) => {
    io.to(user.teamIds.map(rooms.teamSupervisors)).emit(EVENTS.presenceChanged, { userId: user.id, online });
  };

  io.on('connection', async (socket) => {
    const { user } = socket.data;
    socket.join(roomsFor(user));

    const beat = () => markPresent(redis, user.teamIds, user.id).catch((error) => {
      log.warn({ err: error.message }, 'No se pudo registrar la presencia');
    });
    await beat();
    if (user.role === 'agent') announcePresence(user, true);
    socket.on(EVENTS.presenceHeartbeat, beat);

    socket.on('disconnect', async () => {
      // Un usuario con varias pestañas o réplicas sigue conectado hasta cerrar la última.
      try {
        const remaining = await io.in(rooms.user(user.id)).fetchSockets();
        if (remaining.length > 0) return;
        await markAbsent(redis, user.teamIds, user.id);
        if (user.role === 'agent') announcePresence(user, false);
      } catch (error) {
        log.warn({ err: error.message }, 'No se pudo actualizar la presencia al desconectar');
      }
    });
  });

  return {
    httpServer,
    io,
    async close() {
      await new Promise((resolve) => io.close(resolve));
      // El adaptador cancela sus suscripciones sin esperar la respuesta: se les da tiempo antes de cerrar.
      await new Promise((resolve) => setTimeout(resolve, 100));
      pubClient.disconnect();
      subClient.disconnect();
    },
  };
}
