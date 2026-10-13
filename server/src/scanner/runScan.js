import { Agent, request } from 'undici';
import env from '../config/env.js';
import { analyseHeaders } from './headerChecks.js';
import { normalizeUrl } from './normalizeUrl.js';
import { assertAllowedUrl, assertPublicHost, BlockedTargetError, createGuardedLookup } from './ssrfGuard.js';

const MAX_REDIRECTS = 5;
const MAX_HEADERS = 60;
const USER_AGENT = 'SecurityHeaderScanner/1.0 (+https://github.com/huzaib123/Security-Header-Scanner)';

export class ScanError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ScanError';
  }
}

// One shared HTTP client. Its DNS lookup refuses private addresses on every
// connection, so redirects to internal hosts are blocked as well.
let defaultDispatcher;
function getDispatcher() {
  if (!defaultDispatcher) {
    defaultDispatcher = new Agent({
      connect: { lookup: createGuardedLookup({ allowPrivate: env.allowPrivateTargets }), timeout: env.scanTimeoutMs },
      headersTimeout: env.scanTimeoutMs,
      bodyTimeout: env.scanTimeoutMs,
      connections: 20,
    });
  }
  return defaultDispatcher;
}

const first = (value) => (Array.isArray(value) ? value[0] : value);

function friendlyError(err) {
  if (err instanceof BlockedTargetError || err instanceof ScanError) return err.message;
  const code = err?.code || err?.cause?.code || '';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'The domain does not resolve';
  if (code === 'ECONNREFUSED') return 'Connection refused';
  if (code === 'ECONNRESET') return 'Connection was reset';
  if (code.startsWith('UND_ERR_CONNECT_TIMEOUT') || code === 'UND_ERR_HEADERS_TIMEOUT' || err?.name === 'TimeoutError' || err?.name === 'AbortError') {
    return 'The site took too long to respond';
  }
  if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(code) || /certificate/i.test(err?.message || '')) {
    return 'The HTTPS certificate is not valid';
  }
  if (err instanceof BlockedTargetError || err?.cause instanceof BlockedTargetError) return (err.cause ?? err).message;
  return 'The site could not be reached';
}

// GET a URL and follow redirects by hand, checking every hop.
async function fetchFollowing(startUrl, { dispatcher, allowPrivate, signal }) {
  const chain = [];
  let current = new URL(startUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    assertAllowedUrl(current, { allowPrivate });
    const res = await request(current, {
      method: 'GET',
      dispatcher,
      signal,
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*;q=0.8' },
    });
    // Only headers matter; discard the body, reading at most 64 kb of it.
    await res.body.dump({ limit: 64 * 1024 }).catch(() => {});
    chain.push({ url: current.href, statusCode: res.statusCode });
    const location = first(res.headers.location);
    if (res.statusCode >= 300 && res.statusCode < 400 && location) {
      current = new URL(location, current);
      continue;
    }
    return { finalUrl: current.href, statusCode: res.statusCode, headers: res.headers, chain };
  }
  throw new ScanError(`More than ${MAX_REDIRECTS} redirects`);
}

function pickHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers)
      .slice(0, MAX_HEADERS)
      .map(([k, v]) => [k.toLowerCase(), String(Array.isArray(v) ? v.join(', ') : v).slice(0, 1000)]),
  );
}

// Scans one address: requests the http:// and https:// versions in
// parallel, grades the HTTPS response when there is one, and reports
// whether plain HTTP redirects to HTTPS. Only ordinary GET requests are sent.
export async function runScan(input, options = {}) {
  const allowPrivate = options.allowPrivate ?? env.allowPrivateTargets;
  const dispatcher = options.dispatcher ?? getDispatcher();
  const started = Date.now();

  const { url } = normalizeUrl(input);
  assertAllowedUrl(url, { allowPrivate });
  await assertPublicHost(url.hostname, { allowPrivate });

  const host = url.host;
  const path = `${url.pathname}${url.search}`;
  const signal = AbortSignal.timeout(env.scanTimeoutMs * 2);
  const opts = { dispatcher, allowPrivate, signal };

  const [plain, secure] = await Promise.allSettled([
    fetchFollowing(`http://${host}${path}`, opts),
    fetchFollowing(`https://${host}${path}`, opts),
  ]);

  const plainOk = plain.status === 'fulfilled';
  const secureOk = secure.status === 'fulfilled';
  if (!plainOk && !secureOk) throw new ScanError(friendlyError(secure.reason ?? plain.reason));

  const plainEndsOnHttps = plainOk && plain.value.finalUrl.startsWith('https:');
  const graded = plainEndsOnHttps ? plain.value : secureOk ? secure.value : plain.value;
  const httpsAvailable = secureOk || plainEndsOnHttps;
  const httpRedirectsToHttps = plainOk ? plainEndsOnHttps : null;

  const analysis = analyseHeaders(graded.headers, { httpsAvailable, httpRedirectsToHttps });

  return {
    finalUrl: graded.finalUrl,
    statusCode: graded.statusCode,
    redirects: graded.chain,
    httpsAvailable,
    httpRedirectsToHttps,
    httpsError: secureOk ? null : friendlyError(secure.reason),
    headers: pickHeaders(graded.headers),
    ...analysis,
    durationMs: Date.now() - started,
  };
}
