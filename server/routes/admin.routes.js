import { Router } from 'express';

import {
  approveCourse,
  deleteUser,
  forceArchiveCourse,
  forceDeleteCourse,
  getAllCoursesAdmin,
  getAllUsers,
  getDashboardStats,
  getPendingCourses,
  getUserById,
  rejectCourse,
  toggleUserActive,
  updateUserRole,
} from '../controllers/admin.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { adminLimiter } from '../middleware/rateLimit.middleware.js';
import { adminOnly } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  courseIdParamValidator as adminCourseIdParamValidator,
  forceDeleteCourseValidator,
  listCoursesAdminValidator,
  listUsersValidator,
  rejectCourseValidator,
  toggleUserActiveValidator,
  updateUserRoleValidator,
  userIdParamValidator,
} from '../validators/admin.validator.js';

const router = Router();

router.use(protect, adminOnly, adminLimiter);

router.get('/stats', getDashboardStats);

router.get('/users', validate(listUsersValidator), getAllUsers);
router.get('/users/:id', validate(userIdParamValidator), getUserById);
router.patch('/users/:id/role', validate(updateUserRoleValidator), updateUserRole);
router.patch('/users/:id/active', validate(toggleUserActiveValidator), toggleUserActive);
router.delete('/users/:id', validate(userIdParamValidator), deleteUser);

router.get('/courses/pending', getPendingCourses);
router.get('/courses', validate(listCoursesAdminValidator), getAllCoursesAdmin);

router.post(
  '/courses/:id/approve',
  validate(adminCourseIdParamValidator),
  approveCourse,
);
router.post(
  '/courses/:id/reject',
  validate(rejectCourseValidator),
  rejectCourse,
);
router.post(
  '/courses/:id/archive',
  validate(adminCourseIdParamValidator),
  forceArchiveCourse,
);
router.delete(
  '/courses/:id',
  validate(forceDeleteCourseValidator),
  forceDeleteCourse,
);

export default router;
