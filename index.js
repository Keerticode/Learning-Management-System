import { createRequire } from 'node:module';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';

import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { redis } from './config/redis.js';
import { swaggerSpec, swaggerUiOptions } from './config/swagger.js';
import { errorHandler } from './middleware/error.middleware.js';
import { notFound } from './middleware/notFound.middleware.js';
import { apiLimiter } from './middleware/rateLimit.middleware.js';
import { requestId } from './middleware/requestId.middleware.js';
import {
  denyObsoleteMethods,
  redirectToHttps,
  securityHeaders,
} from './middleware/security.middleware.js';
import adminRoutes from './routes/admin.routes.js';
import authRoutes from './routes/auth.routes.js';
import courseRoutes from './routes/course.routes.js';
import enrollmentRoutes from './routes/enrollment.routes.js';
import instructorRoutes from './routes/instructor.routes.js';
import lessonRoutes from './routes/lesson.routes.js';
import progressRoutes from './routes/progress.routes.js';
import quizStudentRoutes from './routes/quiz.student.routes.js';
import quizRoutes from './routes/quiz.routes.js';
import sectionRoutes, { courseSectionsRouter } from './routes/section.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import userRoutes from './routes/user.routes.js';
import { httpLogger, logger } from './utils/logger.js';
import { renderWelcomePage } from './utils/welcomePage.js';

const require = createRequire(import.meta.url);
const { version: pkgVersion } = require('./package.json');

const app = express();

app.disable('x-powered-by');

if (env.isProd) {
  app.set('trust proxy', 1);
}

app.use(requestId);

app.use(redirectToHttps);

app.use(securityHeaders);

app.use(denyObsoleteMethods);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
    maxAge: 86_400,
    exposedHeaders: [
      'X-Request-Id',
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'Cache-Control',
      'Vary',
    ],
  }),
);

app.use(compression({ level: 6, threshold: 1024 }));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use(cookieParser());

app.use((req, _res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});

app.use(httpLogger);

app.use(apiLimiter);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

app.get('/', (_req, res) => {
  res
    .type('html')
    .send(renderWelcomePage({ version: pkgVersion, env: env.NODE_ENV }));
});

app.get('/api-docs.json', (_req, res) => {
  res.type('application/json').send(swaggerSpec);
});

app.use(
  '/api-docs',
  (_req, res, next) => {
    res.removeHeader('Content-Security-Policy');
    next();
  },
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, swaggerUiOptions),
);

app.use('/api/auth', authRoutes);
app.use('/api/courses/:courseId/sections', courseSectionsRouter);
app.use('/api/courses', courseRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/lessons', progressRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/quizzes', quizStudentRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/instructors', instructorRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);

app.use(errorHandler);

const FORCE_EXIT_TIMEOUT_MS = 10_000;

const start = async () => {
  await connectDB();
  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `LMS API listening on http://localhost:${env.PORT}`,
    );
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, 'Shutdown signal received — draining connections.');

    const httpClosed = new Promise((resolve) => {
      server.close((err) => {
        if (err) logger.error({ err }, 'HTTP server close errored.');
        else logger.info('HTTP server closed.');
        resolve();
      });
    });

    const forceExit = setTimeout(() => {
      logger.warn(
        { timeoutMs: FORCE_EXIT_TIMEOUT_MS },
        'Forced exit — graceful shutdown took too long.',
      );
      process.exit(1);
    }, FORCE_EXIT_TIMEOUT_MS);
    forceExit.unref();

    try {
      await httpClosed;
      await mongoose.connection.close();
      logger.info('MongoDB connection closed.');
      if (redis) {
        await redis.quit().catch(() => redis.disconnect());
        logger.info('Redis connection closed.');
      }
    } catch (err) {
      logger.error({ err }, 'Error during graceful shutdown.');
      process.exit(1);
      return;
    }

    clearTimeout(forceExit);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'unhandledRejection — initiating shutdown.');
    shutdown('unhandledRejection');
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaughtException — initiating shutdown.');
    shutdown('uncaughtException');
  });
};

start().catch((err) => {
  logger.fatal({ err }, 'Fatal startup error.');
  process.exit(1);
});

export default app;