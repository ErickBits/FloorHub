import { cacheKeys, withTransaction } from '@floorhub/shared';
import { notFound } from '../errors.js';
import { buildUpdate, refreshUserAccess } from './common.js';

const TEAMS_TTL_SECONDS = 300;

export function listTeams({ pool, cache }) {
  return cache.getOrSet(cacheKeys.teams(), TEAMS_TTL_SECONDS, async () => {
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
}

export async function createTeam({ pool, cache }, input) {
  const { rows } = await pool.query(
    'INSERT INTO teams (campaign_id, name) VALUES ($1, $2) RETURNING *',
    [input.campaignId, input.name],
  );
  await cache.invalidate(cacheKeys.teams());
  return rows[0];
}

export async function updateTeam({ pool, cache }, id, input) {
  const update = buildUpdate({ name: input.name, is_active: input.isActive });
  const { rows } = await pool.query(
    `UPDATE teams SET ${update.assignments} WHERE id = $1 RETURNING *`,
    [id, ...update.values],
  );
  if (rows.length === 0) throw notFound('Equipo no encontrado');
  await cache.invalidate(cacheKeys.teams());
  return rows[0];
}

// Reemplaza los supervisores del equipo. Pierden y ganan alcance tanto los anteriores como los nuevos.
export async function setTeamSupervisors(context, id, userIds) {
  const affected = await withTransaction(context.pool, async (client) => {
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
  await context.cache.invalidate(cacheKeys.teams());
  await refreshUserAccess(context, affected);
}
