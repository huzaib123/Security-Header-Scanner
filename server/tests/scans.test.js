import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { startWorker } from '../src/worker.js';
import { cacheTtl } from '../src/services/scanCache.js';
import { setupStores, resetStores, teardownStores, startTargetSite, waitForScan } from './helpers.js';

const app = createApp();
const post = (url) => request(app).post('/api/scans').send({ url });

describe('scan API', () => {
  let site;
  let worker;

  before(async () => {
    await setupStores();
    site = await startTargetSite({ server: 'Apache/2.4.41', 'x-content-type-options': 'nosniff' });
  });
  after(async () => {
    site.close();
    await teardownStores();
  });
  beforeEach(resetStores);

  test('rejects missing, malformed and non-http addresses', async () => {
    for (const body of [{}, { url: 42 }, { url: 'not a url' }, { url: 'ftp://example.com' }]) {
      const res = await request(app).post('/api/scans').send(body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  test('queues a scan and answers at once with 202', async () => {
    const res = await post(site.url);
    assert.equal(res.status, 202);
    assert.equal(res.body.data.status, 'queued');
    assert.equal(res.body.cached, false);
    assert.equal(res.headers.location, `/api/scans/${res.body.data.id}`);
  });

  test('the worker completes the scan and the result has a grade and fixes', async () => {
    worker = startWorker();
    try {
      const { body } = await post(site.url);
      const scan = await waitForScan(app, request, body.data.id);
      assert.equal(scan.status, 'completed');
      assert.equal(scan.grade, 'F');
      assert.equal(scan.httpsAvailable, false);
      const server = scan.checks.find((c) => c.id === 'server');
      assert.equal(server.status, 'fail');
      assert.match(server.fix, /version/);
      assert.equal(scan.headers.server, 'Apache/2.4.41');
    } finally {
      await worker.close();
    }
  });

  test('a second scan of the same address within 10 minutes comes from the Redis cache', async () => {
    worker = startWorker();
    try {
      const first = await post(site.url);
      await waitForScan(app, request, first.body.data.id);

      const started = Date.now();
      const second = await post(site.url.replace('http://', 'HTTP://'));
      assert.equal(second.status, 200);
      assert.equal(second.body.cached, true);
      assert.equal(second.headers['x-cache'], 'HIT');
      assert.equal(second.body.data.id, first.body.data.id);
      assert.ok(Date.now() - started < 500);

      const ttl = await cacheTtl(first.body.data.key);
      assert.ok(ttl > 0 && ttl <= 600, `ttl ${ttl}`);
    } finally {
      await worker.close();
    }
  });

  test('a repeat request while a scan is still queued reuses it instead of queueing a duplicate', async () => {
    const first = await post(site.url);
    const second = await post(site.url);
    assert.equal(second.status, 202);
    assert.equal(second.body.deduplicated, true);
    assert.equal(second.body.data.id, first.body.data.id);
  });

  test('the 11th scan request in a minute from one IP is refused with 429', async () => {
    const statuses = [];
    for (let i = 0; i < 11; i += 1) {
      const res = await post(`https://site-${i}.example.com/`);
      statuses.push(res.status);
      if (i === 10) {
        assert.ok(Number(res.headers['retry-after']) > 0);
        assert.match(res.body.error.message, /10 scans per minute/);
      }
    }
    // .example.com does not resolve, so allowed requests fail validation (400)
    // but still count; only the 11th is rate limited.
    assert.equal(statuses.filter((s) => s === 429).length, 1);
    assert.equal(statuses[10], 429);
  });

  test('marks unreachable sites as failed with a readable error', async () => {
    worker = startWorker();
    try {
      const closed = await startTargetSite({});
      closed.close();
      const { body } = await post(closed.url);
      const scan = await waitForScan(app, request, body.data.id, 20000);
      assert.equal(scan.status, 'failed');
      assert.match(scan.error, /refused|reached/);
    } finally {
      await worker.close();
    }
  });

  test('history lists scans of one address, newest first', async () => {
    await post(site.url);
    const other = await startTargetSite({});
    await post(other.url);
    other.close();

    const all = await request(app).get('/api/scans');
    assert.equal(all.body.total, 2);
    const one = await request(app).get(`/api/scans?url=${encodeURIComponent(site.url)}`);
    assert.equal(one.body.total, 1);
    assert.equal(one.body.data[0].url, site.url);
    assert.equal(one.body.data[0].checks, undefined);
  });

  test('unknown and malformed ids', async () => {
    assert.equal((await request(app).get('/api/scans/507f1f77bcf86cd799439011')).status, 404);
    assert.equal((await request(app).get('/api/scans/nope')).status, 400);
  });
});
