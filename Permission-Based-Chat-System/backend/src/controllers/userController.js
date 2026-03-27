const bcrypt = require('bcryptjs');
const prisma = require('../utils/prismaClient');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { ROLES } = require('../utils/constants');
const {
  FILE_ATTACHMENT_TYPES,
  FILE_CATEGORIES,
  getFileAssetsByIds,
  setUserAvatarFromUpload,
} = require('../services/fileService');
const { invalidateAdminCache } = require('../services/socketService');
const asyncHandler = require('../utils/asyncHandler');

const getManagedRoleByActor = (actorRole) => {
  if (actorRole === ROLES.SUPERADMIN) return ROLES.ADMIN;
  if (actorRole === ROLES.ADMIN) return ROLES.USER;
  return ROLES.ADMIN;
};

const getManagedRolesByActor = (actorRole) => {
  if (actorRole === ROLES.SUPERADMIN) return [ROLES.SUPERADMIN, ROLES.ADMIN];
  if (actorRole === ROLES.ADMIN) return [ROLES.USER];
  return [];
};

const canManageTargetRole = (actorRole, targetRole) =>
  getManagedRolesByActor(actorRole).includes(targetRole);

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  return { ...safe, _id: safe.id };
};

const hydrateUsersWithAvatars = async (users = []) => {
  if (!Array.isArray(users) || users.length === 0) {
    return [];
  }

  const safeUsers = users.map((user) => sanitizeUser(user));
  const userIds = safeUsers.map((user) => user.id);

  const avatarFileIds = [
    ...new Set(safeUsers.map((user) => user.avatarFileId).filter(Boolean).map(String)),
  ];

  const [avatarAssets, fallbackAssets] = await Promise.all([
    avatarFileIds.length > 0 ? getFileAssetsByIds(avatarFileIds) : Promise.resolve([]),
    prisma.fileAsset.findMany({
      where: {
        attachedToType: FILE_ATTACHMENT_TYPES.USER_AVATAR,
        attachedToId: { in: userIds },
        category: FILE_CATEGORIES.AVATAR,
        isTemporary: false,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const avatarByFileId = new Map(avatarAssets.map((asset) => [asset.id, asset]));
  const fallbackByUserId = new Map();
  for (const asset of fallbackAssets) {
    const userId = String(asset.attachedToId || '').trim();
    if (!userId || fallbackByUserId.has(userId)) continue;

    fallbackByUserId.set(userId, {
      ...asset,
      _id: asset.id,
      url: asset.publicUrl,
      path: asset.relativePath,
      fileName: asset.originalName,
    });
  }

  return safeUsers.map((user) => {
    const avatarFile =
      (user.avatarFileId ? avatarByFileId.get(String(user.avatarFileId)) : null) ||
      fallbackByUserId.get(user.id) ||
      null;

    return {
      ...user,
      avatar: avatarFile?.publicUrl || null,
      avatarFile,
    };
  });
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
  const managedRoles = getManagedRolesByActor(req.user.role);

  if (req.query.role) {
    if (!managedRoles.includes(req.query.role)) {
      throw new ApiError(403, `You can only list users in your managed scope: ${managedRoles.join(', ')}`);
    }
    where.role = req.query.role;
  } else {
    where.role = { in: managedRoles };
  }

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
    data: await hydrateUsersWithAvatars(users),
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  };

  return ApiResponse.success(res, payload);
});

const createUser = asyncHandler(async (req, res) => {
  if (![ROLES.ADMIN, ROLES.SUPERADMIN].includes(req.user.role)) {
    throw new ApiError(403, 'Only admin or superadmin can create managed users');
  }

  const managedRoles = getManagedRolesByActor(req.user.role);
  const requestedRole = req.body.role;
  const managedRole = requestedRole && managedRoles.includes(requestedRole) ? requestedRole : getManagedRoleByActor(req.user.role);

  if (requestedRole && !managedRoles.includes(requestedRole)) {
    throw new ApiError(403, `You can only create users in your managed scope: ${managedRoles.join(', ')}`);
  }
  const normalizedEmail = req.body.email.trim().toLowerCase();
  const normalizedRegistrationNumber = req.body.registrationNumber.trim().toUpperCase();

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: normalizedEmail }, { registrationNumber: normalizedRegistrationNumber }],
    },
  });

  if (existing) {
    throw new ApiError(409, 'User with email or registration number already exists');
  }

  const passwordHash = await bcrypt.hash(req.body.password, 12);

  const created = await prisma.user.create({
    data: {
      name: req.body.name.trim(),
      registrationNumber: normalizedRegistrationNumber,
      email: normalizedEmail,
      password: passwordHash,
      role: managedRole,
      isActive: true,
    },
  });

  invalidateAdminCache();

  return ApiResponse.success(res, {
    statusCode: 201,
    message: `${managedRole} created successfully`,
    data: sanitizeUser(created),
  });
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
  const actorId = String(req.user._id);

  if ([ROLES.ADMIN, ROLES.SUPERADMIN].includes(req.user.role) && actorId !== id) {
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) {
      throw new ApiError(404, 'User not found');
    }

    if (!canManageTargetRole(req.user.role, target.role)) {
      throw new ApiError(403, 'You are not authorized to update this user');
    }
  }

  if (![ROLES.ADMIN, ROLES.SUPERADMIN].includes(req.user.role) && actorId !== id) {
    throw new ApiError(403, 'You can only update your own profile');
  }

  const payload = { ...req.body };
  if (![ROLES.ADMIN, ROLES.SUPERADMIN].includes(req.user.role)) {
    delete payload.role;
    delete payload.isActive;
    delete payload.assignedGroups;
    delete payload.password;
  }

  if ([ROLES.ADMIN, ROLES.SUPERADMIN].includes(req.user.role) && payload.role) {
    const managedRoles = getManagedRolesByActor(req.user.role);
    if (!managedRoles.includes(payload.role)) {
      throw new ApiError(403, `You can only assign roles in your managed scope: ${managedRoles.join(', ')}`);
    }
  } else {
    delete payload.role;
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

const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (![ROLES.ADMIN, ROLES.SUPERADMIN].includes(req.user.role)) {
    throw new ApiError(403, 'Only admin or superadmin can delete managed users');
  }

  if (String(req.user._id) === id) {
    throw new ApiError(400, 'You cannot delete your own account');
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    throw new ApiError(404, 'User not found');
  }

  if (!canManageTargetRole(req.user.role, target.role)) {
    throw new ApiError(403, 'You are not authorized to delete this user');
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      isActive: false,
      lastSeen: new Date(),
    },
  });

  invalidateAdminCache();

  return ApiResponse.success(res, {
    message: 'User deleted successfully',
    data: sanitizeUser(updated),
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

  where.isActive = true;
  where.role = getManagedRoleByActor(req.user.role);

  const users = await prisma.user.findMany({
    where,
    orderBy: { name: 'asc' },
    take: 50,
  });

  return ApiResponse.success(res, {
    message: 'Search results fetched successfully',
    data: await hydrateUsersWithAvatars(users),
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
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  updateUserStatus,
  searchUsers,
  uploadMyAvatar,
};
