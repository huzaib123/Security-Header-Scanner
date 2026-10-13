import { Worker } from 'bullmq';
import env from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createQueueConnection, closeRedis } from './config/redis.js';
import { SCAN_QUEUE } from './services/queue.js';
import { processScan } from './services/processScan.js';

// The worker runs as its own process (and its own Docker service), so slow
// scans never block the API. Jobs whose worker dies mid-scan are detected
// as stalled by BullMQ and handed to another worker.
export function startWorker() {
  const connection = createQueueConnection();
  const worker = new Worker(
    SCAN_QUEUE,
    async (job) => {
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      const scan = await processScan(job.data.scanId, { isLastAttempt });
      return { status: scan?.status, grade: scan?.grade ?? null };
    },
    { connection, concurrency: env.workerConcurrency },
  );

  worker.on('completed', (job, result) => {
    if (env.nodeEnv !== 'test') console.log(`Scan ${job.data.scanId} ${result.status} ${result.grade ?? ''}`.trim());
  });
  worker.on('failed', (job, err) => {
    if (env.nodeEnv !== 'test') console.warn(`Scan ${job?.data.scanId} attempt ${job?.attemptsMade} failed: ${err.message}`);
  });

  return {
    worker,
    async close() {
      await worker.close();
      await connection.quit().catch(() => {});
    },
  };
}

async function main() {
  await connectDB();
  console.log(`Scan worker started (concurrency ${env.workerConcurrency})`);
  const { close } = startWorker();

  const shutdown = async (signal) => {
    console.log(`${signal} received, finishing current scans`);
    await close();
    await Promise.all([disconnectDB(), closeRedis()]);
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Worker failed to start', err);
    process.exit(1);
  });
}
