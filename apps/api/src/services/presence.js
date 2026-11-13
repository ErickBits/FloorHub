import { onlineUsers } from '@floorhub/shared';

// Agentes de los equipos del supervisor con su estado. Si Redis falla, todos aparecen desconectados.
export async function listTeamPresence({ pool, redis, log }, user) {
  let online = [];
  try {
    online = await onlineUsers(redis, user.teamIds);
  } catch (error) {
    log.warn({ err: error.message }, 'Presencia no disponible');
  }
  const { rows } = await pool.query(
    `SELECT id, full_name, team_id FROM users
      WHERE role = 'agent' AND is_active AND team_id = ANY($1)
      ORDER BY full_name`,
    [user.teamIds],
  );
  const onlineIds = new Set(online);
  return rows.map((agent) => ({ ...agent, online: onlineIds.has(agent.id) }));
}
