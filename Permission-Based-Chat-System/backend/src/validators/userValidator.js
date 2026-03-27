const { param, body, query } = require('express-validator');
const { isUuid } = require('../utils/uuid');

const userIdParamValidator = [param('id').custom(isUuid).withMessage('Invalid user ID')];

const createUserValidator = [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('registrationNumber').trim().isLength({ min: 3, max: 40 }),
  body('email').trim().isEmail().normalizeEmail(),
  body('role')
    .optional()
    .isIn(['user', 'admin', 'superadmin'])
    .withMessage('role must be user, admin, or superadmin'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/)
    .withMessage('Password must include upper, lower, and numeric characters'),
];

const updateUserValidator = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('registrationNumber').optional().trim().isLength({ min: 3, max: 40 }),
  body('email').optional().trim().isEmail().normalizeEmail(),
  body('role')
    .optional()
    .isIn(['user', 'admin', 'superadmin'])
    .withMessage('role must be user, admin, or superadmin'),
  body('uiDensityMode')
    .optional()
    .isIn(['comfortable', 'compact'])
    .withMessage('uiDensityMode must be comfortable or compact'),
  body('password')
    .optional()
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/)
    .withMessage('Password must include upper, lower, and numeric characters'),
];

const updateUserStatusValidator = [
  body('isActive').isBoolean().withMessage('isActive must be a boolean'),
];

const searchUserValidator = [query('q').trim().notEmpty().withMessage('Search query is required')];

module.exports = {
  createUserValidator,
  userIdParamValidator,
  updateUserValidator,
  updateUserStatusValidator,
  searchUserValidator,
};
