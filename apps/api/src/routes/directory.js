import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { getDirectory } from '../services/directory.js';

export function directoryRoutes(context) {
  const router = Router();

  router.get('/', requireRole('supervisor'), async (req, res) => {
    res.json(await getDirectory(context, req.user));
  });

  return router;
}
