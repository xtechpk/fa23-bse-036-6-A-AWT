const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../utils/prismaClient');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../utils/constants');
const { logAuditEvent } = require('./auditService');
const { deliverTwoFactorCode } = require('./twoFactorDeliveryService');
const {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  decodeToken,
} = require('../utils/generateToken');

const TWO_FACTOR_CODE_EXPIRY_MINUTES = Number(process.env.TWO_FACTOR_CODE_EXPIRY_MINUTES || 10);
const MAX_2FA_ATTEMPTS = Number(process.env.TWO_FACTOR_MAX_ATTEMPTS || 5);

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  return { ...safe, _id: safe.id };
};

const getAuthPayload = (user, sessionId) => ({
  userId: user.id,
  role: user.role,
  sessionId,
});

const getLocationMetadata = (location) => ({
  country: location?.country || null,
  region: location?.region || null,
  city: location?.city || null,
  zipCode: location?.zipCode || null,
  latitude: location?.latitude ?? null,
  longitude: location?.longitude ?? null,
  accuracyRadius: location?.accuracyRadius ?? null,
  altitude: location?.altitude ?? null,
  locationTimestamp: location?.locationTimestamp || null,
});

const persistRefreshToken = async (userId, token, meta = {}, sessionId = null) => {
  const decoded = decodeToken(token);

  if (!decoded || !decoded.exp) {
    throw new ApiError(500, 'Unable to decode refresh token');
  }

  const expiresAt = new Date(decoded.exp * 1000);

  const record = await prisma.refreshToken.create({
    data: {
      userId,
      sessionId,
      token,
      expiresAt,
      createdByIp: meta.ip || null,
      userAgent: meta.userAgent || null,
    },
  });

  return { record, expiresAt };
};

const upsertSession = async ({ sessionId, userId, refreshTokenId, expiresAt, meta = {} }) => {
  const location = getLocationMetadata(meta.location);

  const existing = await prisma.loginSession.findUnique({ where: { id: sessionId } });

  const baseData = {
    refreshTokenId,
    expiresAt,
    lastSeenAt: new Date(),
    ipAddress: meta.ip || existing?.ipAddress || null,
    userAgent: meta.userAgent || existing?.userAgent || null,
    browser: meta.browser || existing?.browser || 'Unknown',
    os: meta.os || existing?.os || 'Unknown',
    deviceType: meta.deviceType || existing?.deviceType || 'Unknown',
    country: location.country || existing?.country || null,
    region: location.region || existing?.region || null,
    city: location.city || existing?.city || null,
    zipCode: location.zipCode || existing?.zipCode || null,
    latitude: location.latitude ?? existing?.latitude ?? null,
    longitude: location.longitude ?? existing?.longitude ?? null,
    accuracyRadius: location.accuracyRadius ?? existing?.accuracyRadius ?? null,
    altitude: location.altitude ?? existing?.altitude ?? null,
    locationTimestamp: location.locationTimestamp || existing?.locationTimestamp || null,
    status: 'active',
    blockedAt: null,
    blockedById: null,
    blockedReason: null,
    revokedAt: null,
  };

  if (existing) {
    return prisma.loginSession.update({
      where: { id: sessionId },
      data: baseData,
    });
  }

  return prisma.loginSession.create({
    data: {
      id: sessionId,
      userId,
      ...baseData,
    },
  });
};

const buildTokens = async (user, meta = {}, existingSessionId = null) => {
  const sessionId = existingSessionId || crypto.randomUUID();

  const payload = getAuthPayload(user, sessionId);
  const accessToken = createAccessToken(payload);
  const refreshToken = createRefreshToken(payload);

  const { record: refreshTokenRecord, expiresAt } = await persistRefreshToken(
    user.id,
    refreshToken,
    meta,
    sessionId
  );

  await upsertSession({
    sessionId,
    userId: user.id,
    refreshTokenId: refreshTokenRecord.id,
    expiresAt,
    meta,
  });

  return {
    accessToken,
    refreshToken,
    sessionId,
  };
};

const generateSixDigitCode = () => String(crypto.randomInt(100000, 1000000));

const createTwoFactorChallenge = async ({ userId, purpose, meta = {} }) => {
  const code = generateSixDigitCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + TWO_FACTOR_CODE_EXPIRY_MINUTES * 60 * 1000);

  const challenge = await prisma.twoFactorChallenge.create({
    data: {
      userId,
      purpose,
      codeHash,
      expiresAt,
      ipAddress: meta.ip || null,
      userAgent: meta.userAgent || null,
      browser: meta.browser || 'Unknown',
      os: meta.os || 'Unknown',
      deviceType: meta.deviceType || 'Unknown',
      metadata: {
        location: meta.location || null,
      },
    },
  });

  return {
    challenge,
    code,
  };
};

const verifyTwoFactorChallenge = async ({ challengeId, code, purpose, expectedUserId = null }) => {
  const challenge = await prisma.twoFactorChallenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    throw new ApiError(404, 'Two-factor challenge not found');
  }

  if (challenge.purpose !== purpose) {
    throw new ApiError(400, 'Invalid two-factor challenge purpose');
  }

  if (expectedUserId && challenge.userId !== String(expectedUserId)) {
    throw new ApiError(403, 'Two-factor challenge does not belong to this user');
  }

  if (challenge.usedAt) {
    throw new ApiError(400, 'Two-factor challenge is already used');
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(401, 'Two-factor code has expired');
  }

  if (challenge.attempts >= MAX_2FA_ATTEMPTS) {
    throw new ApiError(429, 'Too many invalid attempts for this two-factor challenge');
  }

  const valid = await bcrypt.compare(String(code || '').trim(), challenge.codeHash);

  if (!valid) {
    await prisma.twoFactorChallenge.update({
      where: { id: challenge.id },
      data: { attempts: challenge.attempts + 1 },
    });
    throw new ApiError(401, 'Invalid two-factor code');
  }

  const updated = await prisma.twoFactorChallenge.update({
    where: { id: challenge.id },
    data: { usedAt: new Date() },
  });

  return updated;
};

const register = async ({ name, registrationNumber, email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedRegistrationNumber = registrationNumber.trim().toUpperCase();

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: normalizedEmail }, { registrationNumber: normalizedRegistrationNumber }],
    },
  });

  if (existing) {
    throw new ApiError(409, 'User with email or registration number already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      registrationNumber: normalizedRegistrationNumber,
      email: normalizedEmail,
      password: hashedPassword,
      role: 'user',
    },
  });

  return sanitizeUser(user);
};

const login = async (
  { email, password, location = null },
  { adminOnly = false, meta = {} } = {}
) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    await logAuditEvent({
      actorId: null,
      action: 'auth.login.failed_user_not_found',
      targetType: 'user',
      targetId: normalizedEmail,
      ipAddress: meta.ip || null,
      userAgent: meta.userAgent || null,
      metadata: {
        email: normalizedEmail,
        adminOnly: Boolean(adminOnly),
        browser: meta.browser,
        os: meta.os,
        deviceType: meta.deviceType,
        location: location || meta.location || null,
      },
    });
    throw new ApiError(401, 'Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    await logAuditEvent({
      actorId: user.id,
      action: 'auth.login.failed_invalid_password',
      targetType: 'user',
      targetId: user.id,
      ipAddress: meta.ip || null,
      userAgent: meta.userAgent || null,
      metadata: {
        email: normalizedEmail,
        adminOnly: Boolean(adminOnly),
        browser: meta.browser,
        os: meta.os,
        deviceType: meta.deviceType,
        location: location || meta.location || null,
      },
    });
    throw new ApiError(401, 'Invalid email or password');
  }

  if (adminOnly && ![ROLES.ADMIN, ROLES.SUPERADMIN].includes(user.role)) {
    await logAuditEvent({
      actorId: user.id,
      action: 'auth.login.failed_admin_only',
      targetType: 'user',
      targetId: user.id,
      ipAddress: meta.ip || null,
      userAgent: meta.userAgent || null,
      metadata: {
        role: user.role,
        browser: meta.browser,
        os: meta.os,
        deviceType: meta.deviceType,
        location: location || meta.location || null,
      },
    });
    throw new ApiError(403, 'Only admin or superadmin can access this endpoint');
  }

  if (!user.isActive) {
    await logAuditEvent({
      actorId: user.id,
      action: 'auth.login.failed_inactive_account',
      targetType: 'user',
      targetId: user.id,
      ipAddress: meta.ip || null,
      userAgent: meta.userAgent || null,
      metadata: {
        role: user.role,
        browser: meta.browser,
        os: meta.os,
        deviceType: meta.deviceType,
        location: location || meta.location || null,
      },
    });
    throw new ApiError(403, 'Account is inactive. Contact admin.');
  }

  const combinedMeta = {
    ...meta,
    location: location || meta.location || null,
  };

  if (user.twoFactorEnabled) {
    const { challenge, code } = await createTwoFactorChallenge({
      userId: user.id,
      purpose: 'login',
      meta: combinedMeta,
    });

    const delivery = await deliverTwoFactorCode({
      user,
      code,
      challenge,
      purpose: 'login',
      meta: combinedMeta,
    });

    await logAuditEvent({
      actorId: user.id,
      action: 'auth.login.2fa_challenge_created',
      targetType: 'user',
      targetId: user.id,
      ipAddress: combinedMeta.ip || null,
      userAgent: combinedMeta.userAgent || null,
      metadata: {
        challengeId: challenge.id,
        expiresAt: challenge.expiresAt,
        deliveryChannel: delivery.channel,
        browser: combinedMeta.browser,
        os: combinedMeta.os,
        deviceType: combinedMeta.deviceType,
        location: combinedMeta.location || null,
      },
    });

    return {
      requiresTwoFactor: true,
      twoFactor: {
        challengeId: challenge.id,
        expiresAt: challenge.expiresAt,
        purpose: challenge.purpose,
        deliveryChannel: delivery.channel,
      },
      ...(delivery.debugCode ? { debugCode: delivery.debugCode } : {}),
    };
  }

  const tokens = await buildTokens(user, combinedMeta);

  await logAuditEvent({
    actorId: user.id,
    action: 'auth.login.success',
    targetType: 'user',
    targetId: user.id,
    ipAddress: combinedMeta.ip || null,
    userAgent: combinedMeta.userAgent || null,
    metadata: {
      sessionId: tokens.sessionId,
      browser: combinedMeta.browser,
      os: combinedMeta.os,
      deviceType: combinedMeta.deviceType,
      location: combinedMeta.location || null,
    },
  });

  return {
    user: sanitizeUser(user),
    tokens,
  };
};

const verifyLoginTwoFactor = async ({ challengeId, code }, { meta = {} } = {}) => {
  const challenge = await verifyTwoFactorChallenge({
    challengeId,
    code,
    purpose: 'login',
  });

  const user = await prisma.user.findUnique({ where: { id: challenge.userId } });

  if (!user || !user.isActive) {
    throw new ApiError(401, 'User account is not active');
  }

  const challengeLocation = challenge.metadata?.location || null;
  const combinedMeta = {
    ...meta,
    location: meta.location || challengeLocation || null,
    ip: meta.ip || challenge.ipAddress || null,
    userAgent: meta.userAgent || challenge.userAgent || null,
    browser: meta.browser || challenge.browser || 'Unknown',
    os: meta.os || challenge.os || 'Unknown',
    deviceType: meta.deviceType || challenge.deviceType || 'Unknown',
  };

  const tokens = await buildTokens(user, combinedMeta);

  await logAuditEvent({
    actorId: user.id,
    action: 'auth.login.2fa_verified',
    targetType: 'user',
    targetId: user.id,
    ipAddress: combinedMeta.ip || null,
    userAgent: combinedMeta.userAgent || null,
    metadata: {
      sessionId: tokens.sessionId,
      browser: combinedMeta.browser,
      os: combinedMeta.os,
      deviceType: combinedMeta.deviceType,
      location: combinedMeta.location || null,
    },
  });

  return {
    user: sanitizeUser(user),
    tokens,
  };
};

const startEnableTwoFactor = async ({ userId }, { meta = {} } = {}) => {
  const user = await prisma.user.findUnique({ where: { id: String(userId) } });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.twoFactorEnabled) {
    throw new ApiError(409, 'Two-factor authentication is already enabled');
  }

  const { challenge, code } = await createTwoFactorChallenge({
    userId: user.id,
    purpose: 'enable',
    meta,
  });

  const delivery = await deliverTwoFactorCode({
    user,
    code,
    challenge,
    purpose: 'enable',
    meta,
  });

  await logAuditEvent({
    actorId: user.id,
    action: 'auth.2fa.enable_challenge_created',
    targetType: 'user',
    targetId: user.id,
    ipAddress: meta.ip || null,
    userAgent: meta.userAgent || null,
    metadata: {
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
      deliveryChannel: delivery.channel,
    },
  });

  return {
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt,
    deliveryChannel: delivery.channel,
    ...(delivery.debugCode ? { debugCode: delivery.debugCode } : {}),
  };
};

const verifyEnableTwoFactor = async ({ userId, challengeId, code }, { meta = {} } = {}) => {
  const challenge = await verifyTwoFactorChallenge({
    challengeId,
    code,
    purpose: 'enable',
    expectedUserId: userId,
  });

  const user = await prisma.user.update({
    where: { id: challenge.userId },
    data: {
      twoFactorEnabled: true,
      twoFactorEnabledAt: new Date(),
    },
  });

  await logAuditEvent({
    actorId: user.id,
    action: 'auth.2fa.enabled',
    targetType: 'user',
    targetId: user.id,
    ipAddress: meta.ip || null,
    userAgent: meta.userAgent || null,
  });

  return sanitizeUser(user);
};

const disableTwoFactor = async ({ userId, currentPassword }, { meta = {} } = {}) => {
  const user = await prisma.user.findUnique({ where: { id: String(userId) } });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (!user.twoFactorEnabled) {
    throw new ApiError(400, 'Two-factor authentication is already disabled');
  }

  const isPasswordValid = await bcrypt.compare(String(currentPassword || ''), user.password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Current password is incorrect');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: false,
      twoFactorEnabledAt: null,
    },
  });

  await prisma.twoFactorChallenge.updateMany({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: {
      usedAt: new Date(),
    },
  });

  await logAuditEvent({
    actorId: user.id,
    action: 'auth.2fa.disabled',
    targetType: 'user',
    targetId: user.id,
    ipAddress: meta.ip || null,
    userAgent: meta.userAgent || null,
  });

  return sanitizeUser(updated);
};

const refreshToken = async (token, meta = {}) => {
  if (!token) {
    throw new ApiError(401, 'Refresh token is required');
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch (error) {
    throw new ApiError(401, 'Invalid refresh token');
  }

  const existingToken = await prisma.refreshToken.findFirst({
    where: {
      token,
      userId: decoded.userId,
      isRevoked: false,
    },
  });

  if (!existingToken) {
    throw new ApiError(401, 'Refresh token is not recognized');
  }

  if (existingToken.expiresAt.getTime() <= Date.now()) {
    await prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    if (existingToken.sessionId) {
      await prisma.loginSession.updateMany({
        where: { id: existingToken.sessionId },
        data: { status: 'expired', revokedAt: new Date() },
      });
    }

    throw new ApiError(401, 'Refresh token has expired');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || !user.isActive) {
    throw new ApiError(401, 'User account is not active');
  }

  const sessionId = existingToken.sessionId || decoded.sessionId || crypto.randomUUID();
  const session = await prisma.loginSession.findUnique({ where: { id: sessionId } });

  if (session && session.userId !== user.id) {
    throw new ApiError(401, 'Refresh token session ownership is invalid');
  }

  if (session?.expiresAt && session.expiresAt.getTime() <= Date.now()) {
    await prisma.loginSession.updateMany({
      where: { id: session.id },
      data: { status: 'expired', revokedAt: new Date() },
    });
    throw new ApiError(401, 'This session has expired');
  }

  if (session && session.status !== 'active') {
    throw new ApiError(403, 'This session is no longer active');
  }

  const payload = getAuthPayload(user, sessionId);
  const accessToken = createAccessToken(payload);
  const newRefreshToken = createRefreshToken(payload);

  await prisma.refreshToken.update({
    where: { id: existingToken.id },
    data: {
      isRevoked: true,
      revokedAt: new Date(),
      replacedByToken: newRefreshToken,
    },
  });

  const { record: createdToken, expiresAt } = await persistRefreshToken(
    user.id,
    newRefreshToken,
    meta,
    sessionId
  );

  await upsertSession({
    sessionId,
    userId: user.id,
    refreshTokenId: createdToken.id,
    expiresAt,
    meta,
  });

  await logAuditEvent({
    actorId: user.id,
    action: 'auth.refresh.success',
    targetType: 'session',
    targetId: sessionId,
    ipAddress: meta.ip || null,
    userAgent: meta.userAgent || null,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    sessionId,
  };
};

const logout = async (token, userId = null, meta = {}) => {
  if (token) {
    const tokenRows = await prisma.refreshToken.findMany({
      where: { token, isRevoked: false },
      select: { id: true, userId: true, sessionId: true },
    });

    await prisma.refreshToken.updateMany({
      where: { token, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    const sessionIds = tokenRows.map((item) => item.sessionId).filter(Boolean);
    if (sessionIds.length > 0) {
      await prisma.loginSession.updateMany({
        where: { id: { in: sessionIds } },
        data: { status: 'revoked', revokedAt: new Date() },
      });
    }

    await Promise.all(
      tokenRows.map((item) =>
        logAuditEvent({
          actorId: userId || item.userId,
          action: 'auth.logout',
          targetType: 'session',
          targetId: item.sessionId || null,
          ipAddress: meta.ip || null,
          userAgent: meta.userAgent || null,
        })
      )
    );

    return;
  }

  if (userId) {
    await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    await prisma.loginSession.updateMany({
      where: { userId, status: 'active' },
      data: { status: 'revoked', revokedAt: new Date() },
    });

    await logAuditEvent({
      actorId: userId,
      action: 'auth.logout.all_sessions',
      targetType: 'user',
      targetId: String(userId),
      ipAddress: meta.ip || null,
      userAgent: meta.userAgent || null,
    });
  }
};

const listUserSessions = async (userId) => {
  const sessions = await prisma.loginSession.findMany({
    where: { userId: String(userId) },
    orderBy: { createdAt: 'desc' },
  });

  return sessions.map((item) => ({ ...item, _id: item.id }));
};

const revokeUserSession = async ({ requesterId, sessionId }, meta = {}) => {
  const session = await prisma.loginSession.findUnique({ where: { id: String(sessionId) } });

  if (!session) {
    throw new ApiError(404, 'Session not found');
  }

  if (session.userId !== String(requesterId)) {
    throw new ApiError(403, 'You can only revoke your own sessions');
  }

  const updated = await prisma.loginSession.update({
    where: { id: session.id },
    data: {
      status: 'revoked',
      revokedAt: new Date(),
    },
  });

  await prisma.refreshToken.updateMany({
    where: { sessionId: session.id, isRevoked: false },
    data: { isRevoked: true, revokedAt: new Date() },
  });

  await logAuditEvent({
    actorId: String(requesterId),
    action: 'auth.session.revoked_by_user',
    targetType: 'session',
    targetId: session.id,
    ipAddress: meta.ip || null,
    userAgent: meta.userAgent || null,
  });

  return { ...updated, _id: updated.id };
};

module.exports = {
  register,
  login,
  verifyLoginTwoFactor,
  startEnableTwoFactor,
  verifyEnableTwoFactor,
  disableTwoFactor,
  refreshToken,
  logout,
  listUserSessions,
  revokeUserSession,
};
