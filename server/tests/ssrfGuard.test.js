import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedIp, assertAllowedUrl, assertPublicHost, createGuardedLookup, BlockedTargetError } from '../src/scanner/ssrfGuard.js';
import { normalizeUrl } from '../src/scanner/normalizeUrl.js';

describe('isBlockedIp', () => {
  test('blocks private, loopback, link-local and metadata addresses', () => {
    ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1']
      .forEach((ip) => assert.equal(isBlockedIp(ip), true, ip));
  });

  test('allows public addresses', () => {
    ['8.8.8.8', '1.1.1.1', '172.32.0.1', '93.184.216.34', '2606:4700:4700::1111'].forEach((ip) => assert.equal(isBlockedIp(ip), false, ip));
  });

  test('treats garbage as blocked', () => {
    assert.equal(isBlockedIp('not-an-ip'), true);
  });
});

describe('assertAllowedUrl', () => {
  const check = (u) => assertAllowedUrl(new URL(u));

  test('accepts normal public URLs', () => {
    assert.doesNotThrow(() => check('https://example.com/login'));
    assert.doesNotThrow(() => check('http://example.com:80/'));
  });

  test('rejects other protocols, credentials, odd ports and internal names', () => {
    ['ftp://example.com', 'file:///etc/passwd', 'https://user:pw@example.com', 'https://example.com:8443', 'http://localhost/', 'http://db.internal/', 'http://127.0.0.1/', 'http://[::1]/', 'http://169.254.169.254/latest/meta-data']
      .forEach((u) => assert.throws(() => check(u), BlockedTargetError, u));
  });
});

describe('assertPublicHost', () => {
  test('rejects hostnames that resolve to private addresses', async () => {
    await assert.rejects(assertPublicHost('localhost'), BlockedTargetError);
    await assert.rejects(assertPublicHost('127.0.0.1'), BlockedTargetError);
  });

  test('allows them only when explicitly asked (tests)', async () => {
    assert.deepEqual(await assertPublicHost('127.0.0.1', { allowPrivate: true }), ['127.0.0.1']);
  });
});

describe('createGuardedLookup', () => {
  test('refuses to connect to a private address at connection time', async () => {
    const lookup = createGuardedLookup();
    const err = await new Promise((resolve) => lookup('localhost', {}, (e) => resolve(e)));
    assert.ok(err instanceof BlockedTargetError);
  });
});

describe('normalizeUrl', () => {
  test('adds https, lowercases the host and drops the fragment', () => {
    const { href, key } = normalizeUrl('  Example.COM/Login?a=1#top ');
    assert.equal(href, 'https://example.com/Login?a=1');
    assert.equal(key, 'example.com/login?a=1');
  });

  test('http and https of the same page share a cache key', () => {
    assert.equal(normalizeUrl('http://example.com/').key, normalizeUrl('https://example.com').key);
  });

  test('rejects junk', () => {
    ['', 'not a url', 'https://', 'intranet', 'x'.repeat(3000)].forEach((u) => assert.throws(() => normalizeUrl(u), TypeError, u));
  });
});
