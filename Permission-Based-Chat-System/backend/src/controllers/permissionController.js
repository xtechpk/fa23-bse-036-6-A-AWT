const prisma = require('../utils/prismaClient');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { ROLES } = require('../utils/constants');
const {
  createPermissionRequest,
  approvePermissionRequest,
  rejectPermissionRequest,
  grantDirectChatPermission,
  revokeChatPermission,
  listChatPermissions,
  buildPermissionScopeFilter,
  isPermissionInScope,
} = require('../services/permissionService');
const asyncHandler = require('../utils/asyncHandler');

const uniq = (arr) => [...new Set(arr.filter(Boolean).map(String))];

const hydratePermissions = async (items) => {
  if (!items.length) return [];

  const userIds = [];
  items.forEach((item) => {
    userIds.push(item.requesterId);
    userIds.push(item.targetId);
    if (item.approvedBy) userIds.push(item.approvedBy);
  });

  const users = await prisma.user.findMany({
    where: { id: { in: uniq(userIds) } },
    select: { id: true, name: true, email: true, registrationNumber: true, role: true },
  });

  const userMap = new Map(users.map((user) => [user.id, { ...user, _id: user.id }]));

  return items.map((item) => ({
    ...item,
    _id: item.id,
    requester: userMap.get(item.requesterId) || null,
    target: userMap.get(item.targetId) || null,
    approvedByUser: item.approvedBy ? userMap.get(item.approvedBy) || null : null,
  }));
};

const requestPermission = asyncHandler(async (req, res) => {
  const request = await createPermissionRequest({
    requesterId: req.user._id,
    targetUserId: req.body.targetUserId,
    reason: req.body.reason,
    expiresAt: req.body.expiresAt || null,
  });

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Permission request submitted successfully',
    data: request,
  });
});

const listPermissions = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const where = buildPermissionScopeFilter({
    actorId: req.user._id,
    actorRole: req.user.role,
  });

  if (req.query.status) {
    where.status = req.query.status;
  }

  const [items, total] = await Promise.all([
    prisma.permissionRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.permissionRequest.count({ where }),
  ]);

  return ApiResponse.success(res, {
    message: 'Permission requests fetched successfully',
    data: await hydratePermissions(items),
    meta: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

const getPermissionById = asyncHandler(async (req, res) => {
  const item = await prisma.permissionRequest.findUnique({ where: { id: req.params.id } });

  if (!item) {
    throw new ApiError(404, 'Permission request not found');
  }

  const canAccess = await isPermissionInScope({
    actorId: req.user._id,
    actorRole: req.user.role,
    permission: item,
  });

  if (!canAccess) {
    throw new ApiError(403, 'You are not authorized to view this permission request');
  }

  const [hydrated] = await hydratePermissions([item]);

  return ApiResponse.success(res, {
    message: 'Permission request fetched successfully',
    data: hydrated,
  });
});

const approvePermission = asyncHandler(async (req, res) => {
  const item = await approvePermissionRequest({
    requestId: req.params.id,
    adminId: req.user._id,
    expiresAt: req.body.expiresAt || null,
    adminRemark: req.body.adminRemark || null,
  });

  return ApiResponse.success(res, {
    message: 'Permission request approved',
    data: item,
  });
});

const rejectPermission = asyncHandler(async (req, res) => {
  const item = await rejectPermissionRequest({
    requestId: req.params.id,
    adminId: req.user._id,
    adminRemark: req.body.adminRemark || null,
  });

  return ApiResponse.success(res, {
    message: 'Permission request rejected',
    data: item,
  });
});

const grantDirectPermission = asyncHandler(async (req, res) => {
  const permission = await grantDirectChatPermission({
    adminId: req.user._id,
    userAId: req.body.userAId,
    userBId: req.body.userBId,
    expiresAt: req.body.expiresAt || null,
  });

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Chat permission granted directly',
    data: permission,
  });
});

const revokePermission = asyncHandler(async (req, res) => {
  const result = await revokeChatPermission({
    adminId: req.user._id,
    permissionId: req.params.permissionId,
  });

  return ApiResponse.success(res, {
    message: 'Chat permission revoked successfully',
    data: result,
  });
});

const getChatPermissions = asyncHandler(async (req, res) => {
  const result = await listChatPermissions({
    userId: req.user._id,
    actorRole: req.user.role,
    page: req.query.page,
    limit: req.query.limit,
  });

  return ApiResponse.success(res, {
    message: 'Chat permissions fetched successfully',
    data: result.items,
    meta: result.pagination,
  });
});

module.exports = {
  requestPermission,
  listPermissions,
  getPermissionById,
  approvePermission,
  rejectPermission,
  grantDirectPermission,
  revokePermission,
  getChatPermissions,
};
