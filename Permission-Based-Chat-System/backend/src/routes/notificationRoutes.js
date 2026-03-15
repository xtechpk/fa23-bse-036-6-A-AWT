const express = require('express');
const { param } = require('express-validator');
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { isUuid } = require('../utils/uuid');
const { cacheGet, invalidateOnWrite } = require('../middlewares/cacheMiddleware');

const router = express.Router();

const notificationIdValidator = [
  param('id')
    .custom((value) => isUuid(value))
    .withMessage('Invalid notification ID'),
];

router.use(protect);
router.use(invalidateOnWrite(['notifications', 'admin-dashboard']));

router.get(
  '/',
  cacheGet({ resource: 'notifications', scope: 'user', ttlSeconds: 120 }),
  notificationController.listNotifications
);
router.patch(
  '/:id/read',
  notificationIdValidator,
  validate,
  notificationController.markNotificationRead
);

module.exports = router;
