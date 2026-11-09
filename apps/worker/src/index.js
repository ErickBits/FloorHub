import { createServer } from 'node:http';
import { Worker } from 'bullmq';
import { createContext, createDurableRedis, loadConfig, QUEUE_NAMES } from '@floorhub/shared';
import {
  dailySummary,
  deliverNotification,
  reconcileReminders,
  sendReminder,
  sweepPresence,
} from './jobs.js';

const config = loadConfig();
const context = createContext('worker', config);
const { log, queues } = context;
const connection = createDurableRedis(config.redisUrl, log);

const maintenanceJobs = {
  'reconcile-reminders': reconcileReminders,
  'sweep-presence': sweepPresence,
  'daily-summary': dailySummary,
};

const workers = [
  new Worker(QUEUE_NAMES.reminders, (job) => sendReminder(context, job.data), { connection }),
  new Worker(QUEUE_NAMES.notifications, (job) => deliverNotification(context, job.data), { connection }),
  new Worker(QUEUE_NAMES.maintenance, (job) => maintenanceJobs[job.name]?.(context), { connection }),
];
for (const worker of workers) {
  worker.on('failed', (job, error) => log.error({ err: error, job: job?.name, id: job?.id }, 'Trabajo fallido'));
  worker.on('error', (error) => log.warn({ err: error.message }, 'Error del worker'));
}

// Los programadores también viven en Redis: registrarlos al arrancar y al reconectar
// los recupera después de un reinicio. upsert evita duplicados.
async function registerSchedulers() {
  await queues.maintenance.upsertJobScheduler('reconcile-reminders', { every: 60_000 }, { name: 'reconcile-reminders' });
  await queues.maintenance.upsertJobScheduler('sweep-presence', { every: 15_000 }, { name: 'sweep-presence' });
  await queues.maintenance.upsertJobScheduler('daily-summary', { pattern: '0 23 * * *' }, { name: 'daily-summary' });
  log.info('Trabajos periódicos registrados');
}
connection.on('ready', () => {
  registerSchedulers().catch((error) => log.error({ err: error }, 'No se pudieron registrar los trabajos'));
});

const healthServer = createServer(async (req, res) => {
  if (req.url === '/livez') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end('{"status":"ok"}');
  }
  if (req.url === '/health') {
    let healthy = true;
    try {
      await Promise.all([context.pool.query('SELECT 1'), context.redis.ping()]);
    } catch {
      healthy = false;
    }
    res.writeHead(healthy ? 200 : 503, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ status: healthy ? 'ok' : 'error', service: 'worker' }));
  }
  res.writeHead(404);
  return res.end();
});
healthServer.listen(config.port, () => log.info({ port: config.port }, 'Worker escuchando'));

async function shutdown(signal) {
  log.info({ signal }, 'Cerrando worker');
  healthServer.close();
  await Promise.all(workers.map((worker) => worker.close()));
  connection.disconnect();
  await context.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
