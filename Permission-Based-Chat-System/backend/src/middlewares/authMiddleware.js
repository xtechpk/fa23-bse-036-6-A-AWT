const prisma = require('../utils/prismaClient');
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/generateToken');
const { ROLES } = require('../utils/constants');

const SESSION_HEARTBEAT_INTERVAL_MS = Number(
  process.env.SESSION_HEARTBEAT_INTERVAL_MS || 60 * 1000
);

const extractToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }

  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }

  return null;
};

const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new ApiError(401, 'Authentication token is missing');
    }

    const decoded = verifyAccessToken(token);

    if (!decoded.sessionId) {
      throw new ApiError(401, 'Authentication session is missing. Please log in again');
    }

    // Single DB roundtrip: fetch session and its user together instead of two sequential queries.
    const session = await prisma.loginSession.findUnique({
      where: { id: decoded.sessionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            registrationNumber: true,
            password: true,
            role: true,
            uiDensityMode: true,
            isActive: true,
            twoFactorEnabled: true,
            twoFactorEnabledAt: true,
            avatarFileId: true,
            lastSeen: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!session || session.userId !== decoded.userId) {
      throw new ApiError(401, 'Authentication session is invalid');
    }

    const user = session.user;

    if (!user) {
      throw new ApiError(401, 'Invalid authentication token');
    }

    if (!session.expiresAt || session.expiresAt.getTime() <= Date.now()) {
      if (session.status !== 'expired') {
        // Fire-and-forget — the request is already failing; no need to block on this write.
        prisma.loginSession
          .update({ where: { id: session.id }, data: { status: 'expired', revokedAt: new Date() } })
          .catch(() => {});
      }

      throw new ApiError(401, 'Authentication session has expired');
    }

    if (session.status === 'blocked') {
      throw new ApiError(403, 'Authentication session is blocked by administrator');
    }

    if (session.status === 'revoked') {
      throw new ApiError(401, 'Authentication session has been revoked');
    }

    if (session.status === 'expired') {
      throw new ApiError(401, 'Authentication session has expired');
    }

    const shouldUpdateHeartbeat =
      !session.lastSeenAt ||
      Date.now() - session.lastSeenAt.getTime() >= SESSION_HEARTBEAT_INTERVAL_MS;

    if (shouldUpdateHeartbeat) {
      // Fire-and-forget — a heartbeat timestamp update must never add latency to the real response.
      prisma.loginSession
        .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
        .catch(() => {});
    }

    req.session = { ...session, _id: session.id };

    const elevatedRoles = [ROLES.ADMIN, ROLES.SUPERADMIN];
    if (!user.isActive && !elevatedRoles.includes(user.role)) {
      throw new ApiError(403, 'Account is inactive');
    }

    req.user = { ...user, _id: user.id };
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Invalid or expired token'));
    }

    return next(error);
  }
};

module.exports = {
  protect,
};
