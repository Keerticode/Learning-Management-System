import { Router } from 'express';

import { getMyEnrollments } from '../controllers/enrollment.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { myEnrollmentsValidator } from '../validators/enrollment.validator.js';

const router = Router();

router.use(protect);

router.get('/mine', validate(myEnrollmentsValidator), getMyEnrollments);

export default router;
