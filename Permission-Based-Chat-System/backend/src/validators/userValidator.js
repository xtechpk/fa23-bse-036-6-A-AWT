const { param, body, query } = require('express-validator');
const { isUuid } = require('../utils/uuid');

const userIdParamValidator = [param('id').custom(isUuid).withMessage('Invalid user ID')];

const updateUserValidator = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('registrationNumber').optional().trim().isLength({ min: 3, max: 40 }),
  body('email').optional().trim().isEmail().normalizeEmail(),
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
  userIdParamValidator,
  updateUserValidator,
  updateUserStatusValidator,
  searchUserValidator,
};
