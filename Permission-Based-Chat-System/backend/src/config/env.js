const dotenv = require('dotenv');

dotenv.config();

// Allow a single JWT secret while still supporting split access/refresh secrets.
const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || '';
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || '';
const jwtAccessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m';
const jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const DEFAULT_ADMIN_PASSWORD = 'ChangeThisStrongPassword123!';
const DEFAULT_SUPERADMIN_PASSWORD = 'ChangeThisSuperAdminPassword123!';

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  databaseUrl: process.env.DATABASE_URL || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  cacheTtl: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
  jwt: {
    accessSecret: jwtAccessSecret,
    refreshSecret: jwtRefreshSecret,
    accessExpiresIn: jwtAccessExpiresIn,
    refreshExpiresIn: jwtRefreshExpiresIn,
  },
  defaultAdmin: {
    name: process.env.DEFAULT_ADMIN_NAME || 'System Admin',
    registrationNumber: process.env.DEFAULT_ADMIN_REGISTRATION_NUMBER || 'ADMIN-0001',
    email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.DEFAULT_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,
  },
  defaultSuperAdmin: {
    name: process.env.DEFAULT_SUPERADMIN_NAME || 'System SuperAdmin',
    registrationNumber: process.env.DEFAULT_SUPERADMIN_REGISTRATION_NUMBER || 'SUPERADMIN-0001',
    email: process.env.DEFAULT_SUPERADMIN_EMAIL || 'superadmin@example.com',
    password: process.env.DEFAULT_SUPERADMIN_PASSWORD || DEFAULT_SUPERADMIN_PASSWORD,
  },
};

const requiredVars = ['DATABASE_URL'];

if (env.nodeEnv !== 'test') {
  const missing = requiredVars.filter((name) => !process.env[name]);
  if (!jwtAccessSecret || !jwtRefreshSecret) {
    missing.push('JWT_SECRET (or JWT_ACCESS_SECRET + JWT_REFRESH_SECRET)');
  }

  if (env.nodeEnv === 'production') {
    if (env.defaultAdmin.password === DEFAULT_ADMIN_PASSWORD) {
      missing.push('DEFAULT_ADMIN_PASSWORD (must not use default in production)');
    }

    if (env.defaultSuperAdmin.password === DEFAULT_SUPERADMIN_PASSWORD) {
      missing.push('DEFAULT_SUPERADMIN_PASSWORD (must not use default in production)');
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = env;
