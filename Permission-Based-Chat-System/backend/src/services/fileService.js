const path = require('path');
const prisma = require('../utils/prismaClient');
const ApiError = require('../utils/ApiError');

const FILE_CATEGORIES = {
  CHAT_ATTACHMENT: 'chat_attachment',
  AVATAR: 'avatar',
  OTHER: 'other',
};

const FILE_ATTACHMENT_TYPES = {
  MESSAGE: 'message',
  USER_AVATAR: 'user_avatar',
  GROUP_AVATAR: 'group_avatar',
};

const normalizeId = (value, fieldName = 'id') => {
  if (value === null || value === undefined) {
    throw new ApiError(400, `${fieldName} is required`);
  }

  const normalized = String(value).trim();
  if (!normalized) {
    throw new ApiError(400, `${fieldName} cannot be empty`);
  }

  return normalized;
};

const uniqIds = (values = []) => [
  ...new Set((values || []).filter(Boolean).map((value) => normalizeId(value))),
];

const buildPublicUrl = (folder, storedName) =>
  `/uploads/${String(folder).replace(/^\/+|\/+$/g, '')}/${storedName}`;

const mapFileAsset = (fileAsset) => ({
  ...fileAsset,
  _id: fileAsset.id,
  url: fileAsset.publicUrl,
  path: fileAsset.relativePath,
  fileName: fileAsset.originalName,
});

const createFileAssetsFromUploads = async ({
  files,
  userId,
  category,
  folder,
  client = prisma,
}) => {
  const safeUserId = normalizeId(userId, 'userId');
  const safeFolder = String(folder || '').trim();
  const safeCategory = String(category || '').trim();

  if (!Array.isArray(files) || files.length === 0) {
    throw new ApiError(400, 'No uploaded files were provided');
  }

  if (!safeFolder) {
    throw new ApiError(400, 'folder is required');
  }

  if (!safeCategory) {
    throw new ApiError(400, 'category is required');
  }

  const created = await Promise.all(
    files.map((file) =>
      client.fileAsset.create({
        data: {
          userId: safeUserId,
          category: safeCategory,
          folder: safeFolder,
          originalName: file.originalname,
          storedName: file.filename,
          mimeType: file.mimetype,
          size: Number(file.size) || 0,
          extension: path.extname(file.originalname || '') || null,
          relativePath: `${safeFolder}/${file.filename}`,
          publicUrl: buildPublicUrl(safeFolder, file.filename),
          isTemporary: true,
        },
      })
    )
  );

  return created.map(mapFileAsset);
};

const getFileAssetsByIds = async (fileIds, client = prisma) => {
  const safeIds = uniqIds(fileIds);
  if (safeIds.length === 0) {
    return [];
  }

  const assets = await client.fileAsset.findMany({
    where: { id: { in: safeIds } },
  });

  return assets.map(mapFileAsset);
};

const getFileAssetsMap = async (fileIds, client = prisma) => {
  const assets = await getFileAssetsByIds(fileIds, client);
  return new Map(assets.map((asset) => [asset.id, asset]));
};

const assertOwnedFileAssets = async ({ fileIds, userId, category = null, client = prisma }) => {
  const safeIds = uniqIds(fileIds);
  if (safeIds.length === 0) {
    return [];
  }

  const where = {
    id: { in: safeIds },
    userId: normalizeId(userId, 'userId'),
  };

  if (category) {
    where.category = String(category);
  }

  const assets = await client.fileAsset.findMany({ where });

  if (assets.length !== safeIds.length) {
    throw new ApiError(400, 'One or more files are invalid or do not belong to the current user');
  }

  return assets.map(mapFileAsset);
};

const attachFilesToEntity = async ({
  fileIds,
  userId,
  category = null,
  attachedToType,
  attachedToId,
  client = prisma,
}) => {
  const assets = await assertOwnedFileAssets({ fileIds, userId, category, client });

  if (assets.length === 0) {
    return [];
  }

  await client.fileAsset.updateMany({
    where: {
      id: { in: assets.map((asset) => asset.id) },
      userId: normalizeId(userId, 'userId'),
    },
    data: {
      isTemporary: false,
      attachedToType: attachedToType || null,
      attachedToId: attachedToId ? String(attachedToId) : null,
    },
  });

  return assets;
};

const setUserAvatarFromUpload = async ({ file, userId, client = prisma }) => {
  const safeUserId = normalizeId(userId, 'userId');

  if (!file) {
    throw new ApiError(400, 'Avatar file is required');
  }

  const created = await createFileAssetsFromUploads({
    files: [file],
    userId: safeUserId,
    category: FILE_CATEGORIES.AVATAR,
    folder: 'avatars',
    client,
  });

  const avatarFile = created[0];

  const user = await client.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { id: safeUserId },
      select: { avatarFileId: true },
    });

    if (existingUser?.avatarFileId) {
      await tx.fileAsset.updateMany({
        where: {
          id: existingUser.avatarFileId,
          userId: safeUserId,
          category: FILE_CATEGORIES.AVATAR,
        },
        data: {
          attachedToType: null,
          attachedToId: null,
          isTemporary: true,
        },
      });
    }

    await tx.fileAsset.update({
      where: { id: avatarFile.id },
      data: {
        isTemporary: false,
        attachedToType: FILE_ATTACHMENT_TYPES.USER_AVATAR,
        attachedToId: safeUserId,
      },
    });

    return tx.user.update({
      where: { id: safeUserId },
      data: {
        avatarFileId: avatarFile.id,
      },
    });
  });

  return {
    user,
    avatarFile,
  };
};

const setGroupAvatarFromUpload = async ({ file, userId, groupId, client = prisma }) => {
  const safeUserId = normalizeId(userId, 'userId');
  const safeGroupId = normalizeId(groupId, 'groupId');

  if (!file) {
    throw new ApiError(400, 'Group avatar file is required');
  }

  const created = await createFileAssetsFromUploads({
    files: [file],
    userId: safeUserId,
    category: FILE_CATEGORIES.AVATAR,
    folder: 'chat',
    client,
  });

  const avatarFile = created[0];

  const group = await client.$transaction(async (tx) => {
    const existingGroup = await tx.group.findUnique({
      where: { id: safeGroupId },
      select: { avatarFileId: true },
    });

    if (!existingGroup) {
      throw new ApiError(404, 'Group not found');
    }

    if (existingGroup.avatarFileId) {
      await tx.fileAsset.updateMany({
        where: {
          id: existingGroup.avatarFileId,
          category: FILE_CATEGORIES.AVATAR,
        },
        data: {
          attachedToType: null,
          attachedToId: null,
          isTemporary: true,
        },
      });
    }

    await tx.fileAsset.update({
      where: { id: avatarFile.id },
      data: {
        isTemporary: false,
        attachedToType: FILE_ATTACHMENT_TYPES.GROUP_AVATAR,
        attachedToId: safeGroupId,
      },
    });

    return tx.group.update({
      where: { id: safeGroupId },
      data: { avatarFileId: avatarFile.id },
    });
  });

  return {
    group,
    avatarFile,
  };
};

module.exports = {
  FILE_CATEGORIES,
  FILE_ATTACHMENT_TYPES,
  mapFileAsset,
  createFileAssetsFromUploads,
  getFileAssetsByIds,
  getFileAssetsMap,
  assertOwnedFileAssets,
  attachFilesToEntity,
  setUserAvatarFromUpload,
  setGroupAvatarFromUpload,
};
