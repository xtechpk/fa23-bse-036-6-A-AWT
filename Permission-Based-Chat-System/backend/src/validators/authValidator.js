const { body, param } = require('express-validator');
const { isUuid } = require('../utils/uuid');

const baseLocationValidator = [
  body('location').optional().isObject().withMessage('location must be an object'),
  body('location.country').optional().isString().isLength({ max: 100 }),
  body('location.region').optional().isString().isLength({ max: 100 }),
  body('location.city').optional().isString().isLength({ max: 100 }),
  body('location.zipCode').optional().isString().isLength({ max: 20 }),
  body('location.latitude').optional().isFloat({ min: -90, max: 90 }),
  body('location.longitude').optional().isFloat({ min: -180, max: 180 }),
  body('location.accuracyRadius').optional().isFloat({ min: 0 }),
  body('location.altitude').optional().isFloat(),
  body('location.locationTimestamp')
    .optional()
    .isISO8601()
    .withMessage('locationTimestamp must be ISO8601'),
];

const registerValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 }),
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

const loginValidator = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  ...baseLocationValidator,
];

const refreshTokenValidator = [
  body('refreshToken').optional().isString().withMessage('Refresh token must be a string'),
];

const twoFactorVerifyLoginValidator = [
  body('challengeId').custom(isUuid).withMessage('challengeId must be a valid challenge ID'),
  body('code')
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('code must be exactly 6 digits')
    .matches(/^\d{6}$/)
    .withMessage('code must be numeric'),
  ...baseLocationValidator,
];

const twoFactorEnableStartValidator = [...baseLocationValidator];

const twoFactorEnableVerifyValidator = [
  body('challengeId').custom(isUuid).withMessage('challengeId must be a valid challenge ID'),
  body('code')
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('code must be exactly 6 digits')
    .matches(/^\d{6}$/)
    .withMessage('code must be numeric'),
  ...baseLocationValidator,
];

const twoFactorDisableValidator = [
  body('currentPassword').notEmpty().withMessage('currentPassword is required'),
  ...baseLocationValidator,
];

const sessionIdParamValidator = [
  param('sessionId').custom(isUuid).withMessage('Invalid session ID'),
];

module.exports = {
  registerValidator,
  loginValidator,
  refreshTokenValidator,
  twoFactorVerifyLoginValidator,
  twoFactorEnableStartValidator,
  twoFactorEnableVerifyValidator,
  twoFactorDisableValidator,
  sessionIdParamValidator,
};
