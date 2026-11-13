import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { runner } from 'node-pg-migrate';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/* Arma la configuracion de conexion */
export function connectionFor(url) {
  const caFile = process.env.DB_SSL_CA_FILE;
  return {
    connectionString: url,
    ...(caFile ? { ssl: { ca: readFileSync(caFile, 'utf8'), rejectUnauthorized: true } } : {}),
  };
}

// Esperar a la base evita que el Job falle si arranca antes que PostgreSQL.
async function waitForDatabase(connection, attempts = 30) {
  for (let attempt = 1; ; attempt += 1) {
    const client = new pg.Client(connection);
    try {
      await client.connect();
      await client.query('SELECT 1');
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      console.log(JSON.stringify({ msg: 'Esperando a PostgreSQL', attempt }));
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } finally {
      await client.end().catch(() => {});
    }
  }
}

// El rol de el usuario de la base de datos en la aplicación se crea antes de las migraciones porque estas le conceden permisos.
async function ensureAppRole(connection, appUrl) {
  const { username, password } = new URL(appUrl);
  const client = new pg.Client(connection);
  await client.connect();
  try {
    const role = decodeURIComponent(username);
    const secret = decodeURIComponent(password);
    const { rows } = await client.query(
      'SELECT format($1, $2::text, $3::text) AS statement',
      ['ROLE %I LOGIN PASSWORD %L', role, secret],
    );
    const exists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
    await client.query(`${exists.rowCount ? 'ALTER' : 'CREATE'} ${rows[0].statement}`);
  } finally {
    await client.end();
  }
}

export async function migrate({
  ownerUrl = process.env.MIGRATION_DATABASE_URL,
  appUrl = process.env.DATABASE_URL,
} = {}) {
  if (!ownerUrl || !appUrl) throw new Error('Faltan MIGRATION_DATABASE_URL o DATABASE_URL');
  const connection = connectionFor(ownerUrl);
  await waitForDatabase(connection);
  await ensureAppRole(connection, appUrl);
  await runner({
    databaseUrl: connection,
    dir: migrationsDir,
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log: () => {},
  });
}
