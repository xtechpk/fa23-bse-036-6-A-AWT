const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const redis = require('../src/config/redisClient');
const { cacheGet, invalidateOnWrite } = require('../src/middlewares/cacheMiddleware');
const {
  buildCacheKey,
  getCachedJson,
  setCachedJson,
  invalidateResourceEverywhere,
  resetCacheStats,
} = require('../src/utils/cache');

const originalRedis = {
  isOpenDescriptor: Object.getOwnPropertyDescriptor(redis, 'isOpen'),
  get: redis.get,
  set: redis.set,
  del: redis.del,
  scan: redis.scan,
  multi: redis.multi,
};

const inMemoryStore = new Map();

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchPattern = (pattern, key) => {
  const regex = new RegExp(`^${escapeRegExp(pattern).replace(/\\\*/g, '.*')}$`);
  return regex.test(key);
};

const installRedisMock = () => {
  Object.defineProperty(redis, 'isOpen', {
    value: true,
    configurable: true,
    enumerable: true,
    writable: true,
  });

  redis.get = async (key) => {
    return inMemoryStore.has(key) ? inMemoryStore.get(key) : null;
  };

  redis.set = async (key, value) => {
    inMemoryStore.set(key, value);
    return 'OK';
  };

  redis.del = async (key) => {
    return inMemoryStore.delete(key) ? 1 : 0;
  };

  redis.scan = async (cursor, { MATCH }) => {
    if (String(cursor) !== '0') {
      return { cursor: '0', keys: [] };
    }

    const keys = [...inMemoryStore.keys()].filter((key) => matchPattern(MATCH, key));
    return { cursor: '0', keys };
  };

  redis.multi = () => {
    const keysToDelete = [];
    return {
      del(key) {
        keysToDelete.push(key);
        return this;
      },
      async exec() {
        keysToDelete.forEach((key) => inMemoryStore.delete(key));
        return [];
      },
    };
  };
};

const restoreRedisMock = () => {
  if (originalRedis.isOpenDescriptor) {
    Object.defineProperty(redis, 'isOpen', originalRedis.isOpenDescriptor);
  }
  redis.get = originalRedis.get;
  redis.set = originalRedis.set;
  redis.del = originalRedis.del;
  redis.scan = originalRedis.scan;
  redis.multi = originalRedis.multi;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let server;
let baseUrl;
let version = 0;

const startTestApp = async () => {
  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    req.user = { _id: 'test-user-1' };
    next();
  });

  app.use('/items', invalidateOnWrite(['items']));

  app.get(
    '/items',
    cacheGet({ resource: 'items', scope: 'global', ttlSeconds: 60 }),
    (_req, res) => {
      version += 1;
      res.status(200).json({
        success: true,
        message: 'ok',
        data: { version },
      });
    }
  );

  app.post('/items', (_req, res) => {
    res.status(201).json({
      success: true,
      message: 'created',
    });
  });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
};

const stopTestApp = async () => {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
};

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { response, body };
};

test.before(async () => {
  installRedisMock();
  await startTestApp();
});

test.after(async () => {
  await stopTestApp();
  restoreRedisMock();
});

test.beforeEach(() => {
  inMemoryStore.clear();
  version = 0;
  resetCacheStats();
});

test('GET endpoint returns MISS then HIT', async () => {
  const first = await requestJson('/items');
  assert.equal(first.response.status, 200);
  assert.equal(first.response.headers.get('x-cache'), 'MISS');
  assert.equal(first.body.data.version, 1);

  await wait(10);

  const second = await requestJson('/items');
  assert.equal(second.response.status, 200);
  assert.equal(second.response.headers.get('x-cache'), 'HIT');
  assert.equal(second.body.data.version, 1);
});

test('write endpoint invalidates cached GET resource', async () => {
  const priming = await requestJson('/items');
  assert.equal(priming.response.headers.get('x-cache'), 'MISS');

  await wait(10);

  const reqShape = { originalUrl: '/items', user: { _id: 'test-user-1' } };
  const key = buildCacheKey('items', reqShape, null, 'global');
  const cachedBeforeWrite = await getCachedJson(key);
  assert.ok(cachedBeforeWrite);

  const write = await requestJson('/items', { method: 'POST' });
  assert.equal(write.response.status, 201);

  // Invalidation is async on response finish; wait briefly before verifying.
  await wait(20);

  const cachedAfterWrite = await getCachedJson(key);
  assert.equal(cachedAfterWrite, null);

  const afterInvalidate = await requestJson('/items');
  assert.equal(afterInvalidate.response.headers.get('x-cache'), 'MISS');
  assert.equal(afterInvalidate.body.data.version, 2);
});

test('cross-scope invalidation removes both global and user cache keys', async () => {
  await setCachedJson('global:items:list:/items?page=1', { ok: true }, 60);
  await setCachedJson('user:test-user-1:items:list:/items?page=1', { ok: true }, 60);

  assert.ok(await getCachedJson('global:items:list:/items?page=1'));
  assert.ok(await getCachedJson('user:test-user-1:items:list:/items?page=1'));

  await invalidateResourceEverywhere('items');

  assert.equal(await getCachedJson('global:items:list:/items?page=1'), null);
  assert.equal(await getCachedJson('user:test-user-1:items:list:/items?page=1'), null);
});
