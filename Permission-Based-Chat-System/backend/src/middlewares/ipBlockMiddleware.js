const prisma = require('../utils/prismaClient');
const ApiError = require('../utils/ApiError');
const { normalizeIp } = require('../utils/requestContext');
const logger = require('../utils/logger');

const BLOCKED_IP_CACHE_TTL_MS = Number(process.env.BLOCKED_IP_CACHE_TTL_MS || 30 * 1000);
const IP_CACHE_MAX_SIZE = 10_000;
const blockedIpCache = new Map();

// Periodically sweep expired entries so the Map cannot grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of blockedIpCache) {
    if (value.expiresAt <= now) {
      blockedIpCache.delete(key);
    }
  }
}, 60 * 1000).unref(); // .unref() so the timer never keeps the process alive

const getCachedIpDecision = (ipAddress) => {
  const cached = blockedIpCache.get(ipAddress);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    blockedIpCache.delete(ipAddress);
    return null;
  }

  return cached;
};

const setCachedIpDecision = (ipAddress, blockedEntry) => {
  // Evict the oldest entry when the cache is full to prevent unbounded memory growth.
  if (blockedIpCache.size >= IP_CACHE_MAX_SIZE) {
    blockedIpCache.delete(blockedIpCache.keys().next().value);
  }
  blockedIpCache.set(ipAddress, {
    blocked: Boolean(blockedEntry),
    reason: blockedEntry?.reason || null,
    expiresAt: Date.now() + BLOCKED_IP_CACHE_TTL_MS,
  });
};

const checkBlockedIp = async (req, res, next) => {
  try {
    const ipAddress = normalizeIp(
      req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || null
    );

    if (!ipAddress) {
      return next();
    }

    const cachedDecision = getCachedIpDecision(ipAddress);
    if (cachedDecision) {
      if (cachedDecision.blocked) {
        throw new ApiError(403, cachedDecision.reason || 'Access denied from this IP address');
      }
      return next();
    }

    const blocked = await prisma.blockedIp.findFirst({
      where: {
        ipAddress,
        isActive: true,
      },
      select: { id: true, reason: true },
    });

    setCachedIpDecision(ipAddress, blocked);

    if (blocked) {
      throw new ApiError(403, blocked.reason || 'Access denied from this IP address');
    }

    return next();
  } catch (error) {
    logger.warn('Blocked IP middleware fallback due to lookup failure', {
      message: error.message,
    });

    // Keep API available if IP lookup fails transiently; global limiters still apply.
    if (error instanceof ApiError && error.statusCode === 403) {
      return next(error);
    }

    return next();
  }
};

module.exports = {
  checkBlockedIp,
};
