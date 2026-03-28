const prisma = require('../utils/prismaClient');
const ApiError = require('../utils/ApiError');
const { invalidateResourceEverywhere } = require('../utils/cache');
const { MESSAGE_TYPES, MESSAGE_STATUS, SOCKET_EVENTS } = require('../utils/constants');
const { isPrivateChatAllowed } = require('./permissionService');
const { emitToUser, emitToGroup, isUserOnline, getIO } = require('./socketService');
const { createNotification, createBulkNotifications } = require('./notificationService');
const {
  FILE_CATEGORIES,
  FILE_ATTACHMENT_TYPES,
  getFileAssetsMap,
  attachFilesToEntity,
  assertOwnedFileAssets,
} = require('./fileService');

const normalizeId = (value, fieldName = 'identifier') => {
  if (value === null || value === undefined) {
    throw new ApiError(400, `Invalid ${fieldName} value`);
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new ApiError(400, `Invalid ${fieldName} type`);
  }

  const normalized = String(value).trim();
  if (!normalized) {
    throw new ApiError(400, `${fieldName} cannot be empty`);
  }

  return normalized;
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

const MESSAGE_CACHE_RESOURCES = [
  'messages-inbox',
  'messages-private-history',
  'messages-group-history',
  'messages-search',
  'admin-dashboard',
];

const STATUS_TICK = {
  [MESSAGE_STATUS.SENT]: 'sent',
  [MESSAGE_STATUS.DELIVERED]: 'delivered',
  [MESSAGE_STATUS.READ]: 'read',
};

const normalizeAttachmentIds = (attachmentIds = []) => {
  if (!Array.isArray(attachmentIds)) {
    throw new ApiError(400, 'attachmentIds must be an array');
  }

  return [...new Set(attachmentIds.map((item) => normalizeId(item, 'attachmentId')))];
};

const normalizeLegacyAttachments = (attachments) => {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
};

const hydrateUsersWithAvatars = async (users = []) => {
  const avatarFileIds = [
    ...new Set(
      users
        .map((user) => user.avatarFileId)
        .filter(Boolean)
        .map(String)
    ),
  ];
  const avatarFilesMap = await getFileAssetsMap(avatarFileIds);

  return users.map((user) => ({
    ...user,
    avatar: user.avatarFileId
      ? avatarFilesMap.get(String(user.avatarFileId))?.publicUrl || null
      : null,
  }));
};

const ensureActiveUser = async (userId) => {
  const userRecord = await prisma.user.findUnique({
    where: { id: normalizeId(userId) },
    select: {
      id: true,
      name: true,
      email: true,
      registrationNumber: true,
      avatarFileId: true,
      isActive: true,
    },
  });

  const [user] = await hydrateUsersWithAvatars(userRecord ? [userRecord] : []);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Inactive users cannot send messages');
  }

  return user;
};

const sanitizePagination = ({ page = 1, limit = 20 } = {}) => {
  const safePage = Number(page) > 0 ? Number(page) : 1;
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (safePage - 1) * safeLimit;

  return { page: safePage, limit: safeLimit, skip };
};

const loadUsersMap = async (userIds) => {
  const uniqueIds = [...new Set(userIds.filter(Boolean).map(normalizeId))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      name: true,
      email: true,
      registrationNumber: true,
      avatarFileId: true,
      isActive: true,
    },
  });

  const usersWithAvatars = await hydrateUsersWithAvatars(users);

  return new Map(usersWithAvatars.map((user) => [user.id, { ...user, _id: user.id }]));
};

const loadGroupsMap = async (groupIds) => {
  const uniqueIds = [...new Set(groupIds.filter(Boolean).map(normalizeId))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const groups = await prisma.group.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true, description: true, avatarFileId: true },
  });

  const avatarFileIds = groups.map((group) => group.avatarFileId).filter(Boolean);
  const groupAvatarsMap = await getFileAssetsMap(avatarFileIds);

  return new Map(
    groups.map((group) => [
      group.id,
      {
        ...group,
        _id: group.id,
        avatar: group.avatarFileId
          ? groupAvatarsMap.get(String(group.avatarFileId))?.publicUrl || null
          : null,
      },
    ])
  );
};

const loadReplyMessagesMap = async (replyIds) => {
  const uniqueReplyIds = [...new Set(replyIds.filter(Boolean).map(normalizeId))];
  if (uniqueReplyIds.length === 0) {
    return new Map();
  }

  const replyMessages = await prisma.message.findMany({
    where: { id: { in: uniqueReplyIds } },
    orderBy: { createdAt: 'asc' },
  });

  if (replyMessages.length === 0) {
    return new Map();
  }

  const usersMap = await loadUsersMap(replyMessages.map((message) => message.senderId));
  const replyFileIds = [];
  replyMessages.forEach((message) => {
    (message.attachmentIds || []).forEach((attachmentId) => replyFileIds.push(attachmentId));
  });
  const replyFileAssetsMap = await getFileAssetsMap(replyFileIds);

  return new Map(
    replyMessages.map((message) => [
      message.id,
      {
        id: message.id,
        _id: message.id,
        senderId: message.senderId,
        receiverId: message.receiverId,
        groupId: message.groupId,
        content: message.content,
        attachments:
          Array.isArray(message.attachmentIds) && message.attachmentIds.length > 0
            ? message.attachmentIds.map((id) => replyFileAssetsMap.get(String(id))).filter(Boolean)
            : normalizeLegacyAttachments(message.attachments),
        messageType: message.messageType,
        oneTime: message.oneTime,
        status: message.status,
        createdAt: message.createdAt,
        sender: usersMap.get(message.senderId) || null,
      },
    ])
  );
};

const mapMessage = (message, usersMap, groupsMap, replyMessagesMap, fileAssetsMap) => {
  const attachmentIds = Array.isArray(message.attachmentIds) ? message.attachmentIds : [];
  const attachments =
    attachmentIds.length > 0
      ? attachmentIds.map((id) => fileAssetsMap.get(String(id))).filter(Boolean)
      : normalizeLegacyAttachments(message.attachments);

  return {
    ...message,
    attachments,
    _id: message.id,
    tick: STATUS_TICK[message.status] || STATUS_TICK[MESSAGE_STATUS.SENT],
    sender: usersMap.get(message.senderId) || null,
    receiver: message.receiverId ? usersMap.get(message.receiverId) || null : null,
    group: message.groupId ? groupsMap.get(message.groupId) || null : null,
    replyTo: message.replyToId ? replyMessagesMap.get(message.replyToId) || null : null,
  };
};

const enrichMessages = async (messages) => {
  const userIds = [];
  const groupIds = [];
  const replyIds = [];
  const fileIds = [];

  messages.forEach((message) => {
    userIds.push(message.senderId);
    if (message.receiverId) userIds.push(message.receiverId);
    if (message.groupId) groupIds.push(message.groupId);
    if (message.replyToId) replyIds.push(message.replyToId);
    (message.attachmentIds || []).forEach((attachmentId) => fileIds.push(attachmentId));
  });

  const [usersMap, groupsMap, replyMessagesMap, fileAssetsMap] = await Promise.all([
    loadUsersMap(userIds),
    loadGroupsMap(groupIds),
    loadReplyMessagesMap(replyIds),
    getFileAssetsMap(fileIds),
  ]);

  return messages.map((message) =>
    mapMessage(message, usersMap, groupsMap, replyMessagesMap, fileAssetsMap)
  );
};

const buildStatusPayload = (message, extra = {}) => ({
  messageId: message.id,
  status: message.status,
  tick: STATUS_TICK[message.status] || STATUS_TICK[MESSAGE_STATUS.SENT],
  deliveredAt: message.deliveredAt || null,
  readAt: message.readAt || null,
  readBy: extra.readBy || null,
  seenBy: Array.isArray(message.seenBy) ? message.seenBy : [],
  ...extra,
});

const assertReplyMessageAllowed = async ({
  senderId,
  receiverId = null,
  groupId = null,
  messageType,
  replyToId = null,
}) => {
  if (!replyToId) {
    return null;
  }

  const safeReplyToId = normalizeId(replyToId);

  const replyMessage = await prisma.message.findUnique({
    where: { id: safeReplyToId },
  });

  if (!replyMessage) {
    throw new ApiError(404, 'Reply message not found');
  }

  if (replyMessage.messageType !== messageType) {
    throw new ApiError(400, 'replyToId must belong to the same message type');
  }

  if (messageType === MESSAGE_TYPES.PRIVATE) {
    const participants = new Set([normalizeId(senderId), normalizeId(receiverId)]);
    const replyParticipants = new Set([
      normalizeId(replyMessage.senderId),
      normalizeId(replyMessage.receiverId),
    ]);

    if (
      participants.size !== replyParticipants.size ||
      ![...participants].every((id) => replyParticipants.has(id))
    ) {
      throw new ApiError(403, 'You can only reply to messages from the same private chat');
    }
  }

  if (
    messageType === MESSAGE_TYPES.GROUP &&
    normalizeId(replyMessage.groupId) !== normalizeId(groupId)
  ) {
    throw new ApiError(403, 'You can only reply to messages from the same group');
  }

  return replyMessage;
};

const hasPrivateMessageHistory = async (userIdA, userIdB, visibleForUserId = null) => {
  const safeUserIdA = normalizeId(userIdA);
  const safeUserIdB = normalizeId(userIdB);

  const where = {
    messageType: MESSAGE_TYPES.PRIVATE,
    OR: [
      { senderId: safeUserIdA, receiverId: safeUserIdB },
      { senderId: safeUserIdB, receiverId: safeUserIdA },
    ],
  };

  if (visibleForUserId) {
    where.NOT = { deletedFor: { has: normalizeId(visibleForUserId) } };
  }

  const existingMessage = await prisma.message.findFirst({
    where,
    select: { id: true },
  });

  return Boolean(existingMessage);
};

const hasActiveSession = async (userId) => {
  const activeSession = await prisma.loginSession.findFirst({
    where: {
      userId: normalizeId(userId),
      status: 'active',
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  return Boolean(activeSession);
};

const sendPrivateMessage = async ({
  senderId,
  receiverId,
  content = '',
  attachmentIds = [],
  replyToId = null,
  oneTime = false,
}) => {
  const safeSenderId = normalizeId(senderId);
  const safeReceiverId = normalizeId(receiverId);
  const safeContent = typeof content === 'string' ? content.trim() : '';
  const normalizedAttachmentIds = normalizeAttachmentIds(attachmentIds);

  if (safeSenderId === safeReceiverId) {
    throw new ApiError(400, 'You cannot message yourself');
  }

  if (!safeContent && normalizedAttachmentIds.length === 0) {
    throw new ApiError(400, 'Provide content or attachments');
  }

  const [sender] = await Promise.all([
    ensureActiveUser(safeSenderId),
    ensureActiveUser(safeReceiverId),
  ]);

  const permissionResult = await isPrivateChatAllowed(safeSenderId, safeReceiverId);
  if (!permissionResult.allowed) {
    const alreadyHasThread = await hasPrivateMessageHistory(safeSenderId, safeReceiverId);
    if (!alreadyHasThread) {
      throw new ApiError(403, 'Cross-group private messaging requires admin-approved permission');
    }
  }

  await assertReplyMessageAllowed({
    senderId: safeSenderId,
    receiverId: safeReceiverId,
    messageType: MESSAGE_TYPES.PRIVATE,
    replyToId,
  });

  const receiverOnline =
    isUserOnline(safeReceiverId) && (await hasActiveSession(safeReceiverId));
  const status = receiverOnline ? MESSAGE_STATUS.DELIVERED : MESSAGE_STATUS.SENT;
  const deliveredAt = receiverOnline ? new Date() : null;

  const message = await prisma.$transaction(async (tx) => {
    await assertOwnedFileAssets({
      fileIds: normalizedAttachmentIds,
      userId: safeSenderId,
      category: FILE_CATEGORIES.CHAT_ATTACHMENT,
      client: tx,
    });

    const createdMessage = await tx.message.create({
      data: {
        senderId: safeSenderId,
        receiverId: safeReceiverId,
        content: safeContent,
        attachmentIds: normalizedAttachmentIds,
        attachments: null,
        messageType: MESSAGE_TYPES.PRIVATE,
        replyToId: replyToId || null,
        oneTime: Boolean(oneTime),
        status,
        deliveredAt,
        seenBy: [],
        deletedFor: [],
      },
    });

    await attachFilesToEntity({
      fileIds: normalizedAttachmentIds,
      userId: safeSenderId,
      category: FILE_CATEGORIES.CHAT_ATTACHMENT,
      attachedToType: FILE_ATTACHMENT_TYPES.MESSAGE,
      attachedToId: createdMessage.id,
      client: tx,
    });

    return createdMessage;
  });

  const [populated] = await enrichMessages([message]);

  emitToUser(safeSenderId, SOCKET_EVENTS.PRIVATE_MESSAGE, populated);
  emitToUser(safeReceiverId, SOCKET_EVENTS.PRIVATE_MESSAGE, populated);

  const statusPayload = buildStatusPayload(populated);
  emitToUser(safeSenderId, SOCKET_EVENTS.MESSAGE_STATUS_UPDATE, statusPayload);
  emitToUser(safeReceiverId, SOCKET_EVENTS.MESSAGE_STATUS_UPDATE, statusPayload);

  await createNotification({
    recipient: safeReceiverId,
    type: 'message',
    title: `New message from ${sender.name}`,
    message: safeContent ? safeContent.slice(0, 150) : 'Sent an attachment',
    metadata: {
      messageId: message.id,
      senderId: safeSenderId,
      messageType: MESSAGE_TYPES.PRIVATE,
    },
  });

  await invalidateResources(MESSAGE_CACHE_RESOURCES);

  return populated;
};

const sendGroupMessage = async ({
  senderId,
  groupId,
  content = '',
  attachmentIds = [],
  replyToId = null,
  oneTime = false,
}) => {
  const safeSenderId = normalizeId(senderId);
  const safeGroupId = normalizeId(groupId);
  const safeContent = typeof content === 'string' ? content.trim() : '';
  const normalizedAttachmentIds = normalizeAttachmentIds(attachmentIds);

  if (Boolean(oneTime)) {
    throw new ApiError(400, 'oneTime messages are only supported for private chats');
  }

  if (!safeContent && normalizedAttachmentIds.length === 0) {
    throw new ApiError(400, 'Provide content or attachments');
  }

  const sender = await ensureActiveUser(safeSenderId);
  const group = await prisma.group.findUnique({
    where: { id: safeGroupId },
    select: { id: true, name: true, description: true },
  });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  const senderMembership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: safeGroupId, userId: safeSenderId } },
  });
  if (!senderMembership) {
    throw new ApiError(403, 'You are not a member of this group');
  }

  await assertReplyMessageAllowed({
    senderId: safeSenderId,
    groupId: safeGroupId,
    messageType: MESSAGE_TYPES.GROUP,
    replyToId,
  });

  const allMembers = await prisma.groupMember.findMany({
    where: { groupId: safeGroupId },
    select: { userId: true },
  });
  const recipientIds = allMembers.map((m) => m.userId).filter((id) => id !== safeSenderId);
  const isDeliveredToAnyRecipient = recipientIds.some((memberId) => isUserOnline(memberId));

  const message = await prisma.$transaction(async (tx) => {
    await assertOwnedFileAssets({
      fileIds: normalizedAttachmentIds,
      userId: safeSenderId,
      category: FILE_CATEGORIES.CHAT_ATTACHMENT,
      client: tx,
    });

    const createdMessage = await tx.message.create({
      data: {
        senderId: safeSenderId,
        groupId: safeGroupId,
        content: safeContent,
        attachmentIds: normalizedAttachmentIds,
        attachments: null,
        messageType: MESSAGE_TYPES.GROUP,
        replyToId: replyToId || null,
        oneTime: false,
        status: isDeliveredToAnyRecipient ? MESSAGE_STATUS.DELIVERED : MESSAGE_STATUS.SENT,
        deliveredAt: isDeliveredToAnyRecipient ? new Date() : null,
        seenBy: [safeSenderId],
        deletedFor: [],
      },
    });

    await attachFilesToEntity({
      fileIds: normalizedAttachmentIds,
      userId: safeSenderId,
      category: FILE_CATEGORIES.CHAT_ATTACHMENT,
      attachedToType: FILE_ATTACHMENT_TYPES.MESSAGE,
      attachedToId: createdMessage.id,
      client: tx,
    });

    return createdMessage;
  });

  const [populated] = await enrichMessages([message]);

  emitToGroup(safeGroupId, SOCKET_EVENTS.GROUP_MESSAGE, populated);
  emitToGroup(safeGroupId, SOCKET_EVENTS.MESSAGE_STATUS_UPDATE, buildStatusPayload(populated));

  const activeMembers = await prisma.groupMember.findMany({
    where: { groupId: safeGroupId, userId: { not: safeSenderId }, user: { isActive: true } },
    select: { userId: true },
  });

  const recipients = activeMembers.map((m) => m.userId);

  if (recipients.length > 0) {
    await createBulkNotifications(
      recipients.map((recipientId) => ({
        recipient: recipientId,
        type: 'message',
        title: `New message in ${group.name}`,
        message: safeContent ? safeContent.slice(0, 150) : 'New attachment in group chat',
        metadata: {
          messageId: message.id,
          senderId: safeSenderId,
          groupId: safeGroupId,
          messageType: MESSAGE_TYPES.GROUP,
        },
      }))
    );
  }

  await invalidateResources(MESSAGE_CACHE_RESOURCES);

  return populated;
};

const getPrivateHistory = async ({ userId, otherUserId, page, limit }) => {
  const safeUserId = normalizeId(userId);
  const safeOtherUserId = normalizeId(otherUserId);

  const { allowed } = await isPrivateChatAllowed(safeUserId, safeOtherUserId);
  if (!allowed) {
    const hasHistory = await hasPrivateMessageHistory(
      safeUserId,
      safeOtherUserId,
      safeUserId
    );

    if (!hasHistory) {
      throw new ApiError(403, 'You are not allowed to access this private chat history');
    }
  }

  const { skip, page: safePage, limit: safeLimit } = sanitizePagination({ page, limit });

  const where = {
    messageType: MESSAGE_TYPES.PRIVATE,
    OR: [
      { senderId: safeUserId, receiverId: safeOtherUserId },
      { senderId: safeOtherUserId, receiverId: safeUserId },
    ],
    NOT: { deletedFor: { has: safeUserId } },
  };

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    }),
    prisma.message.count({ where }),
  ]);

  return {
    messages: await enrichMessages(messages),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  };
};

const getGroupHistory = async ({ userId, groupId, page, limit }) => {
  const safeUserId = normalizeId(userId);
  const safeGroupId = normalizeId(groupId);

  const group = await prisma.group.findUnique({
    where: { id: safeGroupId },
    select: { id: true },
  });

  if (!group) {
    throw new ApiError(404, 'Group not found');
  }

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: safeGroupId, userId: safeUserId } },
  });
  if (!membership) {
    throw new ApiError(403, 'You are not a member of this group');
  }

  const { skip, page: safePage, limit: safeLimit } = sanitizePagination({ page, limit });

  const where = {
    messageType: MESSAGE_TYPES.GROUP,
    groupId: safeGroupId,
    NOT: { deletedFor: { has: safeUserId } },
  };

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    }),
    prisma.message.count({ where }),
  ]);

  return {
    messages: await enrichMessages(messages),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  };
};

const searchMessages = async ({ userId, query, page, limit }) => {
  const safeUserId = normalizeId(userId);
  const { skip, page: safePage, limit: safeLimit } = sanitizePagination({ page, limit });

  const userExists = await prisma.user.findUnique({
    where: { id: safeUserId },
    select: { id: true },
  });

  if (!userExists) {
    throw new ApiError(404, 'User not found');
  }

  const memberships = await prisma.groupMember.findMany({
    where: { userId: safeUserId },
    select: { groupId: true },
  });
  const userGroupIds = memberships.map((m) => m.groupId);

  const criteria = {
    content: { contains: query, mode: 'insensitive' },
    NOT: { deletedFor: { has: safeUserId } },
    OR: [
      {
        messageType: MESSAGE_TYPES.PRIVATE,
        OR: [{ senderId: safeUserId }, { receiverId: safeUserId }],
      },
      {
        messageType: MESSAGE_TYPES.GROUP,
        groupId: { in: userGroupIds },
      },
    ],
  };

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: criteria,
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    }),
    prisma.message.count({ where: criteria }),
  ]);

  return {
    messages: await enrichMessages(messages),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  };
};

const getInboxConversations = async ({ userId }) => {
  const safeUserId = normalizeId(userId);

  const memberships = await prisma.groupMember.findMany({
    where: { userId: safeUserId },
    select: { groupId: true },
  });
  const groupIds = memberships.map((item) => item.groupId);

  const [privateMessages, groupMessages] = await Promise.all([
    prisma.message.findMany({
      where: {
        messageType: MESSAGE_TYPES.PRIVATE,
        OR: [{ senderId: safeUserId }, { receiverId: safeUserId }],
        NOT: { deletedFor: { has: safeUserId } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    groupIds.length
      ? prisma.message.findMany({
          where: {
            messageType: MESSAGE_TYPES.GROUP,
            groupId: { in: groupIds },
            NOT: { deletedFor: { has: safeUserId } },
          },
          orderBy: { createdAt: 'desc' },
          take: 500,
        })
      : Promise.resolve([]),
  ]);

  const privateMap = new Map();
  for (const message of privateMessages) {
    const peerId = normalizeId(
      normalizeId(message.senderId) === safeUserId ? message.receiverId : message.senderId
    );

    if (!peerId) {
      // Skip malformed records.
      continue;
    }

    const existing = privateMap.get(peerId) || {
      type: MESSAGE_TYPES.PRIVATE,
      threadId: peerId,
      lastMessageAt: null,
      lastMessagePreview: '',
      unreadCount: 0,
    };

    if (!existing.lastMessageAt) {
      existing.lastMessageAt = message.createdAt;
      existing.lastMessagePreview = message.content || '[Attachment]';
    }

    if (normalizeId(message.receiverId) === safeUserId && message.status !== MESSAGE_STATUS.READ) {
      existing.unreadCount += 1;
    }

    privateMap.set(peerId, existing);
  }

  const groupMap = new Map();
  for (const message of groupMessages) {
    const groupId = normalizeId(message.groupId);
    if (!groupId) {
      continue;
    }

    const existing = groupMap.get(groupId) || {
      type: MESSAGE_TYPES.GROUP,
      threadId: groupId,
      lastMessageAt: null,
      lastMessagePreview: '',
      unreadCount: 0,
    };

    if (!existing.lastMessageAt) {
      existing.lastMessageAt = message.createdAt;
      existing.lastMessagePreview = message.content || '[Attachment]';
    }

    const seenBy = Array.isArray(message.seenBy) ? message.seenBy.map((id) => String(id)) : [];
    if (normalizeId(message.senderId) !== safeUserId && !seenBy.includes(safeUserId)) {
      existing.unreadCount += 1;
    }

    groupMap.set(groupId, existing);
  }

  const [peers, groups] = await Promise.all([
    privateMap.size
      ? prisma.user.findMany({
          where: { id: { in: [...privateMap.keys()] } },
          select: { id: true, name: true, role: true, registrationNumber: true, avatarFileId: true },
        })
      : Promise.resolve([]),
    groupMap.size
      ? prisma.group.findMany({
          where: { id: { in: [...groupMap.keys()] } },
          select: { id: true, name: true, avatarFileId: true },
        })
      : Promise.resolve([]),
  ]);

  const enrichedPeers = await hydrateUsersWithAvatars(peers);
  const peerById = new Map(enrichedPeers.map((user) => [user.id, user]));
  const groupAvatarFileIds = groups.map((group) => group.avatarFileId).filter(Boolean);
  const groupAvatarsMap = await getFileAssetsMap(groupAvatarFileIds);
  const groupById = new Map(
    groups.map((group) => [
      group.id,
      {
        ...group,
        avatar: group.avatarFileId
          ? groupAvatarsMap.get(String(group.avatarFileId))?.publicUrl || null
          : null,
      },
    ])
  );

  const items = [];

  for (const [peerId, thread] of privateMap.entries()) {
    const peer = peerById.get(peerId);
    if (!peer) continue;
    items.push({
      id: `private:${peerId}`,
      type: MESSAGE_TYPES.PRIVATE,
      threadId: peerId,
      name: peer.name,
      unreadCount: thread.unreadCount,
      lastMessageAt: thread.lastMessageAt,
      lastMessagePreview: thread.lastMessagePreview,
      peer: { ...peer, _id: peer.id },
    });
  }

  for (const [groupId, thread] of groupMap.entries()) {
    const group = groupById.get(groupId);
    if (!group) continue;
    items.push({
      id: `group:${groupId}`,
      type: MESSAGE_TYPES.GROUP,
      threadId: groupId,
      name: group.name,
      unreadCount: thread.unreadCount,
      lastMessageAt: thread.lastMessageAt,
      lastMessagePreview: thread.lastMessagePreview,
      group: { ...group, _id: group.id },
    });
  }

  items.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  return items;
};

const markMessageRead = async ({ userId, messageId }) => {
  const safeUserId = normalizeId(userId);
  const safeMessageId = normalizeId(messageId);

  const message = await prisma.message.findUnique({ where: { id: safeMessageId } });
  if (!message) {
    throw new ApiError(404, 'Message not found');
  }

  if (message.messageType === MESSAGE_TYPES.PRIVATE) {
    if (String(message.receiverId) !== safeUserId) {
      throw new ApiError(403, 'Only receiver can mark private message as read');
    }

    const now = new Date();
    const seenBy = Array.isArray(message.seenBy)
      ? [...new Set([...message.seenBy, safeUserId])]
      : [safeUserId];
    const updateData = {
      status: MESSAGE_STATUS.READ,
      readAt: message.readAt || now,
      seenBy,
    };

    if (message.oneTime && !message.consumedAt) {
      updateData.consumedAt = now;
      updateData.content = '[One-time message opened]';
      updateData.attachments = [];
      updateData.attachmentIds = [];
    }

    const updated = await prisma.message.update({
      where: { id: safeMessageId },
      data: updateData,
    });

    const payload = buildStatusPayload(updated, { readBy: safeUserId, seenBy });
    emitToUser(updated.senderId, SOCKET_EVENTS.MESSAGE_STATUS_UPDATE, payload);
    emitToUser(updated.receiverId, SOCKET_EVENTS.MESSAGE_STATUS_UPDATE, payload);

    if (updated.oneTime && updated.consumedAt) {
      const oneTimePayload = {
        messageId: updated.id,
        consumedAt: updated.consumedAt,
        consumedBy: safeUserId,
      };
      emitToUser(updated.senderId, SOCKET_EVENTS.MESSAGE_ONE_TIME_CONSUMED, oneTimePayload);
      emitToUser(updated.receiverId, SOCKET_EVENTS.MESSAGE_ONE_TIME_CONSUMED, oneTimePayload);
    }

    await invalidateResources(MESSAGE_CACHE_RESOURCES);

    return { ...updated, _id: updated.id, tick: STATUS_TICK[updated.status] };
  }

  if (message.messageType === MESSAGE_TYPES.GROUP) {
    const groupMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: message.groupId, userId: safeUserId } },
    });
    if (!groupMembership) {
      throw new ApiError(403, 'Only group members can mark this message as read');
    }

    const allGroupMembers = await prisma.groupMember.findMany({
      where: { groupId: message.groupId },
      select: { userId: true },
    });

    const currentSeenBy = Array.isArray(message.seenBy)
      ? message.seenBy.map((id) => String(id))
      : [];
    const nextSeenBy = currentSeenBy.includes(safeUserId)
      ? currentSeenBy
      : [...currentSeenBy, safeUserId];

    const recipientIds = allGroupMembers
      .map((m) => m.userId)
      .filter((id) => id !== String(message.senderId));

    const seenRecipientCount = nextSeenBy.filter((id) => recipientIds.includes(id)).length;

    let nextStatus = message.status;
    if (recipientIds.length > 0 && seenRecipientCount >= recipientIds.length) {
      nextStatus = MESSAGE_STATUS.READ;
    } else if (seenRecipientCount > 0 || message.status === MESSAGE_STATUS.DELIVERED) {
      nextStatus = MESSAGE_STATUS.DELIVERED;
    }

    const updateData = { seenBy: nextSeenBy };

    if (nextStatus !== message.status) {
      updateData.status = nextStatus;
    }

    if (nextStatus === MESSAGE_STATUS.DELIVERED && !message.deliveredAt) {
      updateData.deliveredAt = new Date();
    }

    if (nextStatus === MESSAGE_STATUS.READ && !message.readAt) {
      updateData.readAt = new Date();
    }

    const updated = await prisma.message.update({
      where: { id: safeMessageId },
      data: updateData,
    });

    const io = getIO();
    if (io) {
      io.to(`group:${updated.groupId}`).emit(
        SOCKET_EVENTS.MESSAGE_STATUS_UPDATE,
        buildStatusPayload(updated, { readBy: safeUserId, seenBy: nextSeenBy })
      );
    }

    await invalidateResources(MESSAGE_CACHE_RESOURCES);

    return { ...updated, _id: updated.id, tick: STATUS_TICK[updated.status] };
  }

  throw new ApiError(400, 'Unsupported message type');
};

const markPrivateMessagesDelivered = async ({ receiverId, senderId = null }) => {
  const safeReceiverId = normalizeId(receiverId);
  const safeSenderId = senderId ? normalizeId(senderId) : null;

  const filter = {
    messageType: MESSAGE_TYPES.PRIVATE,
    receiverId: safeReceiverId,
    status: MESSAGE_STATUS.SENT,
  };

  if (safeSenderId) {
    filter.senderId = safeSenderId;
  }

  const pendingMessages = await prisma.message.findMany({
    where: filter,
    select: { id: true, senderId: true, receiverId: true, seenBy: true },
  });

  if (pendingMessages.length === 0) {
    return;
  }

  const deliveredAt = new Date();

  await prisma.message.updateMany({
    where: filter,
    data: { status: MESSAGE_STATUS.DELIVERED, deliveredAt },
  });

  pendingMessages.forEach((message) => {
    const payload = buildStatusPayload(
      {
        ...message,
        status: MESSAGE_STATUS.DELIVERED,
        deliveredAt,
        readAt: null,
      },
      { seenBy: message.seenBy || [] }
    );

    emitToUser(message.senderId, SOCKET_EVENTS.MESSAGE_STATUS_UPDATE, payload);
    emitToUser(message.receiverId, SOCKET_EVENTS.MESSAGE_STATUS_UPDATE, payload);
  });

  await invalidateResources(MESSAGE_CACHE_RESOURCES);
};

const MESSAGE_EDIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const editMessage = async ({ userId, messageId, content }) => {
  const safeUserId = normalizeId(userId);
  const safeMessageId = normalizeId(messageId);
  const safeContent = typeof content === 'string' ? content.trim() : '';

  if (!safeContent) {
    throw new ApiError(400, 'Edited content cannot be empty');
  }

  const message = await prisma.message.findUnique({ where: { id: safeMessageId } });
  if (!message) {
    throw new ApiError(404, 'Message not found');
  }

  if (normalizeId(message.senderId) !== safeUserId) {
    throw new ApiError(403, 'You can only edit your own messages');
  }

  if (message.oneTime) {
    throw new ApiError(400, 'One-time messages cannot be edited');
  }

  const ageMs = Date.now() - new Date(message.createdAt).getTime();
  if (ageMs > MESSAGE_EDIT_WINDOW_MS) {
    throw new ApiError(403, 'Messages can only be edited within 5 minutes of sending');
  }

  const updated = await prisma.message.update({
    where: { id: safeMessageId },
    data: { content: safeContent, isEdited: true, editedAt: new Date() },
  });

  const [populated] = await enrichMessages([updated]);

  const editPayload = {
    messageId: updated.id,
    content: updated.content,
    isEdited: true,
    editedAt: updated.editedAt,
    senderId: updated.senderId,
  };

  if (updated.messageType === MESSAGE_TYPES.PRIVATE && updated.receiverId) {
    emitToUser(updated.receiverId, SOCKET_EVENTS.MESSAGE_EDITED, editPayload);
    emitToUser(updated.senderId, SOCKET_EVENTS.MESSAGE_EDITED, editPayload);
  } else if (updated.messageType === MESSAGE_TYPES.GROUP && updated.groupId) {
    emitToGroup(updated.groupId, SOCKET_EVENTS.MESSAGE_EDITED, editPayload);
  }

  await invalidateResources(MESSAGE_CACHE_RESOURCES);

  return populated;
};

const deleteMessage = async ({ userId, messageId, deleteFor = 'me' }) => {
  const safeUserId = normalizeId(userId);
  const safeMessageId = normalizeId(messageId);

  const message = await prisma.message.findUnique({ where: { id: safeMessageId } });
  if (!message) {
    throw new ApiError(404, 'Message not found');
  }

  const isSender = normalizeId(message.senderId) === safeUserId;

  if (deleteFor === 'everyone') {
    if (!isSender) {
      throw new ApiError(403, 'Only the sender can delete a message for everyone');
    }

    const ageMs = Date.now() - new Date(message.createdAt).getTime();
    if (ageMs > MESSAGE_EDIT_WINDOW_MS) {
      throw new ApiError(
        403,
        'Messages can only be deleted for everyone within 5 minutes of sending'
      );
    }

    const updated = await prisma.message.update({
      where: { id: safeMessageId },
      data: {
        content: '[This message was deleted]',
        attachments: [],
        attachmentIds: [],
        deletedFor: [],
      },
    });

    const deletePayload = { messageId: updated.id, deletedBy: safeUserId, deletedFor: 'everyone' };

    if (updated.messageType === MESSAGE_TYPES.PRIVATE && updated.receiverId) {
      emitToUser(updated.receiverId, SOCKET_EVENTS.MESSAGE_DELETED, deletePayload);
      emitToUser(updated.senderId, SOCKET_EVENTS.MESSAGE_DELETED, deletePayload);
    } else if (updated.messageType === MESSAGE_TYPES.GROUP && updated.groupId) {
      emitToGroup(updated.groupId, SOCKET_EVENTS.MESSAGE_DELETED, deletePayload);
    }

    await invalidateResources(MESSAGE_CACHE_RESOURCES);

    return { messageId: safeMessageId, deletedFor: 'everyone' };
  }

  // deleteFor === 'me' — soft delete
  let isParticipant = false;

  if (message.messageType === MESSAGE_TYPES.PRIVATE) {
    const receiverId = message.receiverId ? normalizeId(message.receiverId) : null;
    isParticipant = isSender || receiverId === safeUserId;
  }

  if (message.messageType === MESSAGE_TYPES.GROUP && message.groupId) {
    const gm = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: message.groupId, userId: safeUserId } },
    });
    isParticipant = Boolean(gm);
  }

  if (!isParticipant) {
    throw new ApiError(403, 'You are not a participant of this message');
  }

  const currentDeletedFor = Array.isArray(message.deletedFor) ? message.deletedFor : [];
  if (currentDeletedFor.includes(safeUserId)) {
    return { messageId: safeMessageId, deletedFor: 'me' };
  }

  await prisma.message.update({
    where: { id: safeMessageId },
    data: { deletedFor: [...currentDeletedFor, safeUserId] },
  });

  await invalidateResources(MESSAGE_CACHE_RESOURCES);

  return { messageId: safeMessageId, deletedFor: 'me' };
};

const softDeleteConversationForUser = async ({ userId, where }) => {
  const safeUserId = normalizeId(userId);
  const messages = await prisma.message.findMany({
    where: {
      ...where,
      NOT: { deletedFor: { has: safeUserId } },
    },
    select: { id: true, deletedFor: true },
  });

  if (messages.length === 0) {
    return 0;
  }

  await prisma.$transaction(async (tx) => {
    for (const message of messages) {
      const currentDeletedFor = Array.isArray(message.deletedFor) ? message.deletedFor : [];
      if (currentDeletedFor.includes(safeUserId)) {
        continue;
      }

      await tx.message.update({
        where: { id: message.id },
        data: { deletedFor: [...currentDeletedFor, safeUserId] },
      });
    }
  });

  return messages.length;
};

const deletePrivateConversation = async ({ userId, otherUserId }) => {
  const safeUserId = normalizeId(userId);
  const safeOtherUserId = normalizeId(otherUserId);

  if (safeUserId === safeOtherUserId) {
    throw new ApiError(400, 'Invalid conversation target');
  }

  const peer = await prisma.user.findUnique({
    where: { id: safeOtherUserId },
    select: { id: true },
  });

  if (!peer) {
    throw new ApiError(404, 'Conversation user not found');
  }

  const deletedMessagesCount = await softDeleteConversationForUser({
    userId: safeUserId,
    where: {
      messageType: MESSAGE_TYPES.PRIVATE,
      OR: [
        { senderId: safeUserId, receiverId: safeOtherUserId },
        { senderId: safeOtherUserId, receiverId: safeUserId },
      ],
    },
  });

  await invalidateResources(MESSAGE_CACHE_RESOURCES);

  return {
    deletedFor: 'me',
    conversationType: MESSAGE_TYPES.PRIVATE,
    conversationId: safeOtherUserId,
    deletedMessagesCount,
  };
};

const deleteGroupConversation = async ({ userId, groupId }) => {
  const safeUserId = normalizeId(userId);
  const safeGroupId = normalizeId(groupId);

  const groupMembership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: safeGroupId, userId: safeUserId } },
    select: { userId: true },
  });

  if (!groupMembership) {
    throw new ApiError(403, 'Only group members can delete this conversation');
  }

  const deletedMessagesCount = await softDeleteConversationForUser({
    userId: safeUserId,
    where: {
      messageType: MESSAGE_TYPES.GROUP,
      groupId: safeGroupId,
    },
  });

  await invalidateResources(MESSAGE_CACHE_RESOURCES);

  return {
    deletedFor: 'me',
    conversationType: MESSAGE_TYPES.GROUP,
    conversationId: safeGroupId,
    deletedMessagesCount,
  };
};

module.exports = {
  sendPrivateMessage,
  sendGroupMessage,
  getInboxConversations,
  getPrivateHistory,
  getGroupHistory,
  searchMessages,
  markMessageRead,
  markPrivateMessagesDelivered,
  editMessage,
  deleteMessage,
  deletePrivateConversation,
  deleteGroupConversation,
};
