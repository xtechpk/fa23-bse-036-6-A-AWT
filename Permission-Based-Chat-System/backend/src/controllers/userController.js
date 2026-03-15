const bcrypt = require('bcryptjs');
const prisma = require('../utils/prismaClient');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { ROLES } = require('../utils/constants');
const { getFileAssetsByIds, setUserAvatarFromUpload } = require('../services/fileService');
const { invalidateAdminCache } = require('../services/socketService');
const asyncHandler = require('../utils/asyncHandler');

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  return { ...safe, _id: safe.id };
};

const hydrateAssignedGroups = async (user) => {
  const safe = sanitizeUser(user);

  const [avatarAssets, memberships] = await Promise.all([
    safe.avatarFileId ? getFileAssetsByIds([safe.avatarFileId]) : Promise.resolve([]),
    prisma.groupMember.findMany({
      where: { userId: safe.id },
      select: {
        joinedAt: true,
        group: {
          select: { id: true, name: true, description: true, createdAt: true, updatedAt: true },
        },
      },
    }),
  ]);

  const avatarFile = avatarAssets[0] || null;

  return {
    ...safe,
    avatar: avatarFile?.publicUrl || null,
    avatarFile,
    assignedGroups: memberships.map((m) => ({ ...m.group, _id: m.group.id, joinedAt: m.joinedAt })),
  };
};

const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const where = {};
  if (req.query.role) where.role = req.query.role;
  if (typeof req.query.isActive !== 'undefined') where.isActive = req.query.isActive === 'true';

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  const payload = {
    message: 'Users fetched successfully',
    data: users.map(sanitizeUser),
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  };

  return ApiResponse.success(res, payload);
});

const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (![ROLES.ADMIN, ROLES.SUPERADMIN].includes(req.user.role) && String(req.user._id) !== id) {
    throw new ApiError(403, 'You can only view your own profile');
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const hydrated = await hydrateAssignedGroups(user);
  const payload = { message: 'User fetched successfully', data: hydrated };

  return ApiResponse.success(res, payload);
});

const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (![ROLES.ADMIN, ROLES.SUPERADMIN].includes(req.user.role) && String(req.user._id) !== id) {
    throw new ApiError(403, 'You can only update your own profile');
  }

  const payload = { ...req.body };
  if (![ROLES.ADMIN, ROLES.SUPERADMIN].includes(req.user.role)) {
    delete payload.role;
    delete payload.isActive;
    delete payload.assignedGroups;
    delete payload.password;
  }

  delete payload.avatar;
  delete payload.avatarFileId;

  if (payload.registrationNumber) {
    payload.registrationNumber = payload.registrationNumber.trim().toUpperCase();
  }

  if (payload.email) {
    payload.email = payload.email.trim().toLowerCase();
  }

  if (payload.password) {
    payload.password = await bcrypt.hash(payload.password, 12);
  }

  const user = await prisma.user.update({
    where: { id },
    data: payload,
  });

  // Role changes affect which users appear in the admin socket cache.
  if (payload.role !== undefined || payload.isActive !== undefined) {
    invalidateAdminCache();
  }

  return ApiResponse.success(res, {
    message: 'User updated successfully',
    data: await hydrateAssignedGroups(user),
  });
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const user = await prisma.user.update({
    where: { id },
    data: { isActive },
  });

  // A status change can add or remove a user from the active-admin set.
  invalidateAdminCache();

  return ApiResponse.success(res, {
    message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: sanitizeUser(user),
  });
});

const searchUsers = asyncHandler(async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) {
    throw new ApiError(400, 'Search query is required');
  }

  const where = {
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { registrationNumber: { contains: query, mode: 'insensitive' } },
    ],
    NOT: { id: req.user._id },
  };

  if (![ROLES.ADMIN, ROLES.SUPERADMIN].includes(req.user.role)) {
    where.isActive = true;
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { name: 'asc' },
    take: 50,
  });

  return ApiResponse.success(res, {
    message: 'Search results fetched successfully',
    data: users.map(sanitizeUser),
  });
});

const uploadMyAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'Upload an avatar file');
  }

  const { user, avatarFile } = await setUserAvatarFromUpload({
    file: req.file,
    userId: req.user._id,
  });

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Avatar uploaded successfully',
    data: {
      user: await hydrateAssignedGroups(user),
      avatarFile,
    },
  });
});

module.exports = {
  listUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  searchUsers,
  uploadMyAvatar,
};
