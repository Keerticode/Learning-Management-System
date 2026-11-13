import mongoose from 'mongoose';

import { env } from '../config/env.js';
import { hashAuthToken, User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from '../utils/email.js';
import { pickFields } from '../utils/pickFields.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/tokens.js';

const REGISTER_FIELDS = ['name', 'email', 'password'];
const PROFILE_FIELDS = ['name', 'avatar', 'bio', 'headline'];

const refreshCookieMaxAgeMs = () => {
  // Mirror the JWT TTL so the cookie expires alongside the token.
  const value = String(env.JWT_REFRESH_EXPIRES_IN).trim();
  const match = value.match(/^(\d+)\s*([smhd])?$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const multiplier = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return amount * multiplier;
};

const buildRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? 'none' : 'lax',
  path: '/api/auth',
  maxAge: refreshCookieMaxAgeMs(),
});

const setRefreshCookie = (res, token) => {
  res.cookie(env.REFRESH_COOKIE_NAME, token, buildRefreshCookieOptions());
};

const clearRefreshCookie = (res) => {
  const { maxAge: _ignored, ...attrs } = buildRefreshCookieOptions();
  res.clearCookie(env.REFRESH_COOKIE_NAME, attrs);
};

const issueAuthResponse = (res, status, user, { message } = {}) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  setRefreshCookie(res, refreshToken);
  return res.status(status).json({
    success: true,
    token: accessToken,
    user: user.toSafeJSON(),
    ...(message ? { message } : {}),
  });
};

const cascadeDeleteForUser = async (userId) => {
  const registered = new Set(mongoose.modelNames());
  const ops = [];
  if (registered.has('Enrollment')) {
    ops.push(mongoose.model('Enrollment').deleteMany({ user: userId }));
  }
  if (registered.has('QuizAttempt')) {
    ops.push(mongoose.model('QuizAttempt').deleteMany({ user: userId }));
  }
  if (registered.has('Course')) {
    ops.push(mongoose.model('Course').deleteMany({ instructor: userId }));
  }
  if (ops.length > 0) await Promise.all(ops);
};

const assertInstructorHasNoActiveEnrollments = async (user) => {
  if (user.role !== 'instructor') return;
  if (!mongoose.modelNames().includes('Enrollment')) return;
  if (!mongoose.modelNames().includes('Course')) return;

  const Course = mongoose.model('Course');
  const Enrollment = mongoose.model('Enrollment');
  const ownedCourseIds = await Course.find({ instructor: user._id }).distinct('_id');
  if (ownedCourseIds.length === 0) return;

  const activeEnrollments = await Enrollment.countDocuments({
    course: { $in: ownedCourseIds },
  });

  if (activeEnrollments > 0) {
    throw ApiError.conflict(
      'Cannot delete account: students are still enrolled in your courses. Archive or transfer them first.',
    );
  }
};

export const register = asyncHandler(async (req, res) => {
  const payload = pickFields(req.body, REGISTER_FIELDS);

  const existing = await User.findOne({ email: payload.email });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists.');
  }

  const user = await User.create({ ...payload, role: 'student' });

  // Generate verification token after create() so the pre-save bcrypt hook only runs once.
  const rawToken = user.createEmailVerificationToken();
  await user.save({ validateBeforeSave: false });
  // Email delivery must not block registration.
  sendVerificationEmail(user, rawToken).catch(() => {});

  return issueAuthResponse(res, 201, user, {
    message: 'Account created. Please check your inbox to verify your email.',
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = pickFields(req.body, ['email', 'password']);

  const user = await User.findOne({ email }).select(
    '+password +tokenVersion +failedLoginAttempts +lockUntil',
  );

  // Keep the error message generic to prevent user enumeration.
  const invalidCredentials = ApiError.unauthorized('Invalid email or password.');

  if (!user) throw invalidCredentials;

  if (user.isLocked) {
    throw new ApiError(423, 'Account temporarily locked. Please try again later.', {
      code: 'ACCOUNT_LOCKED',
    });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    user.registerFailedLoginAttempt();
    await user.save({ validateBeforeSave: false });
    throw invalidCredentials;
  }
  if (!user.isActive) throw ApiError.forbidden('Account is disabled.');

  user.resetLoginAttempts();
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  return issueAuthResponse(res, 200, user);
});

export const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeJSON() });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const updates = pickFields(req.body, PROFILE_FIELDS);
  if (Object.keys(updates).length === 0) {
    throw ApiError.badRequest('No updatable fields provided.');
  }

  Object.assign(req.user, updates);
  await req.user.save();

  res.json({ success: true, user: req.user.toSafeJSON() });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = pickFields(req.body, [
    'currentPassword',
    'newPassword',
  ]);

  if (currentPassword === newPassword) {
    throw ApiError.badRequest('New password must be different from the current password.');
  }

  const user = await User.findById(req.user._id).select('+password +tokenVersion');
  if (!user) throw ApiError.unauthorized('Account no longer exists.');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw ApiError.unauthorized('Current password is incorrect.');

  user.password = newPassword;
  // Invalidate every other session.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  // Issue fresh tokens for the active client.
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  setRefreshCookie(res, refreshToken);

  // Security awareness email must not block the response.
  sendPasswordChangedEmail(user).catch(() => {});

  res.json({
    success: true,
    message: 'Password updated. Other devices have been signed out.',
    token: accessToken,
  });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  const { password } = pickFields(req.body, ['password']);

  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw ApiError.unauthorized('Account no longer exists.');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw ApiError.unauthorized('Password is incorrect.');

  await assertInstructorHasNoActiveEnrollments(user);
  await cascadeDeleteForUser(user._id);
  await user.deleteOne();

  clearRefreshCookie(res);
  res.json({ success: true, message: 'Account deleted successfully.' });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;
  if (!token || typeof token !== 'string') {
    throw ApiError.badRequest('Verification token is required.');
  }

  const hashed = hashAuthToken(token);
  const user = await User.findOne({
    emailVerificationToken: hashed,
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationToken +emailVerificationExpires +tokenVersion');

  if (!user) {
    throw ApiError.badRequest('Verification link is invalid or has expired.');
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  sendWelcomeEmail(user).catch(() => {});

  res.json({
    success: true,
    message: 'Email verified successfully. Welcome aboard!',
    user: user.toSafeJSON(),
  });
});

export const resendVerification = asyncHandler(async (req, res) => {
  // Prefer the authenticated user's email; otherwise use the supplied email.
  const targetEmail =
    req.user?.email ||
    (typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '');

  // Keep the response generic to prevent email enumeration.
  const genericResponse = {
    success: true,
    message:
      'If an account exists for that email, a verification link is on its way.',
  };

  if (!targetEmail) {
    return res.json(genericResponse);
  }

  const user = await User.findOne({ email: targetEmail }).select(
    '+emailVerificationToken +emailVerificationExpires',
  );
  if (!user || user.isEmailVerified) {
    return res.json(genericResponse);
  }

  const rawToken = user.createEmailVerificationToken();
  await user.save({ validateBeforeSave: false });
  sendVerificationEmail(user, rawToken).catch(() => {});

  return res.json(genericResponse);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const email =
    typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';

  // Keep the response generic to prevent account enumeration.
  const genericResponse = {
    success: true,
    message:
      'If an account exists for that email, a reset link has been sent.',
  };

  if (!email) return res.json(genericResponse);

  const user = await User.findOne({ email }).select(
    '+passwordResetToken +passwordResetExpires',
  );
  if (!user) return res.json(genericResponse);

  const rawToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });
  sendPasswordResetEmail(user, rawToken).catch(() => {});

  return res.json(genericResponse);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = pickFields(req.body, ['password']);

  if (!token || typeof token !== 'string') {
    throw ApiError.badRequest('Reset token is required.');
  }
  if (!password) {
    throw ApiError.badRequest('A new password is required.');
  }

  const hashed = hashAuthToken(token);
  const user = await User.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: new Date() },
  }).select('+password +passwordResetToken +passwordResetExpires +tokenVersion');

  if (!user) {
    throw ApiError.badRequest('Reset link is invalid or has expired.');
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  // Invalidate existing sessions.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  // Successful password reset also verifies inbox ownership.
  if (!user.isEmailVerified) {
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
  }
  user.resetLoginAttempts();
  await user.save();

  sendPasswordChangedEmail(user).catch(() => {});

  res.json({
    success: true,
    message: 'Password reset successfully. Please sign in with your new password.',
  });
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const cookieToken = req.cookies?.[env.REFRESH_COOKIE_NAME];
  if (!cookieToken) {
    throw ApiError.unauthorized('No refresh token provided.', { code: 'TOKEN_MISSING' });
  }

  let payload;
  try {
    payload = verifyRefreshToken(cookieToken);
  } catch {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Refresh token expired or invalid.', {
      code: 'TOKEN_INVALID',
    });
  }

  const user = await User.findById(payload.id).select('+tokenVersion +lockUntil');
  if (!user || !user.isActive || user.isLocked) {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Session is no longer valid.', { code: 'TOKEN_REVOKED' });
  }
  if (typeof payload.tokenVersion === 'number' && payload.tokenVersion !== user.tokenVersion) {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Session is no longer valid.', { code: 'TOKEN_REVOKED' });
  }

  // Issue a new refresh token and replace the cookie.
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  setRefreshCookie(res, refreshToken);

  res.json({
    success: true,
    token: accessToken,
    user: user.toSafeJSON(),
  });
});

export const logout = asyncHandler(async (_req, res) => {
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Signed out.' });
});

export const logoutAll = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+tokenVersion');
  if (!user) throw ApiError.unauthorized('Account no longer exists.');

  // Invalidate existing tokens, then issue a fresh pair for this client.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save({ validateBeforeSave: false });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  setRefreshCookie(res, refreshToken);

  res.json({
    success: true,
    message: 'Signed out from every other device.',
    token: accessToken,
    user: user.toSafeJSON(),
  });
});

export default {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
  logout,
  logoutAll,
};