import helmet from 'helmet';

import { env } from '../config/env.js';

const isProd = env.isProd;

export const securityHeaders = [
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // 'unsafe-inline' for styles is unavoidable while we ship runtime
        // utility-class generators (Tailwind v4) and Helmet/Google fonts.
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        mediaSrc: ["'self'", 'https://res.cloudinary.com'],
        // Google Fonts hosts must appear here (not just in `style-src` /
        // `font-src`) because the SPA's Service Worker revalidates them
        // via `fetch()` — and `fetch()` is governed by `connect-src`.
        connectSrc: [
          "'self'",
          env.CLIENT_URL,
          ...env.CORS_ORIGINS,
          'https://fonts.googleapis.com',
          'https://fonts.gstatic.com',
        ],
        frameSrc: [
          'https://www.youtube.com',
          'https://www.youtube-nocookie.com',
          'https://player.vimeo.com',
          'https://player.cloudinary.com',
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(isProd ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    // 1 year, includeSubDomains, preload — the values required to qualify
    // for the browser HSTS preload list.
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
    // The API does not need to be embeddable anywhere.
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    // Allow the SPA on a different origin to load JSON we return.
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    // Don't promise embedder isolation — would break some Cloudinary players.
    crossOriginEmbedderPolicy: false,
  }),
];

export const redirectToHttps = (req, res, next) => {
  if (!isProd) return next();
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
  // 308 preserves the request method, so a redirected POST stays a POST.
  return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
};

const FORBIDDEN_METHODS = new Set(['TRACE', 'TRACK']);

export const denyObsoleteMethods = (req, res, next) => {
  if (FORBIDDEN_METHODS.has(req.method)) {
    res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    return res.status(405).json({
      success: false,
      message: `HTTP method ${req.method} is not allowed.`,
    });
  }
  return next();
};

export default {
  securityHeaders,
  redirectToHttps,
  denyObsoleteMethods,
};
