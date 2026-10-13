import Scan from '../models/Scan.js';
import { runScan } from '../scanner/runScan.js';
import { BlockedTargetError } from '../scanner/ssrfGuard.js';
import { cacheResult, releaseInflight } from './scanCache.js';

// Runs one queued scan and stores the outcome. Blocked targets fail at
// once; other errors are thrown so BullMQ retries them, and the scan is
// marked failed only when no attempts are left.
export async function processScan(scanId, { isLastAttempt = true } = {}) {
  const scan = await Scan.findById(scanId);
  if (!scan || scan.status === 'completed' || scan.status === 'failed') return scan;

  scan.status = 'running';
  scan.startedAt = scan.startedAt ?? new Date();
  await scan.save();

  try {
    const result = await runScan(scan.url);
    Object.assign(scan, result, { status: 'completed', error: null, finishedAt: new Date() });
    await scan.save();
    await cacheResult(scan.key, scan.toJSON());
    await releaseInflight(scan.key);
    return scan;
  } catch (err) {
    const permanent = err instanceof BlockedTargetError || err instanceof TypeError;
    if (!permanent && !isLastAttempt) {
      scan.status = 'queued';
      await scan.save();
      throw err;
    }
    scan.status = 'failed';
    scan.error = err.message || 'Scan failed';
    scan.finishedAt = new Date();
    await scan.save();
    await releaseInflight(scan.key);
    return scan;
  }
}
