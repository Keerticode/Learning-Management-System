import { Course } from '../models/Course.model.js';
import { Enrollment } from '../models/Enrollment.model.js';
import { Lesson } from '../models/Lesson.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';


const buildProgressPayload = (enrollment, totalLessons) => ({
  progressPercent: enrollment.progressPercent,
  completedLessons: enrollment.completedLessons,
  completedAt: enrollment.completedAt,
  lastAccessedLesson: enrollment.lastAccessedLesson,
  totalLessons,
});



const findEnrolledLessonContextOr403 = async (lessonId, user) => {
  const lesson = await Lesson.findById(lessonId).select('courseId');
  if (!lesson) throw ApiError.notFound('Lesson not found.');

  const enrollment = await Enrollment.findOne({
    userId: user._id,
    courseId: lesson.courseId,
  });

  if (!enrollment) {
    throw ApiError.forbidden('You must be enrolled in this course to track progress.');
  }

  return { lesson, enrollment };
};


export const markLessonComplete = asyncHandler(async (req, res) => {
  const { lesson, enrollment } = await findEnrolledLessonContextOr403(
    req.params.id,
    req.user,
  );

  enrollment.completedLessons.addToSet(lesson._id);
  await enrollment.save();

  const course = await Course.findById(enrollment.courseId).select('totalLessons').lean();
  res.json({
    success: true,
    data: buildProgressPayload(enrollment, course?.totalLessons ?? 0),
  });
});


export const markLessonIncomplete = asyncHandler(async (req, res) => {
  const { lesson, enrollment } = await findEnrolledLessonContextOr403(
    req.params.id,
    req.user,
  );

  enrollment.completedLessons.pull(lesson._id);
  await enrollment.save();

  const course = await Course.findById(enrollment.courseId).select('totalLessons').lean();
  res.json({
    success: true,
    data: buildProgressPayload(enrollment, course?.totalLessons ?? 0),
  });
});


export const setLastAccessed = asyncHandler(async (req, res) => {
  const { lesson, enrollment } = await findEnrolledLessonContextOr403(
    req.params.id,
    req.user,
  );

  await Enrollment.updateOne(
    { _id: enrollment._id },
    { $set: { lastAccessedLesson: lesson._id } },
  );

  res.json({
    success: true,
    data: { lastAccessedLesson: lesson._id },
  });
});


export const getCourseProgress = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id).select('totalLessons').lean();
  if (!course) throw ApiError.notFound('Course not found.');

  const enrollment = await Enrollment.findOne({
    userId: req.user._id,
    courseId: req.params.id,
  });

  if (!enrollment) throw ApiError.notFound('You are not enrolled in this course.');

  res.json({
    success: true,
    data: buildProgressPayload(enrollment, course.totalLessons ?? 0),
  });
});

export default {
  markLessonComplete,
  markLessonIncomplete,
  setLastAccessed,
  getCourseProgress,
};
