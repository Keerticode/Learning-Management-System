
import { body } from 'express-validator';

import {
  USER_DENSITIES,
  USER_FONT_SIZES,
  USER_INTERESTS,
  USER_LANGUAGES,
  USER_PLAYBACK_SPEEDS,
  USER_THEMES,
} from '../models/User.model.js';
import { mongoIdParam } from './course.validator.js';

const optionalBoolean = (path, label) =>
  body(path)
    .optional()
    .isBoolean()
    .withMessage(`${label} must be a boolean.`)
    .bail()
    .toBoolean();

const optionalEnum = (path, label, values) =>
  body(path)
    .optional()
    .isIn(values)
    .withMessage(`${label} must be one of: ${values.join(', ')}.`);

export const updatePreferencesValidator = [
  optionalEnum('theme', 'Theme', USER_THEMES),
  optionalEnum('fontSize', 'Font size', USER_FONT_SIZES),
  optionalEnum('contentDensity', 'Content density', USER_DENSITIES),
  optionalBoolean('animations', 'Animations'),
  optionalEnum('language', 'Language', USER_LANGUAGES),

  body('privacy')
    .optional()
    .isObject({ strict: true })
    .withMessage('Privacy must be an object.'),
  optionalBoolean('privacy.showEmail', 'privacy.showEmail'),
  optionalBoolean('privacy.showEnrolledCourses', 'privacy.showEnrolledCourses'),

  body('notifications')
    .optional()
    .isObject({ strict: true })
    .withMessage('Notifications must be an object.'),
  optionalBoolean('notifications.emailOnEnroll', 'notifications.emailOnEnroll'),
  optionalBoolean('notifications.emailOnQuizGraded', 'notifications.emailOnQuizGraded'),

  body('playback')
    .optional()
    .isObject({ strict: true })
    .withMessage('Playback must be an object.'),
  optionalBoolean('playback.autoplayNext', 'playback.autoplayNext'),
  body('playback.defaultSpeed')
    .optional()
    .isFloat()
    .withMessage('playback.defaultSpeed must be a number.')
    .bail()
    .toFloat()
    .custom((value) => USER_PLAYBACK_SPEEDS.includes(value))
    .withMessage(
      `playback.defaultSpeed must be one of: ${USER_PLAYBACK_SPEEDS.join(', ')}.`,
    ),

  // Onboarding additions.
  body('interests')
    .optional()
    .isArray({ max: USER_INTERESTS.length })
    .withMessage(`Interests must be an array of at most ${USER_INTERESTS.length} items.`),
  body('interests.*')
    .optional()
    .isString()
    .bail()
    .isIn(USER_INTERESTS)
    .withMessage(`Each interest must be one of: ${USER_INTERESTS.join(', ')}.`),

  body('onboardingCompletedAt')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('onboardingCompletedAt must be an ISO 8601 timestamp.')
    .bail()
    .toDate(),
];


export const publicProfileParamValidator = [mongoIdParam('id')];

export default {
  updatePreferencesValidator,
  publicProfileParamValidator,
};
