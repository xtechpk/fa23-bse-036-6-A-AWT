const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const noop = (_req, _res, next) => {
  if (typeof next === 'function') next();
};

const controllerProxy = new Proxy(
  {},
  {
    get: () => noop,
  }
);

const validatorProxy = new Proxy(
  {},
  {
    get: () => [],
  }
);

const rateLimitProxy = new Proxy(
  {},
  {
    get: () => noop,
  }
);

const normalizeCacheGetOptions = (options) => ({
  resource: options.resource,
  scope: options.scope || 'global',
  ttlSeconds: options.ttlSeconds ?? 120,
  hasIdentifier: Boolean(options.identifier),
});

const loadRouteWithCacheSpies = (routeRelativePath) => {
  const routeAbsolutePath = path.resolve(__dirname, '..', routeRelativePath);
  const cacheGetCalls = [];
  const invalidateOnWriteCalls = [];

  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    const isDirectDependencyOfRoute = parent && parent.filename === routeAbsolutePath;

    if (isDirectDependencyOfRoute && request === '../middlewares/cacheMiddleware') {
      return {
        cacheGet: (options = {}) => {
          cacheGetCalls.push(options);
          return noop;
        },
        invalidateOnWrite: (resources = []) => {
          invalidateOnWriteCalls.push(resources);
          return noop;
        },
      };
    }

    if (isDirectDependencyOfRoute && request.startsWith('../controllers/')) {
      return controllerProxy;
    }

    if (isDirectDependencyOfRoute && request.startsWith('../validators/')) {
      return validatorProxy;
    }

    if (isDirectDependencyOfRoute && request === '../middlewares/authMiddleware') {
      return { protect: noop };
    }

    if (isDirectDependencyOfRoute && request === '../middlewares/validateMiddleware') {
      return noop;
    }

    if (isDirectDependencyOfRoute && request === '../middlewares/roleMiddleware') {
      return () => noop;
    }

    if (isDirectDependencyOfRoute && request === '../middlewares/uploadMiddleware') {
      return { uploadAvatar: noop, uploadChatAttachments: noop };
    }

    if (isDirectDependencyOfRoute && request === '../middlewares/rateLimitMiddleware') {
      return rateLimitProxy;
    }

    if (isDirectDependencyOfRoute && request === '../utils/cache') {
      return {
        getCacheStats: () => ({}),
        resetCacheStats: () => {},
        cacheMetrics: { lastOperations: [], operationsByResource: {} },
      };
    }

    if (isDirectDependencyOfRoute && request === '../utils/ApiResponse') {
      return {
        success: (_res, payload) => payload,
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[routeAbsolutePath];
    require(routeAbsolutePath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[routeAbsolutePath];
  }

  return {
    cacheGetCalls: cacheGetCalls.map(normalizeCacheGetOptions),
    invalidateOnWriteCalls,
  };
};

test('auth routes cache contract is correct', () => {
  const contract = loadRouteWithCacheSpies('src/routes/authRoutes.js');

  assert.deepEqual(contract.invalidateOnWriteCalls, [
    ['auth-me', 'auth-sessions', 'users', 'users-search', 'admin-dashboard', 'admin-sessions'],
  ]);

  assert.deepEqual(contract.cacheGetCalls, [
    { resource: 'auth-me', scope: 'user', ttlSeconds: 60, hasIdentifier: false },
    { resource: 'auth-sessions', scope: 'user', ttlSeconds: 60, hasIdentifier: false },
  ]);
});

test('user routes cache contract is correct', () => {
  const contract = loadRouteWithCacheSpies('src/routes/userRoutes.js');

  assert.deepEqual(contract.invalidateOnWriteCalls, [
    ['users', 'users-search', 'admin-dashboard', 'admins', 'auth-me'],
  ]);

  assert.deepEqual(contract.cacheGetCalls, [
    { resource: 'users', scope: 'global', ttlSeconds: 300, hasIdentifier: false },
    { resource: 'users-search', scope: 'user', ttlSeconds: 120, hasIdentifier: false },
    { resource: 'users', scope: 'global', ttlSeconds: 300, hasIdentifier: true },
  ]);
});

test('group routes cache contract is correct', () => {
  const contract = loadRouteWithCacheSpies('src/routes/groupRoutes.js');

  assert.deepEqual(contract.invalidateOnWriteCalls, [
    [
      'groups',
      'mygroups',
      'messages-private-history',
      'messages-group-history',
      'messages-search',
      'admin-dashboard',
    ],
  ]);

  assert.deepEqual(contract.cacheGetCalls, [
    { resource: 'mygroups', scope: 'user', ttlSeconds: 120, hasIdentifier: false },
    { resource: 'groups', scope: 'global', ttlSeconds: 300, hasIdentifier: false },
    { resource: 'groups', scope: 'global', ttlSeconds: 300, hasIdentifier: true },
  ]);
});

test('message routes cache contract is correct', () => {
  const contract = loadRouteWithCacheSpies('src/routes/messageRoutes.js');

  assert.deepEqual(contract.invalidateOnWriteCalls, [
    [
      'messages-inbox',
      'messages-private-history',
      'messages-group-history',
      'messages-search',
      'notifications',
      'admin-dashboard',
    ],
  ]);

  assert.deepEqual(contract.cacheGetCalls, [
    { resource: 'messages-inbox', scope: 'user', ttlSeconds: 30, hasIdentifier: false },
    { resource: 'messages-search', scope: 'user', ttlSeconds: 60, hasIdentifier: false },
    { resource: 'messages-private-history', scope: 'user', ttlSeconds: 60, hasIdentifier: false },
    { resource: 'messages-group-history', scope: 'user', ttlSeconds: 60, hasIdentifier: false },
  ]);
});

test('permission routes cache contract is correct', () => {
  const contract = loadRouteWithCacheSpies('src/routes/permissionRoutes.js');

  assert.deepEqual(contract.invalidateOnWriteCalls, [
    [
      'permissions',
      'permissions-by-id',
      'chat-permissions',
      'messages-private-history',
      'messages-search',
      'notifications',
      'admin-dashboard',
    ],
  ]);

  assert.deepEqual(contract.cacheGetCalls, [
    { resource: 'permissions', scope: 'user', ttlSeconds: 120, hasIdentifier: false },
    { resource: 'chat-permissions', scope: 'user', ttlSeconds: 120, hasIdentifier: false },
    { resource: 'permissions-by-id', scope: 'user', ttlSeconds: 120, hasIdentifier: true },
  ]);
});

test('notification routes cache contract is correct', () => {
  const contract = loadRouteWithCacheSpies('src/routes/notificationRoutes.js');

  assert.deepEqual(contract.invalidateOnWriteCalls, [['notifications', 'admin-dashboard']]);

  assert.deepEqual(contract.cacheGetCalls, [
    { resource: 'notifications', scope: 'user', ttlSeconds: 120, hasIdentifier: false },
  ]);
});

test('admin routes cache contract is correct', () => {
  const contract = loadRouteWithCacheSpies('src/routes/adminRoutes.js');

  assert.deepEqual(contract.invalidateOnWriteCalls, [
    [
      'admins',
      'users',
      'users-search',
      'admin-dashboard',
      'admin-sessions',
      'blocked-ips',
      'audit-logs',
      'auth-sessions',
    ],
  ]);

  assert.deepEqual(contract.cacheGetCalls, [
    { resource: 'admin-dashboard', scope: 'user', ttlSeconds: 60, hasIdentifier: false },
    { resource: 'admins', scope: 'user', ttlSeconds: 120, hasIdentifier: false },
    { resource: 'admin-sessions', scope: 'user', ttlSeconds: 60, hasIdentifier: false },
    { resource: 'blocked-ips', scope: 'user', ttlSeconds: 60, hasIdentifier: false },
    { resource: 'audit-logs', scope: 'user', ttlSeconds: 60, hasIdentifier: false },
  ]);
});
