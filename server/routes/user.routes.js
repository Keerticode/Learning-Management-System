import { Router } from 'express';

import { getPublicProfile, updateMyPreferences } from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  publicProfileParamValidator,
  updatePreferencesValidator,
} from '../validators/user.validator.js';

const router = Router();

router.patch(
  '/me/preferences',
  protect,
  validate(updatePreferencesValidator),
  updateMyPreferences,
);

router.get('/:id', validate(publicProfileParamValidator), getPublicProfile);

export default router;