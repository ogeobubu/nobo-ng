import { createApp } from './src/app.js';
import { config } from './src/config.js';
import { closePool, initializeDatabase } from './src/db.js';

const bootstrap = async () => {
  await initializeDatabase();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`Backend API running on http://localhost:${config.port}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

bootstrap().catch((error) => {
  console.error('Failed to start backend:', error);
  process.exit(1);
});
