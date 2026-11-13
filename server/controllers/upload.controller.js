import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  cloudinary,
  signedVideoUrl,
  uploadStreamToCloudinary,
} from '../config/cloudinary.js';

const PUBLIC_ID_PATTERN = /^lms\/[\w/-]+$/;
const ALLOWED_RESOURCE_TYPES = new Set(['image', 'video', 'raw']);
const ALLOWED_DELIVERY_TYPES = new Set(['upload', 'authenticated', 'private']);

export const uploadCourseThumbnail = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image file provided.');

  const { secure_url, public_id } = await uploadStreamToCloudinary(
    req.file.buffer,
    'lms/thumbnails',
    'image',
  );

  res.status(201).json({
    success: true,
    url: secure_url,
    publicId: public_id,
  });
});


export const uploadLessonVideo = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No video file provided.');

  const { public_id, duration, type } = await uploadStreamToCloudinary(
    req.file.buffer,
    'lms/lesson-videos',
    'video',
    { type: 'authenticated' },
  );

  res.status(201).json({
    success: true,
    url: signedVideoUrl(public_id),
    publicId: public_id,
    duration,
    type,
  });
});

export const deleteAsset = asyncHandler(async (req, res) => {
  const decoded = decodeURIComponent(req.params.publicId || '');
  if (!PUBLIC_ID_PATTERN.test(decoded)) {
    throw ApiError.badRequest('Invalid public ID.');
  }

  const requestedType = String(req.query.resourceType || 'image').toLowerCase();
  if (!ALLOWED_RESOURCE_TYPES.has(requestedType)) {
    throw ApiError.badRequest('Invalid resourceType. Use image, video, or raw.');
  }

  const requestedDelivery = String(req.query.type || 'upload').toLowerCase();
  if (!ALLOWED_DELIVERY_TYPES.has(requestedDelivery)) {
    throw ApiError.badRequest('Invalid type. Use upload, authenticated, or private.');
  }

  const result = await cloudinary.uploader.destroy(decoded, {
    resource_type: requestedType,
    type: requestedDelivery,
    invalidate: true,
  });

  if (result.result !== 'ok' && result.result !== 'not found') {
    throw ApiError.badRequest(`Failed to delete asset: ${result.result}`);
  }

  res.json({
    success: true,
    publicId: decoded,
    result: result.result,
  });
});

export default {
  uploadCourseThumbnail,
  uploadLessonVideo,
  deleteAsset,
};
