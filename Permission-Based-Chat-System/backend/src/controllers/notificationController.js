const ApiResponse = require('../utils/ApiResponse');
const notificationService = require('../services/notificationService');
const asyncHandler = require('../utils/asyncHandler');

const listNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.listNotifications(req.user._id, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
  });

  const payload = {
    message: 'Notifications fetched successfully',
    data: result.items,
    meta: result.pagination,
  };

  return ApiResponse.success(res, payload);
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markNotificationRead(req.user._id, req.params.id);

  return ApiResponse.success(res, {
    message: 'Notification marked as read',
    data: notification,
  });
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllNotificationsRead(req.user._id);

  return ApiResponse.success(res, {
    message: 'All notifications marked as read',
    data: result,
  });
});

const deleteNotification = asyncHandler(async (req, res) => {
  const result = await notificationService.deleteNotification(req.user._id, req.params.id);

  return ApiResponse.success(res, {
    message: 'Notification deleted successfully',
    data: result,
  });
});

const deleteNotificationsBulk = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const result = await notificationService.deleteNotificationsBulk(req.user._id, ids);

  return ApiResponse.success(res, {
    message: 'Notifications deleted successfully',
    data: result,
  });
});

module.exports = {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteNotificationsBulk,
};
