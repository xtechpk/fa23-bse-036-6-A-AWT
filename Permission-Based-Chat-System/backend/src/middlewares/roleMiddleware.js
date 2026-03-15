const ApiError = require('../utils/ApiError');
const { ROLES } = require('../utils/constants');

const ROLE_RANK = {
  [ROLES.USER]: 1,
  [ROLES.ADMIN]: 2,
  [ROLES.SUPERADMIN]: 3,
};

const hasRoleAccess = (userRole, allowedRoles) => {
  if (allowedRoles.includes(userRole)) {
    return true;
  }

  const userRank = ROLE_RANK[userRole] || 0;
  return allowedRoles.some((role) => {
    const requiredRank = ROLE_RANK[role] || 0;
    return userRank >= requiredRank && requiredRank > 0;
  });
};

const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }

    if (!hasRoleAccess(req.user.role, roles)) {
      return next(new ApiError(403, 'You are not authorized to access this resource'));
    }

    return next();
  };
};

module.exports = allowRoles;
