const express = require('express');
const userController = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');
const { uploadAvatar } = require('../middlewares/uploadMiddleware');
const allowRoles = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { cacheGet, invalidateOnWrite } = require('../middlewares/cacheMiddleware');
const {
  userIdParamValidator,
  updateUserValidator,
  updateUserStatusValidator,
  searchUserValidator,
} = require('../validators/userValidator');

const router = express.Router();

router.use(protect);
router.use(invalidateOnWrite(['users', 'users-search', 'admin-dashboard', 'admins', 'auth-me']));

router.post('/me/avatar', uploadAvatar, userController.uploadMyAvatar);
router.get(
  '/',
  allowRoles('admin'),
  cacheGet({ resource: 'users', scope: 'global', ttlSeconds: 300 }),
  userController.listUsers
);
router.get(
  '/search',
  searchUserValidator,
  validate,
  cacheGet({ resource: 'users-search', scope: 'user', ttlSeconds: 120 }),
  userController.searchUsers
);
router.get(
  '/:id',
  userIdParamValidator,
  validate,
  cacheGet({
    resource: 'users',
    scope: 'global',
    identifier: (req) => req.params.id,
    ttlSeconds: 300,
  }),
  userController.getUserById
);
router.put(
  '/:id',
  [...userIdParamValidator, ...updateUserValidator],
  validate,
  userController.updateUser
);
router.patch(
  '/:id/status',
  allowRoles('admin'),
  [...userIdParamValidator, ...updateUserStatusValidator],
  validate,
  userController.updateUserStatus
);

module.exports = router;
