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

const upsertRoleBatch = async (entries, role) => {
  for (const entry of entries) {
    // Seed sequentially to keep deterministic logs and avoid DB burst on startup.
    // eslint-disable-next-line no-await-in-loop
    await upsertSystemUser({
      name: entry.name,
      registrationNumber: entry.registrationNumber,
      email: entry.email,
      password: entry.password,
      role,
    });
  }
};

const seedSystemAdmins = async () => {
  await connectDB();

  await upsertRoleBatch(env.defaultUsers.superadmins, ROLES.SUPERADMIN);
  await upsertRoleBatch(env.defaultUsers.admins, ROLES.ADMIN);
  await upsertRoleBatch(env.defaultUsers.users, ROLES.USER);
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
