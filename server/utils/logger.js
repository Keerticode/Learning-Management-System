import pino from 'pino';
import pinoHttp from 'pino-http';

import { env } from '../config/env.js';

const transport = env.isProd
  ? undefined
  : {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        singleLine: true,
        ignore: 'pid,hostname',
      },
    };

export const logger = pino({
  level: env.LOG_LEVEL,
  transport,
  base: { service: 'lms-api', env: env.NODE_ENV },
});

export const httpLogger = pinoHttp({
  level: env.LOG_LEVEL,
  transport,
  // The id is set by `requestId` middleware before this logger fires.
  genReqId: (req) => req.id,
  // Inheriting `req.id` into every emitted line keeps logs joinable.
  customProps: (req) => ({ requestId: req.id }),
  // Collapse 4xx into warn so error-only alerting only triggers on 5xx.
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // Redact secrets at the LOGGER level so a misconfigured route handler
  // can't accidentally leak them into a log line.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.token',
      'req.body.refreshToken',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

export default httpLogger;