
import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

const userId = (user) => (typeof user === 'string' ? user : user._id.toString());

export const generateAccessToken = (user) =>
  jwt.sign(
    {
      id: userId(user),
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN },
  );

export const generateRefreshToken = (user) =>
  jwt.sign(
    {
      id: userId(user),
      tokenVersion: user.tokenVersion ?? 0,
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN },
  );

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);

export const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);

export const generateRandomToken = () => crypto.randomBytes(32).toString('hex');

export const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateRandomToken,
  hashToken,
};
