import { Course } from '../models/Course.model.js';
import { Enrollment } from '../models/Enrollment.model.js';
import { Lesson } from '../models/Lesson.model.js';
import { Quiz } from '../models/Quiz.model.js';
import { QuizAttempt } from '../models/QuizAttempt.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pickFields } from '../utils/pickFields.js';

const QUIZ_FIELDS = [
  'title',
  'description',
  'passingScore',
  'timeLimitSeconds',
  'questions',
];

const isAdmin = (user) => user?.role === 'admin';

const isOwner = (course, user) =>
  course?.instructor && user?._id && course.instructor.equals(user._id);


const findOwnedLessonOr404 = async (lessonId, user) => {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw ApiError.notFound('Lesson not found.');

  const course = await Course.findById(lesson.courseId);
  if (!course || (!isOwner(course, user) && !isAdmin(user))) {
    throw ApiError.notFound('Lesson not found.');
  }
  return { lesson, course };
};


const findOwnedQuizOr404 = async (quizId, user) => {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw ApiError.notFound('Quiz not found.');

  const course = await Course.findById(quiz.courseId);
  if (!course || (!isOwner(course, user) && !isAdmin(user))) {
    throw ApiError.notFound('Quiz not found.');
  }
  return { quiz, course };
};


export const createQuiz = asyncHandler(async (req, res) => {
  const { lesson } = await findOwnedLessonOr404(req.params.lessonId, req.user);

  const existing = await Quiz.exists({ lessonId: lesson._id });
  if (existing) {
    throw ApiError.conflict('This lesson already has a quiz.');
  }

  const data = pickFields(req.body, QUIZ_FIELDS);

  const quiz = await Quiz.create({
    ...data,
    lessonId: lesson._id,
    courseId: lesson.courseId,
  });

  res.status(201).json({ success: true, quiz });
});


export const updateQuiz = asyncHandler(async (req, res) => {
  const { quiz } = await findOwnedQuizOr404(req.params.id, req.user);
  const updates = pickFields(req.body, QUIZ_FIELDS);

  if (Object.keys(updates).length === 0) {
    throw ApiError.badRequest('No updatable fields provided.');
  }

  Object.assign(quiz, updates);
  await quiz.save();

  res.json({ success: true, quiz });
});


export const deleteQuiz = asyncHandler(async (req, res) => {
  const { quiz } = await findOwnedQuizOr404(req.params.id, req.user);

  await quiz.deleteOne();

  res.json({ success: true, message: 'Quiz deleted successfully.' });
});


export const getQuizForInstructor = asyncHandler(async (req, res) => {
  const { quiz } = await findOwnedQuizOr404(req.params.id, req.user);
  res.json({ success: true, quiz });
});


export const getQuizByLessonForInstructor = asyncHandler(async (req, res) => {
  const { lesson } = await findOwnedLessonOr404(req.params.lessonId, req.user);
  const quiz = await Quiz.findOne({ lessonId: lesson._id });
  res.json({ success: true, quiz: quiz ?? null, lesson });
});

const ATTEMPTS_DEFAULT_LIMIT = 10;
const ATTEMPTS_MAX_LIMIT = 50;
const TIME_LIMIT_GRACE_SECONDS = 5;


const findEnrolledQuizOr403 = async (quizId, user) => {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw ApiError.notFound('Quiz not found.');

  const enrollment = await Enrollment.exists({
    userId: user._id,
    courseId: quiz.courseId,
  });
  if (!enrollment) {
    throw ApiError.forbidden('You must be enrolled in this course to access the quiz.');
  }

  return quiz;
};


export const getQuizForStudent = asyncHandler(async (req, res) => {
  const quiz = await findEnrolledQuizOr403(req.params.id, req.user);
  res.json({ success: true, quiz: quiz.toStudentView() });
});

export const submitQuiz = asyncHandler(async (req, res) => {
  const quiz = await findEnrolledQuizOr403(req.params.id, req.user);

  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  if (answers.length !== quiz.questions.length) {
    throw ApiError.badRequest(
      `Expected ${quiz.questions.length} answers, received ${answers.length}.`,
    );
  }

  const reportedSeconds = Number.isInteger(req.body.timeSpentSeconds)
    ? req.body.timeSpentSeconds
    : 0;
  const clampedSeconds =
    quiz.timeLimitSeconds > 0
      ? Math.max(0, Math.min(reportedSeconds, quiz.timeLimitSeconds + TIME_LIMIT_GRACE_SECONDS))
      : Math.max(0, reportedSeconds);

  // Anti-cheat signal: tab switches reported by the client.
  // Clamped to a reasonable [0, 9999] range so a forged payload can't
  // poison aggregate "average tab switches per attempt" analytics.
  const reportedTabSwitches = Number.isInteger(req.body.tabSwitches)
    ? req.body.tabSwitches
    : 0;
  const clampedTabSwitches = Math.max(0, Math.min(reportedTabSwitches, 9999));

  const attempt = await QuizAttempt.create({
    userId: req.user._id,
    quizId: quiz._id,
    courseId: quiz.courseId,
    answers,
    timeSpentSeconds: clampedSeconds,
    tabSwitches: clampedTabSwitches,
  });

  // Per-question feedback is response-only — it is intentionally NOT
  // persisted on the attempt (the raw answers + the live quiz are the
  // canonical source, so an instructor edit to `explanation` after
  // the fact is reflected the next time history is re-derived).
  const perQuestion = quiz.questions.map((question, index) => ({
    correct: answers[index] === question.correctIndex,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
  }));

  res.status(201).json({
    success: true,
    attemptId: attempt._id,
    score: attempt.score,
    correctCount: attempt.correctCount,
    totalQuestions: attempt.totalQuestions,
    passed: attempt.passed,
    timeSpentSeconds: attempt.timeSpentSeconds,
    perQuestion,
  });
});


export const getMyAttempts = asyncHandler(async (req, res) => {
  const quiz = await findEnrolledQuizOr403(req.params.id, req.user);

  const page = Number.isInteger(req.query.page) && req.query.page > 0 ? req.query.page : 1;
  const requestedLimit =
    Number.isInteger(req.query.limit) && req.query.limit > 0
      ? req.query.limit
      : ATTEMPTS_DEFAULT_LIMIT;
  const limit = Math.min(requestedLimit, ATTEMPTS_MAX_LIMIT);
  const skip = (page - 1) * limit;

  const filter = { userId: req.user._id, quizId: quiz._id };

  const [items, total] = await Promise.all([
    QuizAttempt.find(filter).sort({ attemptedAt: -1 }).skip(skip).limit(limit).lean(),
    QuizAttempt.countDocuments(filter),
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


export const getMyBestScore = asyncHandler(async (req, res) => {
  const quiz = await findEnrolledQuizOr403(req.params.id, req.user);

  const [aggregate] = await QuizAttempt.aggregate([
    { $match: { userId: req.user._id, quizId: quiz._id } },
    {
      $group: {
        _id: '$quizId',
        best: { $max: '$score' },
        attempts: { $sum: 1 },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      quizId: quiz._id,
      best: aggregate?.best ?? null,
      attempts: aggregate?.attempts ?? 0,
      passingScore: quiz.passingScore,
      passed: aggregate ? aggregate.best >= quiz.passingScore : false,
    },
  });
});

export default {
  createQuiz,
  updateQuiz,
  deleteQuiz,
  getQuizForInstructor,
  getQuizByLessonForInstructor,
  getQuizForStudent,
  submitQuiz,
  getMyAttempts,
  getMyBestScore,
};
