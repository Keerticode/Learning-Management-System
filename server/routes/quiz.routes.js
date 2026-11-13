import { Router } from 'express';

import {
  deleteQuiz,
  getQuizForInstructor,
  updateQuiz,
} from '../controllers/quiz.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { instructorOrAdmin } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  quizIdParamValidator,
  updateQuizValidator,
} from '../validators/quiz.validator.js';

const router = Router();

router.use(protect, instructorOrAdmin);

// `/:id/instructor` is declared BEFORE the bare `/:id` route so the
// more specific path wins the match instead of being shadowed by the
// generic id matcher.
router.get('/:id/instructor', validate(quizIdParamValidator), getQuizForInstructor);

router
  .route('/:id')
  .patch(validate(updateQuizValidator), updateQuiz)
  .delete(validate(quizIdParamValidator), deleteQuiz);

export default router;
