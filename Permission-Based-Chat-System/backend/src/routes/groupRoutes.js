const express = require('express');
const groupController = require('../controllers/groupController');
const { protect } = require('../middlewares/authMiddleware');
const allowRoles = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { cacheGet, invalidateOnWrite } = require('../middlewares/cacheMiddleware');
const {
  groupIdParamValidator,
  createGroupValidator,
  updateGroupValidator,
  membersValidator,
  transferOwnershipValidator,
} = require('../validators/groupValidator');

const router = express.Router();

router.use(protect);
router.use(
  invalidateOnWrite([
    'groups',
    'mygroups',
    'messages-private-history',
    'messages-group-history',
    'messages-search',
    'admin-dashboard',
  ])
);

// Any authenticated user can view their own groups or leave a group
router.get(
  '/my',
  cacheGet({ resource: 'mygroups', scope: 'user', ttlSeconds: 120 }),
  groupController.getMyGroups
);
router.post('/:id/leave', groupIdParamValidator, validate, groupController.leaveGroup);

// Admin-only group management
router.use(allowRoles('admin'));
router.post('/', createGroupValidator, validate, groupController.createGroup);
router.get(
  '/',
  cacheGet({ resource: 'groups', scope: 'global', ttlSeconds: 300 }),
  groupController.listGroups
);
router.get(
  '/:id',
  groupIdParamValidator,
  validate,
  cacheGet({
    resource: 'groups',
    scope: 'global',
    identifier: (req) => req.params.id,
    ttlSeconds: 300,
  }),
  groupController.getGroupById
);
router.put(
  '/:id',
  [...groupIdParamValidator, ...updateGroupValidator],
  validate,
  groupController.updateGroup
);
router.delete('/:id', groupIdParamValidator, validate, groupController.deleteGroup);
router.post(
  '/:id/add-members',
  [...groupIdParamValidator, ...membersValidator],
  validate,
  groupController.addMembers
);
router.post(
  '/:id/remove-members',
  [...groupIdParamValidator, ...membersValidator],
  validate,
  groupController.removeMembers
);
router.patch(
  '/:id/transfer-ownership',
  [...groupIdParamValidator, ...transferOwnershipValidator],
  validate,
  groupController.transferOwnership
);

module.exports = router;
