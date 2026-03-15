const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  USER: 'user',
};

const MESSAGE_TYPES = {
  PRIVATE: 'private',
  GROUP: 'group',
};

const MESSAGE_STATUS = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
};

const PERMISSION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const SOCKET_EVENTS = {
  CONNECTION: 'connection',
  PRIVATE_MESSAGE: 'private_message',
  GROUP_MESSAGE: 'group_message',
  MESSAGE_STATUS_UPDATE: 'message_status_update',
  MESSAGE_ONE_TIME_CONSUMED: 'message_one_time_consumed',
  MESSAGE_EDITED: 'message_edited',
  MESSAGE_DELETED: 'message_deleted',
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  MARK_READ: 'mark_read',
  EDIT_MESSAGE: 'edit_message',
  DELETE_MESSAGE: 'delete_message',
  PERMISSION_REQUEST_CREATED: 'permission_request_created',
  PERMISSION_REQUEST_UPDATED: 'permission_request_updated',
  NOTIFICATION: 'notification',
  DISCONNECT: 'disconnect',
};

module.exports = {
  ROLES,
  MESSAGE_TYPES,
  MESSAGE_STATUS,
  PERMISSION_STATUS,
  SOCKET_EVENTS,
};
