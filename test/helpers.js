import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import pg from 'pg';
import { createContext, loadConfig, signToken } from '@floorhub/shared';
import { appUrl, ownerUrl, redisUrl } from './env.js';

const PASSWORD_HASH = bcrypt.hashSync('password-de-prueba', 4);
export const TEST_PASSWORD = 'password-de-prueba';

export function createTestContext(service = 'test') {
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: appUrl,
    REDIS_URL: redisUrl,
    JWT_SECRET: 'secreto-solo-para-tests-de-floorhub-123456',
    BCRYPT_ROUNDS: '4',
    LOGIN_RATE_LIMIT_PER_MINUTE: '5',
    HELP_RATE_LIMIT_PER_MINUTE: '3',
    REMINDER_MAX_ROUNDS: '2',
  });
  return createContext(service, config);
}

export async function redisReady(context) {
  if (context.redis.status === 'ready') return;
  await new Promise((resolve) => context.redis.once('ready', resolve));
}

// Cada test crea sus propios datos: así los tests no dependen del orden ni se pisan en paralelo.
export async function createOrg(context) {
  const { pool, config } = context;
  const suffix = randomUUID().slice(0, 8);
  const insertUser = async (handle, role, teamId = null) => {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, team_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role, team_id`,
      [`${handle}-${suffix}@floorhub.test`, PASSWORD_HASH, `${handle} ${suffix}`, role, teamId],
    );
    return { ...rows[0], token: signToken(config, rows[0].id) };
  };
  const insertTeam = async (campaignId, name) => {
    const { rows } = await pool.query(
      'INSERT INTO teams (campaign_id, name) VALUES ($1, $2) RETURNING id',
      [campaignId, name],
    );
    return rows[0].id;
  };

  const { rows: [campaign] } = await pool.query(
    'INSERT INTO campaigns (name) VALUES ($1) RETURNING id',
    [`Campaña ${suffix}`],
  );
  const { rows: [otherCampaign] } = await pool.query(
    'INSERT INTO campaigns (name) VALUES ($1) RETURNING id',
    [`Otra campaña ${suffix}`],
  );
  const teamId = await insertTeam(campaign.id, 'Equipo A');
  const otherTeamId = await insertTeam(otherCampaign.id, 'Equipo B');

  const supervisor = await insertUser('supervisor', 'supervisor');
  const supervisor2 = await insertUser('supervisor2', 'supervisor');
  const otherSupervisor = await insertUser('otro-supervisor', 'supervisor');
  await pool.query(
    'INSERT INTO team_supervisors (team_id, user_id) VALUES ($1, $2), ($1, $3), ($4, $5)',
    [teamId, supervisor.id, supervisor2.id, otherTeamId, otherSupervisor.id],
  );

  return {
    campaignId: campaign.id,
    otherCampaignId: otherCampaign.id,
    teamId,
    otherTeamId,
    admin: await insertUser('admin', 'admin'),
    supervisor,
    supervisor2,
    otherSupervisor,
    agent: await insertUser('agente', 'agent', teamId),
    agent2: await insertUser('agente2', 'agent', teamId),
    otherAgent: await insertUser('otro-agente', 'agent', otherTeamId),
  };
}

export const bearer = (user) => ({ Authorization: `Bearer ${user.token}` });

export function ownerClient() {
  return new pg.Client(ownerUrl);
}
