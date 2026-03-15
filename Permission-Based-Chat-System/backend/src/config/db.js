const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');

const connectDB = async () => {
  await prisma.$connect();
  logger.info('Prisma connected');
};

module.exports = connectDB;
