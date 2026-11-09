import { migrate } from './migrate.js';
import { seed } from './seed.js';

const command = process.argv[2] ?? 'all';
const log = (msg) => console.log(JSON.stringify({ service: 'db', msg }));

try {
  if (command === 'migrate' || command === 'all') {
    await migrate();
    log('Migraciones aplicadas');
  }
  if (command === 'seed' || command === 'all') {
    await seed();
    log('Seed aplicado');
  }
} catch (error) {
  console.error(JSON.stringify({ service: 'db', level: 'error', msg: error.message }));
  process.exit(1);
}
