import mongoose from 'mongoose';

import { connectDB } from '../config/db.js';
import { Course } from '../models/Course.model.js';
import { logger } from '../utils/logger.js';

const STALE_DAYS = 90;

const run = async () => {
  await connectDB();

  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  const filter = {
    status: 'draft',
    enrollmentCount: { $lte: 0 },
    updatedAt: { $lt: cutoff },
  };

  const result = await Course.deleteMany(filter);

  logger.info(
    { deleted: result.deletedCount, cutoff: cutoff.toISOString(), staleDays: STALE_DAYS },
    'cleanupStaleDrafts: completed.',
  );
};

run()
  .then(async () => {
    await mongoose.connection.close().catch(() => {});
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err }, 'cleanupStaleDrafts: failed.');
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
