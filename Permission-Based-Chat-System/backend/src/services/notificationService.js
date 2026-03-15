const prisma = require('../utils/prismaClient');
const ApiError = require('../utils/ApiError');
const { invalidateResourceEverywhere } = require('../utils/cache');
const { SOCKET_EVENTS, ROLES } = require('../utils/constants');
const { emitToUser, emitToUsers } = require('./socketService');

const sanitizePagination = ({ page = 1, limit = 20 } = {}) => {
  const safePage = Number(page) > 0 ? Number(page) : 1;
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (safePage - 1) * safeLimit;

  return { page: safePage, limit: safeLimit, skip };
};

const mapNotification = (notification) => ({
  ...notification,
  _id: notification.id,
  recipient: notification.recipientId,
});

const invalidateNotificationCaches = async () => {
  try {
    await Promise.allSettled([
      invalidateResourceEverywhere('notifications'),
      invalidateResourceEverywhere('admin-dashboard'),
    ]);
  } catch {
    // Cache invalidation should not fail the request flow.
  }
};

const createNotification = async ({ recipient, type, title, message, metadata = {} }) => {
  const notification = await prisma.notification.create({
    data: {
      recipientId: recipient,
      type,
      title,
      message,
      metadata,
    },
  });

  const payload = mapNotification(notification);
  emitToUser(recipient, SOCKET_EVENTS.NOTIFICATION, payload);
  await invalidateNotificationCaches();
  return payload;
};

const createBulkNotifications = async (notifications) => {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return [];
  }

  // Single DB roundtrip instead of N individual inserts.
  await prisma.notification.createMany({
    data: notifications.map((item) => ({
      recipientId: item.recipient,
      type: item.type,
      title: item.title,
      message: item.message,
      metadata: item.metadata || {},
    })),
    skipDuplicates: true,
  });

  // Push real-time notification to each recipient with the data we have.
  notifications.forEach((item) => {
    emitToUser(item.recipient, SOCKET_EVENTS.NOTIFICATION, {
      recipientId: item.recipient,
      recipient: item.recipient,
      type: item.type,
      title: item.title,
      message: item.message,
      metadata: item.metadata || {},
    });
  });

  await invalidateNotificationCaches();

  return notifications.map((item) => ({ recipient: item.recipient, type: item.type }));
};

const listNotifications = async (userId, { page = 1, limit = 20 } = {}) => {
  const { page: safePage, limit: safeLimit, skip } = sanitizePagination({ page, limit });

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    }),
    prisma.notification.count({ where: { recipientId: userId } }),
  ]);

  return {
    items: items.map(mapNotification),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  };
};

const markNotificationRead = async (userId, notificationId) => {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, recipientId: userId },
  });

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });

  await invalidateNotificationCaches();

  return mapNotification(updated);
};

const notifyAdminsPermissionRequestCreated = async (permissionRequest) => {
  const admins = await prisma.user.findMany({
    where: { role: { in: [ROLES.ADMIN, ROLES.SUPERADMIN] }, isActive: true },
    select: { id: true },
  });

  if (admins.length === 0) return;

  const adminIds = admins.map((a) => a.id);
  const notificationMetadata = {
    permissionRequestId: permissionRequest.id,
    requesterId: permissionRequest.requesterId,
    targetId: permissionRequest.targetId,
  };

  // Batch-insert all admin notifications in one query, then emit using the IDs we already have
  // (avoids a second DB round-trip that emitToAdmins would make).
  await createBulkNotifications(
    adminIds.map((adminId) => ({
      recipient: adminId,
      type: 'permission_request',
      title: 'New Cross-Group Chat Request',
      message: 'A new cross-group permission request has been submitted.',
      metadata: notificationMetadata,
    }))
  );

  emitToUsers(adminIds, SOCKET_EVENTS.PERMISSION_REQUEST_CREATED, {
    permissionRequestId: permissionRequest.id,
    requesterId: permissionRequest.requesterId,
    targetId: permissionRequest.targetId,
    status: permissionRequest.status,
  });
};

const notifyPermissionRequestUpdated = async (permissionRequest) => {
  const userIds = [permissionRequest.requesterId, permissionRequest.targetId];

  await createBulkNotifications(
    userIds.map((userId) => ({
      recipient: userId,
      type: 'permission_update',
      title: 'Permission Request Updated',
      message: `Your cross-group request is ${permissionRequest.status}.`,
      metadata: {
        permissionRequestId: permissionRequest.id,
        status: permissionRequest.status,
      },
    }))
  );

  userIds.forEach((userId) => {
    emitToUser(userId, SOCKET_EVENTS.PERMISSION_REQUEST_UPDATED, {
      permissionRequestId: permissionRequest.id,
      status: permissionRequest.status,
      approvedBy: permissionRequest.approvedBy,
      expiresAt: permissionRequest.expiresAt,
    });
  });
};

module.exports = {
  createNotification,
  createBulkNotifications,
  listNotifications,
  markNotificationRead,
  notifyAdminsPermissionRequestCreated,
  notifyPermissionRequestUpdated,
};
