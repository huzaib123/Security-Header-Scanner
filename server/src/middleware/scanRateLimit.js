import { getRedis } from '../config/redis.js';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

// Fixed-window limit stored in Redis: one counter per IP per window, with
// INCR and EXPIRE in one MULTI so the key never lives without a TTL.
// Because the counter is in Redis, every API instance shares the limit.
export async function scanRateLimit(req, res, next) {
  const windowSeconds = env.scanRateWindow;
  const limit = env.scanRateLimit;
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  const key = `shs:ratelimit:${req.ip}:${windowStart}`;

  let count;
  try {
    const [[, value]] = await getRedis().multi().incr(key).expire(key, windowSeconds).exec();
    count = value;
  } catch {
    // If Redis is down, allow the request rather than block every user.
    return next();
  }

  const resetIn = windowStart + windowSeconds - Math.floor(Date.now() / 1000);
  res.set('RateLimit-Limit', String(limit));
  res.set('RateLimit-Remaining', String(Math.max(0, limit - count)));
  res.set('RateLimit-Reset', String(resetIn));

  if (count > limit) {
    res.set('Retry-After', String(resetIn));
    return next(ApiError.tooManyRequests(`Limit of ${limit} scans per minute reached. Try again in ${resetIn}s.`));
  }
  return next();
}
