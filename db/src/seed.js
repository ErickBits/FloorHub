import bcrypt from 'bcrypt';
import pg from 'pg';
import { connectionFor } from './migrate.js';

const ADMIN = { fullName: 'Andrés Felipe Morales', email: 'andres.morales@floorhub.com' };

const CAMPAIGNS = [
  {
    name: 'Telecomunicaciones Andina',
    teams: [
      {
        name: 'Retención',
        supervisor: { fullName: 'Laura Valentina Gómez', email: 'laura.gomez@floorhub.com' },
        agents: [
          { fullName: 'Santiago Ramírez', email: 'santiago.ramirez@floorhub.com' },
          { fullName: 'Daniela Ospina', email: 'daniela.ospina@floorhub.com' },
          { fullName: 'Camilo Rincón', email: 'camilo.rincon@floorhub.com' },
        ],
      },
      {
        name: 'Soporte técnico',
        supervisor: { fullName: 'Julián Andrés Herrera', email: 'julian.herrera@floorhub.com' },
        agents: [
          { fullName: 'Valentina Muñoz', email: 'valentina.munoz@floorhub.com' },
          { fullName: 'Sebastián Cárdenas', email: 'sebastian.cardenas@floorhub.com' },
          { fullName: 'Mariana López', email: 'mariana.lopez@floorhub.com' },
        ],
      },
    ],
  },
  {
    name: 'Banco del Valle',
    teams: [
      {
        name: 'Tarjetas',
        supervisor: { fullName: 'Paola Andrea Castaño', email: 'paola.castano@floorhub.com' },
        agents: [
          { fullName: 'Felipe Arango', email: 'felipe.arango@floorhub.com' },
          { fullName: 'Natalia Quintero', email: 'natalia.quintero@floorhub.com' },
          { fullName: 'Juan David Mejía', email: 'juan.mejia@floorhub.com' },
        ],
      },
    ],
  },
];

async function upsertUser(client, { email, fullName, role, teamId = null, passwordHash }) {
  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash, full_name, role, team_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (lower(email)) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name,
           is_active = true, updated_at = now()
     RETURNING id`,
    [email, passwordHash, fullName, role, teamId],
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
    await upsertUser(client, { ...ADMIN, role: 'admin', passwordHash });
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
          ...team.supervisor, role: 'supervisor', passwordHash,
        });
        await client.query(
          'INSERT INTO team_supervisors (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [teamId, supervisorId],
        );
        for (const agent of team.agents) {
          await upsertUser(client, { ...agent, role: 'agent', teamId, passwordHash });
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
