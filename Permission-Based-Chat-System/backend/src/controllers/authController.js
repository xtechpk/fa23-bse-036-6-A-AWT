const ApiResponse = require('../utils/ApiResponse');
const authService = require('../services/authService');
const { buildRequestMeta } = require('../utils/requestContext');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../utils/prismaClient');
const {
  FILE_ATTACHMENT_TYPES,
  FILE_CATEGORIES,
  getFileAssetsByIds,
} = require('../services/fileService');

const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'User registered successfully',
    data: user,
  });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, {
    adminOnly: false,
    meta: buildRequestMeta(req, req.body.location),
  });

  const message = result.requiresTwoFactor
    ? 'Two-factor verification is required to complete login'
    : 'Login successful';

  return ApiResponse.success(res, {
    message,
    data: result,
  });
});

const adminLogin = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, {
    adminOnly: true,
    meta: buildRequestMeta(req, req.body.location),
  });

  const message = result.requiresTwoFactor
    ? 'Two-factor verification is required to complete admin login'
    : 'Admin/Superadmin login successful';

  return ApiResponse.success(res, {
    message,
    data: result,
  });
});

const verifyLoginTwoFactor = asyncHandler(async (req, res) => {
  const result = await authService.verifyLoginTwoFactor(
    {
      challengeId: req.body.challengeId,
      code: req.body.code,
    },
    { meta: buildRequestMeta(req, req.body.location) }
  );

  return ApiResponse.success(res, {
    message: 'Two-factor verification successful',
    data: result,
  });
});

const startEnableTwoFactor = asyncHandler(async (req, res) => {
  const result = await authService.startEnableTwoFactor(
    {
      userId: req.user._id,
    },
    { meta: buildRequestMeta(req, req.body?.location) }
  );

  return ApiResponse.success(res, {
    message: 'Two-factor setup challenge generated',
    data: result,
  });
});

const verifyEnableTwoFactor = asyncHandler(async (req, res) => {
  const user = await authService.verifyEnableTwoFactor(
    {
      userId: req.user._id,
      challengeId: req.body.challengeId,
      code: req.body.code,
    },
    { meta: buildRequestMeta(req, req.body?.location) }
  );

  return ApiResponse.success(res, {
    message: 'Two-factor authentication enabled successfully',
    data: user,
  });
});

const disableTwoFactor = asyncHandler(async (req, res) => {
  const user = await authService.disableTwoFactor(
    {
      userId: req.user._id,
      code: req.body.code,
    },
    { meta: buildRequestMeta(req, req.body?.location) }
  );

  return ApiResponse.success(res, {
    message: 'Two-factor authentication disabled successfully',
    data: user,
  });
});

const regenerateRecoveryCodes = asyncHandler(async (req, res) => {
  const result = await authService.regenerateRecoveryCodes(
    {
      userId: req.user._id,
      currentPassword: req.body.currentPassword,
    },
    { meta: buildRequestMeta(req, req.body?.location) }
  );

  return ApiResponse.success(res, {
    message: 'Recovery codes regenerated successfully',
    data: result,
  });
});

const getRecoveryCodeStatus = asyncHandler(async (req, res) => {
  const status = await authService.getRecoveryCodeStatus({
    userId: req.user._id,
  });

  return ApiResponse.success(res, {
    message: 'Recovery code status fetched successfully',
    data: status,
  });
});

const refreshToken = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken || req.cookies?.refreshToken;

  const tokens = await authService.refreshToken(token, buildRequestMeta(req, req.body.location));

  return ApiResponse.success(res, {
    message: 'Token refreshed successfully',
    data: tokens,
  });
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
  await authService.logout(refreshToken, req.user?._id, buildRequestMeta(req, req.body?.location));

  return ApiResponse.success(res, {
    message: 'Logout successful',
  });
});

const me = asyncHandler(async (req, res) => {
  const [avatarAssets, fallbackAssets] = await Promise.all([
    req.user?.avatarFileId ? getFileAssetsByIds([req.user.avatarFileId]) : Promise.resolve([]),
    prisma.fileAsset.findMany({
      where: {
        attachedToType: FILE_ATTACHMENT_TYPES.USER_AVATAR,
        attachedToId: String(req.user?._id || ''),
        category: FILE_CATEGORIES.AVATAR,
        isTemporary: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    }),
  ]);

  const fallbackAvatar = fallbackAssets[0]
    ? {
        ...fallbackAssets[0],
        _id: fallbackAssets[0].id,
        url: fallbackAssets[0].publicUrl,
        path: fallbackAssets[0].relativePath,
        fileName: fallbackAssets[0].originalName,
      }
    : null;
  const avatarFile = avatarAssets[0] || fallbackAvatar || null;

  return ApiResponse.success(res, {
    data: {
      ...req.user,
      avatar: avatarFile?.publicUrl || null,
      avatarFile,
    },
    message: 'Current user fetched successfully',
  });
});

const listMySessions = asyncHandler(async (req, res) => {
  const sessions = await authService.listUserSessions(req.user._id);

  return ApiResponse.success(res, {
    message: 'Sessions fetched successfully',
    data: sessions,
  });
});

const revokeMySession = asyncHandler(async (req, res) => {
  const session = await authService.revokeUserSession(
    {
      requesterId: req.user._id,
      sessionId: req.params.sessionId,
    },
    buildRequestMeta(req, req.body?.location)
  );

  return ApiResponse.success(res, {
    message: 'Session revoked successfully',
    data: session,
  });
});

module.exports = {
  register,
  login,
  adminLogin,
  verifyLoginTwoFactor,
  startEnableTwoFactor,
  verifyEnableTwoFactor,
  disableTwoFactor,
  regenerateRecoveryCodes,
  getRecoveryCodeStatus,
  refreshToken,
  logout,
  me,
  listMySessions,
  revokeMySession,
};
