import { cacheKeys } from '@floorhub/shared';
import { notFound } from '../errors.js';
import { buildUpdate } from './common.js';

export async function listCampaigns({ pool }) {
  const { rows } = await pool.query('SELECT * FROM campaigns ORDER BY name');
  return rows;
}

export async function createCampaign({ pool }, input) {
  const { rows } = await pool.query('INSERT INTO campaigns (name) VALUES ($1) RETURNING *', [input.name]);
  return rows[0];
}

export async function updateCampaign({ pool, cache }, id, input) {
  const update = buildUpdate({ name: input.name, is_active: input.isActive });
  const { rows } = await pool.query(
    `UPDATE campaigns SET ${update.assignments} WHERE id = $1 RETURNING *`,
    [id, ...update.values],
  );
  if (rows.length === 0) throw notFound('Campaña no encontrada');
  // El listado de equipos incluye el nombre de la campaña.
  await cache.invalidate(cacheKeys.teams());
  return rows[0];
}
