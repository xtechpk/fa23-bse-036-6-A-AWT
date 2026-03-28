export type UserRole = 'user' | 'admin' | 'superadmin';

export interface ChatUser {
  id: string;
  _id?: string;
  name: string;
  email: string;
  registrationNumber: string;
  role: UserRole;
  isActive?: boolean;
  avatar?: string | null;
  uiDensityMode?: DensityMode;
  twoFactorEnabled?: boolean;
  twoFactorEnabledAt?: string | null;
}

export interface TwoFactorChallengePayload {
  challengeId: string;
  expiresAt?: string;
  purpose?: 'login' | 'enable' | string;
  deliveryChannel?: string;
  qrImageDataUrl?: string;
  manualEntryKey?: string;
  otpAuthUrl?: string;
}

export interface RecoveryCodeStatus {
  total: number;
  used: number;
  remaining: number;
}

export interface TwoFactorEnableVerifyResult {
  user: ChatUser;
  recoveryCodes: string[];
}

export interface RecoveryCodesRegenerateResult {
  recoveryCodes: string[];
  status: RecoveryCodeStatus;
}

export interface ChatGroup {
  id: string;
  _id?: string;
  name: string;
  description?: string;
  avatar?: string | null;
  createdById?: string;
  createdBy?: {
    id: string;
    _id?: string;
    name: string;
    email?: string;
    registrationNumber?: string;
    isActive?: boolean;
  } | null;
  members?: Array<{
    id: string;
    _id?: string;
    name: string;
    email?: string;
    registrationNumber?: string;
    isActive?: boolean;
    avatar?: string | null;
    role?: 'owner' | 'admin' | 'member' | string;
    joinedAt?: string;
  }>;
  memberCount?: number;
}

export interface UploadedAttachment {
  id: string;
  _id?: string;
  fileName?: string;
  originalName?: string;
  mimeType: string;
  url?: string;
  publicUrl?: string;
  size?: number;
}

export interface NotificationItem {
  id: string;
  _id?: string;
  title?: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  _id?: string;
  content: string;
  createdAt: string;
  messageType?: 'private' | 'group' | string;
  status?: string;
  tick?: 'sent' | 'delivered' | 'read' | 'single' | 'double' | 'blue';
  senderId: string;
  receiverId?: string | null;
  groupId?: string | null;
  replyToId?: string | null;
  replyTo?: {
    id: string;
    _id?: string;
    content: string;
    createdAt: string;
    senderId: string;
    sender?: Pick<ChatUser, 'id' | 'name' | 'registrationNumber' | 'avatar'> & { _id?: string };
  } | null;
  isEdited?: boolean;
  editedAt?: string | null;
  seenBy?: string[];
  oneTime?: boolean;
  attachments?: UploadedAttachment[];
  group?: (Pick<ChatGroup, 'id' | 'name' | 'avatar'> & { _id?: string }) | null;
  receiver?:
    | (Pick<ChatUser, 'id' | 'name' | 'registrationNumber' | 'avatar'> & { _id?: string })
    | null;
  sender?: Pick<ChatUser, 'id' | 'name' | 'registrationNumber' | 'avatar'> & { _id?: string };
}

export interface InboxConversation {
  id: string;
  type: 'private' | 'group';
  threadId: string;
  name: string;
  unreadCount: number;
  lastMessageAt: string;
  lastMessagePreview: string;
  peer?: ChatUser;
  group?: ChatGroup;
}

export interface PermissionRequest {
  id: string;
  _id?: string;
  requesterId: string;
  targetId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  createdAt: string;
  expiresAt?: string | null;
  adminRemark?: string | null;
  requester?: Pick<ChatUser, 'id' | 'name' | 'registrationNumber' | 'role'> | null;
  target?: Pick<ChatUser, 'id' | 'name' | 'registrationNumber' | 'role'> | null;
}

export interface ChatPermission {
  id: string;
  _id?: string;
  userAId: string;
  userBId: string;
  isActive: boolean;
  expiresAt?: string | null;
  createdAt: string;
  userA?: Pick<ChatUser, 'id' | 'name' | 'registrationNumber'> | null;
  userB?: Pick<ChatUser, 'id' | 'name' | 'registrationNumber'> | null;
}

export interface BackendResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  } | null;
}

export interface LoginResult {
  user?: ChatUser;
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
  requiresTwoFactor?: boolean;
  twoFactor?: TwoFactorChallengePayload;
  debugCode?: string;
}

export interface RegisterPayload {
  name: string;
  registrationNumber: string;
  email: string;
  password: string;
}

export type DensityMode = 'comfortable' | 'compact';

export type ChatTarget =
  | { kind: 'private'; id: string; name: string; avatar?: string | null }
  | { kind: 'group'; id: string; name: string; avatar?: string | null };

export const SOCKET_EVENTS = {
  privateMessage: 'private_message',
  groupMessage: 'group_message',
  messageStatusUpdate: 'message_status_update',
  messageEdited: 'message_edited',
  messageDeleted: 'message_deleted',
  typingStart: 'typing_start',
  typingStop: 'typing_stop',
  permissionRequestCreated: 'permission_request_created',
  permissionRequestUpdated: 'permission_request_updated',
  notification: 'notification',
} as const;

export const normalizeId = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return '';
};
