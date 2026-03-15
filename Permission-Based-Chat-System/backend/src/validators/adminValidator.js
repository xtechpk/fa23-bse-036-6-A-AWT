const { body, param, query } = require('express-validator');
const net = require('net');
const { isUuid } = require('../utils/uuid');

const SESSION_STATUSES = ['active', 'blocked', 'revoked', 'expired'];

const adminIdParamValidator = [param('id').custom(isUuid).withMessage('Invalid admin user ID')];

const createAdminValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }),
  body('registrationNumber')
    .trim()
    .notEmpty()
    .withMessage('Registration number is required')
    .isLength({ min: 3, max: 40 }),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/)
    .withMessage('Password must include upper, lower, and numeric characters'),
];

const updateAdminValidator = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('registrationNumber').optional().trim().isLength({ min: 3, max: 40 }),
  body('email').optional().trim().isEmail().normalizeEmail(),
  body('password')
    .optional()
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/)
    .withMessage('Password must include upper, lower, and numeric characters'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const updateAdminStatusValidator = [
  body('isActive').isBoolean().withMessage('isActive must be a boolean'),
];

const promoteUserParamValidator = [param('id').custom(isUuid).withMessage('Invalid user ID')];

const sessionIdParamValidator = [
  param('sessionId').custom(isUuid).withMessage('Invalid session ID'),
];

const blockedIpIdParamValidator = [
  param('blockedIpId').custom(isUuid).withMessage('Invalid blocked IP ID'),
];

const listSessionsValidator = [
  query('userId').optional().custom(isUuid).withMessage('userId must be a valid user ID'),
  query('status').optional().isIn(SESSION_STATUSES).withMessage('Invalid session status filter'),
  query('ipAddress').optional().trim().isLength({ min: 3, max: 64 }),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
];

const blockSessionValidator = [
  ...sessionIdParamValidator,
  body('reason').optional().trim().isLength({ min: 3, max: 300 }),
];

const unblockSessionValidator = [
  ...sessionIdParamValidator,
  body('reason').optional().trim().isLength({ min: 3, max: 300 }),
];

const listBlockedIpsValidator = [
  query('onlyActive').optional().isBoolean().toBoolean(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
];

const blockIpValidator = [
  body('ipAddress')
    .trim()
    .notEmpty()
    .withMessage('ipAddress is required')
    .custom((value) => net.isIP(String(value).trim()) !== 0)
    .withMessage('ipAddress must be a valid IPv4 or IPv6 address'),
  body('reason').optional().trim().isLength({ min: 3, max: 300 }),
];

const unblockIpValidator = [
  ...blockedIpIdParamValidator,
  body('reason').optional().trim().isLength({ min: 3, max: 300 }),
];

const listAuditLogsValidator = [
  query('actorId').optional().custom(isUuid).withMessage('actorId must be a valid user ID'),
  query('action').optional().trim().isLength({ min: 2, max: 120 }),
  query('targetType').optional().trim().isLength({ min: 2, max: 80 }),
  query('targetId').optional().trim().isLength({ min: 1, max: 120 }),
  query('ipAddress').optional().trim().isLength({ min: 3, max: 64 }),
  query('from').optional().isISO8601().withMessage('from must be a valid ISO8601 datetime'),
  query('to').optional().isISO8601().withMessage('to must be a valid ISO8601 datetime'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
];

module.exports = {
  adminIdParamValidator,
  createAdminValidator,
  updateAdminValidator,
  updateAdminStatusValidator,
  promoteUserParamValidator,
  sessionIdParamValidator,
  blockedIpIdParamValidator,
  listSessionsValidator,
  blockSessionValidator,
  unblockSessionValidator,
  listBlockedIpsValidator,
  blockIpValidator,
  unblockIpValidator,
  listAuditLogsValidator,
};
