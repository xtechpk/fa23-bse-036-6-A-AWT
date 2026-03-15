const { createClient } = require('redis');
const env = require('./env');
const logger = require('../utils/logger');

const redis = createClient({
  url: env.redisUrl || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('[Redis] Too many reconnect attempts — giving up');
        return new Error('Redis reconnect limit reached');
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

redis.on('error', (err) => {
  logger.error(`[Redis] Client error: ${err.message}`);
});

redis.on('connect', () => {
  logger.info('[Redis] Connected');
});

redis.on('reconnecting', () => {
  logger.warn('[Redis] Reconnecting...');
});

redis.on('ready', () => {
  logger.info('[Redis] Ready');
});

module.exports = redis;
