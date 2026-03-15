const { PrismaClient } = require('@prisma/client');

// In production only surface errors; in development also show slow-query warnings.
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
});

module.exports = prisma;
