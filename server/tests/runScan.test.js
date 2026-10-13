import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import { Agent, request } from 'undici';
import { runScan, ScanError } from '../src/scanner/runScan.js';
import { BlockedTargetError, createGuardedLookup } from '../src/scanner/ssrfGuard.js';

const SECURE_HEADERS = {
  'strict-transport-security': 'max-age=31536000',
  'content-security-policy': "default-src 'self'",
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};

// One port serving plain HTTP and HTTPS so http://host:port and
// https://host:port both answer, like a real site on 80 and 443.
function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

describe('runScan against local test servers', () => {
  const tls = {
    key: fs.readFileSync(new URL('./fixtures/test-key.pem', import.meta.url)),
    cert: fs.readFileSync(new URL('./fixtures/test-cert.pem', import.meta.url)),
  };
  const trustTestCert = new Agent({ connect: { rejectUnauthorized: false } });
  let plainPort;
  let securePort;
  let servers;
  const routes = {
    '/insecure': (req, res) => {
      res.writeHead(200, { server: 'Apache/2.4.41', 'x-powered-by': 'PHP/7.4' });
      res.end('hi');
    },
    '/loop': (req, res) => {
      res.writeHead(302, { location: '/loop' });
      res.end();
    },
  };

  before(async () => {
    const handler = (secure) => (req, res) => {
      if (routes[req.url]) return routes[req.url](req, res);
      if (!secure && req.url === '/redirecting') {
        res.writeHead(301, { location: `https://127.0.0.1:${securePort}/redirecting` });
        return res.end();
      }
      res.writeHead(200, secure ? SECURE_HEADERS : { server: 'nginx' });
      return res.end('ok');
    };
    const plain = http.createServer(handler(false));
    const secure = https.createServer(tls, handler(true));
    servers = [plain, secure];
    plainPort = await listen(plain);
    securePort = await listen(secure);
  });

  after(async () => {
    servers.forEach((s) => s.close());
    await trustTestCert.close();
  });

  test('grades the HTTPS response after http redirects to https', async () => {
    // http on plainPort redirects to https on securePort.
    const result = await runScan(`http://127.0.0.1:${plainPort}/redirecting`, { dispatcher: trustTestCert, allowPrivate: true });
    assert.equal(result.httpRedirectsToHttps, true);
    assert.equal(result.httpsAvailable, true);
    assert.equal(result.finalUrl, `https://127.0.0.1:${securePort}/redirecting`);
    assert.equal(result.grade, 'A');
    assert.equal(result.headers['x-frame-options'], 'DENY');
    assert.deepEqual(result.redirects.map((r) => r.statusCode), [301, 200]);
  });

  test('a plain-HTTP-only site with leaky headers gets an F', async () => {
    const result = await runScan(`http://127.0.0.1:${plainPort}/insecure`, { allowPrivate: true });
    assert.equal(result.httpsAvailable, false);
    assert.equal(result.grade, 'F');
    assert.ok(result.httpsError);
    const failed = result.checks.filter((c) => c.status === 'fail').map((c) => c.id);
    assert.ok(failed.includes('server') && failed.includes('x-powered-by'));
  });

  test('stops after too many redirects', async () => {
    await assert.rejects(runScan(`http://127.0.0.1:${plainPort}/loop`, { allowPrivate: true }), ScanError);
  });

  test('refuses private addresses when private targets are not allowed', async () => {
    await assert.rejects(runScan('http://127.0.0.1/', { allowPrivate: false }), BlockedTargetError);
  });

  test('the guarded HTTP client refuses to connect to a private host, so redirects cannot reach one', async () => {
    const guarded = new Agent({ connect: { lookup: createGuardedLookup() } });
    await assert.rejects(request(`http://localhost:${plainPort}/`, { dispatcher: guarded }), (err) => {
      return err instanceof BlockedTargetError || err.cause instanceof BlockedTargetError || /private or reserved/.test(err.message);
    });
    await guarded.close();
  });

  test('reports unreachable sites with a friendly message', async () => {
    const closed = http.createServer();
    const port = await listen(closed);
    closed.close();
    await assert.rejects(runScan(`http://127.0.0.1:${port}/`, { allowPrivate: true }), /Connection refused|could not be reached/);
  });
});
