import { Queue } from 'bullmq';
import { createQueueConnection } from '../config/redis.js';

export const SCAN_QUEUE = 'scans';

let queue = null;
let connection = null;

export function getScanQueue() {
  if (!queue) {
    connection = createQueueConnection();
    queue = new Queue(SCAN_QUEUE, {
      connection,
      defaultJobOptions: {
        // A crashed or failed scan is retried once after a short delay.
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    });
  }
  return queue;
}

export async function enqueueScan(scan) {
  // Using the scan id as the job id makes enqueueing idempotent.
  await getScanQueue().add('scan', { scanId: scan.id }, { jobId: scan.id });
}

export async function closeQueue() {
  if (queue) {
    await queue.close();
    await connection.quit().catch(() => {});
    queue = null;
    connection = null;
  }
}
