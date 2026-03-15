const express = require('express');
const permissionController = require('../controllers/permissionController');
const { protect } = require('../middlewares/authMiddleware');
const allowRoles = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { cacheGet, invalidateOnWrite } = require('../middlewares/cacheMiddleware');
const {
  createPermissionRequestValidator,
  permissionIdParamValidator,
  permissionPermIdParamValidator,
  approvePermissionValidator,
  rejectPermissionValidator,
  directGrantValidator,
} = require('../validators/permissionValidator');

const router = express.Router();

router.use(protect);
router.use(
  invalidateOnWrite([
    'permissions',
    'permissions-by-id',
    'chat-permissions',
    'messages-private-history',
    'messages-search',
    'notifications',
    'admin-dashboard',
  ])
);

// Any authenticated user
router.post(
  '/request',
  createPermissionRequestValidator,
  validate,
  permissionController.requestPermission
);
router.get(
  '/',
  cacheGet({ resource: 'permissions', scope: 'user', ttlSeconds: 120 }),
  permissionController.listPermissions
);
router.get(
  '/chat-permissions',
  cacheGet({ resource: 'chat-permissions', scope: 'user', ttlSeconds: 120 }),
  permissionController.getChatPermissions
);
router.get(
  '/:id',
  permissionIdParamValidator,
  validate,
  cacheGet({
    resource: 'permissions-by-id',
    scope: 'user',
    identifier: (req) => req.params.id,
    ttlSeconds: 120,
  }),
  permissionController.getPermissionById
);

// Admin-only permission management
router.patch(
  '/:id/approve',
  allowRoles('admin'),
  [...permissionIdParamValidator, ...approvePermissionValidator],
  validate,
  permissionController.approvePermission
);
router.patch(
  '/:id/reject',
  allowRoles('admin'),
  [...permissionIdParamValidator, ...rejectPermissionValidator],
  validate,
  permissionController.rejectPermission
);
router.post(
  '/direct-grant',
  allowRoles('admin'),
  directGrantValidator,
  validate,
  permissionController.grantDirectPermission
);
router.patch(
  '/chat/:permissionId/revoke',
  allowRoles('admin'),
  permissionPermIdParamValidator,
  validate,
  permissionController.revokePermission
);

module.exports = router;
