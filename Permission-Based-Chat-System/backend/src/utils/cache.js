const redis = require('../config/redisClient');

const DEFAULT_TTL = parseInt(process.env.CACHE_TTL_SECONDS || '300', 10);
const RECENT_OPS_LIMIT = 50;

const cacheMetrics = {
  totalOperations: 0,
  hits: 0,
  misses: 0,
  invalidations: 0,
  lastOperations: [],
  operationsByResource: {},
};

function pushRecentOperation(operation) {
  cacheMetrics.lastOperations.push(operation);
  if (cacheMetrics.lastOperations.length > RECENT_OPS_LIMIT) {
    cacheMetrics.lastOperations.shift();
  }
}

function ensureResourceMetrics(resource) {
  if (!cacheMetrics.operationsByResource[resource]) {
    cacheMetrics.operationsByResource[resource] = {
      hits: 0,
      misses: 0,
      invalidations: 0,
    };
  }
}

function logCacheOperation(type, resource, identifier, isCacheHit, responseTimeMs) {
  cacheMetrics.totalOperations += 1;
  ensureResourceMetrics(resource);

  if (type === 'GET') {
    if (isCacheHit) {
      cacheMetrics.hits += 1;
      cacheMetrics.operationsByResource[resource].hits += 1;
    } else {
      cacheMetrics.misses += 1;
      cacheMetrics.operationsByResource[resource].misses += 1;
    }
  }

  if (type === 'INVALIDATE') {
    cacheMetrics.invalidations += 1;
    cacheMetrics.operationsByResource[resource].invalidations += 1;
  }

  const totalReads = cacheMetrics.hits + cacheMetrics.misses;
  const hitRate = totalReads === 0 ? 0 : (cacheMetrics.hits / totalReads) * 100;

  pushRecentOperation({
    timestamp: new Date().toISOString(),
    type,
    resource,
    identifier: identifier || 'list',
    isCacheHit: typeof isCacheHit === 'boolean' ? isCacheHit : null,
    responseTime: `${responseTimeMs || 0}ms`,
    hitRate: `${hitRate.toFixed(2)}%`,
  });
}

function buildCacheKey(resource, req, identifier = null, scope = 'global') {
  const userId = req?.user?._id || req?.user?.id || 'anonymous';
  const prefix = scope === 'user' ? `user:${userId}` : 'global';

  if (identifier) {
    return `${prefix}:${resource}:${identifier}`;
  }

  return `${prefix}:${resource}:list:${req.originalUrl}`;
}

function parseKeyMeta(key) {
  const parts = String(key || '').split(':');

  if (parts[0] === 'user') {
    return {
      resource: parts[2] || 'unknown',
      identifier: parts[3] || 'list',
    };
  }

  return {
    resource: parts[1] || 'unknown',
    identifier: parts[2] || 'list',
  };
}

async function getCachedJson(key) {
  const startTime = Date.now();
  const { resource, identifier } = parseKeyMeta(key);

  if (!redis || !redis.isOpen) {
    logCacheOperation('GET', resource, identifier, false, 0);
    return null;
  }

  try {
    const cached = await redis.get(key);
    const responseTime = Date.now() - startTime;

    if (!cached) {
      logCacheOperation('GET', resource, identifier, false, responseTime);
      return null;
    }

    logCacheOperation('GET', resource, identifier, true, responseTime);
    return JSON.parse(cached);
  } catch {
    logCacheOperation('GET', resource, identifier, false, Date.now() - startTime);
    return null;
  }
}

async function setCachedJson(key, value, ttl = DEFAULT_TTL) {
  if (!redis || !redis.isOpen || value == null) return;

  try {
    await redis.set(key, JSON.stringify(value), { EX: ttl });
  } catch {
    // Cache failure should never break request flow.
  }
}

async function invalidateCache(context, resource, identifier = null) {
  if (!redis || !redis.isOpen) return;

  try {
    if (identifier) {
      await redis.del(`${context}:${resource}:${identifier}`);
      logCacheOperation('INVALIDATE', resource, identifier, null, 0);
    }

    const pattern = `${context}:${resource}:list:*`;
    let cursor = '0';

    do {
      const reply = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = String(reply.cursor);
      const keys = reply.keys || [];

      if (keys.length > 0) {
        const pipeline = redis.multi();
        keys.forEach((key) => pipeline.del(key));
        await pipeline.exec();
        logCacheOperation('INVALIDATE', resource, 'list', null, 0);
      }
    } while (cursor !== '0');
  } catch {
    // Cache invalidation failure should not block request flow.
  }
}

async function invalidateCacheByPrefix(resource, req, identifier = null, scope = 'global') {
  const userId = req?.user?._id || req?.user?.id || 'anonymous';
  const context = scope === 'user' ? `user:${userId}` : 'global';
  await invalidateCache(context, resource, identifier);
}

async function deleteByPattern(pattern) {
  if (!redis || !redis.isOpen) return 0;

  let cursor = '0';
  let deletedCount = 0;

  do {
    const reply = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
    cursor = String(reply.cursor);
    const keys = reply.keys || [];

    if (keys.length > 0) {
      const pipeline = redis.multi();
      keys.forEach((key) => pipeline.del(key));
      await pipeline.exec();
      deletedCount += keys.length;
    }
  } while (cursor !== '0');

  return deletedCount;
}

async function invalidateResourceEverywhere(resource) {
  if (!redis || !redis.isOpen || !resource) return;

  try {
    const globalPattern = `global:${resource}:*`;
    const userPattern = `user:*:${resource}:*`;

    const [globalDeleted, userDeleted] = await Promise.all([
      deleteByPattern(globalPattern),
      deleteByPattern(userPattern),
    ]);

    if (globalDeleted > 0 || userDeleted > 0) {
      logCacheOperation('INVALIDATE', resource, 'all-scopes', null, 0);
    }
  } catch {
    // Cache invalidation failure should not block request flow.
  }
}

async function getWithStats(key) {
  const startTime = Date.now();
  const data = await getCachedJson(key);
  const responseTime = Date.now() - startTime;

  return {
    data,
    isCacheHit: data !== null,
    responseTime,
    status: data !== null ? `CACHE HIT (${responseTime}ms)` : `CACHE MISS (${responseTime}ms)`,
  };
}

function getCacheStats() {
  const totalReads = cacheMetrics.hits + cacheMetrics.misses;
  const hitRate = totalReads === 0 ? 0 : (cacheMetrics.hits / totalReads) * 100;

  const responseTimes = cacheMetrics.lastOperations
    .filter((op) => op.type === 'GET')
    .map((op) => Number(String(op.responseTime).replace('ms', '')) || 0);

  const avgResponseTime = responseTimes.length
    ? (responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length).toFixed(2)
    : '0.00';

  return {
    totalRequests: totalReads,
    cacheHits: cacheMetrics.hits,
    cacheMisses: cacheMetrics.misses,
    hitRate: `${hitRate.toFixed(2)}%`,
    avgResponseTime: `${avgResponseTime}ms`,
    invalidations: cacheMetrics.invalidations,
    status: hitRate >= 70 ? 'CACHE_HEALTHY' : 'CACHE_HIT_RATE_LOW',
  };
}

function resetCacheStats() {
  cacheMetrics.totalOperations = 0;
  cacheMetrics.hits = 0;
  cacheMetrics.misses = 0;
  cacheMetrics.invalidations = 0;
  cacheMetrics.lastOperations = [];
  cacheMetrics.operationsByResource = {};
}

module.exports = {
  buildCacheKey,
  getCachedJson,
  setCachedJson,
  invalidateCache,
  invalidateCacheByPrefix,
  invalidateResourceEverywhere,
  getWithStats,
  getCacheStats,
  resetCacheStats,
  cacheMetrics,
};
