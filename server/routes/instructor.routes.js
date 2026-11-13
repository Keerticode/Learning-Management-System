import { Router } from 'express';

import { getInstructorPublicCourses } from '../controllers/course.controller.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { instructorPublicCoursesValidator } from '../validators/course.validator.js';

const router = Router();

router.get(
  '/:id/courses',
  optionalAuth,
  validate(instructorPublicCoursesValidator),
  getInstructorPublicCourses,
);

export default router;