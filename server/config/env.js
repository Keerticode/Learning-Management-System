import 'dotenv/config';

const NODE_ENVS = ['development', 'production', 'test'];

const isProd = process.env.NODE_ENV === 'production';

const errors = [];

const requireVar = (name, value) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    errors.push(`Missing required env var: ${name}`);
    return '';
  }
  return String(value).trim();
};

const optionalVar = (value, fallback = '') => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }
  return String(value).trim();
};

const parseInteger = (name, value, fallback, { min, max } = {}) => {
  const raw = value ?? fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    errors.push(`Invalid integer for ${name}: "${value}"`);
    return fallback;
  }
  if (min !== undefined && parsed < min) {
    errors.push(`${name} must be >= ${min} (got ${parsed})`);
  }
  if (max !== undefined && parsed > max) {
    errors.push(`${name} must be <= ${max} (got ${parsed})`);
  }
  return parsed;
};

const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const parseList = (value) =>
  optionalVar(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

// Runtime
const NODE_ENV = optionalVar(process.env.NODE_ENV, 'development');
if (!NODE_ENVS.includes(NODE_ENV)) {
  errors.push(`NODE_ENV must be one of ${NODE_ENVS.join(', ')} (got "${NODE_ENV}")`);
}

const PORT = parseInteger('PORT', process.env.PORT, 5000, { min: 1, max: 65535 });
const CLIENT_URL = requireVar('CLIENT_URL', process.env.CLIENT_URL);

if (isProd && CLIENT_URL.includes('*')) {
  errors.push('CLIENT_URL must not contain a wildcard ("*") in production.');
}

const corsOriginsList = parseList(process.env.CORS_ORIGINS);

// CLIENT_URL is automatically included in the CORS allowlist.
const CORS_ORIGINS = Array.from(new Set([CLIENT_URL, ...corsOriginsList].filter(Boolean)));

if (isProd && CORS_ORIGINS.some((origin) => origin.includes('*'))) {
  errors.push('CORS_ORIGINS must not contain a wildcard ("*") in production.');
}

// Database
const MONGO_URI = requireVar('MONGO_URI', process.env.MONGO_URI);
if (MONGO_URI && !MONGO_URI.startsWith('mongodb')) {
  errors.push('MONGO_URI must start with "mongodb://" or "mongodb+srv://".');
}

// JWT — Access and rotating refresh tokens
const JWT_ACCESS_SECRET = requireVar('JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET);
const JWT_ACCESS_EXPIRES_IN = optionalVar(process.env.JWT_ACCESS_EXPIRES_IN, '15m');
const JWT_REFRESH_SECRET = requireVar('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET);
const JWT_REFRESH_EXPIRES_IN = optionalVar(process.env.JWT_REFRESH_EXPIRES_IN, '7d');

// Production requires strong, separate JWT secrets.
if (isProd) {
  if (JWT_ACCESS_SECRET.length < 32) {
    errors.push('JWT_ACCESS_SECRET must be at least 32 characters in production.');
  }
  if (JWT_REFRESH_SECRET.length < 32) {
    errors.push('JWT_REFRESH_SECRET must be at least 32 characters in production.');
  }
  if (JWT_ACCESS_SECRET && JWT_ACCESS_SECRET === JWT_REFRESH_SECRET) {
    errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production.');
  }
}

// Cloudinary
const CLOUDINARY_CLOUD_NAME = optionalVar(process.env.CLOUDINARY_CLOUD_NAME);
const CLOUDINARY_API_KEY = optionalVar(process.env.CLOUDINARY_API_KEY);
const CLOUDINARY_API_SECRET = optionalVar(process.env.CLOUDINARY_API_SECRET);
const CLOUDINARY_CONFIGURED = Boolean(
  CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET,
);

// Cloudinary is required in production.
if (isProd && !CLOUDINARY_CONFIGURED) {
  errors.push(
    'Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are required in production.',
  );
}

// Mail (SMTP)
const SMTP_HOST = optionalVar(process.env.SMTP_HOST);
const SMTP_PORT = parseInteger('SMTP_PORT', process.env.SMTP_PORT, 587, { min: 1, max: 65535 });
const SMTP_SECURE = parseBool(process.env.SMTP_SECURE, false);
const SMTP_USER = optionalVar(process.env.SMTP_USER);
const SMTP_PASS = optionalVar(process.env.SMTP_PASS);
const MAIL_FROM = optionalVar(process.env.MAIL_FROM, 'LMS Platform <no-reply@example.com>');
const MAIL_CONFIGURED = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

// Redis
const REDIS_URL = optionalVar(process.env.REDIS_URL);

// Seeder admin
const ADMIN_EMAIL = optionalVar(process.env.ADMIN_EMAIL);
const ADMIN_PASSWORD = optionalVar(process.env.ADMIN_PASSWORD);
const ADMIN_NAME = optionalVar(process.env.ADMIN_NAME, 'Platform Admin');

if (ADMIN_PASSWORD && ADMIN_PASSWORD.length < 6) {
  errors.push('ADMIN_PASSWORD must be at least 6 characters when set.');
}

// Password hashing
const BCRYPT_ROUNDS = parseInteger('BCRYPT_ROUNDS', process.env.BCRYPT_ROUNDS, 12, {
  min: 10,
  max: 14,
});

// Account lockout
const MAX_LOGIN_ATTEMPTS = parseInteger(
  'MAX_LOGIN_ATTEMPTS',
  process.env.MAX_LOGIN_ATTEMPTS,
  10,
  { min: 3, max: 50 },
);
const LOCK_DURATION_MIN = parseInteger(
  'LOCK_DURATION_MIN',
  process.env.LOCK_DURATION_MIN,
  15,
  { min: 1, max: 1440 },
);

// Email verification and password reset token TTLs
const EMAIL_VERIFICATION_TTL_MIN = parseInteger(
  'EMAIL_VERIFICATION_TTL_MIN',
  process.env.EMAIL_VERIFICATION_TTL_MIN,
  60 * 24,
  { min: 5, max: 60 * 24 * 7 },
);
const PASSWORD_RESET_TTL_MIN = parseInteger(
  'PASSWORD_RESET_TTL_MIN',
  process.env.PASSWORD_RESET_TTL_MIN,
  15,
  { min: 5, max: 60 * 4 },
);

// Refresh-token cookie name (HttpOnly cookie)
const REFRESH_COOKIE_NAME = optionalVar(process.env.REFRESH_COOKIE_NAME, 'lms.refresh');

// Logging
const LOG_LEVEL = optionalVar(process.env.LOG_LEVEL, isProd ? 'info' : 'debug');

// Feature flags
// Server-side defaults must match client-side defaults in features.js.
const FEATURE_CERTIFICATES = parseBool(process.env.FEATURE_CERTIFICATES, true);
const FEATURE_HLS = parseBool(process.env.FEATURE_HLS, false);
const FEATURE_BETA_QUIZ_TIMER = parseBool(process.env.FEATURE_BETA_QUIZ_TIMER, false);

// Stop startup if environment validation fails.
if (errors.length > 0) {
  const message = [
    'Environment validation failed:',
    ...errors.map((e) => `  - ${e}`),
    '',
    'Fix your .env (see .env.example) and restart.',
  ].join('\n');
  // eslint-disable-next-line no-console
  console.error(message);
  process.exit(1);
}

export const env = Object.freeze({
  NODE_ENV,
  isProd,
  isDev: NODE_ENV === 'development',
  isTest: NODE_ENV === 'test',
  PORT,
  CLIENT_URL,
  CORS_ORIGINS,
  MONGO_URI,
  JWT_ACCESS_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_CONFIGURED,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  MAIL_CONFIGURED,
  REDIS_URL,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_NAME,
  BCRYPT_ROUNDS,
  MAX_LOGIN_ATTEMPTS,
  LOCK_DURATION_MIN,
  EMAIL_VERIFICATION_TTL_MIN,
  PASSWORD_RESET_TTL_MIN,
  REFRESH_COOKIE_NAME,
  LOG_LEVEL,
  FEATURE_CERTIFICATES,
  FEATURE_HLS,
  FEATURE_BETA_QUIZ_TIMER,
});

export default env;