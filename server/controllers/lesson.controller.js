
import { cloudinary, signedVideoUrl } from '../config/cloudinary.js';
import { Course } from '../models/Course.model.js';
import { Lesson } from '../models/Lesson.model.js';
import { Section } from '../models/Section.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pickFields } from '../utils/pickFields.js';

const LESSON_FIELDS = [
  'title',
  'type',
  'videoUrl',
  'videoPublicId',
  'videoProvider',
  'content',
  'duration',
  'isFreePreview',
];

const isAdmin = (user) => user?.role === 'admin';

const isOwner = (course, user) =>
  course?.instructor && user?._id && course.instructor.equals(user._id);

const findOwnedSectionOr404 = async (sectionId, user) => {
  const section = await Section.findById(sectionId);
  if (!section) throw ApiError.notFound('Section not found.');

  const course = await Course.findById(section.courseId);
  if (!course || (!isOwner(course, user) && !isAdmin(user))) {
    throw ApiError.notFound('Section not found.');
  }
  return { section, course };
};

const findOwnedLessonOr404 = async (lessonId, user) => {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw ApiError.notFound('Lesson not found.');

  const course = await Course.findById(lesson.courseId);
  if (!course || (!isOwner(course, user) && !isAdmin(user))) {
    throw ApiError.notFound('Lesson not found.');
  }
  return { lesson, course };
};

const destroyCloudinaryVideo = async (publicId) => {
  if (!publicId) return;
  try {
    // Lesson videos live under `type: 'authenticated'`, so the destroy
    // call MUST pass the matching delivery type — otherwise Cloudinary
    // looks under the default `upload` namespace and silently returns
    // "not found" while the real asset stays orphaned in the account.
    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'video',
      type: 'authenticated',
      invalidate: true,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[lesson] Cloudinary destroy failed for "${publicId}": ${err.message}`);
  }
};


const projectLessonForResponse = (lesson) => {
  const obj = typeof lesson.toObject === 'function' ? lesson.toObject() : { ...lesson };
  if (obj.videoProvider === 'cloudinary' && obj.videoPublicId) {
    obj.videoUrl = signedVideoUrl(obj.videoPublicId);
  }
  return obj;
};

export const createLesson = asyncHandler(async (req, res) => {
  const { section } = await findOwnedSectionOr404(req.params.sectionId, req.user);
  const data = pickFields(req.body, LESSON_FIELDS);

  const last = await Lesson.findOne({ sectionId: section._id })
    .sort({ order: -1 })
    .select('order')
    .lean();
  const order = (last?.order ?? -1) + 1;

  const lesson = await Lesson.create({
    ...data,
    sectionId: section._id,
    courseId: section.courseId,
    order,
  });

  res.status(201).json({ success: true, lesson: projectLessonForResponse(lesson) });
});


export const updateLesson = asyncHandler(async (req, res) => {
  const { lesson } = await findOwnedLessonOr404(req.params.id, req.user);
  const updates = pickFields(req.body, LESSON_FIELDS);

  if (Object.keys(updates).length === 0) {
    throw ApiError.badRequest('No updatable fields provided.');
  }

  const previousPublicId = lesson.videoPublicId;
  Object.assign(lesson, updates);
  await lesson.save();

  const replacedVideo =
    Object.prototype.hasOwnProperty.call(updates, 'videoPublicId') &&
    previousPublicId &&
    previousPublicId !== lesson.videoPublicId;

  if (replacedVideo) {
    await destroyCloudinaryVideo(previousPublicId);
  }

  res.json({ success: true, lesson: projectLessonForResponse(lesson) });
});


export const deleteLesson = asyncHandler(async (req, res) => {
  const { lesson } = await findOwnedLessonOr404(req.params.id, req.user);
  const publicId = lesson.videoPublicId;

  await lesson.deleteOne();
  await destroyCloudinaryVideo(publicId);

  res.json({ success: true, message: 'Lesson deleted successfully.' });
});


export const reorderLessons = asyncHandler(async (req, res) => {
  const { section } = await findOwnedSectionOr404(req.params.sectionId, req.user);
  const items = req.body;

  const ids = items.map((item) => item.id);
  const owned = await Lesson.countDocuments({ _id: { $in: ids }, sectionId: section._id });
  if (owned !== items.length) {
    throw ApiError.badRequest('Some lessons do not belong to this section.');
  }

  const tempOps = items.map((item, idx) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { order: -(idx + 1) } },
    },
  }));
  await Lesson.bulkWrite(tempOps, { ordered: true });

  const finalOps = items.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { order: item.order } },
    },
  }));
  await Lesson.bulkWrite(finalOps, { ordered: true });

  const lessons = await Lesson.find({ sectionId: section._id }).sort({ order: 1 });
  res.json({ success: true, lessons: lessons.map(projectLessonForResponse) });
});


export const getLessonForInstructor = asyncHandler(async (req, res) => {
  const { lesson } = await findOwnedLessonOr404(req.params.id, req.user);
  res.json({ success: true, lesson: projectLessonForResponse(lesson) });
});

export default {
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  getLessonForInstructor,
};