import jwt from 'jsonwebtoken';

import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyAccessToken } from '../utils/tokens.js';

const extractBearerToken = (req) => {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.trim().split(/\s+/);
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token;
};

const decodeAccessToken = (token) => {
  try {
    return verifyAccessToken(token);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Access token expired.', { code: 'TOKEN_EXPIRED' });
    }
    throw ApiError.unauthorized('Invalid authentication token.', { code: 'TOKEN_INVALID' });
  }
};

const loadUserFromToken = async (token) => {
  const payload = decodeAccessToken(token);
  if (!payload?.id) {
    throw ApiError.unauthorized('Invalid authentication token.', { code: 'TOKEN_INVALID' });
  }
  // We need the lockout + version columns to enforce session invariants.
  const user = await User.findById(payload.id).select('+tokenVersion +lockUntil');
  if (!user) {
    throw ApiError.unauthorized('Account no longer exists.', { code: 'TOKEN_INVALID' });
  }
  if (!user.isActive) {
    throw ApiError.forbidden('Account is disabled.', { code: 'ACCOUNT_DISABLED' });
  }
  if (user.isLocked) {
    throw ApiError.unauthorized('Account temporarily locked. Try again later.', {
      code: 'ACCOUNT_LOCKED',
    });
  }
  if (typeof payload.tokenVersion === 'number' && payload.tokenVersion !== user.tokenVersion) {
    throw ApiError.unauthorized('Session no longer valid. Please sign in again.', {
      code: 'TOKEN_REVOKED',
    });
  }
  return user;
};

export const protect = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    throw ApiError.unauthorized('Authentication required.', { code: 'TOKEN_MISSING' });
  }
  req.user = await loadUserFromToken(token);
  next();
});

export const requireVerified = (req, _res, next) => {
  if (!req.user) {
    return next(
      ApiError.unauthorized('Authentication required.', { code: 'TOKEN_MISSING' }),
    );
  }
  if (!req.user.isEmailVerified) {
    return next(
      ApiError.forbidden('Please verify your email to continue.', {
        code: 'EMAIL_NOT_VERIFIED',
      }),
    );
  }
  return next();
};

export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    req.user = await loadUserFromToken(token);
  } catch {
    req.user = null;
  }
  next();
});

export default protect;
