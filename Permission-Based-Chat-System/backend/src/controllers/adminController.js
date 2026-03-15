const bcrypt = require('bcryptjs');
const prisma = require('../utils/prismaClient');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { ROLES } = require('../utils/constants');
const { buildRequestMeta, normalizeIp } = require('../utils/requestContext');
const { logAuditEvent } = require('../services/auditService');

const SESSION_STATUSES = ['active', 'blocked', 'revoked', 'expired'];

const uniq = (arr) => [...new Set(arr.filter(Boolean).map(String))];

const sanitizeUser = (user) => {
  const { password, ...safe } = user;
  return { ...safe, _id: safe.id };
};

const parsePagination = (query) => {
  const rawLimit = Number(query.limit);
  const rawOffset = Number(query.offset);

  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
  const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  return { limit, offset };
};

const sanitizeSession = (session, userMap = null) => ({
  ...session,
  _id: session.id,
  user: userMap ? userMap.get(session.userId) || null : null,
});

const sanitizeBlockedIp = (blockedIp) => ({
  ...blockedIp,
  _id: blockedIp.id,
});

const sanitizeAuditLog = (log, actorMap = null) => ({
  ...log,
  _id: log.id,
  actor: actorMap ? actorMap.get(log.actorId) || null : null,
});

const getRoleRank = (role) => {
  if (role === ROLES.SUPERADMIN) return 3;
  if (role === ROLES.ADMIN) return 2;
  if (role === ROLES.USER) return 1;
  return 0;
};

const assertActorCanManageUser = ({ actor, targetUser }) => {
  const actorRank = getRoleRank(actor?.role);
  const targetRank = getRoleRank(targetUser?.role);

  if (actorRank === 0 || targetRank === 0) {
    throw new ApiError(403, 'Invalid role permissions for this action');
  }

  // Superadmin can manage anyone; admins can only manage user-level accounts.
  if (actorRank < 3 && targetRank >= 2) {
    throw new ApiError(403, 'You are not allowed to manage admin or superadmin sessions');
  }
};

const getDashboard = async (req, res, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalGroups,
      totalMessages,
      pendingPermissionRequests,
      totalAdmins,
      totalSuperAdmins,
      recentUsers,
      recentGroups,
      recentMessages,
      recentPermissionRequests,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.group.count(),
      prisma.message.count(),
      prisma.permissionRequest.count({ where: { status: 'pending' } }),
      prisma.user.count({ where: { role: ROLES.ADMIN } }),
      prisma.user.count({ where: { role: ROLES.SUPERADMIN } }),
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          registrationNumber: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.group.findMany({
        select: { id: true, name: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.message.findMany({
        select: {
          id: true,
          messageType: true,
          senderId: true,
          receiverId: true,
          groupId: true,
          content: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.permissionRequest.findMany({
        select: { id: true, requesterId: true, targetId: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const messageUserIds = uniq(
      recentMessages.flatMap((message) => [message.senderId, message.receiverId])
    );
    const permissionUserIds = uniq(
      recentPermissionRequests.flatMap((item) => [item.requesterId, item.targetId])
    );
    const groupIds = uniq(recentMessages.map((message) => message.groupId));

    const [messageUsers, permissionUsers, groups] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: messageUserIds } },
        select: { id: true, name: true, email: true, registrationNumber: true },
      }),
      prisma.user.findMany({
        where: { id: { in: permissionUserIds } },
        select: { id: true, name: true, email: true, registrationNumber: true },
      }),
      prisma.group.findMany({
        where: { id: { in: groupIds } },
        select: { id: true, name: true },
      }),
    ]);

    const messageUserMap = new Map(
      messageUsers.map((user) => [user.id, { ...user, _id: user.id }])
    );
    const permissionUserMap = new Map(
      permissionUsers.map((user) => [user.id, { ...user, _id: user.id }])
    );
    const groupMap = new Map(groups.map((group) => [group.id, { ...group, _id: group.id }]));

    const hydratedMessages = recentMessages.map((message) => ({
      ...message,
      _id: message.id,
      sender: messageUserMap.get(message.senderId) || null,
      receiver: message.receiverId ? messageUserMap.get(message.receiverId) || null : null,
      group: message.groupId ? groupMap.get(message.groupId) || null : null,
    }));

    const hydratedPermissionRequests = recentPermissionRequests.map((item) => ({
      ...item,
      _id: item.id,
      requester: permissionUserMap.get(item.requesterId) || null,
      target: permissionUserMap.get(item.targetId) || null,
    }));

    return ApiResponse.success(res, {
      message: 'Dashboard data fetched successfully',
      data: {
        summary: {
          totalUsers,
          activeUsers,
          totalGroups,
          totalMessages,
          pendingPermissionRequests,
          totalAdmins,
          totalSuperAdmins,
        },
        recentActivity: {
          users: recentUsers.map((user) => ({ ...user, _id: user.id })),
          groups: recentGroups.map((group) => ({ ...group, _id: group.id })),
          messages: hydratedMessages,
          permissionRequests: hydratedPermissionRequests,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

const listAdmins = async (req, res, next) => {
  try {
    const includeSuperadmin = req.query.includeSuperadmin === 'true';
    const where = {
      role: includeSuperadmin ? { in: [ROLES.ADMIN, ROLES.SUPERADMIN] } : ROLES.ADMIN,
    };

    const admins = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return ApiResponse.success(res, {
      message: 'Admin users fetched successfully',
      data: admins.map(sanitizeUser),
    });
  } catch (error) {
    return next(error);
  }
};

const createAdmin = async (req, res, next) => {
  try {
    const normalizedEmail = req.body.email.trim().toLowerCase();
    const normalizedRegistrationNumber = req.body.registrationNumber.trim().toUpperCase();

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { registrationNumber: normalizedRegistrationNumber }],
      },
    });

    if (existing) {
      throw new ApiError(409, 'User with email or registration number already exists');
    }

    const passwordHash = await bcrypt.hash(req.body.password, 12);

    const admin = await prisma.user.create({
      data: {
        name: req.body.name.trim(),
        registrationNumber: normalizedRegistrationNumber,
        email: normalizedEmail,
        password: passwordHash,
        role: ROLES.ADMIN,
        isActive: true,
      },
    });

    return ApiResponse.success(res, {
      statusCode: 201,
      message: 'Admin created successfully',
      data: sanitizeUser(admin),
    });
  } catch (error) {
    return next(error);
  }
};

const promoteUserToAdmin = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    if (user.role === ROLES.SUPERADMIN) {
      throw new ApiError(400, 'Superadmin cannot be promoted');
    }

    if (user.role === ROLES.ADMIN) {
      throw new ApiError(409, 'User is already an admin');
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: ROLES.ADMIN, isActive: true },
    });

    return ApiResponse.success(res, {
      message: 'User promoted to admin successfully',
      data: sanitizeUser(updated),
    });
  } catch (error) {
    return next(error);
  }
};

const updateAdmin = async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.params.id } });

    if (!admin) {
      throw new ApiError(404, 'Admin not found');
    }

    if (admin.role !== ROLES.ADMIN) {
      throw new ApiError(400, 'Target user is not an admin');
    }

    const data = {};

    if (typeof req.body.name !== 'undefined') {
      data.name = req.body.name.trim();
    }

    if (typeof req.body.email !== 'undefined') {
      data.email = req.body.email.trim().toLowerCase();
    }

    if (typeof req.body.registrationNumber !== 'undefined') {
      data.registrationNumber = req.body.registrationNumber.trim().toUpperCase();
    }

    if (typeof req.body.password !== 'undefined') {
      data.password = await bcrypt.hash(req.body.password, 12);
    }

    if (typeof req.body.isActive !== 'undefined') {
      data.isActive = req.body.isActive;
    }

    const updated = await prisma.user.update({
      where: { id: admin.id },
      data,
    });

    return ApiResponse.success(res, {
      message: 'Admin updated successfully',
      data: sanitizeUser(updated),
    });
  } catch (error) {
    return next(error);
  }
};

const updateAdminStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const admin = await prisma.user.findUnique({ where: { id: req.params.id } });

    if (!admin) {
      throw new ApiError(404, 'Admin not found');
    }

    if (admin.role !== ROLES.ADMIN) {
      throw new ApiError(400, 'Target user is not an admin');
    }

    const updated = await prisma.user.update({
      where: { id: admin.id },
      data: { isActive },
    });

    return ApiResponse.success(res, {
      message: `Admin ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: sanitizeUser(updated),
    });
  } catch (error) {
    return next(error);
  }
};

const demoteAdmin = async (req, res, next) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.params.id } });

    if (!admin) {
      throw new ApiError(404, 'Admin not found');
    }

    if (admin.role !== ROLES.ADMIN) {
      throw new ApiError(400, 'Target user is not an admin');
    }

    const updated = await prisma.user.update({
      where: { id: admin.id },
      data: { role: ROLES.USER },
    });

    return ApiResponse.success(res, {
      message: 'Admin demoted to user successfully',
      data: sanitizeUser(updated),
    });
  } catch (error) {
    return next(error);
  }
};

const listSessions = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const where = {};

    if (req.query.userId) {
      where.userId = String(req.query.userId);
    }

    if (req.query.status && SESSION_STATUSES.includes(req.query.status)) {
      where.status = req.query.status;
    }

    if (req.query.ipAddress) {
      where.ipAddress = normalizeIp(req.query.ipAddress) || req.query.ipAddress;
    }

    const [total, sessions] = await Promise.all([
      prisma.loginSession.count({ where }),
      prisma.loginSession.findMany({
        where,
        orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
        skip: offset,
        take: limit,
      }),
    ]);

    const userIds = uniq(sessions.map((item) => item.userId));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        email: true,
        registrationNumber: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    const userMap = new Map(users.map((user) => [user.id, sanitizeUser(user)]));

    return ApiResponse.success(res, {
      message: 'Sessions fetched successfully',
      data: sessions.map((session) => sanitizeSession(session, userMap)),
      meta: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const blockSession = async (req, res, next) => {
  try {
    const session = await prisma.loginSession.findUnique({
      where: { id: req.params.sessionId },
    });

    if (!session) {
      throw new ApiError(404, 'Session not found');
    }

    if (session.status === 'blocked') {
      throw new ApiError(409, 'Session is already blocked');
    }

    const targetUser = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!targetUser) {
      throw new ApiError(404, 'Session owner was not found');
    }

    assertActorCanManageUser({ actor: req.user, targetUser });

    const reason = req.body.reason?.trim() || 'Blocked by administrator';
    const now = new Date();

    const updated = await prisma.loginSession.update({
      where: { id: session.id },
      data: {
        status: 'blocked',
        blockedAt: now,
        blockedById: req.user._id,
        blockedReason: reason,
        revokedAt: now,
      },
    });

    await prisma.refreshToken.updateMany({
      where: { sessionId: session.id, isRevoked: false },
      data: { isRevoked: true, revokedAt: now },
    });

    const meta = buildRequestMeta(req, req.body?.location);
    await logAuditEvent({
      actorId: req.user._id,
      action: 'admin.session.blocked',
      targetType: 'session',
      targetId: session.id,
      ipAddress: meta.ip || null,
      userAgent: meta.userAgent || null,
      metadata: {
        reason,
        sessionUserId: session.userId,
        sessionUserRole: targetUser.role,
        sessionIpAddress: session.ipAddress || null,
      },
    });

    return ApiResponse.success(res, {
      message: 'Session blocked successfully',
      data: sanitizeSession(updated),
    });
  } catch (error) {
    return next(error);
  }
};

const unblockSession = async (req, res, next) => {
  try {
    const session = await prisma.loginSession.findUnique({
      where: { id: req.params.sessionId },
    });

    if (!session) {
      throw new ApiError(404, 'Session not found');
    }

    if (session.status !== 'blocked') {
      throw new ApiError(409, 'Only blocked sessions can be unblocked');
    }

    const targetUser = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!targetUser) {
      throw new ApiError(404, 'Session owner was not found');
    }

    assertActorCanManageUser({ actor: req.user, targetUser });

    const isExpired = !session.expiresAt || session.expiresAt.getTime() <= Date.now();
    const status = isExpired ? 'expired' : 'active';
    const reason = req.body.reason?.trim() || 'Session unblocked by administrator';

    const updated = await prisma.loginSession.update({
      where: { id: session.id },
      data: {
        status,
        blockedAt: null,
        blockedById: null,
        blockedReason: null,
        revokedAt: status === 'active' ? null : session.revokedAt || new Date(),
      },
    });

    const meta = buildRequestMeta(req, req.body?.location);
    await logAuditEvent({
      actorId: req.user._id,
      action: 'admin.session.unblocked',
      targetType: 'session',
      targetId: session.id,
      ipAddress: meta.ip || null,
      userAgent: meta.userAgent || null,
      metadata: {
        reason,
        sessionUserRole: targetUser.role,
        resultingStatus: status,
      },
    });

    return ApiResponse.success(res, {
      message: isExpired
        ? 'Session unblocked, but it is already expired and cannot be reused'
        : 'Session unblocked successfully',
      data: sanitizeSession(updated),
    });
  } catch (error) {
    return next(error);
  }
};

const listBlockedIps = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const onlyActive = typeof req.query.onlyActive === 'boolean' ? req.query.onlyActive : true;
    const where = onlyActive ? { isActive: true } : {};

    const [total, blockedIps] = await Promise.all([
      prisma.blockedIp.count({ where }),
      prisma.blockedIp.findMany({
        where,
        orderBy: [{ blockedAt: 'desc' }, { createdAt: 'desc' }],
        skip: offset,
        take: limit,
      }),
    ]);

    return ApiResponse.success(res, {
      message: 'Blocked IPs fetched successfully',
      data: blockedIps.map(sanitizeBlockedIp),
      meta: {
        total,
        limit,
        offset,
        onlyActive,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const blockIpAddress = async (req, res, next) => {
  try {
    const ipAddress = normalizeIp(req.body.ipAddress);
    if (!ipAddress) {
      throw new ApiError(422, 'Invalid ipAddress');
    }

    const reason = req.body.reason?.trim() || 'Blocked by administrator';
    const now = new Date();

    const existing = await prisma.blockedIp.findUnique({ where: { ipAddress } });

    if (existing?.isActive) {
      throw new ApiError(409, 'IP address is already blocked');
    }

    const blockedIp = existing
      ? await prisma.blockedIp.update({
          where: { id: existing.id },
          data: {
            reason,
            isActive: true,
            blockedAt: now,
            blockedById: req.user._id,
            unblockedAt: null,
            unblockedById: null,
            unblockReason: null,
          },
        })
      : await prisma.blockedIp.create({
          data: {
            ipAddress,
            reason,
            blockedById: req.user._id,
            blockedAt: now,
            isActive: true,
          },
        });

    const sessions = await prisma.loginSession.findMany({
      where: {
        ipAddress,
        status: 'active',
      },
      select: { id: true, userId: true },
    });

    if (req.user.role === ROLES.ADMIN && sessions.length > 0) {
      const targetUsers = await prisma.user.findMany({
        where: { id: { in: uniq(sessions.map((item) => item.userId)) } },
        select: { id: true, role: true },
      });

      const hasElevatedTargets = targetUsers.some((item) => getRoleRank(item.role) >= 2);
      if (hasElevatedTargets) {
        throw new ApiError(
          403,
          'You are not allowed to block IPs tied to admin or superadmin sessions'
        );
      }
    }

    const sessionIds = sessions.map((item) => item.id);
    if (sessionIds.length > 0) {
      await prisma.loginSession.updateMany({
        where: { id: { in: sessionIds } },
        data: {
          status: 'blocked',
          blockedAt: now,
          blockedById: req.user._id,
          blockedReason: `IP blocked: ${reason}`,
          revokedAt: now,
        },
      });

      await prisma.refreshToken.updateMany({
        where: { sessionId: { in: sessionIds }, isRevoked: false },
        data: { isRevoked: true, revokedAt: now },
      });
    }

    const meta = buildRequestMeta(req, req.body?.location);
    await logAuditEvent({
      actorId: req.user._id,
      action: 'admin.ip.blocked',
      targetType: 'ip',
      targetId: blockedIp.id,
      ipAddress: meta.ip || null,
      userAgent: meta.userAgent || null,
      metadata: {
        blockedIpAddress: ipAddress,
        reason,
        affectedSessionCount: sessionIds.length,
      },
    });

    return ApiResponse.success(res, {
      statusCode: existing ? 200 : 201,
      message: 'IP address blocked successfully',
      data: sanitizeBlockedIp(blockedIp),
    });
  } catch (error) {
    return next(error);
  }
};

const unblockIpAddress = async (req, res, next) => {
  try {
    const blockedIp = await prisma.blockedIp.findUnique({
      where: { id: req.params.blockedIpId },
    });

    if (!blockedIp) {
      throw new ApiError(404, 'Blocked IP entry not found');
    }

    if (!blockedIp.isActive) {
      throw new ApiError(409, 'IP address is already unblocked');
    }

    const reason = req.body.reason?.trim() || 'Unblocked by administrator';

    const updated = await prisma.blockedIp.update({
      where: { id: blockedIp.id },
      data: {
        isActive: false,
        unblockedAt: new Date(),
        unblockedById: req.user._id,
        unblockReason: reason,
      },
    });

    const meta = buildRequestMeta(req, req.body?.location);
    await logAuditEvent({
      actorId: req.user._id,
      action: 'admin.ip.unblocked',
      targetType: 'ip',
      targetId: blockedIp.id,
      ipAddress: meta.ip || null,
      userAgent: meta.userAgent || null,
      metadata: {
        blockedIpAddress: blockedIp.ipAddress,
        reason,
      },
    });

    return ApiResponse.success(res, {
      message: 'IP address unblocked successfully',
      data: sanitizeBlockedIp(updated),
    });
  } catch (error) {
    return next(error);
  }
};

const listAuditLogs = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const where = {};

    if (req.query.actorId) {
      where.actorId = String(req.query.actorId);
    }

    if (req.query.action) {
      where.action = {
        contains: req.query.action,
        mode: 'insensitive',
      };
    }

    if (req.query.targetType) {
      where.targetType = req.query.targetType;
    }

    if (req.query.targetId) {
      where.targetId = req.query.targetId;
    }

    if (req.query.ipAddress) {
      where.ipAddress = normalizeIp(req.query.ipAddress) || req.query.ipAddress;
    }

    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) {
        where.createdAt.gte = new Date(req.query.from);
      }
      if (req.query.to) {
        where.createdAt.lte = new Date(req.query.to);
      }
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    const actorIds = uniq(logs.map((item) => item.actorId));
    const actors = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: {
        id: true,
        name: true,
        email: true,
        registrationNumber: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    const actorMap = new Map(actors.map((actor) => [actor.id, sanitizeUser(actor)]));

    return ApiResponse.success(res, {
      message: 'Audit logs fetched successfully',
      data: logs.map((log) => sanitizeAuditLog(log, actorMap)),
      meta: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDashboard,
  listAdmins,
  createAdmin,
  promoteUserToAdmin,
  updateAdmin,
  updateAdminStatus,
  demoteAdmin,
  listSessions,
  blockSession,
  unblockSession,
  listBlockedIps,
  blockIpAddress,
  unblockIpAddress,
  listAuditLogs,
};
