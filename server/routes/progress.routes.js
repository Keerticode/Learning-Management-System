import { Router } from 'express';

import {
  markLessonComplete,
  markLessonIncomplete,
  setLastAccessed,
} from '../controllers/progress.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { lessonIdParamValidator } from '../validators/enrollment.validator.js';

const router = Router();

router.use(protect);

router
  .route('/:id/complete')
  .post(validate(lessonIdParamValidator), markLessonComplete)
  .delete(validate(lessonIdParamValidator), markLessonIncomplete);

router.post('/:id/access', validate(lessonIdParamValidator), setLastAccessed);

export default router;
