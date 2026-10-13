import Scan from '../models/Scan.js';
import ApiError from '../utils/ApiError.js';
import { normalizeUrl } from '../scanner/normalizeUrl.js';
import { assertAllowedUrl, assertPublicHost, BlockedTargetError } from '../scanner/ssrfGuard.js';
import { getCachedResult, claimInflight, releaseInflight } from '../services/scanCache.js';
import { enqueueScan } from '../services/queue.js';
import env from '../config/env.js';

const ACTIVE = ['queued', 'running'];
const HISTORY_FIELDS = 'url key hostname status grade score error durationMs createdAt finishedAt';

function parseTarget(input) {
  try {
    return normalizeUrl(input);
  } catch (err) {
    throw ApiError.badRequest(err.message);
  }
}

// POST /api/scans: answers immediately. Returns a cached result (200), the
// scan already running for this address (202), or queues a new scan (202).
export async function createScan(req, res) {
  const { url, href, key } = parseTarget(req.body.url);

  try {
    assertAllowedUrl(url, { allowPrivate: env.allowPrivateTargets });
    await assertPublicHost(url.hostname, { allowPrivate: env.allowPrivateTargets });
  } catch (err) {
    if (err instanceof BlockedTargetError) throw ApiError.badRequest(err.message);
    throw err;
  }

  const cached = await getCachedResult(key);
  if (cached) {
    res.set('X-Cache', 'HIT');
    return res.status(200).json({ data: cached, cached: true });
  }

  const scan = new Scan({ url: href, key, hostname: url.hostname });
  const inflightId = await claimInflight(key, scan.id);
  if (inflightId) {
    const existing = await Scan.findById(inflightId);
    if (existing && ACTIVE.includes(existing.status)) {
      res.set('X-Cache', 'MISS');
      return res.status(202).json({ data: existing, cached: false, deduplicated: true });
    }
  }

  await scan.save();
  try {
    await enqueueScan(scan);
  } catch {
    scan.status = 'failed';
    scan.error = 'The scan queue is unavailable';
    await scan.save();
    await releaseInflight(key);
    throw new ApiError(503, 'The scan queue is unavailable, try again shortly');
  }

  res.set('X-Cache', 'MISS');
  res.set('Location', `/api/scans/${scan.id}`);
  return res.status(202).json({ data: scan, cached: false });
}

export async function getScan(req, res) {
  const scan = await Scan.findById(req.params.id);
  if (!scan) throw ApiError.notFound('Scan not found');
  res.json({ data: scan });
}

export async function listScans(req, res) {
  const { url } = req.validQuery;
  const page = req.validQuery.page || 1;
  const limit = req.validQuery.limit || 20;
  const filter = url ? { key: parseTarget(url).key } : {};

  const [data, total] = await Promise.all([
    Scan.find(filter).select(HISTORY_FIELDS).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Scan.countDocuments(filter),
  ]);
  res.json({ data, page, limit, total, totalPages: Math.ceil(total / limit) || 1 });
}
