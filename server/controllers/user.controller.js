import { Course } from '../models/Course.model.js';
import { Enrollment } from '../models/Enrollment.model.js';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pickFields } from '../utils/pickFields.js';

const PREFERENCE_TOP_KEYS = Object.freeze([
  'theme',
  'fontSize',
  'contentDensity',
  'animations',
  'language',
  'privacy',
  'notifications',
  'playback',
  'interests',
  'onboardingCompletedAt',
]);

const PREFERENCE_PRIVACY_KEYS = Object.freeze(['showEmail', 'showEnrolledCourses']);

const PREFERENCE_NOTIFICATION_KEYS = Object.freeze([
  'emailOnEnroll',
  'emailOnQuizGraded',
]);

const PREFERENCE_PLAYBACK_KEYS = Object.freeze(['autoplayNext', 'defaultSpeed']);

const PUBLIC_PROFILE_FIELDS = Object.freeze([
  '_id',
  'name',
  'role',
  'avatar',
  'bio',
  'headline',
  'createdAt',
]);

const mergePreferences = (user, payload) => {
  const top = pickFields(payload, PREFERENCE_TOP_KEYS);

  for (const key of [
    'theme',
    'fontSize',
    'contentDensity',
    'animations',
    'language',
    'interests',
    'onboardingCompletedAt',
  ]) {
    if (Object.prototype.hasOwnProperty.call(top, key)) {
      user.preferences[key] = top[key];
    }
  }

  if (top.privacy) {
    const privacy = pickFields(top.privacy, PREFERENCE_PRIVACY_KEYS);
    Object.assign(user.preferences.privacy, privacy);
  }

  if (top.notifications) {
    const notifications = pickFields(top.notifications, PREFERENCE_NOTIFICATION_KEYS);
    Object.assign(user.preferences.notifications, notifications);
  }

  if (top.playback) {
    const playback = pickFields(top.playback, PREFERENCE_PLAYBACK_KEYS);
    Object.assign(user.preferences.playback, playback);
  }
  user.markModified('preferences');
};

export const updateMyPreferences = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw ApiError.badRequest('Request body must be a JSON object.');
  }

  const allowedTop = pickFields(req.body, PREFERENCE_TOP_KEYS);
  if (Object.keys(allowedTop).length === 0) {
    throw ApiError.badRequest('No updatable preference fields provided.');
  }

  mergePreferences(req.user, allowedTop);
  await req.user.save();

  res.json({
    success: true,
    user: req.user.toSafeJSON(),
  });
});

export const getPublicProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(
    [...PUBLIC_PROFILE_FIELDS, 'email', 'isActive', 'preferences'].join(' '),
  );

  if (!user || !user.isActive) {
    throw ApiError.notFound('User not found.');
  }

  const profile = {
    _id: user._id,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
    bio: user.bio,
    headline: user.headline,
    createdAt: user.createdAt,
  };

  if (user.preferences?.privacy?.showEmail) {
    profile.email = user.email;
  }

  if (user.preferences?.privacy?.showEnrolledCourses) {
    profile.enrolledCoursesCount = await Enrollment.countDocuments({ userId: user._id });
  }

  if (user.role === 'instructor') {
    profile.coursesPublished = await Course.countDocuments({
      instructor: user._id,
      status: 'published',
    });
  }

  res.json({ success: true, user: profile });
});

export default {
  updateMyPreferences,
  getPublicProfile,
};
