// Each check looks at the response headers (lower-cased keys) and returns
// pass, warn (half points) or fail, with a one-line fix.

const HSTS_MIN_SECONDS = 15552000; // 180 days

const truncate = (value, max = 300) => (value && value.length > max ? `${value.slice(0, max)}…` : value ?? null);

function result(check, status, message, value) {
  const points = status === 'pass' ? check.weight : status === 'warn' ? check.weight / 2 : 0;
  return {
    id: check.id,
    name: check.name,
    status,
    points,
    maxPoints: check.weight,
    value: truncate(value),
    message,
    fix: status === 'pass' ? null : check.fix,
  };
}

export const CHECKS = [
  {
    id: 'https-redirect',
    name: 'HTTPS redirect',
    weight: 20,
    fix: 'Serve the site over HTTPS and redirect every http:// request to https:// with a 301.',
    run(headers, ctx) {
      if (!ctx.httpsAvailable) return result(this, 'fail', 'The site does not respond over HTTPS.');
      if (ctx.httpRedirectsToHttps === false) return result(this, 'fail', 'http:// is served without redirecting to https://.');
      if (ctx.httpRedirectsToHttps === null) return result(this, 'warn', 'Could not check http://; HTTPS works.');
      return result(this, 'pass', 'http:// redirects to https://.');
    },
  },
  {
    id: 'hsts',
    name: 'Strict-Transport-Security',
    weight: 15,
    fix: 'Add "Strict-Transport-Security: max-age=31536000; includeSubDomains" to HTTPS responses.',
    run(headers, ctx) {
      const value = headers['strict-transport-security'];
      if (!ctx.httpsAvailable) return result(this, 'fail', 'HSTS needs HTTPS first.');
      if (!value) return result(this, 'fail', 'Missing, so browsers may still try plain HTTP.', value);
      const maxAge = Number(/max-age\s*=\s*"?(\d+)/i.exec(value)?.[1] ?? 0);
      if (maxAge < HSTS_MIN_SECONDS) return result(this, 'warn', `max-age is ${maxAge}s; use at least 180 days.`, value);
      return result(this, 'pass', `Enabled for ${Math.round(maxAge / 86400)} days.`, value);
    },
  },
  {
    id: 'csp',
    name: 'Content-Security-Policy',
    weight: 20,
    fix: "Add a Content-Security-Policy, starting with \"default-src 'self'\", and avoid 'unsafe-inline' for scripts.",
    run(headers) {
      const value = headers['content-security-policy'];
      if (!value) {
        if (headers['content-security-policy-report-only']) {
          return result(this, 'warn', 'Only a report-only policy is set, so nothing is enforced.', headers['content-security-policy-report-only']);
        }
        return result(this, 'fail', 'Missing, so injected scripts can run freely (XSS).');
      }
      const scriptPolicy = directive(value, 'script-src') ?? directive(value, 'default-src');
      if (!scriptPolicy) return result(this, 'warn', 'Set, but has no script-src or default-src directive.', value);
      if (/'unsafe-inline'|'unsafe-eval'|(^|\s)\*(\s|$)/.test(scriptPolicy) && !/'nonce-|'sha(256|384|512)-|'strict-dynamic'/.test(scriptPolicy)) {
        return result(this, 'warn', 'Set, but allows inline or any-origin scripts.', value);
      }
      return result(this, 'pass', 'A script policy is enforced.', value);
    },
  },
  {
    id: 'x-frame-options',
    name: 'X-Frame-Options',
    weight: 10,
    fix: "Add \"X-Frame-Options: DENY\" (or CSP \"frame-ancestors 'none'\") to stop clickjacking.",
    run(headers) {
      const value = headers['x-frame-options'];
      if (value && /^(deny|sameorigin)$/i.test(value.trim())) return result(this, 'pass', `Framing limited (${value.trim().toUpperCase()}).`, value);
      if (directive(headers['content-security-policy'] ?? '', 'frame-ancestors')) {
        return result(this, 'pass', 'Framing limited by CSP frame-ancestors.', headers['content-security-policy']);
      }
      if (value) return result(this, 'fail', 'Set to an unsupported value.', value);
      return result(this, 'fail', 'Missing, so other sites can frame this page (clickjacking).');
    },
  },
  {
    id: 'x-content-type-options',
    name: 'X-Content-Type-Options',
    weight: 10,
    fix: 'Add "X-Content-Type-Options: nosniff".',
    run(headers) {
      const value = headers['x-content-type-options'];
      if (value && value.trim().toLowerCase() === 'nosniff') return result(this, 'pass', 'MIME sniffing disabled.', value);
      return result(this, 'fail', 'Missing, so browsers may guess content types (MIME sniffing).', value);
    },
  },
  {
    id: 'referrer-policy',
    name: 'Referrer-Policy',
    weight: 10,
    fix: 'Add "Referrer-Policy: strict-origin-when-cross-origin".',
    run(headers) {
      const value = headers['referrer-policy'];
      if (!value) return result(this, 'fail', 'Missing, so full URLs may leak to other sites.');
      const policies = value.toLowerCase().split(',').map((p) => p.trim());
      const effective = policies[policies.length - 1];
      if (['unsafe-url', 'no-referrer-when-downgrade'].includes(effective)) {
        return result(this, 'warn', `"${effective}" still leaks full URLs.`, value);
      }
      return result(this, 'pass', `Set to ${effective}.`, value);
    },
  },
  {
    id: 'server',
    name: 'Server header',
    weight: 7.5,
    fix: 'Remove the version from the Server header (e.g. nginx "server_tokens off").',
    run(headers) {
      const value = headers.server;
      if (!value) return result(this, 'pass', 'Not sent.');
      if (/\d/.test(value)) return result(this, 'fail', 'Reveals software version, which helps attackers find known CVEs.', value);
      return result(this, 'pass', 'Sent without a version.', value);
    },
  },
  {
    id: 'x-powered-by',
    name: 'X-Powered-By',
    weight: 7.5,
    fix: 'Remove the X-Powered-By header (e.g. Express app.disable("x-powered-by"), PHP expose_php=Off).',
    run(headers) {
      const value = headers['x-powered-by'];
      if (!value) return result(this, 'pass', 'Not sent.');
      return result(this, 'fail', 'Reveals the framework or language behind the site.', value);
    },
  },
];

function directive(policy, name) {
  const part = policy
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.toLowerCase().startsWith(`${name} `) || p.toLowerCase() === name);
  return part ? part.slice(name.length).trim() : null;
}

export function gradeFor(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

// headers: response headers of the page that was graded (HTTPS when possible).
// ctx: { httpsAvailable: boolean, httpRedirectsToHttps: boolean|null }
export function analyseHeaders(headers, ctx) {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(', ') : String(v)]),
  );
  const checks = CHECKS.map((check) => check.run(lower, ctx));
  const total = checks.reduce((sum, c) => sum + c.maxPoints, 0);
  const earned = checks.reduce((sum, c) => sum + c.points, 0);
  const score = Math.round((earned / total) * 100);
  return { score, grade: gradeFor(score), checks };
}
