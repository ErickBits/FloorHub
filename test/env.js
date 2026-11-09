// Valores solo para tests. La base y el índice de Redis son exclusivos para no tocar el entorno de desarrollo.
const pgHost = process.env.TEST_PG_HOST ?? '127.0.0.1:5433';
const owner = process.env.TEST_PG_OWNER ?? 'floorhub_owner:floorhub_owner_dev';

export const TEST_DB = 'floorhub_test';
export const adminUrl = `postgres://${owner}@${pgHost}/postgres`;
export const ownerUrl = `postgres://${owner}@${pgHost}/${TEST_DB}`;
export const appUrl = `postgres://floorhub_app:floorhub_app_dev@${pgHost}/${TEST_DB}`;
export const redisUrl = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6380/1';
