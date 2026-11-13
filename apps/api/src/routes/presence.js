import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { listTeamPresence } from '../services/presence.js';

export function presenceRoutes(context) {
  const router = Router();

  router.get('/', requireRole('supervisor'), async (req, res) => {
    res.json({ agents: await listTeamPresence(context, req.user) });
  });

  return router;
}
