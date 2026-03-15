const {
  buildCacheKey,
  getCachedJson,
  setCachedJson,
  invalidateResourceEverywhere,
} = require('../utils/cache');

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const resolve = (valueOrFn, req, fallback) => {
  if (typeof valueOrFn === 'function') return valueOrFn(req);
  return valueOrFn ?? fallback;
};

const cacheGet = ({ resource, scope = 'global', ttlSeconds = 120, identifier = null } = {}) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();

    const resolvedResource = resolve(resource, req, null);
    if (!resolvedResource) return next();

    const resolvedScope = resolve(scope, req, 'global');
    const resolvedIdentifier = resolve(identifier, req, null);
    const cacheKey = buildCacheKey(resolvedResource, req, resolvedIdentifier, resolvedScope);

    const cached = await getCachedJson(cacheKey);
    if (cached && typeof cached === 'object' && cached.body) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(cached.statusCode || 200).json(cached.body);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const statusCode = res.statusCode || 200;

      if (statusCode < 400 && body && body.success === true) {
        setCachedJson(cacheKey, { statusCode, body }, ttlSeconds).catch(() => {});
      }

      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    return next();
  };
};

const invalidateOnWrite = (resources = []) => {
  const uniqueResources = [...new Set(resources.filter(Boolean))];

  return (req, res, next) => {
    if (!WRITE_METHODS.has(req.method)) return next();

    res.on('finish', () => {
      if (res.statusCode >= 400) return;

      uniqueResources.forEach((resource) => {
        invalidateResourceEverywhere(resource).catch(() => {});
      });
    });

    return next();
  };
};

module.exports = {
  cacheGet,
  invalidateOnWrite,
};
