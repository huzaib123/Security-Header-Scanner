import { matchedData, validationResult } from 'express-validator';
import ApiError from '../utils/ApiError.js';

// Runs after a list of express-validator chains and stops the request
// with a 400 listing every invalid field. Express 5 re-parses req.query on
// every read, so sanitised query values are exposed as req.validQuery.
export function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) {
    req.validQuery = matchedData(req, { locations: ['query'] });
    return next();
  }
  const details = result.array().map((e) => ({ field: e.path, message: e.msg }));
  return next(ApiError.badRequest('Validation failed', details));
}
