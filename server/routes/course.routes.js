import { Router } from 'express';

import {
  archiveCourse,
  createCourse,
  deleteCourse,
  getCategoryStats,
  getCourseBySlug,
  getCourseCurriculum,
  getMyCourses,
  listPublishedCourses,
  submitForReview,
  updateCourse,
} from '../controllers/course.controller.js';
import {
  enrollInCourse,
  getEnrollmentForCourse,
  issueCertificate,
  unenroll,
} from '../controllers/enrollment.controller.js';
import { getCourseProgress } from '../controllers/progress.controller.js';
import { optionalAuth, protect } from '../middleware/auth.middleware.js';
import { enrollLimiter } from '../middleware/rateLimit.middleware.js';
import { instructorOrAdmin } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  courseIdParamValidator,
  createCourseValidator,
  listCoursesValidator,
  slugParamValidator,
  updateCourseValidator,
} from '../validators/course.validator.js';
import { courseIdParamValidator as enrollmentCourseIdParamValidator } from '../validators/enrollment.validator.js';

const router = Router();

router.get('/', optionalAuth, validate(listCoursesValidator), listPublishedCourses);

router.get('/mine', protect, instructorOrAdmin, getMyCourses);

router.get('/categories', optionalAuth, getCategoryStats);

router.get(
  '/:slug/curriculum',
  optionalAuth,
  validate(slugParamValidator),
  getCourseCurriculum,
);
router.get('/:slug', optionalAuth, validate(slugParamValidator), getCourseBySlug);

router
  .route('/:id/enroll')
  .post(protect, enrollLimiter, validate(enrollmentCourseIdParamValidator), enrollInCourse)
  .delete(protect, validate(enrollmentCourseIdParamValidator), unenroll);

router.get(
  '/:id/enrollment',
  protect,
  validate(enrollmentCourseIdParamValidator),
  getEnrollmentForCourse,
);

router.get(
  '/:id/progress',
  protect,
  validate(enrollmentCourseIdParamValidator),
  getCourseProgress,
);

router.post(
  '/:id/certificate',
  protect,
  validate(enrollmentCourseIdParamValidator),
  issueCertificate,
);

router.use(protect, instructorOrAdmin);

router.post('/', validate(createCourseValidator), createCourse);

router.post('/:id/submit', validate(courseIdParamValidator), submitForReview);
router.post('/:id/archive', validate(courseIdParamValidator), archiveCourse);

router
  .route('/:id')
  .patch(validate(updateCourseValidator), updateCourse)
  .delete(validate(courseIdParamValidator), deleteCourse);

export default router;