import { Router } from 'express';

import {
  deleteAsset,
  uploadCourseThumbnail,
  uploadLessonVideo,
} from '../controllers/upload.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { instructorOrAdmin } from '../middleware/role.middleware.js';
import { uploadLimiter } from '../middleware/rateLimit.middleware.js';
import { uploadImage, uploadVideo } from '../middleware/upload.middleware.js';

const router = Router();

router.use(protect, instructorOrAdmin, uploadLimiter);

router.post('/image', uploadImage.single('image'), uploadCourseThumbnail);
router.post('/video', uploadVideo.single('video'), uploadLessonVideo);
router.delete('/:publicId', deleteAsset);

export default router;
