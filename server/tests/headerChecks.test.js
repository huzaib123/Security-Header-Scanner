import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { analyseHeaders, gradeFor } from '../src/scanner/headerChecks.js';

const secure = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  Server: 'nginx',
};
const httpsCtx = { httpsAvailable: true, httpRedirectsToHttps: true };
const byId = (r) => Object.fromEntries(r.checks.map((c) => [c.id, c]));

describe('analyseHeaders', () => {
  test('a well configured site scores 100 and gets an A', () => {
    const r = analyseHeaders(secure, httpsCtx);
    assert.equal(r.score, 100);
    assert.equal(r.grade, 'A');
    assert.ok(r.checks.every((c) => c.status === 'pass' && c.fix === null));
  });

  test('a site with no security headers over plain HTTP gets an F', () => {
    const r = analyseHeaders({ Server: 'Apache/2.4.41 (Ubuntu)', 'X-Powered-By': 'PHP/7.4' }, { httpsAvailable: false, httpRedirectsToHttps: false });
    assert.equal(r.score, 0);
    assert.equal(r.grade, 'F');
    assert.ok(r.checks.every((c) => c.status === 'fail' && c.fix));
  });

  test('header names are matched case-insensitively', () => {
    const lower = Object.fromEntries(Object.entries(secure).map(([k, v]) => [k.toLowerCase(), v]));
    assert.equal(analyseHeaders(lower, httpsCtx).score, 100);
  });

  test('short HSTS max-age is a warning worth half points', () => {
    const r = byId(analyseHeaders({ ...secure, 'Strict-Transport-Security': 'max-age=300' }, httpsCtx));
    assert.equal(r.hsts.status, 'warn');
    assert.equal(r.hsts.points, 7.5);
  });

  test("CSP that allows 'unsafe-inline' scripts is a warning, nonces are fine", () => {
    const unsafe = byId(analyseHeaders({ ...secure, 'Content-Security-Policy': "script-src 'self' 'unsafe-inline'" }, httpsCtx));
    assert.equal(unsafe.csp.status, 'warn');
    const nonce = byId(analyseHeaders({ ...secure, 'Content-Security-Policy': "script-src 'nonce-abc' 'unsafe-inline' 'strict-dynamic'" }, httpsCtx));
    assert.equal(nonce.csp.status, 'pass');
  });

  test('report-only CSP is a warning', () => {
    const { 'Content-Security-Policy': _, ...rest } = secure;
    const r = byId(analyseHeaders({ ...rest, 'Content-Security-Policy-Report-Only': "default-src 'self'" }, httpsCtx));
    assert.equal(r.csp.status, 'warn');
  });

  test('frame-ancestors in CSP satisfies the framing check', () => {
    const { 'X-Frame-Options': _, ...rest } = secure;
    assert.equal(byId(analyseHeaders(rest, httpsCtx))['x-frame-options'].status, 'pass');
  });

  test('Server header with a version fails, without one passes', () => {
    assert.equal(byId(analyseHeaders({ ...secure, Server: 'nginx/1.18.0' }, httpsCtx)).server.status, 'fail');
    assert.equal(byId(analyseHeaders({ ...secure, Server: 'cloudflare' }, httpsCtx)).server.status, 'pass');
  });

  test('X-Powered-By fails when present', () => {
    assert.equal(byId(analyseHeaders({ ...secure, 'X-Powered-By': 'Express' }, httpsCtx))['x-powered-by'].status, 'fail');
  });

  test('referrer policy uses the last listed value', () => {
    const r = byId(analyseHeaders({ ...secure, 'Referrer-Policy': 'no-referrer, unsafe-url' }, httpsCtx));
    assert.equal(r['referrer-policy'].status, 'warn');
  });

  test('HTTP that does not redirect to HTTPS fails the redirect check', () => {
    const r = byId(analyseHeaders(secure, { httpsAvailable: true, httpRedirectsToHttps: false }));
    assert.equal(r['https-redirect'].status, 'fail');
  });
});

describe('gradeFor', () => {
  test('maps scores to A–F', () => {
    assert.deepEqual([100, 90, 89, 75, 74, 60, 59, 45, 44, 0].map(gradeFor), ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'F', 'F']);
  });
});
