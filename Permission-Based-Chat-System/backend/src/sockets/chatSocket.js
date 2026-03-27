const prisma = require('../utils/prismaClient');
const { verifyAccessToken } = require('../utils/generateToken');
const { SOCKET_EVENTS, ROLES } = require('../utils/constants');
const {
  registerUserSocket,
  unregisterUserSocket,
  getUserRoom,
  getGroupRoom,
  emitToUser,
} = require('../services/socketService');
const messageService = require('../services/messageService');
const {
  createPermissionRequest,
  approvePermissionRequest,
  rejectPermissionRequest,
} = require('../services/permissionService');
const logger = require('../utils/logger');

const SOCKET_EVENT_WINDOW_MS = Number(process.env.SOCKET_EVENT_WINDOW_MS || 60 * 1000);
const SOCKET_EVENT_MAX_PER_WINDOW = Number(process.env.SOCKET_EVENT_MAX_PER_WINDOW || 120);
const SOCKET_SECURITY_RECHECK_MS = Number(process.env.SOCKET_SECURITY_RECHECK_MS || 30 * 1000);

const RATE_LIMITED_EVENTS = new Set([
  SOCKET_EVENTS.PRIVATE_MESSAGE,
  SOCKET_EVENTS.GROUP_MESSAGE,
  SOCKET_EVENTS.MARK_READ,
  SOCKET_EVENTS.EDIT_MESSAGE,
  SOCKET_EVENTS.DELETE_MESSAGE,
  SOCKET_EVENTS.PERMISSION_REQUEST_CREATED,
  SOCKET_EVENTS.PERMISSION_REQUEST_UPDATED,
]);

const OBJECT_PAYLOAD_EVENTS = new Set([
  SOCKET_EVENTS.PRIVATE_MESSAGE,
  SOCKET_EVENTS.GROUP_MESSAGE,
  SOCKET_EVENTS.TYPING_START,
  SOCKET_EVENTS.TYPING_STOP,
  SOCKET_EVENTS.MARK_READ,
  SOCKET_EVENTS.EDIT_MESSAGE,
  SOCKET_EVENTS.DELETE_MESSAGE,
  SOCKET_EVENTS.PERMISSION_REQUEST_CREATED,
  SOCKET_EVENTS.PERMISSION_REQUEST_UPDATED,
]);

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const updateUserLastSeenSafely = async ({ userId, value }) => {
  const result = await prisma.user.updateMany({
    where: { id: String(userId) },
    data: { lastSeen: value },
  });

  if (result.count === 0) {
    logger.warn('Skipping lastSeen update because user was not found', { userId });
  }
};

const assertSocketSessionActive = async ({ userId, sessionId }) => {
  const session = await prisma.loginSession.findUnique({ where: { id: String(sessionId) } });
  if (!session || session.userId !== String(userId)) {
    throw new Error('Authentication failed: session is invalid');
  }

  if (!session.expiresAt || session.expiresAt.getTime() <= Date.now()) {
    throw new Error('Authentication failed: session has expired');
  }

  if (session.status !== 'active') {
    throw new Error('Authentication failed: session is no longer active');
  }

  return session;
};

const extractTokenFromHandshake = (socket) => {
  const authToken = socket.handshake?.auth?.token;
  if (authToken && typeof authToken === 'string') {
    return authToken;
  }

  const headerToken = socket.handshake?.headers?.authorization;
  if (headerToken && headerToken.startsWith('Bearer ')) {
    return headerToken.split(' ')[1];
  }

  return null;
};

const registerChatSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = extractTokenFromHandshake(socket);
      if (!token) {
        return next(new Error('Authentication failed: token missing'));
      }

      const decoded = verifyAccessToken(token);

      if (!decoded.sessionId) {
        return next(new Error('Authentication failed: session missing'));
      }

      await assertSocketSessionActive({ userId: decoded.userId, sessionId: decoded.sessionId });

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

      if (!user) {
        return next(new Error('Authentication failed: user not found'));
      }

      if (!user.isActive && ![ROLES.ADMIN, ROLES.SUPERADMIN].includes(user.role)) {
        return next(new Error('Authentication failed: inactive account'));
      }

      const userGroupMemberships = await prisma.groupMember.findMany({
        where: { userId: user.id },
        select: { groupId: true },
      });

      socket.user = { ...user, _id: user.id, groupIds: userGroupMemberships.map((m) => m.groupId) };
      socket.authContext = {
        userId: String(user.id),
        sessionId: String(decoded.sessionId),
      };
      socket.securityState = {
        lastSecurityCheckAt: Date.now(),
        eventWindowStartedAt: Date.now(),
        eventCount: 0,
      };

      return next();
    } catch (error) {
      return next(new Error('Authentication failed'));
    }
  });

  io.on(SOCKET_EVENTS.CONNECTION, async (socket) => {
    const userId = String(socket.user._id);

    socket.use(async (packet, next) => {
      try {
        const [eventName, payload] = Array.isArray(packet) ? packet : [];
        const now = Date.now();

        if (OBJECT_PAYLOAD_EVENTS.has(eventName) && !isPlainObject(payload)) {
          return next(new Error('Invalid payload format'));
        }

        if (RATE_LIMITED_EVENTS.has(eventName)) {
          const state = socket.securityState;
          if (now - state.eventWindowStartedAt > SOCKET_EVENT_WINDOW_MS) {
            state.eventWindowStartedAt = now;
            state.eventCount = 0;
          }

          state.eventCount += 1;
          if (state.eventCount > SOCKET_EVENT_MAX_PER_WINDOW) {
            return next(new Error('Too many socket events. Please slow down.'));
          }
        }

        if (now - socket.securityState.lastSecurityCheckAt >= SOCKET_SECURITY_RECHECK_MS) {
          await assertSocketSessionActive({
            userId: socket.authContext.userId,
            sessionId: socket.authContext.sessionId,
          });

          const freshUser = await prisma.user.findUnique({
            where: { id: socket.authContext.userId },
            select: { id: true, isActive: true, role: true },
          });

          const isPrivileged =
            freshUser && [ROLES.ADMIN, ROLES.SUPERADMIN].includes(freshUser.role);
          if (!freshUser || (!freshUser.isActive && !isPrivileged)) {
            socket.disconnect(true);
            return next(new Error('Authentication failed: account is inactive'));
          }

          socket.securityState.lastSecurityCheckAt = now;
        }

        return next();
      } catch (error) {
        socket.disconnect(true);
        return next(new Error(error.message || 'Socket security validation failed'));
      }
    });

    registerUserSocket(userId, socket.id);
    socket.join(getUserRoom(userId));

    (socket.user.groupIds || []).forEach((groupId) => {
      socket.join(getGroupRoom(groupId));
    });

    await updateUserLastSeenSafely({ userId, value: null });
    await messageService.markPrivateMessagesDelivered({ receiverId: userId });

    socket.emit(SOCKET_EVENTS.CONNECTION, {
      success: true,
      message: 'Socket connected successfully',
      data: {
        userId,
        role: socket.user.role,
        joinedGroups: socket.user.groupIds,
      },
    });

    socket.on(SOCKET_EVENTS.PRIVATE_MESSAGE, async (payload, ack) => {
      try {
        const message = await messageService.sendPrivateMessage({
          senderId: userId,
          receiverId: payload?.receiverId,
          content: payload?.content,
          attachments: payload?.attachments || [],
          replyToId: payload?.replyToId,
          oneTime: payload?.oneTime,
        });

        if (ack) ack({ success: true, data: message });
      } catch (error) {
        if (ack) ack({ success: false, message: error.message });
      }
    });

    socket.on(SOCKET_EVENTS.GROUP_MESSAGE, async (payload, ack) => {
      try {
        const message = await messageService.sendGroupMessage({
          senderId: userId,
          groupId: payload?.groupId,
          content: payload?.content,
          attachments: payload?.attachments || [],
          replyToId: payload?.replyToId,
          oneTime: payload?.oneTime,
        });

        if (ack) ack({ success: true, data: message });
      } catch (error) {
        if (ack) ack({ success: false, message: error.message });
      }
    });

    socket.on(SOCKET_EVENTS.TYPING_START, (payload) => {
      if (!payload || !payload.type || !payload.targetId) {
        return;
      }

      if (payload.type === 'private') {
        emitToUser(payload.targetId, SOCKET_EVENTS.TYPING_START, {
          from: userId,
          type: 'private',
        });
      }

      if (payload.type === 'group') {
        socket.to(getGroupRoom(payload.targetId)).emit(SOCKET_EVENTS.TYPING_START, {
          from: userId,
          type: 'group',
          groupId: payload.targetId,
        });
      }
    });

    socket.on(SOCKET_EVENTS.TYPING_STOP, (payload) => {
      if (!payload || !payload.type || !payload.targetId) {
        return;
      }

      if (payload.type === 'private') {
        emitToUser(payload.targetId, SOCKET_EVENTS.TYPING_STOP, {
          from: userId,
          type: 'private',
        });
      }

      if (payload.type === 'group') {
        socket.to(getGroupRoom(payload.targetId)).emit(SOCKET_EVENTS.TYPING_STOP, {
          from: userId,
          type: 'group',
          groupId: payload.targetId,
        });
      }
    });

    socket.on(SOCKET_EVENTS.MARK_READ, async (payload, ack) => {
      try {
        const result = await messageService.markMessageRead({
          userId,
          messageId: payload?.messageId,
        });

        if (ack) ack({ success: true, data: result });
      } catch (error) {
        if (ack) ack({ success: false, message: error.message });
      }
    });

    socket.on(SOCKET_EVENTS.EDIT_MESSAGE, async (payload, ack) => {
      try {
        const result = await messageService.editMessage({
          userId,
          messageId: payload?.messageId,
          content: payload?.content,
        });

        if (ack) ack({ success: true, data: result });
      } catch (error) {
        if (ack) ack({ success: false, message: error.message });
      }
    });

    socket.on(SOCKET_EVENTS.DELETE_MESSAGE, async (payload, ack) => {
      try {
        const result = await messageService.deleteMessage({
          userId,
          messageId: payload?.messageId,
          deleteFor: payload?.deleteFor || 'me',
        });

        if (ack) ack({ success: true, data: result });
      } catch (error) {
        if (ack) ack({ success: false, message: error.message });
      }
    });

    socket.on(SOCKET_EVENTS.PERMISSION_REQUEST_CREATED, async (payload, ack) => {
      try {
        const request = await createPermissionRequest({
          requesterId: userId,
          targetUserId: payload?.targetUserId,
          reason: payload?.reason,
          expiresAt: payload?.expiresAt || null,
        });

        if (ack) ack({ success: true, data: request });
      } catch (error) {
        if (ack) ack({ success: false, message: error.message });
      }
    });

    socket.on(SOCKET_EVENTS.PERMISSION_REQUEST_UPDATED, async (payload, ack) => {
      try {
        if (![ROLES.ADMIN, ROLES.SUPERADMIN].includes(socket.user.role)) {
          throw new Error('Only admin or superadmin can update permission requests');
        }

        if (payload?.action === 'approve') {
          const request = await approvePermissionRequest({
            requestId: payload.requestId,
            adminId: userId,
            expiresAt: payload.expiresAt || null,
            adminRemark: payload.adminRemark || null,
          });
          if (ack) ack({ success: true, data: request });
          return;
        }

        if (payload?.action === 'reject') {
          const request = await rejectPermissionRequest({
            requestId: payload.requestId,
            adminId: userId,
            adminRemark: payload.adminRemark || null,
          });
          if (ack) ack({ success: true, data: request });
          return;
        }

        throw new Error('Invalid action. Use approve or reject.');
      } catch (error) {
        if (ack) ack({ success: false, message: error.message });
      }
    });

    socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
      try {
        unregisterUserSocket(userId, socket.id);
        await updateUserLastSeenSafely({ userId, value: new Date() });
        logger.info('Socket disconnected', { userId, socketId: socket.id });
      } catch (error) {
        logger.warn('Socket disconnect cleanup failed', {
          userId,
          socketId: socket.id,
          message: error.message,
        });
      }
    });
  });
};

module.exports = registerChatSocket;
