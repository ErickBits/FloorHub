import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import {
  acknowledgeAnnouncement,
  announcementStatus,
  listForAgent,
  listForSupervisor,
  publishAnnouncement,
} from '../services/announcements.js';
import { forbidden } from '../errors.js';
import { shortText, uuidParam } from '../validation.js';

const idList = z.array(z.uuid()).max(500).default([]);

const publishSchema = z
  .object({
    title: shortText(200),
    body: shortText(5000),
    priority: z.enum(['info', 'critical']),
    reminderIntervalMinutes: z.number().int().min(1).max(240).optional(),
    expiresAt: z.iso.datetime({ offset: true }).optional(),
    targets: z.object({ campaignIds: idList, teamIds: idList, userIds: idList }),
  })
  .refine(
    ({ targets }) => targets.campaignIds.length + targets.teamIds.length + targets.userIds.length > 0,
    { path: ['targets'], message: 'Elige al menos un destino' },
  )
  .refine(
    ({ priority, reminderIntervalMinutes }) => priority !== 'critical' || reminderIntervalMinutes !== undefined,
    { path: ['reminderIntervalMinutes'], message: 'Un comunicado crítico necesita intervalo de recordatorio' },
  );

export function announcementRoutes(context) {
  const router = Router();

  router.post('/', requireRole('supervisor'), async (req, res) => {
    const announcement = await publishAnnouncement(context, req.user, publishSchema.parse(req.body));
    res.status(201).json({ announcement });
  });

  router.get('/', async (req, res) => {
    if (req.user.role === 'agent') return res.json({ announcements: await listForAgent(context, req.user) });
    if (req.user.role === 'supervisor') {
      return res.json({ announcements: await listForSupervisor(context, req.user) });
    }
    throw forbidden();
  });

  router.get('/:id/status', requireRole('supervisor'), async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    res.json({ status: await announcementStatus(context, req.user, id) });
  });

  router.post('/:id/ack', requireRole('agent'), async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    res.json(await acknowledgeAnnouncement(context, req.user, id));
  });

  return router;
}
