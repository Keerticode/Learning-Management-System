import { env } from './env.js';

// Centralized server-side feature flags.
// Environment variables allow features to be enabled or disabled without code changes.

// Keep defaults consistent with client/src/config/features.js.
// Server flags control API access; client flags only control UI visibility.

export const features = Object.freeze({
  // Certificate generation and download endpoints.
  certificates: env.FEATURE_CERTIFICATES,

  // Cloudinary HLS streaming. Falls back to progressive MP4 playback when disabled.
  hlsStreaming: env.FEATURE_HLS,

  // Beta quiz time-limit functionality. Disabled by default.
  betaQuizTimer: env.FEATURE_BETA_QUIZ_TIMER,
});

export default features;