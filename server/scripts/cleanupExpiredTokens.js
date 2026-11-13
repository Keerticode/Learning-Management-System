import mongoose from 'mongoose';

import { connectDB } from '../config/db.js';
import { User } from '../models/User.model.js';
import { logger } from '../utils/logger.js';

const run = async () => {
  await connectDB();

  const now = new Date();

  const [resetResult, verifyResult] = await Promise.all([
    User.updateMany(
      { passwordResetExpires: { $lt: now } },
      { $unset: { passwordResetToken: '', passwordResetExpires: '' } },
    ),
    User.updateMany(
      { emailVerificationExpires: { $lt: now } },
      { $unset: { emailVerificationToken: '', emailVerificationExpires: '' } },
    ),
  ]);

  logger.info(
    {
      passwordResetCleared: resetResult.modifiedCount,
      emailVerificationCleared: verifyResult.modifiedCount,
      sweptAt: now.toISOString(),
    },
    'cleanupExpiredTokens: completed.',
  );
};

run()
  .then(async () => {
    await mongoose.connection.close().catch(() => {});
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err }, 'cleanupExpiredTokens: failed.');
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
