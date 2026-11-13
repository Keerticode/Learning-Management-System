import multer from 'multer';

import { ApiError } from '../utils/ApiError.js';

const ONE_MB = 1024 * 1024;

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const buildFileFilter = (allowed, kind) => (_req, file, cb) => {
  if (allowed.has(file.mimetype)) return cb(null, true);
  return cb(
    ApiError.badRequest(
      `Unsupported ${kind} type "${file.mimetype}". Allowed: ${[...allowed].join(', ')}.`,
    ),
  );
};

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * ONE_MB, files: 1 },
  fileFilter: buildFileFilter(ALLOWED_IMAGE_MIME, 'image'),
});

export const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * ONE_MB, files: 1 },
  fileFilter: buildFileFilter(ALLOWED_VIDEO_MIME, 'video'),
});

export default { uploadImage, uploadVideo };
