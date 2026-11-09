import bcrypt from 'bcrypt';
import pg from 'pg';
import { connectionFor } from './migrate.js';

const CAMPAIGNS = [
  {
    name: 'Telecomunicaciones Andina',
    teams: [
      { name: 'Retención', supervisor: 'supervisor1', agents: ['agente1', 'agente2', 'agente3'] },
      { name: 'Soporte técnico', supervisor: 'supervisor2', agents: ['agente4', 'agente5', 'agente6'] },
    ],
  },
  {
    name: 'Banco del Valle',
    teams: [
      { name: 'Tarjetas', supervisor: 'supervisor3', agents: ['agente7', 'agente8', 'agente9'] },
    ],
  },
];

function displayName(handle) {
  const number = handle.match(/\d+$/)?.[0] ?? '';
  const base = handle.replace(/\d+$/, '');
  return `${base[0].toUpperCase()}${base.slice(1)} ${number}`.trim();
}

async function upsertUser(client, { handle, role, teamId = null, passwordHash }) {
  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash, full_name, role, team_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (lower(email)) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, is_active = true, updated_at = now()
     RETURNING id`,
    [`${handle}@floorhub.test`, passwordHash, displayName(handle), role, teamId],
  );
  return rows[0].id;
}

// Es idempotente: ejecutarlo de nuevo no duplica datos ni borra el historial.
export async function seed({
  ownerUrl = process.env.MIGRATION_DATABASE_URL,
  password = process.env.SEED_PASSWORD,
} = {}) {
  if (!password) throw new Error('Falta SEED_PASSWORD');
  const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS ?? 10));
  const client = new pg.Client(connectionFor(ownerUrl));
  await client.connect();
  try {
    await client.query('BEGIN');
    await upsertUser(client, { handle: 'admin', role: 'admin', passwordHash });
    for (const campaign of CAMPAIGNS) {
      const { rows: [{ id: campaignId }] } = await client.query(
        `INSERT INTO campaigns (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [campaign.name],
      );
      for (const team of campaign.teams) {
        const { rows: [{ id: teamId }] } = await client.query(
          `INSERT INTO teams (campaign_id, name) VALUES ($1, $2)
           ON CONFLICT (campaign_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [campaignId, team.name],
        );
        const supervisorId = await upsertUser(client, {
          handle: team.supervisor, role: 'supervisor', passwordHash,
        });
        await client.query(
          'INSERT INTO team_supervisors (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [teamId, supervisorId],
        );
        for (const handle of team.agents) {
          await upsertUser(client, { handle, role: 'agent', teamId, passwordHash });
        }
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
