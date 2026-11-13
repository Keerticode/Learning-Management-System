import Redis from 'ioredis';

import { logger } from '../utils/logger.js';
import { env } from './env.js';

const createRedisClient = () => {
  if (!env.REDIS_URL) return null;

  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    // Reconnect with capped exponential back-off.
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });

  client.on('connect', () => {
    logger.info('[redis] Connecting…');
  });

  client.on('ready', () => {
    logger.info('[redis] Ready.');
  });

  client.on('error', (err) => {
    logger.error({ err: err.message }, '[redis] Connection error.');
  });

  client.on('end', () => {
    logger.warn('[redis] Connection closed.');
  });

  return client;
};

export const redis = createRedisClient();

export const isRedisConfigured = redis !== null;

export default redis;