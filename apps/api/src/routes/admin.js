import bcrypt from 'bcrypt';
import { Router } from 'express';
import { z } from 'zod';
import { cacheKeys, rooms, withTransaction } from '@floorhub/shared';
import { notFound } from '../errors.js';
import { requireRole } from '../middleware/auth.js';
import { email, password, shortText, uuidParam } from '../validation.js';

const TEAMS_TTL_SECONDS = 300;

const campaignCreate = z.object({ name: shortText(120) });
const campaignUpdate = z.object({ name: shortText(120).optional(), isActive: z.boolean().optional() });
const teamCreate = z.object({ campaignId: z.uuid(), name: shortText(120) });
const teamUpdate = z.object({ name: shortText(120).optional(), isActive: z.boolean().optional() });
const supervisorsUpdate = z.object({ userIds: z.array(z.uuid()).max(50) });
const userCreate = z.object({
  email,
  password,
  fullName: shortText(120),
  role: z.enum(['agent', 'supervisor', 'admin']),
  teamId: z.uuid().nullable().optional(),
});
const userUpdate = z.object({
  fullName: shortText(120).optional(),
  role: z.enum(['agent', 'supervisor', 'admin']).optional(),
  teamId: z.uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  password: password.optional(),
});

const publicUserColumns = 'id, email, full_name, role, team_id, is_active, created_at, updated_at';

// Construye un UPDATE solo con los campos enviados; los nombres de columna vienen de este código.
function buildUpdate(fields) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  return {
    assignments: entries.map(([column], index) => `${column} = $${index + 2}`).join(', '),
    values: entries.map(([, value]) => value),
    isEmpty: entries.length === 0,
  };
}

export function adminRoutes(context) {
  const { pool, cache, emitter } = context;
  const router = Router();
  router.use(requireRole('admin'));

  const invalidateTeams = () => cache.invalidate(cacheKeys.teams());

  // Al cambiar el alcance se cierra el socket para que reconecte con las salas correctas.
  const refreshUserAccess = async (userIds) => {
    await cache.invalidate(...userIds.map(cacheKeys.userScope));
    for (const userId of userIds) {
      context.background(
        Promise.resolve(emitter.in(rooms.user(userId)).disconnectSockets(true)),
        'No se pudo desconectar al usuario',
      );
    }
  };

  router.get('/campaigns', async (_req, res) => {
    const { rows } = await pool.query('SELECT * FROM campaigns ORDER BY name');
    res.json({ campaigns: rows });
  });

  router.post('/campaigns', async (req, res) => {
    const body = campaignCreate.parse(req.body);
    const { rows } = await pool.query('INSERT INTO campaigns (name) VALUES ($1) RETURNING *', [body.name]);
    res.status(201).json({ campaign: rows[0] });
  });

  router.patch('/campaigns/:id', async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    const body = campaignUpdate.parse(req.body);
    const update = buildUpdate({ name: body.name, is_active: body.isActive });
    if (update.isEmpty) return res.status(400).json({ error: { code: 'empty_update', message: 'No hay cambios' } });
    const { rows } = await pool.query(
      `UPDATE campaigns SET ${update.assignments} WHERE id = $1 RETURNING *`,
      [id, ...update.values],
    );
    if (rows.length === 0) throw notFound('Campaña no encontrada');
    await invalidateTeams();
    return res.json({ campaign: rows[0] });
  });

  router.get('/teams', async (_req, res) => {
    const teams = await cache.getOrSet(cacheKeys.teams(), TEAMS_TTL_SECONDS, async () => {
      const { rows } = await pool.query(
        `SELECT t.*, c.name AS campaign_name,
                COALESCE(json_agg(json_build_object('id', u.id, 'full_name', u.full_name))
                         FILTER (WHERE u.id IS NOT NULL), '[]') AS supervisors
           FROM teams t
           JOIN campaigns c ON c.id = t.campaign_id
           LEFT JOIN team_supervisors ts ON ts.team_id = t.id
           LEFT JOIN users u ON u.id = ts.user_id
          GROUP BY t.id, c.name
          ORDER BY c.name, t.name`,
      );
      return rows;
    });
    res.json({ teams });
  });

  router.post('/teams', async (req, res) => {
    const body = teamCreate.parse(req.body);
    const { rows } = await pool.query(
      'INSERT INTO teams (campaign_id, name) VALUES ($1, $2) RETURNING *',
      [body.campaignId, body.name],
    );
    await invalidateTeams();
    res.status(201).json({ team: rows[0] });
  });

  router.patch('/teams/:id', async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    const body = teamUpdate.parse(req.body);
    const update = buildUpdate({ name: body.name, is_active: body.isActive });
    if (update.isEmpty) return res.status(400).json({ error: { code: 'empty_update', message: 'No hay cambios' } });
    const { rows } = await pool.query(
      `UPDATE teams SET ${update.assignments} WHERE id = $1 RETURNING *`,
      [id, ...update.values],
    );
    if (rows.length === 0) throw notFound('Equipo no encontrado');
    await invalidateTeams();
    return res.json({ team: rows[0] });
  });

  router.put('/teams/:id/supervisors', async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    const { userIds } = supervisorsUpdate.parse(req.body);
    const affected = await withTransaction(pool, async (client) => {
      const team = await client.query('SELECT id FROM teams WHERE id = $1 FOR UPDATE', [id]);
      if (team.rowCount === 0) throw notFound('Equipo no encontrado');
      const valid = await client.query(
        "SELECT id FROM users WHERE id = ANY($1) AND role = 'supervisor'",
        [userIds],
      );
      if (valid.rowCount !== new Set(userIds).size) {
        throw notFound('Algún usuario no existe o no es supervisor');
      }
      const previous = await client.query('DELETE FROM team_supervisors WHERE team_id = $1 RETURNING user_id', [id]);
      await client.query(
        'INSERT INTO team_supervisors (team_id, user_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING',
        [id, userIds],
      );
      return [...new Set([...previous.rows.map((row) => row.user_id), ...userIds])];
    });
    await invalidateTeams();
    await refreshUserAccess(affected);
    res.json({ teamId: id, userIds });
  });

  router.get('/users', async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.team_id, u.is_active, t.name AS team_name
         FROM users u LEFT JOIN teams t ON t.id = u.team_id
        ORDER BY u.role, u.full_name`,
    );
    res.json({ users: rows });
  });

  router.post('/users', async (req, res) => {
    const body = userCreate.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, context.config.bcryptRounds);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, team_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${publicUserColumns}`,
      [body.email, passwordHash, body.fullName, body.role, body.teamId ?? null],
    );
    res.status(201).json({ user: rows[0] });
  });

  router.patch('/users/:id', async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    const body = userUpdate.parse(req.body);
    const update = buildUpdate({
      full_name: body.fullName,
      role: body.role,
      team_id: body.teamId,
      is_active: body.isActive,
      password_hash: body.password ? await bcrypt.hash(body.password, context.config.bcryptRounds) : undefined,
    });
    if (update.isEmpty) return res.status(400).json({ error: { code: 'empty_update', message: 'No hay cambios' } });
    const { rows } = await pool.query(
      `UPDATE users SET ${update.assignments}, updated_at = now() WHERE id = $1 RETURNING ${publicUserColumns}`,
      [id, ...update.values],
    );
    if (rows.length === 0) throw notFound('Usuario no encontrado');
    await refreshUserAccess([id]);
    return res.json({ user: rows[0] });
  });

  return router;
}
