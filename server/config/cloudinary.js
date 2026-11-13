import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

import { env } from './env.js';

if (env.CLOUDINARY_CONFIGURED) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else if (env.isProd) {
  throw new Error('Cloudinary credentials are required in production.');
} else {
  // eslint-disable-next-line no-console
  console.warn(
    '[cloudinary] Credentials not set. Upload features will be disabled until you configure CLOUDINARY_* env vars.',
  );
}

const ALLOWED_DELIVERY_TYPES = new Set(['upload', 'authenticated', 'private']);

/**
 * Upload a raw Buffer to Cloudinary using their streaming API.
 *
 * @param {Buffer} buffer - File bytes.
 * @param {string} folder - Target Cloudinary folder.
 * @param {'auto'|'image'|'video'|'raw'} [resourceType='auto']
 * @param {{ type?: 'upload'|'authenticated'|'private' }} [options]
 * @returns {Promise<{ secure_url: string, public_id: string, duration: number|null, type: string }>}
 */
export function uploadStreamToCloudinary(buffer, folder, resourceType = 'auto', options = {}) {
  if (!env.CLOUDINARY_CONFIGURED) {
    return Promise.reject(
      new Error('Cloudinary is not configured. Set CLOUDINARY_* environment variables.'),
    );
  }
  if (!Buffer.isBuffer(buffer)) {
    return Promise.reject(new TypeError('uploadStreamToCloudinary expects a Buffer.'));
  }
  if (!folder || typeof folder !== 'string') {
    return Promise.reject(new TypeError('uploadStreamToCloudinary expects a non-empty folder.'));
  }

  const deliveryType = options.type ?? 'upload';
  if (!ALLOWED_DELIVERY_TYPES.has(deliveryType)) {
    return Promise.reject(
      new TypeError(`Invalid delivery type "${deliveryType}". Use one of: upload, authenticated, private.`),
    );
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, type: deliveryType },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('Cloudinary returned an empty result.'));
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          duration: typeof result.duration === 'number' ? result.duration : null,
          type: result.type ?? deliveryType,
        });
      },
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

/**
 * Generate a short-lived signed URL for authenticated Cloudinary videos.
 *
 * @param {string} publicId - Cloudinary public ID.
 * @param {number} [expiresInSec=3600] - URL lifetime in seconds.
 * @returns {string|null} Signed HTTPS URL.
 */
export const signedVideoUrl = (publicId, expiresInSec = 3600) => {
  if (!publicId) return null;
  return cloudinary.url(publicId, {
    resource_type: 'video',
    secure: true,
    sign_url: true,
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + expiresInSec,
  });
};

export { cloudinary };
export default cloudinary;