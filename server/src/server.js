import env from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { closeRedis } from './config/redis.js';
import { closeQueue } from './services/queue.js';
import { createApp } from './app.js';

async function start() {
  await connectDB();
  console.log('Connected to MongoDB');

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`API listening on port ${env.port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await Promise.all([disconnectDB(), closeQueue(), closeRedis()]);
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
