const { param, body } = require('express-validator');
const { isUuid } = require('../utils/uuid');

const groupIdParamValidator = [param('id').custom(isUuid).withMessage('Invalid group ID')];

const createGroupValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Group name is required')
    .isLength({ min: 2, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
];

const updateGroupValidator = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
];

const membersValidator = [
  body('members').isArray({ min: 1 }).withMessage('members must be a non-empty array'),
  body('members.*').custom(isUuid).withMessage('Each member must be a valid user ID'),
];

const transferOwnershipValidator = [
  body('newOwnerId').custom(isUuid).withMessage('newOwnerId must be a valid user ID'),
];

const groupMemberRoleChangeValidator = [
  body('userId').custom(isUuid).withMessage('userId must be a valid user ID'),
];

module.exports = {
  groupIdParamValidator,
  createGroupValidator,
  updateGroupValidator,
  membersValidator,
  transferOwnershipValidator,
  groupMemberRoleChangeValidator,
};
