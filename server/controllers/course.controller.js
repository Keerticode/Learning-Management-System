import mongoose from 'mongoose';

import { signedVideoUrl } from '../config/cloudinary.js';
import {
  Course,
  COURSE_CATEGORIES,
  COURSE_LEVELS,
} from '../models/Course.model.js';
import { Enrollment } from '../models/Enrollment.model.js';
import { Lesson } from '../models/Lesson.model.js';
import { Quiz } from '../models/Quiz.model.js';
import { QuizAttempt } from '../models/QuizAttempt.model.js';
import { Section } from '../models/Section.model.js';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { pickFields } from '../utils/pickFields.js';

const CREATE_FIELDS = [
  'title',
  'description',
  'shortDescription',
  'price',
  'thumbnail',
  'category',
  'level',
  'language',
  'tags',
  'requirements',
  'learningOutcomes',
];

const EDIT_FIELDS_DRAFT = CREATE_FIELDS;

const EDIT_FIELDS_PUBLISHED = Object.freeze([
  'description',
  'shortDescription',
  'tags',
  'requirements',
  'learningOutcomes',
  'thumbnail',
]);

const PAGINATION_DEFAULT_LIMIT = 20;
const PAGINATION_MAX_LIMIT = 50;

const isAdmin = (user) => user?.role === 'admin';

const isOwner = (course, user) =>
  course?.instructor && user?._id && course.instructor.equals(user._id);

const findOwnedCourseOr404 = async (id, user) => {
  const course = await Course.findById(id);
  if (!course) throw ApiError.notFound('Course not found.');
  if (!isOwner(course, user) && !isAdmin(user)) {
    throw ApiError.notFound('Course not found.');
  }
  return course;
};

const cascadeDeleteCourse = async (courseId) => {
  const cleanupOps = (session) => {
    const sessionOpt = session ? { session } : undefined;
    return Promise.all([
      Section.deleteMany({ courseId }, sessionOpt),
      Lesson.deleteMany({ courseId }, sessionOpt),
      Quiz.deleteMany({ courseId }, sessionOpt),
      QuizAttempt.deleteMany({ courseId }, sessionOpt),
      Enrollment.deleteMany({ courseId }, sessionOpt),
      Course.deleteOne({ _id: courseId }, sessionOpt),
    ]);
  };

  let session;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(() => cleanupOps(session));
  } catch (err) {
    // Standalone MongoDB does not support transactions.
    if (err?.code === 20 || /Transaction numbers/i.test(err?.message ?? '')) {
      await cleanupOps(null);
    } else {
      throw err;
    }
  } finally {
    await session?.endSession();
  }
};

const buildMyCoursesQuery = (query) => {
  const filter = {};
  if (typeof query.status === 'string' && query.status.length > 0) {
    filter.status = query.status;
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const requestedLimit = parseInt(query.limit, 10) || PAGINATION_DEFAULT_LIMIT;
  const limit = Math.min(PAGINATION_MAX_LIMIT, Math.max(1, requestedLimit));

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    title: { title: 1 },
    price: { price: 1 },
  };
  const sort = sortMap[query.sort] ?? sortMap.newest;

  return { filter, page, limit, skip: (page - 1) * limit, sort };
};

export const createCourse = asyncHandler(async (req, res) => {
  const data = pickFields(req.body, CREATE_FIELDS);

  const course = await Course.create({
    ...data,
    instructor: req.user._id,
    status: 'draft',
  });

  res.status(201).json({ success: true, course });
});

export const getMyCourses = asyncHandler(async (req, res) => {
  const { filter, page, limit, skip, sort } = buildMyCoursesQuery(req.query);
  const ownedFilter = { ...filter, instructor: req.user._id };

  const [items, total] = await Promise.all([
    Course.find(ownedFilter).sort(sort).skip(skip).limit(limit),
    Course.countDocuments(ownedFilter),
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

export const updateCourse = asyncHandler(async (req, res) => {
  const course = await findOwnedCourseOr404(req.params.id, req.user);

  const allowed = course.status === 'published' ? EDIT_FIELDS_PUBLISHED : EDIT_FIELDS_DRAFT;
  const updates = pickFields(req.body, allowed);

  if (Object.keys(updates).length === 0) {
    if (course.status === 'published') {
      throw ApiError.badRequest(
        `No editable fields provided. Published courses can only update: ${EDIT_FIELDS_PUBLISHED.join(', ')}.`,
      );
    }
    throw ApiError.badRequest('No updatable fields provided.');
  }

  Object.assign(course, updates);
  // Use .save() to run pre-save hooks.
  await course.save();

  res.json({ success: true, course });
});

export const deleteCourse = asyncHandler(async (req, res) => {
  const course = await findOwnedCourseOr404(req.params.id, req.user);

  if (!isAdmin(req.user)) {
    const activeEnrollments = await Enrollment.countDocuments({ courseId: course._id });
    if (activeEnrollments > 0) {
      throw ApiError.conflict(
        'Cannot delete course with active enrollments — archive instead.',
      );
    }
  }

  await cascadeDeleteCourse(course._id);

  res.json({ success: true, message: 'Course deleted successfully.' });
});

export const submitForReview = asyncHandler(async (req, res) => {
  const course = await findOwnedCourseOr404(req.params.id, req.user);

  if (course.status !== 'draft') {
    throw ApiError.badRequest(
      `Only draft courses can be submitted for review (current status: "${course.status}").`,
    );
  }

  course.status = 'pending';
  course.rejectionReason = '';
  await course.save();

  res.json({ success: true, course });
});

export const archiveCourse = asyncHandler(async (req, res) => {
  const course = await findOwnedCourseOr404(req.params.id, req.user);

  if (course.status !== 'published') {
    throw ApiError.badRequest(
      `Only published courses can be archived (current status: "${course.status}").`,
    );
  }

  course.status = 'archived';
  await course.save();

  res.json({ success: true, course });
});

const CATALOG_DEFAULT_LIMIT = 12;
const CATALOG_MAX_LIMIT = 50;
const PRICE_MIN = 0;
const PRICE_MAX = 9999;
const SEARCH_MAX_LENGTH = 100;

const CATALOG_SORT_MAP = Object.freeze({
  newest: { publishedAt: -1, createdAt: -1 },
  popular: { enrollmentCount: -1, publishedAt: -1 },
  'price-asc': { price: 1, publishedAt: -1 },
  'price-desc': { price: -1, publishedAt: -1 },
});

const CATALOG_CARD_FIELDS = [
  'title',
  'slug',
  'shortDescription',
  'price',
  'thumbnail',
  'category',
  'level',
  'language',
  'tags',
  'totalLessons',
  'totalDuration',
  'enrollmentCount',
  'averageRating',
  'publishedAt',
  'createdAt',
  'instructor',
].join(' ');

const clampPage = (raw) => Math.max(1, parseInt(raw, 10) || 1);

const clampLimit = (raw) => {
  const requested = parseInt(raw, 10) || CATALOG_DEFAULT_LIMIT;
  return Math.min(CATALOG_MAX_LIMIT, Math.max(1, requested));
};

const setPublicCatalogCache = (res, user) => {
  if (user) {
    res.set('Cache-Control', 'private, no-store');
    return;
  }
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.set('Vary', 'Authorization');
};

const parsePrice = (raw) => {
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
};

const parseDuration = (raw) => {
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

const parseEnumList = (raw, allowed) => {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const values = Array.from(
    new Set(
      raw
        .split(',')
        .map((piece) => piece.trim())
        .filter((piece) => allowed.includes(piece)),
    ),
  );
  return values.length > 0 ? values : null;
};

const buildCatalogQuery = (query) => {
  const filter = { status: 'published' };

  if (typeof query.search === 'string' && query.search.trim().length > 0) {
    const safe = escapeRegex(query.search.trim().slice(0, SEARCH_MAX_LENGTH));
    if (safe.length > 0) {
      const re = new RegExp(safe, 'i');
      filter.$or = [{ title: re }, { description: re }, { tags: re }];
    }
  }

  const categories = parseEnumList(query.category, COURSE_CATEGORIES);
  if (categories) {
    filter.category = categories.length === 1 ? categories[0] : { $in: categories };
  }

  const levels = parseEnumList(query.level, COURSE_LEVELS);
  if (levels) {
    filter.level = levels.length === 1 ? levels[0] : { $in: levels };
  }

  const minPrice = parsePrice(query.minPrice);
  const maxPrice = parsePrice(query.maxPrice);
  if (minPrice !== null || maxPrice !== null) {
    filter.price = {};
    if (minPrice !== null) filter.price.$gte = Math.max(PRICE_MIN, minPrice);
    if (maxPrice !== null) filter.price.$lte = Math.min(PRICE_MAX, maxPrice);
  }

  const minDuration = parseDuration(query.minDuration);
  const maxDuration = parseDuration(query.maxDuration);
  if (minDuration !== null || maxDuration !== null) {
    filter.totalDuration = {};
    if (minDuration !== null) filter.totalDuration.$gte = minDuration;
    if (maxDuration !== null) filter.totalDuration.$lte = maxDuration;
  }

  if (query.priceMode === 'free') {
    filter.price = { $eq: 0 };
  } else if (query.priceMode === 'paid') {
    filter.price = { ...(filter.price ?? {}), $gt: 0 };
  }

  const sort = CATALOG_SORT_MAP[query.sort] ?? CATALOG_SORT_MAP.newest;
  const page = clampPage(query.page);
  const limit = clampLimit(query.limit);

  return { filter, sort, page, limit, skip: (page - 1) * limit };
};

const findVisibleCourseBySlugOr404 = async (slug, user, { populateInstructor = true } = {}) => {
  let query = Course.findOne({ slug });
  if (populateInstructor) {
    query = query.populate('instructor', 'name avatar headline bio');
  }
  const course = await query;

  if (!course) throw ApiError.notFound('Course not found.');

  if (course.status !== 'published' && !isOwner(course, user) && !isAdmin(user)) {
    throw ApiError.notFound('Course not found.');
  }

  return course;
};

export const listPublishedCourses = asyncHandler(async (req, res) => {
  const { filter, sort, page, limit, skip } = buildCatalogQuery(req.query);

  const [items, total] = await Promise.all([
    Course.find(filter)
      .select(CATALOG_CARD_FIELDS)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('instructor', 'name avatar headline')
      .lean(),
    Course.countDocuments(filter),
  ]);

  setPublicCatalogCache(res, req.user);

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

export const getCategoryStats = asyncHandler(async (req, res) => {
  const aggregated = await Course.aggregate([
    { $match: { status: 'published' } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);

  const counts = new Map(aggregated.map(({ _id, count }) => [_id, count]));
  const items = COURSE_CATEGORIES.map((category) => ({
    category,
    count: counts.get(category) ?? 0,
  }));
  const total = items.reduce((sum, item) => sum + item.count, 0);

  setPublicCatalogCache(res, req.user);

  res.json({
    success: true,
    data: { items, total },
  });
});

export const getCourseBySlug = asyncHandler(async (req, res) => {
  const course = await findVisibleCourseBySlugOr404(req.params.slug, req.user);
  setPublicCatalogCache(res, req.user);
  res.json({ success: true, course });
});

export const getCourseCurriculum = asyncHandler(async (req, res) => {
  const course = await findVisibleCourseBySlugOr404(req.params.slug, req.user, {
    populateInstructor: false,
  });

  const [sections, lessons] = await Promise.all([
    Section.find({ courseId: course._id }).sort({ order: 1 }).lean(),
    Lesson.find({ courseId: course._id }).sort({ order: 1 }).lean(),
  ]);

  const viewerIsOwner = isOwner(course, req.user);
  const viewerIsAdmin = isAdmin(req.user);

  let viewerIsEnrolled = false;
  if (req.user && !viewerIsOwner && !viewerIsAdmin) {
    const enrollment = await Enrollment.exists({
      userId: req.user._id,
      courseId: course._id,
    });
    viewerIsEnrolled = Boolean(enrollment);
  }

  const projectLesson = (lesson) => {
    const base = {
      _id: lesson._id,
      title: lesson.title,
      type: lesson.type,
      duration: lesson.duration,
      isFreePreview: lesson.isFreePreview,
      hasQuiz: lesson.hasQuiz,
      order: lesson.order,
      sectionId: lesson.sectionId,
    };
    const canSeeContent =
      viewerIsOwner || viewerIsAdmin || viewerIsEnrolled || lesson.isFreePreview === true;
    if (!canSeeContent) return base;

    // Generate short-lived signed URLs for authenticated Cloudinary videos.
    const isCloudinary = lesson.videoProvider === 'cloudinary' && lesson.videoPublicId;
    const videoUrl = isCloudinary ? signedVideoUrl(lesson.videoPublicId) : lesson.videoUrl;

    return {
      ...base,
      videoUrl,
      videoProvider: lesson.videoProvider,
      content: lesson.content,
    };
  };

  const lessonsBySection = new Map();
  for (const lesson of lessons) {
    const key = String(lesson.sectionId);
    if (!lessonsBySection.has(key)) lessonsBySection.set(key, []);
    lessonsBySection.get(key).push(projectLesson(lesson));
  }

  const data = sections.map((section) => ({
    _id: section._id,
    title: section.title,
    order: section.order,
    lessons: lessonsBySection.get(String(section._id)) ?? [],
  }));

  // Signed video URLs must not be stored in shared caches.
  setPublicCatalogCache(res, req.user);

  res.json({
    success: true,
    data: {
      sections: data,
      isEnrolled: viewerIsEnrolled,
    },
  });
});

export const getInstructorPublicCourses = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit);
  const skip = (page - 1) * limit;

  const instructor = await User.findOne({
    _id: id,
    role: { $in: ['instructor', 'admin'] },
    isActive: true,
  })
    .select('name avatar headline bio')
    .lean();

  if (!instructor) throw ApiError.notFound('Instructor not found.');

  const filter = { instructor: id, status: 'published' };
  const [items, total] = await Promise.all([
    Course.find(filter)
      .select(CATALOG_CARD_FIELDS)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Course.countDocuments(filter),
  ]);

  setPublicCatalogCache(res, req.user);

  res.json({
    success: true,
    data: {
      instructor,
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

export default {
  createCourse,
  getMyCourses,
  updateCourse,
  deleteCourse,
  submitForReview,
  archiveCourse,
  listPublishedCourses,
  getCourseBySlug,
  getCourseCurriculum,
  getInstructorPublicCourses,
};