import { Router } from 'express';
import { onlineUsers } from '@floorhub/shared';
import { requireRole } from '../middleware/auth.js';

export function presenceRoutes({ pool, redis, log }) {
  const router = Router();

  router.get('/', requireRole('supervisor'), async (req, res) => {
    let online = [];
    try {
      online = await onlineUsers(redis, req.user.teamIds);
    } catch (error) {
      log.warn({ err: error.message }, 'Presencia no disponible');
    }
    const { rows } = await pool.query(
      `SELECT id, full_name, team_id FROM users
        WHERE role = 'agent' AND is_active AND team_id = ANY($1)
        ORDER BY full_name`,
      [req.user.teamIds],
    );
    const onlineIds = new Set(online);
    res.json({ agents: rows.map((agent) => ({ ...agent, online: onlineIds.has(agent.id) })) });
  });

  return router;
}
