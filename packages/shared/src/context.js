import { Redis } from 'ioredis';
import { Emitter } from '@socket.io/redis-emitter';
import pino from 'pino';
import { createCache } from './cache.js';
import { createPool } from './db.js';
import { createQueues } from './queues.js';


/* We´ll set up a tool box with all the connections and utilities services need to run, like databases, redis, queues  etc*/

// info basica del servicio en json
export function createLogger(service, level = 'info') {
  return pino({ level, base: { service }, timestamp: pino.stdTimeFunctions.isoTime });
}

// Conexión para caché y rate limiting: falla rápido para que un Redis caído no bloquee peticiones.
export function createFastRedis(url, log) {
  const client = new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
  client.on('error', (error) => log.warn({ err: error.message }, 'Error de Redis (caché)'));
  return client;
}

// Conexión para colas y eventos: BullMQ exige reintentos ilimitados y conserva los comandos pendientes.
export function createDurableRedis(url, log) {
  const client = new Redis(url, { maxRetriesPerRequest: null });
  client.on('error', (error) => log.warn({ err: error.message }, 'Error de Redis (colas)'));
  return client;
}

export function createContext(service, config) {
  const log = createLogger(service, config.logLevel);
  const pool = createPool(config, log);
  const redis = createFastRedis(config.redisUrl, log);
  const durableRedis = createDurableRedis(config.redisUrl, log);
  const emitter = new Emitter(durableRedis);
  const queues = createQueues(durableRedis);

  return {
    service,
    config,
    log,
    pool,
    redis,
    durableRedis,
    emitter,
    queues,
    cache: createCache(redis, log),
    // Efectos posteriores al commit: si fallan, se registran y PostgreSQL sigue siendo la verdad.
    background(promise, description) {
      return Promise.resolve(promise).catch((error) => log.error({ err: error }, description));
    },
    async close() {
      await queues.close();
      await pool.end();
      redis.disconnect();
      durableRedis.disconnect();
    },
  };
}
