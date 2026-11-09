import { readFileSync } from 'node:fs';
import pg from 'pg';

// Con un archivo CA, la conexión exige TLS y verifica el certificado del servidor (RDS).
export function createPool(config, log) {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: config.dbPoolMax,
    ...(config.dbSslCaFile
      ? { ssl: { ca: readFileSync(config.dbSslCaFile, 'utf8'), rejectUnauthorized: true } }
      : {}),
  });
  // Sin este listener, un error en una conexión inactiva tumbaría el proceso.
  pool.on('error', (error) => log.error({ err: error }, 'Error en una conexión inactiva de PostgreSQL'));
  return pool;
}

export async function withTransaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
