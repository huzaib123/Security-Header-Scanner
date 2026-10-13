import { body, param, query } from 'express-validator';

export const createScanRules = [
  body('url').isString().withMessage('Enter a website address').trim().isLength({ min: 3, max: 2048 }).withMessage('Address must be 3 to 2048 characters'),
];

export const scanIdRules = [param('id').isMongoId().withMessage('Invalid scan id')];

export const historyRules = [
  query('url').optional().isString().trim().isLength({ max: 2048 }),
  query('page').optional().isInt({ min: 1, max: 10000 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
];
