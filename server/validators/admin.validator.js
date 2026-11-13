import { body, query } from 'express-validator';

import { COURSE_STATUSES } from '../models/Course.model.js';
import { USER_ROLES } from '../models/User.model.js';
import { mongoIdParam } from './course.validator.js';

const SEARCH_MAX_LENGTH = 100;
const PAGINATION_DEFAULT_LIMIT = 20;
const PAGINATION_MAX_LIMIT = 100;
const REJECTION_REASON_MIN = 10;
const REJECTION_REASON_MAX = 500;

const USER_LIST_SORT_VALUES = Object.freeze([
  'newest',
  'oldest',
  'name',
  'email',
  'role',
]);

const COURSE_LIST_SORT_VALUES = Object.freeze([
  'newest',
  'oldest',
  'title',
  'price',
  'enrollments',
  'status',
]);

const pageChain = () =>
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer.');

const limitChain = () =>
  query('limit')
    .optional()
    .isInt({ min: 1, max: PAGINATION_MAX_LIMIT })
    .withMessage(`Limit must be between 1 and ${PAGINATION_MAX_LIMIT}.`);

const searchChain = () =>
  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string.')
    .bail()
    .trim()
    .isLength({ max: SEARCH_MAX_LENGTH })
    .withMessage(`Search must be at most ${SEARCH_MAX_LENGTH} characters.`);

const roleQueryChain = () =>
  query('role')
    .optional()
    .isIn(USER_ROLES)
    .withMessage(`Role must be one of: ${USER_ROLES.join(', ')}.`);

const isActiveQueryChain = () =>
  query('isActive')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isActive must be "true" or "false".');

const sortChain = () =>
  query('sort')
    .optional()
    .isIn(USER_LIST_SORT_VALUES)
    .withMessage(`Sort must be one of: ${USER_LIST_SORT_VALUES.join(', ')}.`);

const roleBodyChain = () =>
  body('role')
    .exists({ checkNull: true })
    .withMessage('Role is required.')
    .bail()
    .isIn(USER_ROLES)
    .withMessage(`Role must be one of: ${USER_ROLES.join(', ')}.`);

const isActiveBodyChain = () =>
  body('isActive')
    .exists({ checkNull: true })
    .withMessage('isActive is required.')
    .bail()
    .isBoolean()
    .withMessage('isActive must be a boolean.');

export const listUsersValidator = [
  searchChain(),
  roleQueryChain(),
  isActiveQueryChain(),
  sortChain(),
  pageChain(),
  limitChain(),
];

export const userIdParamValidator = [mongoIdParam('id')];

export const updateUserRoleValidator = [mongoIdParam('id'), roleBodyChain()];

export const toggleUserActiveValidator = [mongoIdParam('id'), isActiveBodyChain()];

const courseStatusQueryChain = () =>
  query('status')
    .optional()
    .isIn(COURSE_STATUSES)
    .withMessage(`Status must be one of: ${COURSE_STATUSES.join(', ')}.`);

const courseSortChain = () =>
  query('sort')
    .optional()
    .isIn(COURSE_LIST_SORT_VALUES)
    .withMessage(`Sort must be one of: ${COURSE_LIST_SORT_VALUES.join(', ')}.`);

const rejectionReasonChain = () =>
  body('reason')
    .exists({ checkNull: true })
    .withMessage('Rejection reason is required.')
    .bail()
    .isString()
    .withMessage('Rejection reason must be a string.')
    .bail()
    .trim()
    .isLength({ min: REJECTION_REASON_MIN, max: REJECTION_REASON_MAX })
    .withMessage(
      `Rejection reason must be between ${REJECTION_REASON_MIN} and ${REJECTION_REASON_MAX} characters.`,
    );

const forceDeleteConfirmChain = () =>
  body('confirm')
    .exists({ checkNull: true })
    .withMessage('Confirmation flag is required for force-delete.')
    .bail()
    .isBoolean()
    .withMessage('Confirmation flag must be a boolean.')
    .bail()
    .custom((value) => value === true)
    .withMessage('Confirmation flag must be true to force-delete a course.');

export const listCoursesAdminValidator = [
  searchChain(),
  courseStatusQueryChain(),
  courseSortChain(),
  pageChain(),
  limitChain(),
];

export const courseIdParamValidator = [mongoIdParam('id')];

export const rejectCourseValidator = [mongoIdParam('id'), rejectionReasonChain()];

export const forceDeleteCourseValidator = [
  mongoIdParam('id'),
  forceDeleteConfirmChain(),
];

export const ADMIN_USER_PAGINATION_DEFAULTS = Object.freeze({
  defaultLimit: PAGINATION_DEFAULT_LIMIT,
  maxLimit: PAGINATION_MAX_LIMIT,
});

export const ADMIN_USER_LIST_SORTS = USER_LIST_SORT_VALUES;

export const ADMIN_COURSE_LIST_SORTS = COURSE_LIST_SORT_VALUES;

export const ADMIN_COURSE_PAGINATION_DEFAULTS = Object.freeze({
  defaultLimit: PAGINATION_DEFAULT_LIMIT,
  maxLimit: PAGINATION_MAX_LIMIT,
});

export default {
  listUsersValidator,
  userIdParamValidator,
  updateUserRoleValidator,
  toggleUserActiveValidator,
  listCoursesAdminValidator,
  courseIdParamValidator,
  rejectCourseValidator,
  forceDeleteCourseValidator,
  ADMIN_USER_PAGINATION_DEFAULTS,
  ADMIN_USER_LIST_SORTS,
  ADMIN_COURSE_LIST_SORTS,
  ADMIN_COURSE_PAGINATION_DEFAULTS,
};
