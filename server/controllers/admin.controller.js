import mongoose from 'mongoose';

import { Course } from '../models/Course.model.js';
import { Enrollment } from '../models/Enrollment.model.js';
import { Lesson } from '../models/Lesson.model.js';
import { Quiz } from '../models/Quiz.model.js';
import { QuizAttempt } from '../models/QuizAttempt.model.js';
import { Section } from '../models/Section.model.js';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/escapeRegex.js';

import {
  ADMIN_COURSE_PAGINATION_DEFAULTS,
  ADMIN_USER_PAGINATION_DEFAULTS,
} from '../validators/admin.validator.js';

const SORT_MAP = Object.freeze({
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
  email: { email: 1 },
  role: { role: 1, createdAt: -1 },
});

const COURSE_SORT_MAP = Object.freeze({
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  title: { title: 1 },
  price: { price: 1, createdAt: -1 },
  enrollments: { enrollmentCount: -1, createdAt: -1 },
  status: { status: 1, createdAt: -1 },
});

const buildUserListQuery = (query) => {
  const filter = {};

  if (typeof query.search === 'string' && query.search.trim().length > 0) {
    // ReDoS-safe: `escapeRegex` neutralises every regex metacharacter so a
    // crafted `?search=(a+)+$` cannot peg the event loop.
    const safe = escapeRegex(query.search.trim());
    const re = new RegExp(safe, 'i');
    filter.$or = [{ name: re }, { email: re }];
  }

  if (typeof query.role === 'string' && query.role.length > 0) {
    filter.role = query.role;
  }

  if (query.isActive === 'true') filter.isActive = true;
  else if (query.isActive === 'false') filter.isActive = false;

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const requestedLimit =
    parseInt(query.limit, 10) || ADMIN_USER_PAGINATION_DEFAULTS.defaultLimit;
  const limit = Math.min(
    ADMIN_USER_PAGINATION_DEFAULTS.maxLimit,
    Math.max(1, requestedLimit),
  );

  const sort = SORT_MAP[query.sort] ?? SORT_MAP.newest;

  return { filter, page, limit, skip: (page - 1) * limit, sort };
};

const countOtherActiveAdmins = (excludingId) =>
  User.countDocuments({
    _id: { $ne: excludingId },
    role: 'admin',
    isActive: true,
  });

const cascadeDeleteCourse = async (courseId, session) => {
  const sessionOpt = session ? { session } : undefined;
  await Promise.all([
    Section.deleteMany({ courseId }, sessionOpt),
    Lesson.deleteMany({ courseId }, sessionOpt),
    Quiz.deleteMany({ courseId }, sessionOpt),
    QuizAttempt.deleteMany({ courseId }, sessionOpt),
    Enrollment.deleteMany({ courseId }, sessionOpt),
    Course.deleteOne({ _id: courseId }, sessionOpt),
  ]);
};

export const getDashboardStats = asyncHandler(async (_req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    totalUsers,
    studentCount,
    instructorCount,
    adminCount,
    activeTodayCount,
    totalCourses,
    draftCourses,
    pendingCourses,
    publishedCourses,
    rejectedCourses,
    archivedCourses,
    totalEnrollments,
    last7DaysEnrollments,
    totalQuizAttempts,
    passedQuizAttempts,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'instructor' }),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ updatedAt: { $gte: startOfToday } }),
    Course.countDocuments({}),
    Course.countDocuments({ status: 'draft' }),
    Course.countDocuments({ status: 'pending' }),
    Course.countDocuments({ status: 'published' }),
    Course.countDocuments({ status: 'rejected' }),
    Course.countDocuments({ status: 'archived' }),
    Enrollment.countDocuments({}),
    Enrollment.countDocuments({ enrolledAt: { $gte: sevenDaysAgo } }),
    QuizAttempt.countDocuments({}),
    QuizAttempt.countDocuments({ passed: true }),
  ]);

  const passRate =
    totalQuizAttempts === 0
      ? 0
      : Math.round((passedQuizAttempts / totalQuizAttempts) * 1000) / 10;

  res.json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        students: studentCount,
        instructors: instructorCount,
        admins: adminCount,
        activeToday: activeTodayCount,
      },
      courses: {
        total: totalCourses,
        draft: draftCourses,
        pending: pendingCourses,
        published: publishedCourses,
        rejected: rejectedCourses,
        archived: archivedCourses,
      },
      enrollments: {
        total: totalEnrollments,
        last7Days: last7DaysEnrollments,
      },
      quizAttempts: {
        total: totalQuizAttempts,
        passed: passedQuizAttempts,
        passRate,
      },
    },
  });
});

export const getAllUsers = asyncHandler(async (req, res) => {
  const { filter, page, limit, skip, sort } = buildUserListQuery(req.query);

  const [items, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).lean();
  if (!user) throw ApiError.notFound('User not found.');

  const [enrollmentCount, quizAttemptCount, ownedCourseCount] = await Promise.all([
    Enrollment.countDocuments({ userId: user._id }),
    QuizAttempt.countDocuments({ userId: user._id }),
    Course.countDocuments({ instructor: user._id }),
  ]);

  res.json({
    success: true,
    data: {
      user,
      stats: {
        enrollments: enrollmentCount,
        quizAttempts: quizAttemptCount,
        ownedCourses: ownedCourseCount,
      },
    },
  });
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (req.user._id.equals(id)) {
    throw ApiError.forbidden('You cannot change your own role.');
  }

  const target = await User.findById(id);
  if (!target) throw ApiError.notFound('User not found.');

  if (target.role === role) {
    return res.json({ success: true, user: target.toSafeJSON() });
  }

  if (target.role === 'admin' && role !== 'admin') {
    const remaining = await countOtherActiveAdmins(target._id);
    if (remaining < 1) {
      throw ApiError.conflict(
        'Cannot demote the last remaining admin — promote another admin first.',
      );
    }
  }

  target.role = role;
  await target.save();

  return res.json({ success: true, user: target.toSafeJSON() });
});

export const toggleUserActive = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (req.user._id.equals(id)) {
    throw ApiError.forbidden('You cannot change your own activation status.');
  }

  const target = await User.findById(id);
  if (!target) throw ApiError.notFound('User not found.');

  if (target.role === 'admin' && isActive === false && target.isActive === true) {
    const remaining = await countOtherActiveAdmins(target._id);
    if (remaining < 1) {
      throw ApiError.conflict(
        'Cannot disable the last active admin — activate another admin first.',
      );
    }
  }

  if (target.isActive === isActive) {
    return res.json({ success: true, user: target.toSafeJSON() });
  }

  target.isActive = isActive;
  await target.save();

  return res.json({ success: true, user: target.toSafeJSON() });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user._id.equals(id)) {
    throw ApiError.forbidden('You cannot delete your own account.');
  }

  const target = await User.findById(id);
  if (!target) throw ApiError.notFound('User not found.');

  if (target.role === 'admin') {
    const remaining = await countOtherActiveAdmins(target._id);
    if (remaining < 1) {
      throw ApiError.conflict(
        'Cannot delete the last remaining admin — promote another admin first.',
      );
    }
  }

  // Prevent deleting instructors whose courses still have other users enrolled.
  const ownedCourseIds = await Course.find({ instructor: target._id })
    .select('_id')
    .lean();

  if (ownedCourseIds.length > 0) {
    const stranded = await Enrollment.countDocuments({
      courseId: { $in: ownedCourseIds.map((c) => c._id) },
      userId: { $ne: target._id },
    });
    if (stranded > 0) {
      throw ApiError.conflict(
        'Cannot delete instructor with active enrollments on their courses — archive those courses first.',
      );
    }
  }

  const runCascade = async (session) => {
    const sessionOpt = session ? { session } : undefined;

    // Delete the user’s enrollments before owned courses.
    await Enrollment.deleteMany({ userId: target._id }, sessionOpt);
    await QuizAttempt.deleteMany({ userId: target._id }, sessionOpt);

    for (const { _id: courseId } of ownedCourseIds) {
      await cascadeDeleteCourse(courseId, session);
    }

    await User.deleteOne({ _id: target._id }, sessionOpt);
  };

  let session;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(() => runCascade(session));
  } catch (err) {
    if (err?.code === 20 || /Transaction numbers/i.test(err?.message ?? '')) {
      await runCascade(null);
    } else {
      throw err;
    }
  } finally {
    await session?.endSession();
  }

  res.json({ success: true, message: 'User deleted successfully.' });
});

// Course moderation endpoints.

const buildAdminCourseListQuery = (query) => {
  const filter = {};

  if (typeof query.search === 'string' && query.search.trim().length > 0) {
    const safe = escapeRegex(query.search.trim());
    filter.title = new RegExp(safe, 'i');
  }

  if (typeof query.status === 'string' && query.status.length > 0) {
    filter.status = query.status;
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const requestedLimit =
    parseInt(query.limit, 10) || ADMIN_COURSE_PAGINATION_DEFAULTS.defaultLimit;
  const limit = Math.min(
    ADMIN_COURSE_PAGINATION_DEFAULTS.maxLimit,
    Math.max(1, requestedLimit),
  );

  const sort = COURSE_SORT_MAP[query.sort] ?? COURSE_SORT_MAP.newest;

  return { filter, page, limit, skip: (page - 1) * limit, sort };
};

export const getAllCoursesAdmin = asyncHandler(async (req, res) => {
  const { filter, page, limit, skip, sort } = buildAdminCourseListQuery(req.query);

  const [items, total] = await Promise.all([
    Course.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('instructor', 'name email avatar role')
      .lean(),
    Course.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

export const getPendingCourses = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const requestedLimit =
    parseInt(req.query.limit, 10) || ADMIN_COURSE_PAGINATION_DEFAULTS.defaultLimit;
  const limit = Math.min(
    ADMIN_COURSE_PAGINATION_DEFAULTS.maxLimit,
    Math.max(1, requestedLimit),
  );
  const skip = (page - 1) * limit;
  const filter = { status: 'pending' };

  const [items, total] = await Promise.all([
    Course.find(filter)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('instructor', 'name email avatar role')
      .lean(),
    Course.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

export const approveCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw ApiError.notFound('Course not found.');

  if (course.status !== 'pending') {
    throw ApiError.badRequest(
      `Only pending courses can be approved (current status: "${course.status}").`,
    );
  }

  course.status = 'published';
  course.rejectionReason = '';
  await course.save();

  res.json({ success: true, course });
});

export const rejectCourse = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const course = await Course.findById(req.params.id);
  if (!course) throw ApiError.notFound('Course not found.');

  if (course.status !== 'pending') {
    throw ApiError.badRequest(
      `Only pending courses can be rejected (current status: "${course.status}").`,
    );
  }

  course.status = 'rejected';
  course.rejectionReason = reason.trim();
  await course.save();

  res.json({ success: true, course });
});

export const forceArchiveCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw ApiError.notFound('Course not found.');

  if (course.status === 'archived') {
    return res.json({ success: true, course });
  }

  course.status = 'archived';
  await course.save();

  return res.json({ success: true, course });
});

export const forceDeleteCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id).select('_id');
  if (!course) throw ApiError.notFound('Course not found.');

  let session;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(() => cascadeDeleteCourse(course._id, session));
  } catch (err) {
    if (err?.code === 20 || /Transaction numbers/i.test(err?.message ?? '')) {
      await cascadeDeleteCourse(course._id, null);
    } else {
      throw err;
    }
  } finally {
    await session?.endSession();
  }

  res.json({ success: true, message: 'Course deleted successfully.' });
});

export default {
  getDashboardStats,
  getAllUsers,
  getUserById,
  updateUserRole,
  toggleUserActive,
  deleteUser,
  getAllCoursesAdmin,
  getPendingCourses,
  approveCourse,
  rejectCourse,
  forceArchiveCourse,
  forceDeleteCourse,
};