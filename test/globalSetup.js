import pg from 'pg';
import { migrate } from '../db/src/migrate.js';
import { adminUrl, appUrl, ownerUrl, TEST_DB } from './env.js';

export default async function setup() {
  const admin = new pg.Client(adminUrl);
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();
  await migrate({ ownerUrl, appUrl });
}
