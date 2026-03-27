const prisma = require('../utils/prismaClient');
const ApiError = require('../utils/ApiError');
const { invalidateResourceEverywhere } = require('../utils/cache');
const { PERMISSION_STATUS, ROLES } = require('../utils/constants');
const {
  notifyAdminsPermissionRequestCreated,
  notifyPermissionRequestUpdated,
} = require('./notificationService');

const normalizePair = (userId1, userId2) => {
  const a = String(userId1);
  const b = String(userId2);
  return a < b ? { userA: a, userB: b } : { userA: b, userB: a };
};

const ROLE_RANK = {
  [ROLES.USER]: 1,
  [ROLES.ADMIN]: 2,
  [ROLES.SUPERADMIN]: 3,
};

const canSendDirectByHierarchy = (senderRole, receiverRole) => {
  if (senderRole === ROLES.SUPERADMIN) {
    return true;
  }

  if (senderRole === ROLES.ADMIN && receiverRole === ROLES.SUPERADMIN) {
    return true;
  }

  if (senderRole === ROLES.ADMIN && receiverRole === ROLES.USER) {
    return true;
  }

  const senderRank = ROLE_RANK[senderRole] || 0;
  const receiverRank = ROLE_RANK[receiverRole] || 0;
  return senderRank > receiverRank;
};

const getManagedRoleByActor = (actorRole) => {
  if (actorRole === ROLES.SUPERADMIN) return ROLES.ADMIN;
  if (actorRole === ROLES.ADMIN) return ROLES.USER;
  if (actorRole === ROLES.USER) return ROLES.ADMIN;
  return null;
};

const canCreateRequestBetween = (requesterRole, targetRole) => {
  if (requesterRole === ROLES.ADMIN) {
    return targetRole === ROLES.USER;
  }

  if (requesterRole === ROLES.USER) {
    return targetRole === ROLES.ADMIN;
  }

  if (requesterRole === ROLES.SUPERADMIN) {
    return targetRole === ROLES.ADMIN || targetRole === ROLES.USER;
  }

  return false;
};

const isTargetInManagementScope = ({ actorId, actorRole, targetUser }) => {
  if (!targetUser) return false;

  // A user can always operate on their own records where relevant.
  if (String(targetUser.id) === String(actorId)) return true;

  const managedRole = getManagedRoleByActor(actorRole);
  return managedRole !== null && targetUser.role === managedRole;
};

const buildPermissionScopeFilter = ({ actorId, actorRole }) => {
  if (actorRole === ROLES.SUPERADMIN) {
    return {};
  }

  const managedRole = getManagedRoleByActor(actorRole);

  if (!managedRole) {
    return {
      OR: [{ requesterId: String(actorId) }, { targetId: String(actorId) }],
    };
  }

  return {
    OR: [
      { requesterId: String(actorId) },
      { targetId: String(actorId) },
      { requester: { role: managedRole } },
      { target: { role: managedRole } },
    ],
  };
};

const isPermissionInScope = async ({ actorId, actorRole, permission }) => {
  if (actorRole === ROLES.SUPERADMIN) {
    return true;
  }

  const actorIdStr = String(actorId);
  if (permission.requesterId === actorIdStr || permission.targetId === actorIdStr) {
    return true;
  }

  const managedRole = getManagedRoleByActor(actorRole);
  if (!managedRole) return false;

  const participants = await prisma.user.findMany({
    where: { id: { in: [permission.requesterId, permission.targetId] } },
    select: { id: true, role: true },
  });

  if (actorRole === ROLES.ADMIN) {
    return participants.some((participant) => participant.role === ROLES.USER);
  }

  return participants.some((participant) => participant.role === managedRole);
};

const invalidateResources = async (resources = []) => {
  const uniqueResources = [...new Set(resources.filter(Boolean))];
  if (uniqueResources.length === 0) return;

  try {
    await Promise.allSettled(
      uniqueResources.map((resource) => invalidateResourceEverywhere(resource))
    );
  } catch {
    // Cache invalidation should not fail the request flow.
  }
};

const PERMISSION_CACHE_RESOURCES = [
  'permissions',
  'permissions-by-id',
  'chat-permissions',
  'messages-private-history',
  'messages-search',
  'admin-dashboard',
];

const getUsersForPermissionCheck = async (userId1, userId2) => {
  const users = await prisma.user.findMany({
    where: { id: { in: [userId1, userId2] } },
    select: { id: true, isActive: true, role: true },
  });

  if (users.length !== 2) {
    throw new ApiError(404, 'One or both users not found');
  }

  const first = users.find((u) => u.id === String(userId1));
  const second = users.find((u) => u.id === String(userId2));

  if (!first || !second) {
    throw new ApiError(404, 'One or both users not found');
  }

  if (!first.isActive || !second.isActive) {
    throw new ApiError(403, 'Inactive users cannot chat');
  }

  return { first, second };
};

const areUsersInSameGroup = async (userId1, userId2) => {
  await getUsersForPermissionCheck(userId1, userId2);

  const shared = await prisma.groupMember.findFirst({
    where: {
      userId: String(userId1),
      group: {
        members: {
          some: {
            userId: String(userId2),
          },
        },
      },
    },
  });

  return Boolean(shared);
};

const getActiveChatPermission = async (userId1, userId2) => {
  const { userA, userB } = normalizePair(userId1, userId2);

  return prisma.chatPermission.findFirst({
    where: {
      userAId: userA,
      userBId: userB,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
};

const isPrivateChatAllowed = async (senderId, receiverId) => {
  if (String(senderId) === String(receiverId)) {
    throw new ApiError(400, 'You cannot message yourself');
  }

  const { first: sender, second: receiver } = await getUsersForPermissionCheck(senderId, receiverId);

  if (canSendDirectByHierarchy(sender.role, receiver.role)) {
    return { allowed: true, reason: 'role_hierarchy_direct' };
  }

  const sameGroup = await areUsersInSameGroup(senderId, receiverId);
  if (sameGroup) {
    return { allowed: true, reason: 'same_group' };
  }

  const permission = await getActiveChatPermission(senderId, receiverId);
  if (permission) {
    return { allowed: true, reason: 'approved_permission', permission };
  }

  return { allowed: false, reason: 'permission_required' };
};

const createPermissionRequest = async ({ requesterId, targetUserId, reason, expiresAt = null }) => {
  if (String(requesterId) === String(targetUserId)) {
    throw new ApiError(400, 'You cannot request permission to message yourself');
  }

  const [requester, target] = await Promise.all([
    prisma.user.findUnique({
      where: { id: requesterId },
      select: { id: true, role: true, isActive: true },
    }),
    prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, isActive: true },
    }),
  ]);

  if (!requester || !target) {
    throw new ApiError(404, 'Requester or target user not found');
  }

  if (!requester.isActive || !target.isActive) {
    throw new ApiError(403, 'Inactive users cannot request cross-group chat permission');
  }

  if (!canCreateRequestBetween(requester.role, target.role)) {
    throw new ApiError(403, 'Permission request is not allowed for this role pair');
  }

  const directResult = await isPrivateChatAllowed(requesterId, targetUserId);
  if (directResult.allowed) {
    throw new ApiError(400, 'Permission request is not required for this chat pair');
  }

  if (
    !isTargetInManagementScope({
      actorId: requester.id,
      actorRole: requester.role,
      targetUser: target,
    })
  ) {
    throw new ApiError(
      403,
      'Role hierarchy violation: allowed scopes are superadmin>admins, admin>users, user>admins'
    );
  }

  const sameGroup = await areUsersInSameGroup(requesterId, targetUserId);
  if (sameGroup) {
    throw new ApiError(400, 'Users are already in the same group and can chat without approval');
  }

  const activePermission = await getActiveChatPermission(requesterId, targetUserId);
  if (activePermission) {
    throw new ApiError(409, 'An active chat permission already exists for these users');
  }

  const pendingRequest = await prisma.permissionRequest.findFirst({
    where: {
      status: PERMISSION_STATUS.PENDING,
      OR: [
        { requesterId, targetId: targetUserId },
        { requesterId: targetUserId, targetId: requesterId },
      ],
    },
  });

  if (pendingRequest) {
    throw new ApiError(409, 'A pending request already exists between these users');
  }

  const request = await prisma.permissionRequest.create({
    data: {
      requesterId,
      targetId: targetUserId,
      reason,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      status: PERMISSION_STATUS.PENDING,
    },
  });

  await notifyAdminsPermissionRequestCreated(request);
  await invalidateResources(PERMISSION_CACHE_RESOURCES);

  return request;
};

const approvePermissionRequest = async ({
  requestId,
  adminId,
  expiresAt = null,
  adminRemark = null,
}) => {
  const request = await prisma.permissionRequest.findUnique({ where: { id: requestId } });

  if (!request) {
    throw new ApiError(404, 'Permission request not found');
  }

  if (request.status !== PERMISSION_STATUS.PENDING) {
    throw new ApiError(400, `Request already ${request.status}`);
  }

  const admin = await prisma.user.findUnique({
    where: { id: String(adminId) },
    select: { id: true, role: true },
  });

  if (!admin || ![ROLES.ADMIN, ROLES.SUPERADMIN].includes(admin.role)) {
    throw new ApiError(403, 'Only admin or superadmin can approve requests');
  }

  const inScope = await isPermissionInScope({
    actorId: admin.id,
    actorRole: admin.role,
    permission: request,
  });

  if (!inScope) {
    throw new ApiError(
      403,
      'Role hierarchy violation: allowed scopes are superadmin>admins and admin>users'
    );
  }

  const updated = await prisma.permissionRequest.update({
    where: { id: requestId },
    data: {
      status: PERMISSION_STATUS.APPROVED,
      approvedBy: adminId,
      approvedAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : request.expiresAt,
      adminRemark: adminRemark || request.adminRemark,
    },
  });

  const { userA, userB } = normalizePair(updated.requesterId, updated.targetId);

  await prisma.chatPermission.upsert({
    where: {
      userAId_userBId: {
        userAId: userA,
        userBId: userB,
      },
    },
    update: {
      createdFromRequestId: updated.id,
      approvedById: adminId,
      isActive: true,
      expiresAt: updated.expiresAt,
    },
    create: {
      userAId: userA,
      userBId: userB,
      createdFromRequestId: updated.id,
      approvedById: adminId,
      isActive: true,
      expiresAt: updated.expiresAt,
    },
  });

  await notifyPermissionRequestUpdated(updated);
  await invalidateResources(PERMISSION_CACHE_RESOURCES);
  return updated;
};

const rejectPermissionRequest = async ({ requestId, adminId, adminRemark = null }) => {
  const request = await prisma.permissionRequest.findUnique({ where: { id: requestId } });

  if (!request) {
    throw new ApiError(404, 'Permission request not found');
  }

  if (request.status !== PERMISSION_STATUS.PENDING) {
    throw new ApiError(400, `Request already ${request.status}`);
  }

  const admin = await prisma.user.findUnique({
    where: { id: String(adminId) },
    select: { id: true, role: true },
  });

  if (!admin || ![ROLES.ADMIN, ROLES.SUPERADMIN].includes(admin.role)) {
    throw new ApiError(403, 'Only admin or superadmin can reject requests');
  }

  const inScope = await isPermissionInScope({
    actorId: admin.id,
    actorRole: admin.role,
    permission: request,
  });

  if (!inScope) {
    throw new ApiError(
      403,
      'Role hierarchy violation: allowed scopes are superadmin>admins and admin>users'
    );
  }

  const updated = await prisma.permissionRequest.update({
    where: { id: requestId },
    data: {
      status: PERMISSION_STATUS.REJECTED,
      approvedBy: adminId,
      rejectedAt: new Date(),
      adminRemark: adminRemark || request.adminRemark,
    },
  });

  await notifyPermissionRequestUpdated(updated);
  await invalidateResources(PERMISSION_CACHE_RESOURCES);
  return updated;
};

const grantDirectChatPermission = async ({ adminId, userAId, userBId, expiresAt = null }) => {
  if (String(userAId) === String(userBId)) {
    throw new ApiError(400, 'Cannot grant permission between a user and themselves');
  }

  const admin = await prisma.user.findUnique({
    where: { id: String(adminId) },
    select: { id: true, role: true },
  });

  if (!admin || ![ROLES.ADMIN, ROLES.SUPERADMIN].includes(admin.role)) {
    throw new ApiError(403, 'Only admin or superadmin can grant direct chat permissions');
  }

  const [uA, uB] = await Promise.all([
    prisma.user.findUnique({
      where: { id: String(userAId) },
      select: { id: true, role: true, isActive: true },
    }),
    prisma.user.findUnique({
      where: { id: String(userBId) },
      select: { id: true, role: true, isActive: true },
    }),
  ]);

  if (!uA || !uB) {
    throw new ApiError(404, 'One or both users not found');
  }

  if (!uA.isActive || !uB.isActive) {
    throw new ApiError(403, 'Both users must be active to receive a chat permission');
  }

  const canManageA = isTargetInManagementScope({
    actorId: admin.id,
    actorRole: admin.role,
    targetUser: uA,
  });
  const canManageB = isTargetInManagementScope({
    actorId: admin.id,
    actorRole: admin.role,
    targetUser: uB,
  });

  if (!canManageA || !canManageB) {
    throw new ApiError(
      403,
      'Role hierarchy violation: you can only grant permissions within your managed role scope'
    );
  }

  const { userA, userB } = normalizePair(userAId, userBId);

  const existing = await prisma.chatPermission.findFirst({
    where: { userAId: userA, userBId: userB, isActive: true },
  });

  if (existing) {
    throw new ApiError(409, 'An active chat permission already exists between these users');
  }

  const permission = await prisma.chatPermission.upsert({
    where: { userAId_userBId: { userAId: userA, userBId: userB } },
    update: {
      approvedById: String(adminId),
      isActive: true,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    create: {
      userAId: userA,
      userBId: userB,
      approvedById: String(adminId),
      isActive: true,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  await invalidateResources(PERMISSION_CACHE_RESOURCES);

  return permission;
};

const revokeChatPermission = async ({ adminId, permissionId }) => {
  const admin = await prisma.user.findUnique({
    where: { id: String(adminId) },
    select: { id: true, role: true },
  });

  if (!admin || ![ROLES.ADMIN, ROLES.SUPERADMIN].includes(admin.role)) {
    throw new ApiError(403, 'Only admin or superadmin can revoke chat permissions');
  }

  const permission = await prisma.chatPermission.findUnique({
    where: { id: String(permissionId) },
  });

  if (!permission) {
    throw new ApiError(404, 'Chat permission not found');
  }

  if (!permission.isActive) {
    throw new ApiError(400, 'This chat permission is already inactive');
  }

  const participants = await prisma.user.findMany({
    where: { id: { in: [permission.userAId, permission.userBId] } },
    select: { id: true, role: true },
  });

  const canRevoke = participants.every((participant) =>
    isTargetInManagementScope({
      actorId: admin.id,
      actorRole: admin.role,
      targetUser: participant,
    })
  );

  if (!canRevoke) {
    throw new ApiError(
      403,
      'Role hierarchy violation: you can only revoke permissions within your managed role scope'
    );
  }

  const updated = await prisma.chatPermission.update({
    where: { id: permission.id },
    data: { isActive: false },
  });

  await invalidateResources(PERMISSION_CACHE_RESOURCES);

  return updated;
};

const listChatPermissions = async ({ userId, actorRole, page = 1, limit = 20 }) => {
  const safePage = Math.max(1, Number(page));
  const safeLimit = Math.min(100, Math.max(1, Number(limit)));
  const skip = (safePage - 1) * safeLimit;

  const managedRole = getManagedRoleByActor(actorRole);

  let where = { OR: [{ userAId: String(userId) }, { userBId: String(userId) }] };

  if ([ROLES.ADMIN, ROLES.SUPERADMIN].includes(actorRole) && managedRole) {
    where = {
      OR: [
        { userAId: String(userId) },
        { userBId: String(userId) },
        { userA: { role: managedRole } },
        { userB: { role: managedRole } },
      ],
    };
  }

  const [items, total] = await Promise.all([
    prisma.chatPermission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    }),
    prisma.chatPermission.count({ where }),
  ]);

  const uniqueUserIds = [
    ...new Set(
      items.flatMap((item) => [item.userAId, item.userBId, item.approvedById]).filter(Boolean)
    ),
  ];
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueUserIds } },
    select: { id: true, name: true, email: true, registrationNumber: true, role: true },
  });
  const userMap = new Map(users.map((u) => [u.id, { ...u, _id: u.id }]));

  const hydrated = items.map((item) => ({
    ...item,
    _id: item.id,
    userA: userMap.get(item.userAId) || null,
    userB: userMap.get(item.userBId) || null,
    approvedBy: userMap.get(item.approvedById) || null,
  }));

  return {
    items: hydrated,
    pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
  };
};

module.exports = {
  normalizePair,
  buildPermissionScopeFilter,
  isPermissionInScope,
  areUsersInSameGroup,
  isPrivateChatAllowed,
  getActiveChatPermission,
  createPermissionRequest,
  approvePermissionRequest,
  rejectPermissionRequest,
  grantDirectChatPermission,
  revokeChatPermission,
  listChatPermissions,
};
