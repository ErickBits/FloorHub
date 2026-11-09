import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { claimRequest, createRequest, listRequests, resolveRequest } from '../services/helpRequests.js';
import { shortText, uuidParam } from '../validation.js';

const createSchema = z.object({
  type: z.enum(['approval', 'difficult_customer', 'process_question']),
  summary: shortText(500),
});

export function helpRequestRoutes(context) {
  const router = Router();
  const limiter = rateLimit(context, {
    name: 'help',
    limit: context.config.helpRateLimit,
    key: (req) => req.user.id,
  });

  router.post('/', requireRole('agent'), limiter, async (req, res) => {
    const request = await createRequest(context, req.user, createSchema.parse(req.body));
    res.status(201).json({ request });
  });

  router.get('/', requireRole('agent', 'supervisor'), async (req, res) => {
    res.json({ requests: await listRequests(context, req.user) });
  });

  router.post('/:id/claim', requireRole('supervisor'), async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    res.json({ request: await claimRequest(context, req.user, id) });
  });

  router.post('/:id/resolve', requireRole('supervisor'), async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    res.json({ request: await resolveRequest(context, req.user, id) });
  });

  return router;
}
