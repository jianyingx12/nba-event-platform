import { startServer } from './server.js';

const app = await startServer();

const shutdown = (): void => {
  void app.close();
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
