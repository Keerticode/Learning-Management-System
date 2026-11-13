import { Router } from 'express';

import {
  createLesson,
  reorderLessons,
} from '../controllers/lesson.controller.js';
import {
  createSection,
  deleteSection,
  reorderSections,
  updateSection,
} from '../controllers/section.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { instructorOrAdmin } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createLessonValidator,
  reorderLessonsValidator,
} from '../validators/lesson.validator.js';
import {
  createSectionValidator,
  reorderSectionsValidator,
  sectionIdParamValidator,
  updateSectionValidator,
} from '../validators/section.validator.js';

export const courseSectionsRouter = Router({ mergeParams: true });

courseSectionsRouter.use(protect, instructorOrAdmin);

courseSectionsRouter.patch('/reorder', validate(reorderSectionsValidator), reorderSections);
courseSectionsRouter.post('/', validate(createSectionValidator), createSection);

const sectionRouter = Router();

sectionRouter.use(protect, instructorOrAdmin);

sectionRouter.patch(
  '/:sectionId/lessons/reorder',
  validate(reorderLessonsValidator),
  reorderLessons,
);
sectionRouter.post('/:sectionId/lessons', validate(createLessonValidator), createLesson);

sectionRouter
  .route('/:id')
  .patch(validate(updateSectionValidator), updateSection)
  .delete(validate(sectionIdParamValidator), deleteSection);

export default sectionRouter;
