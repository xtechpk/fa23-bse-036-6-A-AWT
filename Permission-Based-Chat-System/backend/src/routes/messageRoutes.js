const express = require('express');
const messageController = require('../controllers/messageController');
const { protect } = require('../middlewares/authMiddleware');
const { uploadChatAttachments } = require('../middlewares/uploadMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { cacheGet, invalidateOnWrite } = require('../middlewares/cacheMiddleware');
const {
  privateMessageValidator,
  groupMessageValidator,
  privateHistoryValidator,
  groupHistoryValidator,
  searchMessageValidator,
  markReadValidator,
  editMessageValidator,
  deleteMessageValidator,
} = require('../validators/messageValidator');

const router = express.Router();

router.use(protect);
router.use(
  invalidateOnWrite([
    'messages-private-history',
    'messages-group-history',
    'messages-search',
    'notifications',
    'admin-dashboard',
  ])
);

router.post('/upload', uploadChatAttachments, messageController.uploadAttachments);
router.post('/private', privateMessageValidator, validate, messageController.sendPrivateMessage);
router.post('/group', groupMessageValidator, validate, messageController.sendGroupMessage);
router.get(
  '/search',
  searchMessageValidator,
  validate,
  cacheGet({ resource: 'messages-search', scope: 'user', ttlSeconds: 60 }),
  messageController.searchMessages
);
router.get(
  '/private/:userId',
  privateHistoryValidator,
  validate,
  cacheGet({ resource: 'messages-private-history', scope: 'user', ttlSeconds: 60 }),
  messageController.getPrivateHistory
);
router.get(
  '/group/:groupId',
  groupHistoryValidator,
  validate,
  cacheGet({ resource: 'messages-group-history', scope: 'user', ttlSeconds: 60 }),
  messageController.getGroupHistory
);
router.patch('/:id/read', markReadValidator, validate, messageController.markMessageRead);
router.patch('/:id', editMessageValidator, validate, messageController.editMessage);
router.delete('/:id', deleteMessageValidator, validate, messageController.deleteMessage);

module.exports = router;
