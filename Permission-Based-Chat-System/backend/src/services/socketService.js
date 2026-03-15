const prisma = require('../utils/prismaClient');
const { ROLES } = require('../utils/constants');

let ioInstance = null;
const userSockets = new Map();

const getUserRoom = (userId) => `user:${userId}`;
const getGroupRoom = (groupId) => `group:${groupId}`;

const setIO = (io) => {
  ioInstance = io;
};

const getIO = () => ioInstance;

const registerUserSocket = (userId, socketId) => {
  const key = String(userId);
  if (!userSockets.has(key)) {
    userSockets.set(key, new Set());
  }
  userSockets.get(key).add(socketId);
};

const unregisterUserSocket = (userId, socketId) => {
  const key = String(userId);
  if (!userSockets.has(key)) {
    return;
  }

  const socketSet = userSockets.get(key);
  socketSet.delete(socketId);

  if (socketSet.size === 0) {
    userSockets.delete(key);
  }
};

const isUserOnline = (userId) => {
  const key = String(userId);
  return userSockets.has(key) && userSockets.get(key).size > 0;
};

const emitToUser = (userId, eventName, payload) => {
  if (!ioInstance) {
    return;
  }
  ioInstance.to(getUserRoom(userId)).emit(eventName, payload);
};

const emitToUsers = (userIds, eventName, payload) => {
  if (!ioInstance || !Array.isArray(userIds)) {
    return;
  }

  userIds.forEach((id) => {
    ioInstance.to(getUserRoom(id)).emit(eventName, payload);
  });
};

const emitToGroup = (groupId, eventName, payload) => {
  if (!ioInstance) {
    return;
  }
  ioInstance.to(getGroupRoom(groupId)).emit(eventName, payload);
};

// Cache admin IDs to avoid a DB query on every admin notification.
// TTL of 60 s is short enough to pick up role changes without significant lag.
const ADMIN_CACHE_TTL_MS = 60 * 1000;
const adminCache = { ids: [], expiresAt: 0 };

const invalidateAdminCache = () => {
  adminCache.expiresAt = 0;
};

const emitToAdmins = async (eventName, payload) => {
  if (!ioInstance) {
    return;
  }

  let adminIds;
  if (Date.now() < adminCache.expiresAt) {
    adminIds = adminCache.ids;
  } else {
    const admins = await prisma.user.findMany({
      where: { role: { in: [ROLES.ADMIN, ROLES.SUPERADMIN] }, isActive: true },
      select: { id: true },
    });
    adminIds = admins.map((a) => a.id);
    adminCache.ids = adminIds;
    adminCache.expiresAt = Date.now() + ADMIN_CACHE_TTL_MS;
  }

  adminIds.forEach((id) => {
    ioInstance.to(getUserRoom(id)).emit(eventName, payload);
  });
};

module.exports = {
  setIO,
  getIO,
  getUserRoom,
  getGroupRoom,
  registerUserSocket,
  unregisterUserSocket,
  isUserOnline,
  emitToUser,
  emitToUsers,
  emitToGroup,
  emitToAdmins,
  invalidateAdminCache,
};
