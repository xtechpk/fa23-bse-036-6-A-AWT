const express = require('express');
const adminController = require('../controllers/adminController');
const { protect } = require('../middlewares/authMiddleware');
const allowRoles = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validateMiddleware');
const { adminApiLimiter } = require('../middlewares/rateLimitMiddleware');
const { cacheGet, invalidateOnWrite } = require('../middlewares/cacheMiddleware');
const { getCacheStats, resetCacheStats, cacheMetrics } = require('../utils/cache');
const ApiResponse = require('../utils/ApiResponse');
const {
  adminIdParamValidator,
  createAdminValidator,
  updateAdminValidator,
  updateAdminStatusValidator,
  promoteUserParamValidator,
  listSessionsValidator,
  blockSessionValidator,
  unblockSessionValidator,
  listBlockedIpsValidator,
  blockIpValidator,
  unblockIpValidator,
  listAuditLogsValidator,
} = require('../validators/adminValidator');

const router = express.Router();

router.use(protect);
router.use(adminApiLimiter);
router.use(
  invalidateOnWrite([
    'admins',
    'users',
    'users-search',
    'admin-dashboard',
    'admin-sessions',
    'blocked-ips',
    'audit-logs',
    'auth-sessions',
  ])
);

router.get(
  '/dashboard',
  allowRoles('admin'),
  cacheGet({ resource: 'admin-dashboard', scope: 'user', ttlSeconds: 60 }),
  adminController.getDashboard
);

router.get(
  '/admins',
  allowRoles('superadmin'),
  cacheGet({ resource: 'admins', scope: 'user', ttlSeconds: 120 }),
  adminController.listAdmins
);
router.post(
  '/admins',
  allowRoles('superadmin'),
  createAdminValidator,
  validate,
  adminController.createAdmin
);
router.post(
  '/users/:id/promote',
  allowRoles('superadmin'),
  promoteUserParamValidator,
  validate,
  adminController.promoteUserToAdmin
);
router.patch(
  '/admins/:id',
  allowRoles('superadmin'),
  [...adminIdParamValidator, ...updateAdminValidator],
  validate,
  adminController.updateAdmin
);
router.patch(
  '/admins/:id/status',
  allowRoles('superadmin'),
  [...adminIdParamValidator, ...updateAdminStatusValidator],
  validate,
  adminController.updateAdminStatus
);
router.post(
  '/admins/:id/demote',
  allowRoles('superadmin'),
  adminIdParamValidator,
  validate,
  adminController.demoteAdmin
);

router.get(
  '/sessions',
  allowRoles('admin'),
  listSessionsValidator,
  validate,
  cacheGet({ resource: 'admin-sessions', scope: 'user', ttlSeconds: 60 }),
  adminController.listSessions
);
router.patch(
  '/sessions/:sessionId/block',
  allowRoles('admin'),
  blockSessionValidator,
  validate,
  adminController.blockSession
);
router.patch(
  '/sessions/:sessionId/unblock',
  allowRoles('admin'),
  unblockSessionValidator,
  validate,
  adminController.unblockSession
);

router.get(
  '/blocked-ips',
  allowRoles('admin'),
  listBlockedIpsValidator,
  validate,
  cacheGet({ resource: 'blocked-ips', scope: 'user', ttlSeconds: 60 }),
  adminController.listBlockedIps
);
router.post(
  '/blocked-ips',
  allowRoles('admin'),
  blockIpValidator,
  validate,
  adminController.blockIpAddress
);
router.patch(
  '/blocked-ips/:blockedIpId/unblock',
  allowRoles('admin'),
  unblockIpValidator,
  validate,
  adminController.unblockIpAddress
);

router.get(
  '/audit-logs',
  allowRoles('admin'),
  listAuditLogsValidator,
  validate,
  cacheGet({ resource: 'audit-logs', scope: 'user', ttlSeconds: 60 }),
  adminController.listAuditLogs
);

// ─── Cache monitoring endpoints (superadmin only) ───────────────────────────
router.get('/cache/stats', allowRoles('superadmin'), (req, res) => {
  return ApiResponse.success(res, {
    message: 'Cache statistics',
    data: {
      ...getCacheStats(),
      recentOperations: cacheMetrics.lastOperations.slice(-20),
      byResource: cacheMetrics.operationsByResource,
    },
  });
});

router.post('/cache/reset-stats', allowRoles('superadmin'), (req, res) => {
  resetCacheStats();
  return ApiResponse.success(res, { message: 'Cache statistics reset successfully' });
});

module.exports = router;
