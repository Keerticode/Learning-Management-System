import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

import { redis } from '../config/redis.js';

const makeStore = (name) => {
  if (!redis) return undefined;
  return new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: `rl:${name}:`,
  });
};

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

const tooManyMessage = (message) => ({
  success: false,
  message,
});

export const apiLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('api'),
  message: tooManyMessage('Too many requests. Please try again in a few minutes.'),
});

export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('auth'),
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip);
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    return `auth:${ip}:${email}`;
  },
  message: tooManyMessage(
    'Too many authentication attempts. Please try again in 15 minutes.',
  ),
});

export const passwordLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('password'),
  keyGenerator: (req) =>
    req.user?._id
      ? `pwd:user:${req.user._id.toString()}`
      : `pwd:ip:${ipKeyGenerator(req.ip)}`,
  message: tooManyMessage(
    'Too many password change attempts. Please try again in 15 minutes.',
  ),
});

export const uploadLimiter = rateLimit({
  windowMs: TEN_MINUTES,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('upload'),
  message: tooManyMessage(
    'Too many upload attempts. Please try again in a few minutes.',
  ),
});

export const quizSubmitLimiter = rateLimit({
  windowMs: TEN_MINUTES,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('quiz-submit'),
  keyGenerator: (req) =>
    req.user?._id
      ? `quiz-submit:user:${req.user._id.toString()}`
      : `quiz-submit:ip:${ipKeyGenerator(req.ip)}`,
  message: tooManyMessage(
    'Too many quiz submissions. Please slow down and try again in a few minutes.',
  ),
});

export const adminLimiter = rateLimit({
  windowMs: TEN_MINUTES,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('admin'),
  keyGenerator: (req) =>
    req.user?._id
      ? `admin:user:${req.user._id.toString()}`
      : `admin:ip:${ipKeyGenerator(req.ip)}`,
  message: tooManyMessage(
    'Too many admin requests. Please slow down and try again in a few minutes.',
  ),
});

export const enrollLimiter = rateLimit({
  windowMs: TEN_MINUTES,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('enroll'),
  keyGenerator: (req) =>
    req.user?._id
      ? `enroll:user:${req.user._id.toString()}`
      : `enroll:ip:${ipKeyGenerator(req.ip)}`,
  message: tooManyMessage(
    'Too many enrollment attempts. Please slow down and try again in a few minutes.',
  ),
});

export const verifyEmailLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('verify'),
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip);
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    return `verify:${ip}:${email}`;
  },
  message: tooManyMessage(
    'Too many verification attempts. Please try again in 15 minutes.',
  ),
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: ONE_HOUR,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('forgot'),
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip);
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    return `forgot:${ip}:${email}`;
  },
  message: tooManyMessage(
    'Too many password reset requests. Please wait an hour before trying again.',
  ),
});

export const resetPasswordLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('reset'),
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip);
    const token = typeof req.params?.token === 'string' ? req.params.token : '';
    return `reset:${ip}:${token}`;
  },
  message: tooManyMessage(
    'Too many password reset attempts. Please request a new link.',
  ),
});

export const refreshLimiter = rateLimit({
  windowMs: ONE_MINUTE,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('refresh'),
  keyGenerator: (req) => `refresh:${ipKeyGenerator(req.ip)}`,
  message: tooManyMessage(
    'Too many refresh attempts. Please sign in again.',
  ),
});

export default {
  apiLimiter,
  authLimiter,
  passwordLimiter,
  uploadLimiter,
  quizSubmitLimiter,
  adminLimiter,
  enrollLimiter,
  verifyEmailLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  refreshLimiter,
};