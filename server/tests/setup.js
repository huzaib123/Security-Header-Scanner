// Loaded with --import before any test file so config reads test values.
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/shs_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6379/14';
process.env.SCANNER_ALLOW_PRIVATE = 'true';
process.env.SCAN_TIMEOUT_MS = '3000';
