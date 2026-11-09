import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';

// Lo que un supervisor puede elegir como destino de un comunicado.
export function directoryRoutes({ pool }) {
  const router = Router();

  router.get('/', requireRole('supervisor'), async (req, res) => {
    const [campaigns, teams, agents] = await Promise.all([
      pool.query('SELECT id, name FROM campaigns WHERE id = ANY($1) ORDER BY name', [req.user.campaignIds]),
      pool.query('SELECT id, name, campaign_id FROM teams WHERE id = ANY($1) ORDER BY name', [req.user.teamIds]),
      pool.query(
        `SELECT id, full_name, team_id FROM users
          WHERE role = 'agent' AND is_active AND team_id = ANY($1)
          ORDER BY full_name`,
        [req.user.teamIds],
      ),
    ]);
    res.json({ campaigns: campaigns.rows, teams: teams.rows, agents: agents.rows });
  });

  return router;
}
