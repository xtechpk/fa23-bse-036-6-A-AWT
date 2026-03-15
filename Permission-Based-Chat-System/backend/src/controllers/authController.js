const ApiResponse = require('../utils/ApiResponse');
const authService = require('../services/authService');
const { buildRequestMeta } = require('../utils/requestContext');
const asyncHandler = require('../utils/asyncHandler');

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
      currentPassword: req.body.currentPassword,
    },
    { meta: buildRequestMeta(req, req.body?.location) }
  );

  return ApiResponse.success(res, {
    message: 'Two-factor authentication disabled successfully',
    data: user,
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
  return ApiResponse.success(res, {
    data: req.user,
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
  refreshToken,
  logout,
  me,
  listMySessions,
  revokeMySession,
};
