import { Queue } from 'bullmq';

export const QUEUE_NAMES = {
  reminders: 'reminders',
  notifications: 'notifications',
  maintenance: 'maintenance',
};

const JOB_DEFAULTS = {
  attempts: 3,
  //Exponencial, 2 s, 4s, 8s
  backoff: { type: 'exponential', delay: 2000 },
  //una vez se completa un trabajo se elimina para ahorrar memoria
  removeOnComplete: true,
  //guarda logs de una hora en trabajos fallidos
  removeOnFail: { age: 3600 },
};

// El id determinista hace que reencolar la misma ronda no cree un recordatorio duplicado.
// BullMQ no admite ":" en ids personalizados.
// Evita duplicados con mismo id
export function reminderJobId(announcementId, round) {
  return `reminder-${announcementId}-${round}`;
}

// Create 3 queues using redis connection
export function createQueues(connection) {
  const reminders = new Queue(QUEUE_NAMES.reminders, { connection, defaultJobOptions: JOB_DEFAULTS });
  const notifications = new Queue(QUEUE_NAMES.notifications, { connection, defaultJobOptions: JOB_DEFAULTS });
  const maintenance = new Queue(QUEUE_NAMES.maintenance, { connection, defaultJobOptions: JOB_DEFAULTS });

  return {
    reminders,
    notifications,
    maintenance,
    // Prepare round of reminders
    enqueueReminder({ announcementId, round, delayMs }) {
      return reminders.add(
        'send-reminder',
        { announcementId, round },
        { jobId: reminderJobId(announcementId, round), delay: Math.max(0, delayMs) },
      );
    },
    enqueueNotifications(items) {
      if (items.length === 0) return Promise.resolve([]);
      return notifications.addBulk(items.map((data) => ({ name: 'notify', data })));
    },

    // Cerramos al apagar el servicio.
    async close() {
      await Promise.all([reminders.close(), notifications.close(), maintenance.close()]);
    },
  };
}
