import { Router } from 'express';

import {
  deleteLesson,
  getLessonForInstructor,
  updateLesson,
} from '../controllers/lesson.controller.js';
import {
  createQuiz,
  getQuizByLessonForInstructor,
} from '../controllers/quiz.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { instructorOrAdmin } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  lessonIdParamValidator,
  updateLessonValidator,
} from '../validators/lesson.validator.js';
import {
  createQuizValidator,
  lessonQuizParamValidator,
} from '../validators/quiz.validator.js';

const router = Router();

router.use(protect, instructorOrAdmin);

router
  .route('/:lessonId/quiz')
  .get(validate(lessonQuizParamValidator), getQuizByLessonForInstructor)
  .post(validate(createQuizValidator), createQuiz);

router
  .route('/:id')
  .get(validate(lessonIdParamValidator), getLessonForInstructor)
  .patch(validate(updateLessonValidator), updateLesson)
  .delete(validate(lessonIdParamValidator), deleteLesson);

export default router;
