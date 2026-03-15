const { param, body, query } = require('express-validator');
const { isUuid } = require('../utils/uuid');

const createPermissionRequestValidator = [
  body('targetUserId').custom(isUuid).withMessage('targetUserId must be a valid user ID'),
  body('reason')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Reason must be between 5 and 500 chars'),
  body('expiresAt')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('expiresAt must be a valid date'),
];

const permissionIdParamValidator = [
  param('id').custom(isUuid).withMessage('Invalid permission request ID'),
];

const permissionPermIdParamValidator = [
  param('permissionId').custom(isUuid).withMessage('Invalid chat permission ID'),
];

const approvePermissionValidator = [
  body('expiresAt')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('expiresAt must be a valid date'),
  body('adminRemark').optional({ nullable: true }).isLength({ max: 500 }),
];

const rejectPermissionValidator = [
  body('adminRemark').optional({ nullable: true }).isLength({ max: 500 }),
];

const directGrantValidator = [
  body('userAId').custom(isUuid).withMessage('userAId must be a valid user ID'),
  body('userBId').custom(isUuid).withMessage('userBId must be a valid user ID'),
  body('expiresAt')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('expiresAt must be a valid date'),
];

module.exports = {
  createPermissionRequestValidator,
  permissionIdParamValidator,
  permissionPermIdParamValidator,
  approvePermissionValidator,
  rejectPermissionValidator,
  directGrantValidator,
};
