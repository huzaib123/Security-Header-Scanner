import Redis from 'ioredis';
import env from './env.js';

let client = null;

// General client for the cache and rate limiter. Commands fail fast while
// Redis is down instead of queueing, so callers can decide to fail open.
export function getRedis() {
  if (!client) {
    client = new Redis(env.redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
    client.on('error', (err) => {
      if (env.nodeEnv !== 'test') console.warn(`Redis error: ${err.message}`);
    });
  }
  return client;
}

// BullMQ needs its own connections with unlimited retries so a worker
// waiting for jobs survives a Redis restart.
export function createQueueConnection() {
  const conn = new Redis(env.redisUrl, { maxRetriesPerRequest: null });
  conn.on('error', (err) => {
    if (env.nodeEnv !== 'test') console.warn(`Redis (queue) error: ${err.message}`);
  });
  return conn;
}

export async function waitForRedis() {
  const redis = getRedis();
  if (redis.status === 'ready') return;
  await new Promise((resolve) => {
    redis.once('ready', resolve);
    redis.once('error', resolve);
  });
}

export async function closeRedis() {
  if (client) {
    await client.quit().catch(() => {});
    client = null;
  }
}
