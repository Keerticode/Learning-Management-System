import { Router } from 'express';

import {
  changePassword,
  deleteAccount,
  forgotPassword,
  getMe,
  login,
  logout,
  logoutAll,
  refreshAccessToken,
  register,
  resendVerification,
  resetPassword,
  updateProfile,
  verifyEmail,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import {
  authLimiter,
  forgotPasswordLimiter,
  passwordLimiter,
  refreshLimiter,
  resetPasswordLimiter,
  verifyEmailLimiter,
} from '../middleware/rateLimit.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  changePasswordValidator,
  deleteAccountValidator,
  forgotPasswordValidator,
  loginValidator,
  registerValidator,
  resendVerificationValidator,
  resetPasswordValidator,
  updateProfileValidator,
  verifyEmailValidator,
} from '../validators/auth.validator.js';

const router = Router();

// --- Public ---------------------------------------------------------------

router.post('/register', authLimiter, validate(registerValidator), register);
router.post('/login', authLimiter, validate(loginValidator), login);

router.post('/refresh', refreshLimiter, refreshAccessToken);

router.get(
  '/verify-email/:token',
  verifyEmailLimiter,
  validate(verifyEmailValidator),
  verifyEmail,
);
router.post(
  '/resend-verification',
  verifyEmailLimiter,
  validate(resendVerificationValidator),
  resendVerification,
);

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validate(forgotPasswordValidator),
  forgotPassword,
);
router.post(
  '/reset-password/:token',
  resetPasswordLimiter,
  validate(resetPasswordValidator),
  resetPassword,
);

// --- Protected ------------------------------------------------------------

router.get('/me', protect, getMe);
router.patch('/me', protect, validate(updateProfileValidator), updateProfile);
router.patch(
  '/me/password',
  protect,
  passwordLimiter,
  validate(changePasswordValidator),
  changePassword,
);
router.delete(
  '/me',
  protect,
  passwordLimiter,
  validate(deleteAccountValidator),
  deleteAccount,
);

router.post('/logout', protect, logout);
router.post('/logout-all', protect, logoutAll);

export default router;
