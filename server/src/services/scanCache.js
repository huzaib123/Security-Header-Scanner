import { getRedis } from '../config/redis.js';
import env from '../config/env.js';

const cacheKey = (key) => `shs:result:${key}`;
const inflightKey = (key) => `shs:inflight:${key}`;
const INFLIGHT_TTL = 120;

// Finished results are cached for SCAN_CACHE_TTL seconds (10 minutes), so
// the same address scanned again returns instantly without a new job.
export async function getCachedResult(key) {
  try {
    const raw = await getRedis().get(cacheKey(key));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function cacheResult(key, scan) {
  try {
    await getRedis().set(cacheKey(key), JSON.stringify(scan), 'EX', env.scanCacheTtl);
  } catch {
    // A cache write failure only means the next scan runs again.
  }
}

export async function cacheTtl(key) {
  try {
    return await getRedis().ttl(cacheKey(key));
  } catch {
    return -2;
  }
}

// While a scan of an address is queued or running, later requests for the
// same address get that scan instead of starting a duplicate.
// Returns the id of the scan already in flight, or null after claiming it.
export async function claimInflight(key, scanId) {
  try {
    const ok = await getRedis().set(inflightKey(key), scanId, 'EX', INFLIGHT_TTL, 'NX');
    if (ok) return null;
    return await getRedis().get(inflightKey(key));
  } catch {
    return null;
  }
}

export async function releaseInflight(key) {
  try {
    await getRedis().del(inflightKey(key));
  } catch {
    // Expires on its own after INFLIGHT_TTL.
  }
}
