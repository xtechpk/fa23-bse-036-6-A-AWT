const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');

// Fire-and-forget: audit writes are deferred to the next event-loop tick so they
// never add latency to the HTTP response that triggered the event.
const logAuditEvent = ({
  actorId = null,
  action,
  targetType = null,
  targetId = null,
  ipAddress = null,
  userAgent = null,
  metadata = null,
}) => {
  if (!action) {
    return;
  }

  setImmediate(() => {
    prisma.auditLog
      .create({
        data: {
          actorId,
          action,
          targetType,
          targetId,
          ipAddress,
          userAgent,
          metadata,
        },
      })
      .catch((error) => {
        logger.warn('Failed to persist audit event', {
          action,
          actorId,
          message: error.message,
        });
      });
  });
};

module.exports = {
  logAuditEvent,
};
