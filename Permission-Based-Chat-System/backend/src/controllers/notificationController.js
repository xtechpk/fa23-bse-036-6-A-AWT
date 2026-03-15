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

module.exports = {
  listNotifications,
  markNotificationRead,
};
