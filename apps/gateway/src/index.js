import { createContext, loadConfig } from '@floorhub/shared';
import { createGateway } from './server.js';

const config = loadConfig();
const context = createContext('gateway', config);
const gateway = createGateway(context);

gateway.httpServer.listen(config.port, () => {
  context.log.info({ port: config.port }, 'Gateway escuchando');
});

async function shutdown(signal) {
  context.log.info({ signal }, 'Cerrando gateway');
  await gateway.close();
  await context.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
