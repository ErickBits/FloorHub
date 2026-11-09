import express from 'express';
import { authenticate } from './middleware/auth.js';
import { errorHandler } from './middleware/errors.js';
import { adminRoutes } from './routes/admin.js';
import { announcementRoutes } from './routes/announcements.js';
import { authRoutes } from './routes/auth.js';
import { directoryRoutes } from './routes/directory.js';
import { helpRequestRoutes } from './routes/helpRequests.js';
import { presenceRoutes } from './routes/presence.js';
import { notFound } from './errors.js';

export function createApp(context) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Nginx es el único proxy delante de la API.
  app.use(express.json({ limit: '64kb' }));

  // Vivo: el proceso responde. No toca dependencias para que una caída de la base no reinicie el pod.
  app.get('/livez', (_req, res) => res.json({ status: 'ok' }));

  // Listo: puede atender tráfico. PostgreSQL es indispensable; Redis solo degrada el servicio.
  app.get('/health', async (_req, res) => {
    const checks = { postgres: 'ok', redis: 'ok' };
    try {
      await context.pool.query('SELECT 1');
    } catch {
      checks.postgres = 'error';
    }
    try {
      await context.redis.ping();
    } catch {
      checks.redis = 'error';
    }
    const healthy = checks.postgres === 'ok';
    res.status(healthy ? 200 : 503).json({
      status: healthy ? (checks.redis === 'ok' ? 'ok' : 'degraded') : 'error',
      service: 'api',
      checks,
    });
  });

  const requireAuth = authenticate(context);
  app.use('/api/auth', authRoutes(context, requireAuth));
  app.use('/api/admin', requireAuth, adminRoutes(context));
  app.use('/api/announcements', requireAuth, announcementRoutes(context));
  app.use('/api/help-requests', requireAuth, helpRequestRoutes(context));
  app.use('/api/directory', requireAuth, directoryRoutes(context));
  app.use('/api/presence', requireAuth, presenceRoutes(context));

  app.use(() => {
    throw notFound('Ruta no encontrada');
  });
  app.use(errorHandler(context.log));
  return app;
}
