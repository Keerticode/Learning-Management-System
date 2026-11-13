import { Router } from 'express';

import {
  getMyAttempts,
  getMyBestScore,
  getQuizForStudent,
  submitQuiz,
} from '../controllers/quiz.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { quizSubmitLimiter } from '../middleware/rateLimit.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  myAttemptsValidator,
  quizIdParamValidator,
  submitQuizValidator,
} from '../validators/quiz.validator.js';

const router = Router();

router.use(protect);

router.post(
  '/:id/submit',
  quizSubmitLimiter,
  validate(submitQuizValidator),
  submitQuiz,
);

router.get('/:id/attempts/mine', validate(myAttemptsValidator), getMyAttempts);

router.get('/:id/best/mine', validate(quizIdParamValidator), getMyBestScore);

router.get('/:id', validate(quizIdParamValidator), getQuizForStudent);

export default router;
