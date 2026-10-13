// Load server/.env for local runs (Node 20.12+ built-in). In Docker the
// variables come from docker compose instead, so a missing file is fine.
try {
  process.loadEnvFile();
} catch {
  // No .env file present.
}

const num = (value, fallback) => (Number.isFinite(Number(value)) && value !== '' && value !== undefined ? Number(value) : fallback);

const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 5060),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shs',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:8090',
  trustProxy: num(process.env.TRUST_PROXY, 0),
  scanCacheTtl: num(process.env.SCAN_CACHE_TTL, 600),
  scanRateLimit: num(process.env.SCAN_RATE_LIMIT, 10),
  scanRateWindow: num(process.env.SCAN_RATE_WINDOW, 60),
  scanTimeoutMs: num(process.env.SCAN_TIMEOUT_MS, 10000),
  workerConcurrency: num(process.env.WORKER_CONCURRENCY, 5),
  // Only honoured in tests, so the suite can scan a local HTTP server.
  allowPrivateTargets: process.env.NODE_ENV === 'test' && process.env.SCANNER_ALLOW_PRIVATE === 'true',
});

export default env;
