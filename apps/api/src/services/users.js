import bcrypt from 'bcrypt';
import { notFound } from '../errors.js';
import { buildUpdate, refreshUserAccess } from './common.js';

// Nunca se devuelve password_hash.
const PUBLIC_USER_COLUMNS = 'id, email, full_name, role, team_id, is_active, created_at, updated_at';

export async function listUsers({ pool }) {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.role, u.team_id, u.is_active, t.name AS team_name
       FROM users u LEFT JOIN teams t ON t.id = u.team_id
      ORDER BY u.role, u.full_name`,
  );
  return rows;
}

export async function createUser({ pool, config }, input) {
  const passwordHash = await bcrypt.hash(input.password, config.bcryptRounds);
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role, team_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING ${PUBLIC_USER_COLUMNS}`,
    [input.email, passwordHash, input.fullName, input.role, input.teamId ?? null],
  );
  return rows[0];
}

// Cambiar rol, equipo o estado altera el alcance, así que se refresca el acceso del usuario.
export async function updateUser(context, id, input) {
  const update = buildUpdate({
    full_name: input.fullName,
    role: input.role,
    team_id: input.teamId,
    is_active: input.isActive,
    password_hash: input.password ? await bcrypt.hash(input.password, context.config.bcryptRounds) : undefined,
  });
  const { rows } = await context.pool.query(
    `UPDATE users SET ${update.assignments}, updated_at = now() WHERE id = $1 RETURNING ${PUBLIC_USER_COLUMNS}`,
    [id, ...update.values],
  );
  if (rows.length === 0) throw notFound('Usuario no encontrado');
  await refreshUserAccess(context, [id]);
  return rows[0];
}
