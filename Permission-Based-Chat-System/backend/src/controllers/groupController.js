const prisma = require('../utils/prismaClient');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { getFileAssetsMap, setGroupAvatarFromUpload } = require('../services/fileService');

const GROUP_SELECT = {
  id: true,
  name: true,
  description: true,
  createdById: true,
  avatarFileId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      registrationNumber: true,
      isActive: true,
      avatarFileId: true,
    },
  },
  members: {
    orderBy: { joinedAt: 'asc' },
    select: {
      joinedAt: true,
      role: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          registrationNumber: true,
          isActive: true,
          avatarFileId: true,
        },
      },
    },
  },
};

const enrichGroupWithAvatars = async (group) => {
  if (!group) {
    return null;
  }

  const avatarFileIds = [
    group.avatarFileId,
    group.createdBy?.avatarFileId,
    ...(group.members || []).map((member) => member.user?.avatarFileId),
  ].filter(Boolean);

  const avatarsMap = await getFileAssetsMap(avatarFileIds);

  return {
    ...group,
    _id: group.id,
    avatar: group.avatarFileId ? avatarsMap.get(String(group.avatarFileId))?.publicUrl || null : null,
    createdBy: group.createdBy
      ? {
          ...group.createdBy,
          _id: group.createdBy.id,
          avatar: group.createdBy.avatarFileId
            ? avatarsMap.get(String(group.createdBy.avatarFileId))?.publicUrl || null
            : null,
        }
      : null,
    members: (group.members || []).map((member) => ({
      ...member.user,
      _id: member.user.id,
      role: member.role,
      joinedAt: member.joinedAt,
      avatar: member.user.avatarFileId
        ? avatarsMap.get(String(member.user.avatarFileId))?.publicUrl || null
        : null,
    })),
    memberCount: (group.members || []).length,
  };
};

const ensureGroupExists = async (groupId) => {
  const group = await prisma.group.findUnique({
    where: { id: String(groupId) },
    select: GROUP_SELECT,
  });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  return group;
};

const getMembership = async (groupId, userId) =>
  prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId: String(groupId),
        userId: String(userId),
      },
    },
    select: { id: true, role: true },
  });

const assertGroupAdminOrOwner = async (groupId, userId) => {
  const membership = await getMembership(groupId, userId);
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    throw new ApiError(403, 'Only group owners or admins can perform this action');
  }

  return membership;
};

const assertGroupOwner = async (groupId, userId) => {
  const membership = await getMembership(groupId, userId);
  if (!membership || membership.role !== 'owner') {
    throw new ApiError(403, 'Only the group owner can perform this action');
  }

  return membership;
};

const createGroup = asyncHandler(async (req, res) => {
  const creatorId = String(req.user._id);

  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.group.create({
      data: {
        name: req.body.name,
        description: req.body.description || '',
        createdById: creatorId,
      },
      select: { id: true },
    });

    await tx.groupMember.create({
      data: {
        groupId: created.id,
        userId: creatorId,
        role: 'owner',
      },
    });

    return tx.group.findUnique({ where: { id: created.id }, select: GROUP_SELECT });
  });

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Group created successfully',
    data: await enrichGroupWithAvatars(group),
  });
});

const listGroups = asyncHandler(async (_req, res) => {
  const groups = await prisma.group.findMany({
    orderBy: { createdAt: 'desc' },
    select: GROUP_SELECT,
  });

  const payload = await Promise.all(groups.map((group) => enrichGroupWithAvatars(group)));

  return ApiResponse.success(res, {
    message: 'Groups fetched successfully',
    data: payload,
  });
});

const getGroupById = asyncHandler(async (req, res) => {
  const group = await ensureGroupExists(req.params.id);

  return ApiResponse.success(res, {
    message: 'Group details fetched successfully',
    data: await enrichGroupWithAvatars(group),
  });
});

const updateGroup = asyncHandler(async (req, res) => {
  const requesterId = String(req.user._id);
  const groupId = String(req.params.id);

  const membership = await assertGroupAdminOrOwner(groupId, requesterId);

  if (
    typeof req.body.description !== 'undefined' &&
    membership.role !== 'owner'
  ) {
    throw new ApiError(403, 'Only the group owner can update group rules/description');
  }

  const group = await prisma.group.update({
    where: { id: groupId },
    data: {
      ...(typeof req.body.name !== 'undefined' ? { name: req.body.name } : {}),
      ...(typeof req.body.description !== 'undefined' ? { description: req.body.description } : {}),
    },
    select: GROUP_SELECT,
  });

  return ApiResponse.success(res, {
    message: 'Group updated successfully',
    data: await enrichGroupWithAvatars(group),
  });
});

const deleteGroup = asyncHandler(async (req, res) => {
  const requesterId = String(req.user._id);
  const groupId = String(req.params.id);

  await assertGroupOwner(groupId, requesterId);

  await prisma.group.delete({ where: { id: groupId } });

  return ApiResponse.success(res, { message: 'Group deleted successfully' });
});

const addMembers = asyncHandler(async (req, res) => {
  const requesterId = String(req.user._id);
  const groupId = String(req.params.id);
  const memberIds = [...new Set((req.body.members || []).map(String))];

  await ensureGroupExists(groupId);
  await assertGroupAdminOrOwner(groupId, requesterId);

  const validUsers = await prisma.user.findMany({
    where: { id: { in: memberIds } },
    select: { id: true },
  });

  if (validUsers.length !== memberIds.length) {
    throw new ApiError(400, 'One or more member IDs are invalid');
  }

  await prisma.groupMember.createMany({
    data: memberIds.map((userId) => ({ groupId, userId, role: 'member' })),
    skipDuplicates: true,
  });

  const updated = await prisma.group.findUnique({ where: { id: groupId }, select: GROUP_SELECT });

  return ApiResponse.success(res, {
    message: 'Members added to group successfully',
    data: await enrichGroupWithAvatars(updated),
  });
});

const removeMembers = asyncHandler(async (req, res) => {
  const requesterId = String(req.user._id);
  const groupId = String(req.params.id);
  const memberIds = [...new Set((req.body.members || []).map(String))];

  const group = await ensureGroupExists(groupId);
  await assertGroupAdminOrOwner(groupId, requesterId);

  if (memberIds.includes(String(group.createdById))) {
    throw new ApiError(400, 'Cannot remove the group owner');
  }

  await prisma.groupMember.deleteMany({
    where: { groupId, userId: { in: memberIds } },
  });

  const updated = await prisma.group.findUnique({ where: { id: groupId }, select: GROUP_SELECT });

  return ApiResponse.success(res, {
    message: 'Members removed from group successfully',
    data: await enrichGroupWithAvatars(updated),
  });
});

const leaveGroup = asyncHandler(async (req, res) => {
  const userId = String(req.user._id);
  const groupId = String(req.params.id);

  const group = await ensureGroupExists(groupId);

  if (group.createdById === userId) {
    throw new ApiError(400, 'Group owner cannot leave. Transfer ownership first or delete the group.');
  }

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });

  if (!membership) {
    throw new ApiError(400, 'You are not a member of this group');
  }

  await prisma.groupMember.delete({ where: { groupId_userId: { groupId, userId } } });

  return ApiResponse.success(res, { message: 'You have left the group successfully' });
});

const transferOwnership = asyncHandler(async (req, res) => {
  const requesterId = String(req.user._id);
  const newOwnerId = String(req.body.newOwnerId);
  const groupId = String(req.params.id);

  await assertGroupOwner(groupId, requesterId);

  if (requesterId === newOwnerId) {
    throw new ApiError(400, 'You are already the owner');
  }

  const newOwnerMembership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: newOwnerId } },
    select: { userId: true },
  });

  if (!newOwnerMembership) {
    throw new ApiError(400, 'The new owner must already be a member of the group');
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.group.update({
      where: { id: groupId },
      data: { createdById: newOwnerId },
    });

    await tx.groupMember.update({
      where: { groupId_userId: { groupId, userId: requesterId } },
      data: { role: 'admin' },
    });

    await tx.groupMember.update({
      where: { groupId_userId: { groupId, userId: newOwnerId } },
      data: { role: 'owner' },
    });

    return tx.group.findUnique({ where: { id: groupId }, select: GROUP_SELECT });
  });

  return ApiResponse.success(res, {
    message: 'Group ownership transferred successfully',
    data: await enrichGroupWithAvatars(updated),
  });
});

const promoteGroupAdmin = asyncHandler(async (req, res) => {
  const requesterId = String(req.user._id);
  const groupId = String(req.params.id);
  const userId = String(req.body.userId);

  await assertGroupOwner(groupId, requesterId);

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true },
  });

  if (!member) {
    throw new ApiError(404, 'Selected user is not a group member');
  }

  if (member.role === 'owner') {
    throw new ApiError(400, 'Group owner already has highest privileges');
  }

  await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: { role: 'admin' },
  });

  const updated = await prisma.group.findUnique({ where: { id: groupId }, select: GROUP_SELECT });

  return ApiResponse.success(res, {
    message: 'Member promoted to group admin successfully',
    data: await enrichGroupWithAvatars(updated),
  });
});

const demoteGroupAdmin = asyncHandler(async (req, res) => {
  const requesterId = String(req.user._id);
  const groupId = String(req.params.id);
  const userId = String(req.body.userId);

  await assertGroupOwner(groupId, requesterId);

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true },
  });

  if (!member) {
    throw new ApiError(404, 'Selected user is not a group member');
  }

  if (member.role === 'owner') {
    throw new ApiError(400, 'Cannot demote group owner');
  }

  await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: { role: 'member' },
  });

  const updated = await prisma.group.findUnique({ where: { id: groupId }, select: GROUP_SELECT });

  return ApiResponse.success(res, {
    message: 'Group admin demoted successfully',
    data: await enrichGroupWithAvatars(updated),
  });
});

const uploadGroupAvatar = asyncHandler(async (req, res) => {
  const requesterId = String(req.user._id);
  const groupId = String(req.params.id);

  await assertGroupAdminOrOwner(groupId, requesterId);

  const result = await setGroupAvatarFromUpload({
    file: req.file,
    userId: requesterId,
    groupId,
  });

  const group = await prisma.group.findUnique({ where: { id: result.group.id }, select: GROUP_SELECT });

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Group avatar uploaded successfully',
    data: await enrichGroupWithAvatars(group),
  });
});

const getMyGroups = asyncHandler(async (req, res) => {
  const userId = String(req.user._id);

  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  });

  const groupIds = memberships.map((m) => m.groupId);

  const groups = await prisma.group.findMany({
    where: { id: { in: groupIds } },
    orderBy: { createdAt: 'desc' },
    select: GROUP_SELECT,
  });

  const payload = await Promise.all(groups.map((group) => enrichGroupWithAvatars(group)));

  return ApiResponse.success(res, {
    message: 'Your groups fetched successfully',
    data: payload,
  });
});

module.exports = {
  createGroup,
  listGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  addMembers,
  removeMembers,
  leaveGroup,
  transferOwnership,
  promoteGroupAdmin,
  demoteGroupAdmin,
  uploadGroupAvatar,
  getMyGroups,
};
