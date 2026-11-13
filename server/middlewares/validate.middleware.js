import { validationResult } from 'express-validator';

import { ApiError } from '../utils/ApiError.js';

const SENSITIVE_FIELDS = new Set(['password', 'currentPassword', 'newPassword', 'token']);

export const validate = (rules = []) => [
  ...rules,
  (req, _res, next) => {
    const result = validationResult(req);
    if (result.isEmpty()) return next();

    const errors = result.array({ onlyFirstError: true }).map((e) => ({
      field: e.path || e.param,
      message: e.msg,
      value: SENSITIVE_FIELDS.has(e.path || e.param) ? undefined : e.value,
    }));

    return next(ApiError.unprocessable('Validation failed.', { details: errors }));
  },
];

export default validate;
