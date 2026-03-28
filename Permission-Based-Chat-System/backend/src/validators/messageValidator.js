const { body, param, query } = require('express-validator');
const { isUuid } = require('../utils/uuid');

const hasContentOrAttachments = (value, { req }) => {
  const content = typeof value === 'string' ? value.trim() : '';
  const attachmentIds = Array.isArray(req.body.attachmentIds) ? req.body.attachmentIds : [];
  const legacyAttachments = Array.isArray(req.body.attachments) ? req.body.attachments : [];
  return Boolean(content || attachmentIds.length > 0 || legacyAttachments.length > 0);
};

const attachmentIdsValidator = [
  body('attachmentIds').optional().isArray().withMessage('attachmentIds must be an array'),
  body('attachmentIds.*')
    .optional()
    .custom(isUuid)
    .withMessage('Each attachmentId must be a valid file ID'),
];

const baseMessageValidator = [
  body('content')
    .optional({ nullable: true })
    .custom(hasContentOrAttachments)
    .withMessage('Provide content or attachments'),
  body('replyToId').optional().custom(isUuid).withMessage('replyToId must be a valid message ID'),
  body('oneTime').optional().isBoolean().withMessage('oneTime must be a boolean'),
  ...attachmentIdsValidator,
];

const privateMessageValidator = [
  body('receiverId').custom(isUuid).withMessage('receiverId must be a valid user ID'),
  ...baseMessageValidator,
];

const groupMessageValidator = [
  body('groupId').custom(isUuid).withMessage('groupId must be a valid group ID'),
  body('oneTime')
    .optional()
    .custom((value) => value !== true)
    .withMessage('oneTime messages are only supported in private chat'),
  ...baseMessageValidator,
];

const privateHistoryValidator = [
  param('userId').custom(isUuid).withMessage('Invalid user ID'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

const groupHistoryValidator = [
  param('groupId').custom(isUuid).withMessage('Invalid group ID'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

const searchMessageValidator = [
  query('q').trim().notEmpty().withMessage('Search query is required'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

const markReadValidator = [param('id').custom(isUuid).withMessage('Invalid message ID')];

const editMessageValidator = [
  param('id').custom(isUuid).withMessage('Invalid message ID'),
  body('content').trim().notEmpty().withMessage('content is required for editing'),
];

const deleteMessageValidator = [
  param('id').custom(isUuid).withMessage('Invalid message ID'),
  body('deleteFor')
    .optional()
    .isIn(['me', 'everyone'])
    .withMessage('deleteFor must be me or everyone'),
];

const deletePrivateConversationValidator = [
  param('userId').custom(isUuid).withMessage('Invalid user ID'),
];

const deleteGroupConversationValidator = [
  param('groupId').custom(isUuid).withMessage('Invalid group ID'),
];

module.exports = {
  privateMessageValidator,
  groupMessageValidator,
  privateHistoryValidator,
  groupHistoryValidator,
  searchMessageValidator,
  markReadValidator,
  editMessageValidator,
  deleteMessageValidator,
  deletePrivateConversationValidator,
  deleteGroupConversationValidator,
};
