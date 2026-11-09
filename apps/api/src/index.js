import { createContext, loadConfig } from '@floorhub/shared';
import { createApp } from './app.js';

const config = loadConfig();
const context = createContext('api', config);
const server = createApp(context).listen(config.port, () => {
  context.log.info({ port: config.port }, 'API escuchando');
});

async function shutdown(signal) {
  context.log.info({ signal }, 'Cerrando API');
  server.close(async () => {
    await context.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
