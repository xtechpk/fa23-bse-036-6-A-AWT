const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const messageService = require('../services/messageService');
const { FILE_CATEGORIES, createFileAssetsFromUploads } = require('../services/fileService');
const asyncHandler = require('../utils/asyncHandler');

const resolveAttachmentIds = (body = {}) => {
  if (Array.isArray(body.attachmentIds)) {
    return body.attachmentIds;
  }

  if (!Array.isArray(body.attachments)) {
    return [];
  }

  return body.attachments
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') return item.id || null;
      return null;
    })
    .filter(Boolean);
};

const sendPrivateMessage = asyncHandler(async (req, res) => {
  const message = await messageService.sendPrivateMessage({
    senderId: req.user._id,
    receiverId: req.body.receiverId,
    content: req.body.content,
    attachmentIds: resolveAttachmentIds(req.body),
    replyToId: req.body.replyToId,
    oneTime: req.body.oneTime,
  });

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Private message sent successfully',
    data: message,
  });
});

const sendGroupMessage = asyncHandler(async (req, res) => {
  const message = await messageService.sendGroupMessage({
    senderId: req.user._id,
    groupId: req.body.groupId,
    content: req.body.content,
    attachmentIds: resolveAttachmentIds(req.body),
    replyToId: req.body.replyToId,
    oneTime: req.body.oneTime,
  });

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Group message sent successfully',
    data: message,
  });
});

const getPrivateHistory = asyncHandler(async (req, res) => {
  const result = await messageService.getPrivateHistory({
    userId: req.user._id,
    otherUserId: req.params.userId,
    page: req.query.page,
    limit: req.query.limit,
  });

  return ApiResponse.success(res, {
    message: 'Private chat history fetched successfully',
    data: result.messages,
    meta: result.pagination,
  });
});

const getGroupHistory = asyncHandler(async (req, res) => {
  const result = await messageService.getGroupHistory({
    userId: req.user._id,
    groupId: req.params.groupId,
    page: req.query.page,
    limit: req.query.limit,
  });

  return ApiResponse.success(res, {
    message: 'Group chat history fetched successfully',
    data: result.messages,
    meta: result.pagination,
  });
});

const searchMessages = asyncHandler(async (req, res) => {
  const result = await messageService.searchMessages({
    userId: req.user._id,
    query: req.query.q,
    page: req.query.page,
    limit: req.query.limit,
  });

  return ApiResponse.success(res, {
    message: 'Messages search completed successfully',
    data: result.messages,
    meta: result.pagination,
  });
});

const markMessageRead = asyncHandler(async (req, res) => {
  const message = await messageService.markMessageRead({
    userId: req.user._id,
    messageId: req.params.id,
  });

  return ApiResponse.success(res, {
    message: 'Message marked as read',
    data: message,
  });
});

const uploadAttachments = asyncHandler(async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  if (files.length === 0) {
    throw new ApiError(400, 'Upload at least one attachment');
  }

  const data = await createFileAssetsFromUploads({
    files,
    userId: req.user._id,
    category: FILE_CATEGORIES.CHAT_ATTACHMENT,
    folder: 'chat',
  });

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Attachments uploaded successfully',
    data,
  });
});

const editMessage = asyncHandler(async (req, res) => {
  const message = await messageService.editMessage({
    userId: req.user._id,
    messageId: req.params.id,
    content: req.body.content,
  });

  return ApiResponse.success(res, {
    message: 'Message edited successfully',
    data: message,
  });
});

const deleteMessage = asyncHandler(async (req, res) => {
  const result = await messageService.deleteMessage({
    userId: req.user._id,
    messageId: req.params.id,
    deleteFor: req.body.deleteFor || 'me',
  });

  return ApiResponse.success(res, {
    message:
      result.deletedFor === 'everyone' ? 'Message deleted for everyone' : 'Message deleted for you',
    data: result,
  });
});

module.exports = {
  sendPrivateMessage,
  sendGroupMessage,
  getPrivateHistory,
  getGroupHistory,
  searchMessages,
  markMessageRead,
  uploadAttachments,
  editMessage,
  deleteMessage,
};
