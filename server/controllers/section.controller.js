import { Course } from '../models/Course.model.js';
import { Lesson } from '../models/Lesson.model.js';
import { Section } from '../models/Section.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pickFields } from '../utils/pickFields.js';

const SECTION_FIELDS = ['title'];

const isAdmin = (user) => user?.role === 'admin';

const isOwner = (course, user) =>
  course?.instructor && user?._id && course.instructor.equals(user._id);

const findOwnedCourseOr404 = async (courseId, user) => {
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound('Course not found.');
  if (!isOwner(course, user) && !isAdmin(user)) {
    throw ApiError.notFound('Course not found.');
  }
  return course;
};

const findOwnedSectionOr404 = async (sectionId, user) => {
  const section = await Section.findById(sectionId);
  if (!section) throw ApiError.notFound('Section not found.');

  const course = await Course.findById(section.courseId);
  if (!course || (!isOwner(course, user) && !isAdmin(user))) {
    throw ApiError.notFound('Section not found.');
  }
  return { section, course };
};

export const createSection = asyncHandler(async (req, res) => {
  const course = await findOwnedCourseOr404(req.params.courseId, req.user);
  const { title } = pickFields(req.body, SECTION_FIELDS);

  const last = await Section.findOne({ courseId: course._id })
    .sort({ order: -1 })
    .select('order')
    .lean();
  const order = (last?.order ?? -1) + 1;

  const section = await Section.create({
    courseId: course._id,
    title,
    order,
  });

  res.status(201).json({ success: true, section });
});

export const updateSection = asyncHandler(async (req, res) => {
  const { section } = await findOwnedSectionOr404(req.params.id, req.user);
  const updates = pickFields(req.body, SECTION_FIELDS);

  if (Object.keys(updates).length === 0) {
    throw ApiError.badRequest('No updatable fields provided.');
  }

  Object.assign(section, updates);
  await section.save();

  res.json({ success: true, section });
});

export const deleteSection = asyncHandler(async (req, res) => {
  const { section } = await findOwnedSectionOr404(req.params.id, req.user);

  const lessons = await Lesson.find({ sectionId: section._id });
  for (const lesson of lessons) {
    await lesson.deleteOne();
  }

  await section.deleteOne();

  res.json({ success: true, message: 'Section deleted successfully.' });
});

export const reorderSections = asyncHandler(async (req, res) => {
  const course = await findOwnedCourseOr404(req.params.courseId, req.user);
  const items = req.body;

  const ids = items.map((item) => item.id);
  const owned = await Section.countDocuments({ _id: { $in: ids }, courseId: course._id });
  if (owned !== items.length) {
    throw ApiError.badRequest('Some sections do not belong to this course.');
  }

  const tempOps = items.map((item, idx) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { order: -(idx + 1) } },
    },
  }));
  await Section.bulkWrite(tempOps, { ordered: true });

  const finalOps = items.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { order: item.order } },
    },
  }));
  await Section.bulkWrite(finalOps, { ordered: true });

  const sections = await Section.find({ courseId: course._id }).sort({ order: 1 });
  res.json({ success: true, sections });
});

export default {
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
};
