import http from 'node:http';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { getRedis, waitForRedis, closeRedis } from '../src/config/redis.js';
import { closeQueue, getScanQueue } from '../src/services/queue.js';

export async function setupStores() {
  await connectDB(process.env.MONGO_URI);
  await mongoose.connection.db.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  await waitForRedis();
  await getRedis().flushdb();
}

export async function resetStores() {
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
  await getScanQueue().obliterate({ force: true });
  await getRedis().flushdb();
}

export async function teardownStores() {
  await mongoose.connection.db.dropDatabase();
  await disconnectDB();
  await closeQueue();
  await getRedis().flushdb();
  await closeRedis();
}

// A tiny "website" on localhost whose response headers the test controls.
export async function startTargetSite(headers) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, headers);
    res.end('<h1>test site</h1>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() };
}

export async function waitForScan(app, request, id, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await request(app).get(`/api/scans/${id}`);
    if (['completed', 'failed'].includes(res.body.data.status)) return res.body.data;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Scan ${id} did not finish in ${timeoutMs}ms`);
}
