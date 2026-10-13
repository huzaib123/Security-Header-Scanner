import { Router } from 'express';
import { createScan, getScan, listScans } from '../controllers/scanController.js';
import { scanRateLimit } from '../middleware/scanRateLimit.js';
import { validate } from '../middleware/validate.js';
import { createScanRules, historyRules, scanIdRules } from '../validators/scan.js';

const router = Router();

router.route('/')
  .get(historyRules, validate, listScans)
  .post(scanRateLimit, createScanRules, validate, createScan);

router.get('/:id', scanIdRules, validate, getScan);

export default router;
