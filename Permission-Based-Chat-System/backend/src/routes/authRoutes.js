const express = require('express');
const authController = require('../controllers/authController');
const validate = require('../middlewares/validateMiddleware');
const { protect } = require('../middlewares/authMiddleware');
const {
  authLimiter,
  adminAuthLimiter,
  twoFactorLimiter,
} = require('../middlewares/rateLimitMiddleware');
const { cacheGet, invalidateOnWrite } = require('../middlewares/cacheMiddleware');
const {
  registerValidator,
  loginValidator,
  refreshTokenValidator,
  twoFactorVerifyLoginValidator,
  twoFactorEnableStartValidator,
  twoFactorEnableVerifyValidator,
  twoFactorDisableValidator,
  twoFactorRecoveryRegenerateValidator,
  sessionIdParamValidator,
} = require('../validators/authValidator');

const router = express.Router();

router.use(
  invalidateOnWrite([
    'auth-me',
    'auth-sessions',
    'users',
    'users-search',
    'admin-dashboard',
    'admin-sessions',
  ])
);

router.post('/register', authLimiter, registerValidator, validate, authController.register);
router.post('/login', authLimiter, loginValidator, validate, authController.login);
router.post('/admin/login', adminAuthLimiter, loginValidator, validate, authController.adminLogin);
router.post(
  '/2fa/login/verify',
  twoFactorLimiter,
  twoFactorVerifyLoginValidator,
  validate,
  authController.verifyLoginTwoFactor
);
router.post('/refresh-token', refreshTokenValidator, validate, authController.refreshToken);
router.post('/logout', protect, authController.logout);
router.get(
  '/me',
  protect,
  cacheGet({ resource: 'auth-me', scope: 'user', ttlSeconds: 60 }),
  authController.me
);
router.post(
  '/2fa/enable',
  protect,
  twoFactorLimiter,
  twoFactorEnableStartValidator,
  validate,
  authController.startEnableTwoFactor
);
router.post(
  '/2fa/enable/verify',
  protect,
  twoFactorLimiter,
  twoFactorEnableVerifyValidator,
  validate,
  authController.verifyEnableTwoFactor
);
router.post(
  '/2fa/disable',
  protect,
  twoFactorLimiter,
  twoFactorDisableValidator,
  validate,
  authController.disableTwoFactor
);
router.get('/2fa/recovery-codes/status', protect, authController.getRecoveryCodeStatus);
router.post(
  '/2fa/recovery-codes/regenerate',
  protect,
  twoFactorLimiter,
  twoFactorRecoveryRegenerateValidator,
  validate,
  authController.regenerateRecoveryCodes
);
router.get(
  '/sessions',
  protect,
  cacheGet({ resource: 'auth-sessions', scope: 'user', ttlSeconds: 60 }),
  authController.listMySessions
);
router.delete(
  '/sessions/:sessionId',
  protect,
  sessionIdParamValidator,
  validate,
  authController.revokeMySession
);

module.exports = router;
