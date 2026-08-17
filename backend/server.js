import { createApp } from './src/app.js';
import { config } from './src/config.js';
import { closePool, initializeDatabase } from './src/db.js';

const bootstrap = async () => {
  let dbReady = true;

  try {
    await initializeDatabase();
  } catch (error) {
    dbReady = false;
    console.warn(`MySQL is unavailable. Starting API in degraded mode: ${error.message}`);
  }

  const app = createApp({ dbReady });
  const server = app.listen(config.port, config.host, () => {
    console.log(`Backend API running on http://${config.host}:${config.port}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      if (dbReady) {
        await closePool();
      }
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
