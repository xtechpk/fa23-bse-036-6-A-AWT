const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const env = require('../config/env');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { ROLES } = require('../utils/constants');

const upsertSystemUser = async ({ name, registrationNumber, email, password, role }) => {
  const normalizedEmail = email.toLowerCase();
  const normalizedRegistrationNumber = registrationNumber.toUpperCase();
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role,
        isActive: true,
        name,
        registrationNumber: normalizedRegistrationNumber,
        password: passwordHash,
      },
    });

    logger.info(`Existing ${role} user updated successfully`, { email: normalizedEmail });
    return;
  }

  await prisma.user.create({
    data: {
      name,
      registrationNumber: normalizedRegistrationNumber,
      email: normalizedEmail,
      password: passwordHash,
      role,
      isActive: true,
    },
  });

  logger.info(`Default ${role} user created successfully`, { email: normalizedEmail });
};

const seedSystemAdmins = async () => {
  await connectDB();

  await upsertSystemUser({
    name: env.defaultSuperAdmin.name,
    registrationNumber: env.defaultSuperAdmin.registrationNumber,
    email: env.defaultSuperAdmin.email,
    password: env.defaultSuperAdmin.password,
    role: ROLES.SUPERADMIN,
  });

  await upsertSystemUser({
    name: env.defaultAdmin.name,
    registrationNumber: env.defaultAdmin.registrationNumber,
    email: env.defaultAdmin.email,
    password: env.defaultAdmin.password,
    role: ROLES.ADMIN,
  });
};

seedSystemAdmins()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error('System admin seed failed', { message: error.message, stack: error.stack });
    await prisma.$disconnect();
    process.exit(1);
  });
