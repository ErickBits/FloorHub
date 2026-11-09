import jwt from 'jsonwebtoken';
import { cacheKeys } from './cache.js';

const SCOPE_TTL_SECONDS = 60;

// El alcance decide a qué equipos y campañas accede un usuario, en REST y en WebSocket.
async function loadUserScope(pool, userId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.role, u.is_active,
            COALESCE(array_agg(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL), '{}') AS team_ids,
            COALESCE(array_agg(DISTINCT t.campaign_id) FILTER (WHERE t.id IS NOT NULL), '{}') AS campaign_ids
       FROM users u
       LEFT JOIN team_supervisors ts ON ts.user_id = u.id
       LEFT JOIN teams t ON t.id = u.team_id OR t.id = ts.team_id
      WHERE u.id = $1
      GROUP BY u.id`,
    [userId],
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    teamIds: row.team_ids,
    campaignIds: row.campaign_ids,
  };
}

export function getUserScope({ pool, cache }, userId) {
  return cache.getOrSet(cacheKeys.userScope(userId), SCOPE_TTL_SECONDS, () => loadUserScope(pool, userId));
}

// Devuelve el alcance del dueño del token, o null si el token o el usuario ya no son válidos.
export async function authenticateToken(context, token) {
  let payload;
  try {
    payload = jwt.verify(token, context.config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
  const scope = await getUserScope(context, payload.sub);
  return scope?.isActive ? scope : null;
}

export function signToken(config, userId) {
  return jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS256',
    subject: userId,
    expiresIn: config.jwtExpiresIn,
  });
}
