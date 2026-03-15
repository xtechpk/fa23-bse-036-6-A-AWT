const prisma = require('../utils/prismaClient');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

// Reusable select shape for all group queries
const GROUP_SELECT = {
  id: true,
  name: true,
  description: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: { id: true, name: true, email: true, registrationNumber: true, isActive: true },
  },
  members: {
    orderBy: { joinedAt: 'asc' },
    select: {
      joinedAt: true,
      user: {
        select: { id: true, name: true, email: true, registrationNumber: true, isActive: true },
      },
    },
  },
};

const formatGroup = (group) => ({
  ...group,
  _id: group.id,
  createdBy: group.createdBy ? { ...group.createdBy, _id: group.createdBy.id } : null,
  members: group.members.map((m) => ({ ...m.user, _id: m.user.id, joinedAt: m.joinedAt })),
  memberCount: group.members.length,
});

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

    await tx.groupMember.create({ data: { groupId: created.id, userId: creatorId } });
    return tx.group.findUnique({ where: { id: created.id }, select: GROUP_SELECT });
  });

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Group created successfully',
    data: formatGroup(group),
  });
});

const listGroups = asyncHandler(async (req, res) => {
  const groups = await prisma.group.findMany({
    orderBy: { createdAt: 'desc' },
    select: GROUP_SELECT,
  });

  const payload = {
    message: 'Groups fetched successfully',
    data: groups.map(formatGroup),
  };
  return ApiResponse.success(res, payload);
});

const getGroupById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const group = await prisma.group.findUnique({ where: { id }, select: GROUP_SELECT });
  if (!group) throw new ApiError(404, 'Group not found');

  const payload = {
    message: 'Group details fetched successfully',
    data: formatGroup(group),
  };
  return ApiResponse.success(res, payload);
});

const updateGroup = asyncHandler(async (req, res) => {
  const group = await prisma.group.update({
    where: { id: req.params.id },
    data: {
      ...(typeof req.body.name !== 'undefined' ? { name: req.body.name } : {}),
      ...(typeof req.body.description !== 'undefined' ? { description: req.body.description } : {}),
    },
    select: GROUP_SELECT,
  });

  return ApiResponse.success(res, {
    message: 'Group updated successfully',
    data: formatGroup(group),
  });
});

const deleteGroup = asyncHandler(async (req, res) => {
  const group = await prisma.group.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  if (!group) throw new ApiError(404, 'Group not found');

  await prisma.group.delete({ where: { id: group.id } });

  return ApiResponse.success(res, { message: 'Group deleted successfully' });
});

const addMembers = asyncHandler(async (req, res) => {
  const memberIds = [...new Set((req.body.members || []).map(String))];
  const groupId = String(req.params.id);

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) throw new ApiError(404, 'Group not found');

  const validUsers = await prisma.user.findMany({
    where: { id: { in: memberIds } },
    select: { id: true },
  });

  if (validUsers.length !== memberIds.length) {
    throw new ApiError(400, 'One or more member IDs are invalid');
  }

  await prisma.groupMember.createMany({
    data: memberIds.map((userId) => ({ groupId, userId })),
    skipDuplicates: true,
  });

  const updated = await prisma.group.findUnique({ where: { id: groupId }, select: GROUP_SELECT });

  return ApiResponse.success(res, {
    message: 'Members added to group successfully',
    data: formatGroup(updated),
  });
});

const removeMembers = asyncHandler(async (req, res) => {
  const memberIds = [...new Set((req.body.members || []).map(String))];
  const groupId = String(req.params.id);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, createdById: true },
  });
  if (!group) throw new ApiError(404, 'Group not found');

  if (memberIds.includes(String(group.createdById))) {
    throw new ApiError(400, 'Cannot remove the group creator. Transfer ownership first.');
  }

  await prisma.groupMember.deleteMany({
    where: { groupId, userId: { in: memberIds } },
  });

  const updated = await prisma.group.findUnique({ where: { id: groupId }, select: GROUP_SELECT });

  return ApiResponse.success(res, {
    message: 'Members removed from group successfully',
    data: formatGroup(updated),
  });
});

const leaveGroup = asyncHandler(async (req, res) => {
  const userId = String(req.user._id);
  const groupId = String(req.params.id);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, createdById: true },
  });
  if (!group) throw new ApiError(404, 'Group not found');

  if (group.createdById === userId) {
    throw new ApiError(
      400,
      'Group creator cannot leave. Transfer ownership first or delete the group.'
    );
  }

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });

  if (!membership) throw new ApiError(400, 'You are not a member of this group');

  await prisma.groupMember.delete({ where: { groupId_userId: { groupId, userId } } });

  return ApiResponse.success(res, { message: 'You have left the group successfully' });
});

const transferOwnership = asyncHandler(async (req, res) => {
  const requesterId = String(req.user._id);
  const newOwnerId = String(req.body.newOwnerId);
  const groupId = String(req.params.id);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, createdById: true },
  });
  if (!group) throw new ApiError(404, 'Group not found');

  if (group.createdById !== requesterId) {
    throw new ApiError(403, 'Only the group creator can transfer ownership');
  }

  if (requesterId === newOwnerId) {
    throw new ApiError(400, 'You are already the owner');
  }

  const newOwnerMembership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: newOwnerId } },
  });

  if (!newOwnerMembership) {
    throw new ApiError(400, 'The new owner must already be a member of the group');
  }

  const updated = await prisma.group.update({
    where: { id: group.id },
    data: { createdById: newOwnerId },
    select: GROUP_SELECT,
  });

  return ApiResponse.success(res, {
    message: 'Group ownership transferred successfully',
    data: formatGroup(updated),
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

  const payload = {
    message: 'Your groups fetched successfully',
    data: groups.map(formatGroup),
  };
  return ApiResponse.success(res, payload);
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
  getMyGroups,
};
