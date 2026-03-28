import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Socket, io } from 'socket.io-client';
import axiosInstance, {
  clearStoredSession,
  getStoredAccessToken,
  storeSessionTokens,
} from '../api/axiosInstance';
import {
  BackendResponse,
  ChatGroup,
  ChatMessage,
  ChatPermission,
  ChatTarget,
  ChatUser,
  InboxConversation,
  LoginResult,
  NotificationItem,
  PermissionRequest,
  RegisterPayload,
  RecoveryCodeStatus,
  RecoveryCodesRegenerateResult,
  SOCKET_EVENTS,
  TwoFactorEnableVerifyResult,
  TwoFactorChallengePayload,
  UploadedAttachment,
  normalizeId,
} from '../types/chat';

const normalizeAttachment = (attachment: UploadedAttachment): UploadedAttachment => ({
  ...attachment,
  id: normalizeId(attachment.id || attachment._id),
});

const toAbsoluteAssetUrl = (value?: string | null): string | null => {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^(https?:|blob:|data:)/i.test(raw)) {
    return raw;
  }

  const baseApiUrl = String(axiosInstance.defaults.baseURL || `${window.location.origin}/api`);
  const apiOrigin = baseApiUrl.replace(/\/api\/?$/, '');
  const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;
  return `${apiOrigin}${normalizedPath}`;
};

const withAvatarCacheBuster = (value?: string | null): string | null => {
  const absolute = toAbsoluteAssetUrl(value);
  if (!absolute) return null;

  const separator = absolute.includes('?') ? '&' : '?';
  return `${absolute}${separator}v=${Date.now()}`;
};

const normalizeMessage = (msg: ChatMessage): ChatMessage => ({
  ...msg,
  id: normalizeId(msg.id || msg._id),
  senderId: normalizeId(msg.senderId),
  receiverId: msg.receiverId ? normalizeId(msg.receiverId) : null,
  groupId: msg.groupId ? normalizeId(msg.groupId) : null,
  attachments: Array.isArray(msg.attachments) ? msg.attachments.map(normalizeAttachment) : [],
  replyToId: msg.replyToId ? normalizeId(msg.replyToId) : null,
  replyTo: msg.replyTo
    ? {
        ...msg.replyTo,
        id: normalizeId(msg.replyTo.id || msg.replyTo._id),
        senderId: normalizeId(msg.replyTo.senderId),
        sender: msg.replyTo.sender
          ? {
              ...msg.replyTo.sender,
              id: normalizeId(msg.replyTo.sender.id || msg.replyTo.sender._id),
              avatar: toAbsoluteAssetUrl(msg.replyTo.sender.avatar || null),
            }
          : undefined,
      }
    : null,
  seenBy: Array.isArray(msg.seenBy) ? msg.seenBy.map((id) => normalizeId(id)) : undefined,
  sender: msg.sender
    ? {
        ...msg.sender,
        id: normalizeId(msg.sender.id || msg.sender._id),
        avatar: toAbsoluteAssetUrl(msg.sender.avatar || null),
      }
    : undefined,
  receiver: msg.receiver
    ? {
        ...msg.receiver,
        id: normalizeId(msg.receiver.id || msg.receiver._id),
        avatar: toAbsoluteAssetUrl(msg.receiver.avatar || null),
      }
    : null,
  group: msg.group
    ? {
        ...msg.group,
        id: normalizeId(msg.group.id || msg.group._id),
        avatar: toAbsoluteAssetUrl(msg.group.avatar || null),
      }
    : null,
});

const sortMessagesByTimeAsc = (list: ChatMessage[]): ChatMessage[] =>
  [...list].sort((a, b) => {
    const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }

    return a.id.localeCompare(b.id);
  });

const MESSAGE_EDIT_WINDOW_MS = 5 * 60 * 1000;

const canEditWithinWindow = (message: ChatMessage, userId: string): boolean => {
  if (message.senderId !== userId) {
    return false;
  }

  if (!message.createdAt) {
    return false;
  }

  const ageMs = Date.now() - new Date(message.createdAt).getTime();
  if (Number.isNaN(ageMs)) {
    return false;
  }

  return ageMs <= MESSAGE_EDIT_WINDOW_MS;
};

const isMessageInActiveTarget = (message: ChatMessage, activeTarget: ChatTarget | null): boolean => {
  if (!activeTarget) {
    return false;
  }

  if (activeTarget.kind === 'private') {
    return message.messageType === 'private' &&
      (message.senderId === activeTarget.id || normalizeId(message.receiverId) === activeTarget.id);
  }

  return message.messageType === 'group' && normalizeId(message.groupId) === activeTarget.id;
};

const getManagedRoleByActor = (actorRole?: ChatUser['role']): ChatUser['role'] => {
  if (actorRole === 'superadmin') {
    return 'admin';
  }
  return 'user';
};

const normalizeInboxConversation = (item: InboxConversation): InboxConversation => ({
  ...item,
  id: normalizeId(item.id),
  threadId: normalizeId(item.threadId),
  peer: item.peer
    ? {
        ...item.peer,
        id: normalizeId(item.peer.id || item.peer._id),
        avatar: toAbsoluteAssetUrl(item.peer.avatar || null),
      }
    : undefined,
  group: item.group
    ? {
        ...item.group,
        id: normalizeId(item.group.id || item.group._id),
        avatar: toAbsoluteAssetUrl(item.group.avatar || null),
      }
    : undefined,
});

const normalizeUser = (
  user: ChatUser,
  options?: {
    avatarPublicUrl?: string | null;
  }
): ChatUser => ({
  ...user,
  id: normalizeId(user.id || user._id),
  avatar: toAbsoluteAssetUrl(
    options?.avatarPublicUrl ??
      user.avatar ??
      (user as ChatUser & { avatarFile?: { publicUrl?: string | null } }).avatarFile?.publicUrl ??
      null
  ),
});

const normalizeGroup = (group: ChatGroup): ChatGroup => ({
  ...group,
  id: normalizeId(group.id || group._id),
  createdById: group.createdById ? normalizeId(group.createdById) : undefined,
  createdBy: group.createdBy
    ? {
        ...group.createdBy,
        id: normalizeId(group.createdBy.id || group.createdBy._id),
      }
    : null,
  members: Array.isArray(group.members)
    ? group.members.map((member) => ({
        ...member,
        id: normalizeId(member.id || member._id),
      }))
    : [],
});

export const useChatApp = () => {
  const typingStopTimeoutRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [inboxConversations, setInboxConversations] = useState<InboxConversation[]>([]);
  const [activeTarget, setActiveTarget] = useState<ChatTarget | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [typingFromUser, setTypingFromUser] = useState<ChatUser | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const [messageSearchTerm, setMessageSearchTerm] = useState('');
  const [messageSearchResults, setMessageSearchResults] = useState<ChatMessage[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [permissionsBusy, setPermissionsBusy] = useState(false);
  const [permissionTargetUserId, setPermissionTargetUserId] = useState('');
  const [permissionReason, setPermissionReason] = useState('Need to discuss project task details.');
  const [permissionExpiresAt, setPermissionExpiresAt] = useState('');

  const [chatPermissions, setChatPermissions] = useState<ChatPermission[]>([]);
  const [chatPermissionsBusy, setChatPermissionsBusy] = useState(false);
  const [adminRemark, setAdminRemark] = useState('');
  const [adminExpiresAt, setAdminExpiresAt] = useState('');

  const [isAuthModeLogin, setIsAuthModeLogin] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [pendingTwoFactorLogin, setPendingTwoFactorLogin] =
    useState<TwoFactorChallengePayload | null>(null);
  const [pendingTwoFactorDebugCode, setPendingTwoFactorDebugCode] = useState<string | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [error, setError] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerData, setRegisterData] = useState<RegisterPayload>({
    name: '',
    registrationNumber: '',
    email: '',
    password: '',
  });

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications]
  );

  const isAdminView = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  const connectSocket = useCallback((token: string) => {
    const baseApiUrl = axiosInstance.defaults.baseURL || 'http://localhost:3000/api';
    const socketUrl = baseApiUrl.replace(/\/api\/?$/, '');

    const nextSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      auth: { token },
    });

    setSocket(nextSocket);
  }, []);

  const applyIncomingMessage = useCallback((incoming: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((msg) => msg.id === incoming.id || msg._id === incoming._id)) {
        return prev;
      }
      return sortMessagesByTimeAsc([...prev, incoming]);
    });
  }, []);

  const bootstrapSession = useCallback(async () => {
    const token = getStoredAccessToken();
    if (!token) {
      return;
    }

    try {
      const meRes = await axiosInstance.get<BackendResponse<ChatUser>>('/auth/me');
      const me = meRes.data.data;
      setCurrentUser(normalizeUser(me));
      connectSocket(token);
    } catch {
      clearStoredSession();
      setCurrentUser(null);
    }
  }, [connectSocket]);

  const loadGroups = useCallback(async () => {
    const res = await axiosInstance.get<BackendResponse<ChatGroup[]>>('/groups/my');
    const normalizedGroups = res.data.data.map((group) => normalizeGroup(group));
    setGroups(normalizedGroups);
  }, []);

  const loadNotifications = useCallback(async () => {
    const res = await axiosInstance.get<BackendResponse<NotificationItem[]>>('/notifications');
    const normalizedNotifications = res.data.data.map((item) => ({
      ...item,
      id: normalizeId(item.id || item._id),
    }));
    setNotifications(normalizedNotifications);
  }, []);

  const loadInboxConversations = useCallback(async () => {
    if (!currentUser) {
      setInboxConversations([]);
      return;
    }

    const res = await axiosInstance.get<BackendResponse<InboxConversation[]>>('/messages/inbox');
    setInboxConversations(res.data.data.map((item) => normalizeInboxConversation(item)));
  }, [currentUser]);

  const markMessagesRead = useCallback(
    async (messageIds: string[]) => {
      if (messageIds.length === 0) {
        return;
      }

      await Promise.allSettled(
        messageIds.map((messageId) => axiosInstance.patch(`/messages/${messageId}/read`))
      );
      await loadInboxConversations();
    },
    [loadInboxConversations]
  );

  const markConversationReadIfNeeded = useCallback(
    async (conversationMessages: ChatMessage[], target: ChatTarget, userId: string) => {
      const unreadMessageIds = conversationMessages
        .filter((message) => {
          if (message.senderId === userId) {
            return false;
          }

          if (target.kind === 'private') {
            return message.status !== 'read';
          }

          const seenBy = Array.isArray(message.seenBy) ? message.seenBy : [];
          return !seenBy.includes(userId);
        })
        .map((message) => message.id);

      if (unreadMessageIds.length === 0) {
        return;
      }

      await markMessagesRead(unreadMessageIds);
    },
    [markMessagesRead]
  );

  const loadPermissions = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    setPermissionsBusy(true);
    try {
      const res = await axiosInstance.get<BackendResponse<PermissionRequest[]>>('/permissions', {
        params: { page: 1, limit: 50 },
      });
      const normalized = res.data.data.map((item) => ({
        ...item,
        id: normalizeId(item.id || item._id),
        requesterId: normalizeId(item.requesterId),
        targetId: normalizeId(item.targetId),
      }));
      setPermissions(normalized);
    } finally {
      setPermissionsBusy(false);
    }
  }, [currentUser]);

  const loadChatPermissions = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    setChatPermissionsBusy(true);
    try {
      const res = await axiosInstance.get<BackendResponse<ChatPermission[]>>(
        '/permissions/chat-permissions',
        {
          params: { page: 1, limit: 50 },
        }
      );
      const normalized = res.data.data.map((item) => ({
        ...item,
        id: normalizeId(item.id || item._id),
        userAId: normalizeId(item.userAId),
        userBId: normalizeId(item.userBId),
      }));
      setChatPermissions(normalized);
    } finally {
      setChatPermissionsBusy(false);
    }
  }, [currentUser]);

  const loadManagedUsers = useCallback(async (roleFilter?: ChatUser['role']) => {
    if (!currentUser) {
      return;
    }

    const managedRole = roleFilter || getManagedRoleByActor(currentUser.role);
    const res = await axiosInstance.get<BackendResponse<ChatUser[]>>('/users', {
      params: { role: managedRole, page: 1, limit: 200 },
    });

    const normalizedUsers = res.data.data.map((user) => normalizeUser(user));

    setUsers(normalizedUsers.filter((item) => item.id !== currentUser.id));
  }, [currentUser]);

  const createGroup = useCallback(
    async (payload: { name: string; description?: string; memberIds?: string[] }) => {
      const safeName = payload.name.trim();
      const safeDescription = (payload.description || '').trim();
      const memberIds = [...new Set((payload.memberIds || []).map((id) => normalizeId(id)).filter(Boolean))];

      if (!safeName) {
        throw new Error('Group name is required.');
      }

      const createdRes = await axiosInstance.post<BackendResponse<ChatGroup>>('/groups', {
        name: safeName,
        description: safeDescription,
      });

      const createdGroup = createdRes.data.data;
      const createdGroupId = normalizeId(createdGroup.id || createdGroup._id);

      if (createdGroupId && memberIds.length > 0) {
        await axiosInstance.post(`/groups/${createdGroupId}/add-members`, {
          members: memberIds,
        });
      }

      await Promise.all([loadGroups(), loadInboxConversations()]);

      return {
        ...normalizeGroup(createdGroup),
        id: createdGroupId,
        _id: createdGroupId,
      };
    },
    [loadGroups, loadInboxConversations]
  );

  const updateGroup = useCallback(
    async (groupId: string, payload: { name?: string; description?: string }) => {
      const safeGroupId = normalizeId(groupId);
      if (!safeGroupId) {
        throw new Error('Invalid group id.');
      }

      const res = await axiosInstance.put<BackendResponse<ChatGroup>>(`/groups/${safeGroupId}`, {
        ...(typeof payload.name === 'string' ? { name: payload.name.trim() } : {}),
        ...(typeof payload.description === 'string'
          ? { description: payload.description.trim() }
          : {}),
      });

      const updated = normalizeGroup(res.data.data);
      await loadGroups();
      return updated;
    },
    [loadGroups]
  );

  const addGroupMembers = useCallback(
    async (groupId: string, memberIds: string[]) => {
      const safeGroupId = normalizeId(groupId);
      const safeMembers = [...new Set(memberIds.map((id) => normalizeId(id)).filter(Boolean))];
      if (!safeGroupId || safeMembers.length === 0) {
        return null;
      }

      const res = await axiosInstance.post<BackendResponse<ChatGroup>>(
        `/groups/${safeGroupId}/add-members`,
        {
          members: safeMembers,
        }
      );

      const updated = normalizeGroup(res.data.data);
      await loadGroups();
      return updated;
    },
    [loadGroups]
  );

  const removeGroupMembers = useCallback(
    async (groupId: string, memberIds: string[]) => {
      const safeGroupId = normalizeId(groupId);
      const safeMembers = [...new Set(memberIds.map((id) => normalizeId(id)).filter(Boolean))];
      if (!safeGroupId || safeMembers.length === 0) {
        return null;
      }

      const res = await axiosInstance.post<BackendResponse<ChatGroup>>(
        `/groups/${safeGroupId}/remove-members`,
        {
          members: safeMembers,
        }
      );

      const updated = normalizeGroup(res.data.data);
      await loadGroups();
      return updated;
    },
    [loadGroups]
  );

  const transferGroupOwnership = useCallback(
    async (groupId: string, newOwnerId: string) => {
      const safeGroupId = normalizeId(groupId);
      const safeOwnerId = normalizeId(newOwnerId);
      if (!safeGroupId || !safeOwnerId) {
        throw new Error('Invalid transfer details.');
      }

      const res = await axiosInstance.patch<BackendResponse<ChatGroup>>(
        `/groups/${safeGroupId}/transfer-ownership`,
        {
          newOwnerId: safeOwnerId,
        }
      );

      const updated = normalizeGroup(res.data.data);
      await loadGroups();
      return updated;
    },
    [loadGroups]
  );

  const leaveGroup = useCallback(
    async (groupId: string) => {
      const safeGroupId = normalizeId(groupId);
      if (!safeGroupId) {
        throw new Error('Invalid group id.');
      }

      await axiosInstance.post(`/groups/${safeGroupId}/leave`);

      if (activeTarget?.kind === 'group' && activeTarget.id === safeGroupId) {
        setActiveTarget(null);
        setMessages([]);
        setReplyToMessage(null);
        setEditingMessageId(null);
        setTypingFromUser(null);
      }

      await Promise.all([loadGroups(), loadInboxConversations()]);
    },
    [activeTarget, loadGroups, loadInboxConversations]
  );

  const deleteGroup = useCallback(
    async (groupId: string) => {
      const safeGroupId = normalizeId(groupId);
      if (!safeGroupId) {
        throw new Error('Invalid group id.');
      }

      await axiosInstance.delete(`/groups/${safeGroupId}`);

      if (activeTarget?.kind === 'group' && activeTarget.id === safeGroupId) {
        setActiveTarget(null);
        setMessages([]);
        setReplyToMessage(null);
        setEditingMessageId(null);
        setTypingFromUser(null);
      }

      await Promise.all([loadGroups(), loadInboxConversations()]);
    },
    [activeTarget, loadGroups, loadInboxConversations]
  );

  const promoteGroupAdmin = useCallback(
    async (groupId: string, userId: string) => {
      const safeGroupId = normalizeId(groupId);
      const safeUserId = normalizeId(userId);
      if (!safeGroupId || !safeUserId) {
        throw new Error('Invalid promotion details.');
      }

      const res = await axiosInstance.patch<BackendResponse<ChatGroup>>(
        `/groups/${safeGroupId}/admins/promote`,
        {
          userId: safeUserId,
        }
      );

      const updated = normalizeGroup(res.data.data);
      await loadGroups();
      return updated;
    },
    [loadGroups]
  );

  const demoteGroupAdmin = useCallback(
    async (groupId: string, userId: string) => {
      const safeGroupId = normalizeId(groupId);
      const safeUserId = normalizeId(userId);
      if (!safeGroupId || !safeUserId) {
        throw new Error('Invalid demotion details.');
      }

      const res = await axiosInstance.patch<BackendResponse<ChatGroup>>(
        `/groups/${safeGroupId}/admins/demote`,
        {
          userId: safeUserId,
        }
      );

      const updated = normalizeGroup(res.data.data);
      await loadGroups();
      return updated;
    },
    [loadGroups]
  );

  const uploadGroupAvatar = useCallback(
    async (groupId: string, file: File) => {
      const safeGroupId = normalizeId(groupId);
      if (!safeGroupId) {
        throw new Error('Invalid group id.');
      }

      const formData = new FormData();
      formData.append('file', file);

      const res = await axiosInstance.post<BackendResponse<ChatGroup>>(
        `/groups/${safeGroupId}/avatar`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const updated = normalizeGroup(res.data.data);
      await Promise.all([loadGroups(), loadInboxConversations()]);

      if (activeTarget?.kind === 'group' && activeTarget.id === safeGroupId) {
        setActiveTarget({
          ...activeTarget,
          name: updated.name,
          avatar: updated.avatar || null,
        });
      }

      return updated;
    },
    [activeTarget, loadGroups, loadInboxConversations]
  );

  const searchUsers = useCallback(async () => {
    const query = userSearch.trim();
    if (!query) {
      await loadManagedUsers();
      return;
    }

    const res = await axiosInstance.get<BackendResponse<ChatUser[]>>('/users/search', {
      params: { q: query },
    });

    const normalizedUsers = res.data.data.map((user) => normalizeUser(user));
    setUsers(normalizedUsers.filter((item) => item.id !== currentUser?.id));
  }, [currentUser, loadManagedUsers, userSearch]);

  const createManagedUser = useCallback(
    async (payload: {
      name: string;
      registrationNumber: string;
      email: string;
      password: string;
      role?: ChatUser['role'];
    }) => {
      if (!currentUser) {
        return;
      }

      try {
        await axiosInstance.post('/users', payload);
        await loadManagedUsers(payload.role || undefined);
      } catch (requestError) {
        console.error(requestError);
        setError('Could not create this user. Check required fields and uniqueness.');
        throw requestError;
      }
    },
    [currentUser, loadManagedUsers]
  );

  const updateManagedUser = useCallback(
    async (
      userId: string,
      payload: {
        name?: string;
        registrationNumber?: string;
        email?: string;
        password?: string;
        role?: ChatUser['role'];
      }
    ) => {
      try {
        await axiosInstance.put(`/users/${userId}`, payload);
        await loadManagedUsers(payload.role || undefined);
      } catch (requestError) {
        console.error(requestError);
        setError('Could not update this user.');
        throw requestError;
      }
    },
    [loadManagedUsers]
  );

  const deleteManagedUser = useCallback(
    async (userId: string) => {
      try {
        await axiosInstance.delete(`/users/${userId}`);
        await loadManagedUsers();
      } catch (requestError) {
        console.error(requestError);
        setError('Could not delete this user.');
        throw requestError;
      }
    },
    [loadManagedUsers]
  );

  const loadConversation = useCallback(async (target: ChatTarget) => {
    setChatBusy(true);
    setError('');

    try {
      const endpoint =
        target.kind === 'private' ? `/messages/private/${target.id}` : `/messages/group/${target.id}`;
      const res = await axiosInstance.get<BackendResponse<ChatMessage[]>>(endpoint, {
        params: { page: 1, limit: 100 },
      });
      const normalizedMessages = res.data.data.map((msg) => normalizeMessage(msg));
      setMessages(sortMessagesByTimeAsc(normalizedMessages));

      if (target.kind === 'private') {
        const inboxAvatar = inboxConversations.find(
          (item) => item.type === 'private' && item.threadId === target.id
        )?.peer?.avatar;
        const userAvatar = users.find((item) => item.id === target.id)?.avatar;
        const latestMessageForPeer = [...normalizedMessages]
          .reverse()
          .find(
            (message) =>
              message.messageType === 'private' &&
              (message.senderId === target.id || normalizeId(message.receiverId) === target.id)
          );

        const messageAvatar =
          latestMessageForPeer?.senderId === target.id
            ? latestMessageForPeer?.sender?.avatar || null
            : latestMessageForPeer?.receiver?.avatar || null;

        setActiveTarget({
          ...target,
          avatar: target.avatar || inboxAvatar || userAvatar || messageAvatar || null,
        });
      } else {
        const inboxGroupAvatar = inboxConversations.find(
          (item) => item.type === 'group' && item.threadId === target.id
        )?.group?.avatar;

        setActiveTarget({
          ...target,
          avatar: target.avatar || inboxGroupAvatar || null,
        });
      }

      setTypingFromUser(null);
      setReplyToMessage(null);
      setEditingMessageId(null);
      if (currentUser?.id) {
        void markConversationReadIfNeeded(normalizedMessages, target, currentUser.id);
      }
      void loadInboxConversations();
    } catch (requestError) {
      console.error(requestError);
      setError('Could not load this conversation.');
      setMessages([]);
    } finally {
      setChatBusy(false);
    }
  }, [
    currentUser?.id,
    inboxConversations,
    loadInboxConversations,
    markConversationReadIfNeeded,
    users,
  ]);

  const uploadAttachments = useCallback(async (): Promise<string[]> => {
    if (pendingFiles.length === 0) {
      return [];
    }

    setUploadBusy(true);
    try {
      const formData = new FormData();
      pendingFiles.forEach((file) => {
        formData.append('files', file);
      });

      const res = await axiosInstance.post<BackendResponse<UploadedAttachment[]>>(
        '/messages/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return res.data.data.map((item) => normalizeId(item.id || item._id));
    } finally {
      setUploadBusy(false);
    }
  }, [pendingFiles]);

  const sendMessage = useCallback(async () => {
    const target = activeTarget;
    const content = messageText.trim();
    if (!target) {
      return;
    }

    if (editingMessageId) {
      if (!content) {
        setError('Edited message cannot be empty.');
        return;
      }

      if (pendingFiles.length > 0) {
        setError('Attachments cannot be changed while editing a message.');
        return;
      }

      try {
        const editedRes = await axiosInstance.patch<BackendResponse<ChatMessage>>(
          `/messages/${editingMessageId}`,
          { content }
        );
        const updatedMessage = normalizeMessage(editedRes.data.data);
        setMessages((prev) =>
          prev.map((msg) => (msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg))
        );
        setMessageText('');
        setEditingMessageId(null);
        await loadInboxConversations();
      } catch (requestError) {
        console.error(requestError);
        setError('Could not edit this message.');
      }
      return;
    }

    if (!content && pendingFiles.length === 0) {
      return;
    }

    try {
      const attachmentIds = await uploadAttachments();
      const endpoint = target.kind === 'private' ? '/messages/private' : '/messages/group';
      const payload =
        target.kind === 'private'
          ? { receiverId: target.id, content, attachmentIds, replyToId: replyToMessage?.id }
          : { groupId: target.id, content, attachmentIds, replyToId: replyToMessage?.id };

      await axiosInstance.post<BackendResponse<ChatMessage>>(endpoint, payload);
      setMessageText('');
      setPendingFiles([]);
      setReplyToMessage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await Promise.all([loadConversation(target), loadInboxConversations()]);
    } catch (requestError) {
      console.error(requestError);
      setError('Message send failed.');
    }
  }, [
    activeTarget,
    editingMessageId,
    loadConversation,
    loadInboxConversations,
    messageText,
    pendingFiles.length,
    replyToMessage?.id,
    uploadAttachments,
  ]);

  const startReply = useCallback((message: ChatMessage) => {
    setReplyToMessage(message);
    setEditingMessageId(null);
  }, []);

  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  const startEdit = useCallback(
    (message: ChatMessage) => {
      if (!currentUser) {
        return;
      }

      if (!canEditWithinWindow(message, currentUser.id)) {
        setError('Editing is allowed only within 5 minutes of sending.');
        return;
      }

      setReplyToMessage(null);
      setEditingMessageId(message.id);
      setMessageText(message.content || '');
    },
    [currentUser]
  );

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setMessageText('');
  }, []);

  const deleteChatMessage = useCallback(
    async (message: ChatMessage, deleteFor: 'me' | 'everyone') => {
      try {
        await axiosInstance.delete(`/messages/${message.id}`, {
          data: { deleteFor },
        });

        if (deleteFor === 'me') {
          setMessages((prev) => prev.filter((item) => item.id !== message.id));
        } else {
          setMessages((prev) =>
            prev.map((item) =>
              item.id === message.id
                ? { ...item, content: '[This message was deleted]', attachments: [], replyTo: null }
                : item
            )
          );
        }

        await loadInboxConversations();
      } catch (requestError) {
        console.error(requestError);
        setError(
          deleteFor === 'everyone'
            ? 'Could not delete for everyone. It may be outside the 5 minute limit.'
            : 'Could not delete this message for you.'
        );
      }
    },
    [loadInboxConversations]
  );

  const deleteConversation = useCallback(
    async (target: ChatTarget) => {
      try {
        const endpoint =
          target.kind === 'private'
            ? `/messages/private/${target.id}`
            : `/messages/group/${target.id}`;
        const res = await axiosInstance.delete<
          BackendResponse<{
            deletedFor: 'me';
            conversationType: 'private' | 'group';
            conversationId: string;
            deletedMessagesCount: number;
          }>
        >(endpoint);

        if (activeTarget?.id === target.id && activeTarget.kind === target.kind) {
          setActiveTarget(null);
          setMessages([]);
          setReplyToMessage(null);
          setEditingMessageId(null);
          setTypingFromUser(null);
        }

        await loadInboxConversations();
        return res.data.data;
      } catch (requestError) {
        console.error(requestError);
        setError('Could not delete this conversation.');
        throw requestError;
      }
    },
    [activeTarget, loadInboxConversations]
  );

  const searchMessages = useCallback(async () => {
    const query = messageSearchTerm.trim();
    if (!query) {
      setMessageSearchResults([]);
      return;
    }

    setSearchBusy(true);
    setError('');
    try {
      const res = await axiosInstance.get<BackendResponse<ChatMessage[]>>('/messages/search', {
        params: { q: query, page: 1, limit: 50 },
      });
      setMessageSearchResults(res.data.data.map((msg) => normalizeMessage(msg)));
    } catch (requestError) {
      console.error(requestError);
      setError('Could not search messages right now.');
    } finally {
      setSearchBusy(false);
    }
  }, [messageSearchTerm]);

  useEffect(() => {
    const query = messageSearchTerm.trim();
    if (!query) {
      setMessageSearchResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void searchMessages();
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [messageSearchTerm, searchMessages]);

  const openSearchResult = useCallback(
    async (message: ChatMessage) => {
      if (!currentUser) {
        return;
      }

      if (message.messageType === 'group' && message.groupId) {
        const groupName = message.group?.name || 'Group';
        await loadConversation({
          kind: 'group',
          id: message.groupId,
          name: groupName,
          avatar: message.group?.avatar || null,
        });
        return;
      }

      const peerId =
        message.senderId === currentUser.id
          ? normalizeId(message.receiverId)
          : normalizeId(message.senderId);
      if (!peerId) {
        return;
      }

      const peerName =
        message.senderId === currentUser.id
          ? message.receiver?.name || 'User'
          : message.sender?.name || 'User';
      const peerAvatar =
        message.senderId === currentUser.id ? message.receiver?.avatar || null : message.sender?.avatar || null;
      await loadConversation({ kind: 'private', id: peerId, name: peerName, avatar: peerAvatar });
    },
    [currentUser, loadConversation]
  );

  const createPermissionRequest = useCallback(async () => {
    const targetUserId = permissionTargetUserId.trim();
    const reason = permissionReason.trim();

    if (!targetUserId || !reason) {
      setError('Choose a user and provide a reason to request permission.');
      return;
    }

    try {
      await axiosInstance.post('/permissions/request', {
        targetUserId,
        reason,
        expiresAt: permissionExpiresAt ? new Date(permissionExpiresAt).toISOString() : null,
      });
      setPermissionReason('Need to discuss project task details.');
      setPermissionExpiresAt('');
      await loadPermissions();
      await loadNotifications();
    } catch (requestError) {
      console.error(requestError);
      setError('Permission request failed. Ensure the users are cross-group and active.');
    }
  }, [loadNotifications, loadPermissions, permissionExpiresAt, permissionReason, permissionTargetUserId]);

  const updatePermissionRequest = useCallback(
    async (requestId: string, action: 'approve' | 'reject') => {
      try {
        await axiosInstance.patch(`/permissions/${requestId}/${action}`, {
          adminRemark: adminRemark.trim() || null,
          expiresAt:
            action === 'approve' && adminExpiresAt
              ? new Date(adminExpiresAt).toISOString()
              : undefined,
        });
        await Promise.all([loadPermissions(), loadChatPermissions(), loadNotifications()]);
      } catch (requestError) {
        console.error(requestError);
        setError(`Could not ${action} this permission request.`);
      }
    },
    [adminExpiresAt, adminRemark, loadChatPermissions, loadNotifications, loadPermissions]
  );

  const revokeChatPermission = useCallback(
    async (permissionId: string) => {
      try {
        await axiosInstance.patch(`/permissions/chat/${permissionId}/revoke`);
        await Promise.all([loadChatPermissions(), loadPermissions()]);
      } catch (requestError) {
        console.error(requestError);
        setError('Could not revoke chat permission.');
      }
    },
    [loadChatPermissions, loadPermissions]
  );

  const emitTypingStart = useCallback(() => {
    if (!socket || !activeTarget) {
      return;
    }
    socket.emit(SOCKET_EVENTS.typingStart, {
      type: activeTarget.kind,
      targetId: activeTarget.id,
    });
  }, [activeTarget, socket]);

  const emitTypingStop = useCallback(() => {
    if (!socket || !activeTarget) {
      return;
    }
    socket.emit(SOCKET_EVENTS.typingStop, {
      type: activeTarget.kind,
      targetId: activeTarget.id,
    });
  }, [activeTarget, socket]);

  const handleMessageInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const nextValue = event.target.value;
      setMessageText(nextValue);

      if (!activeTarget) {
        return;
      }

      if (nextValue.trim()) {
        emitTypingStart();
      }

      if (typingStopTimeoutRef.current) {
        window.clearTimeout(typingStopTimeoutRef.current);
      }

      typingStopTimeoutRef.current = window.setTimeout(() => {
        emitTypingStop();
      }, 1200);
    },
    [activeTarget, emitTypingStart, emitTypingStop]
  );

  const handleComposerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void sendMessage();
      }
    },
    [sendMessage]
  );

  const handleFileSelection = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    if (selected.length === 0) {
      return;
    }
    setPendingFiles((prev) => [...prev, ...selected].slice(0, 10));
  }, []);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const clearPendingFiles = useCallback(() => {
    setPendingFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    try {
      await axiosInstance.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      );
    } catch (requestError) {
      console.error(requestError);
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await axiosInstance.patch('/notifications/read-all');
      setNotifications((prev) =>
        prev.map((item) =>
          item.isRead
            ? item
            : {
                ...item,
                isRead: true,
              }
        )
      );
    } catch (requestError) {
      console.error(requestError);
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await axiosInstance.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((item) => item.id !== id));
    } catch (requestError) {
      console.error(requestError);
    }
  }, []);

  const deleteNotificationsBulk = useCallback(async (ids: string[]) => {
    const safeIds = [...new Set(ids.map((id) => normalizeId(id)).filter(Boolean))];
    if (safeIds.length === 0) {
      return;
    }

    try {
      await axiosInstance.delete('/notifications', {
        data: { ids: safeIds },
      });
      setNotifications((prev) => prev.filter((item) => !safeIds.includes(item.id)));
    } catch (requestError) {
      console.error(requestError);
    }
  }, []);

  const updateMyProfile = useCallback(
    async (payload: {
      name?: string;
      email?: string;
      registrationNumber?: string;
      password?: string;
    }) => {
      if (!currentUser) {
        throw new Error('User session missing');
      }

      const res = await axiosInstance.put<BackendResponse<ChatUser>>(`/users/${currentUser.id}`, payload);
      const updated = res.data.data;
      const normalizedUpdated = normalizeUser(updated);
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              ...normalizedUpdated,
              avatar: normalizedUpdated.avatar || prev.avatar || null,
            }
          : prev
      );

      return updated;
    },
    [currentUser]
  );

  const uploadMyAvatar = useCallback(async (file: File) => {
    if (!currentUser) {
      throw new Error('User session missing');
    }

    const formData = new FormData();
    formData.append('file', file);

    const res = await axiosInstance.post<
      BackendResponse<{ user: ChatUser; avatarFile?: { publicUrl?: string | null } }>
    >('/users/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const updated = res.data.data.user;
    const avatarPublicUrl = res.data.data.avatarFile?.publicUrl || null;

    // Re-fetch /auth/me so frontend always receives the same canonical shape used during boot.
    let refreshedUser: ChatUser | null = null;
    try {
      const meRes = await axiosInstance.get<BackendResponse<ChatUser>>('/auth/me');
      refreshedUser = meRes.data.data;
    } catch {
      refreshedUser = null;
    }

    const sourceUser = refreshedUser || updated;
    const normalized = normalizeUser(sourceUser, { avatarPublicUrl });
    const syncedAvatar = withAvatarCacheBuster(normalized.avatar || avatarPublicUrl);
    const normalizedWithSyncedAvatar: ChatUser = {
      ...normalized,
      avatar: syncedAvatar,
    };

    setCurrentUser((prev) =>
      prev
        ? {
            ...prev,
            ...normalizedWithSyncedAvatar,
          }
        : prev
    );

    // Keep all already-loaded UI collections in sync so avatar changes are visible immediately.
    setUsers((prev) =>
      prev.map((user) => (user.id === currentUser.id ? { ...user, avatar: syncedAvatar } : user))
    );

    setMessages((prev) =>
      prev.map((message) => ({
        ...message,
        sender:
          message.sender && message.sender.id === currentUser.id
            ? { ...message.sender, avatar: syncedAvatar }
            : message.sender,
        receiver:
          message.receiver && message.receiver.id === currentUser.id
            ? { ...message.receiver, avatar: syncedAvatar }
            : message.receiver,
      }))
    );

    setInboxConversations((prev) =>
      prev.map((item) =>
        item.type === 'private' && item.peer?.id === currentUser.id
          ? {
              ...item,
              peer: item.peer ? { ...item.peer, avatar: syncedAvatar } : item.peer,
            }
          : item
      )
    );

    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        members: Array.isArray(group.members)
          ? group.members.map((member) =>
              member.id === currentUser.id ? { ...member, avatar: syncedAvatar } : member
            )
          : group.members,
      }))
    );

    setActiveTarget((prev) => {
      if (!prev || prev.kind !== 'private' || prev.id !== currentUser.id) {
        return prev;
      }

      return {
        ...prev,
        avatar: syncedAvatar,
      };
    });

    return {
      ...updated,
      avatar: syncedAvatar,
    };
  }, [currentUser]);

  const handleLogin = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setAuthBusy(true);
      setError('');

      try {
        const loginRes = await axiosInstance.post<BackendResponse<LoginResult>>('/auth/login', {
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword,
        });

        const loginResult = loginRes.data.data;

        if (loginResult.requiresTwoFactor) {
          if (!loginResult.twoFactor?.challengeId) {
            setError('Two-factor login challenge missing. Please retry sign in.');
            return;
          }

          setPendingTwoFactorLogin(loginResult.twoFactor);
          setPendingTwoFactorDebugCode(loginResult.debugCode || null);
          setError('Enter your 6-digit two-factor code to complete sign in.');
          return;
        }

        if (!loginResult.tokens || !loginResult.user) {
          setError('Unexpected login response from server.');
          return;
        }

        storeSessionTokens(loginResult.tokens.accessToken, loginResult.tokens.refreshToken);
        const signedInUser = {
          ...normalizeUser(loginResult.user),
        };
        setPendingTwoFactorLogin(null);
        setPendingTwoFactorDebugCode(null);
        setCurrentUser(signedInUser);
        connectSocket(loginResult.tokens.accessToken);
      } catch (requestError) {
        console.error(requestError);
        setError('Login failed. Verify your email/password and try again.');
      } finally {
        setAuthBusy(false);
      }
    },
    [connectSocket, loginEmail, loginPassword]
  );

  const verifyLoginTwoFactor = useCallback(
    async (code: string) => {
      if (!pendingTwoFactorLogin?.challengeId) {
        throw new Error('No two-factor login challenge is active.');
      }

      const res = await axiosInstance.post<BackendResponse<LoginResult>>('/auth/2fa/login/verify', {
        challengeId: pendingTwoFactorLogin.challengeId,
        code: code.trim(),
      });

      const loginResult = res.data.data;
      if (!loginResult.tokens || !loginResult.user) {
        throw new Error('Unexpected two-factor verification response from server.');
      }

      storeSessionTokens(loginResult.tokens.accessToken, loginResult.tokens.refreshToken);
      setPendingTwoFactorLogin(null);
      setPendingTwoFactorDebugCode(null);

      const signedInUser = {
        ...normalizeUser(loginResult.user),
      };
      setCurrentUser(signedInUser);
      connectSocket(loginResult.tokens.accessToken);
      setError('');
    },
    [connectSocket, pendingTwoFactorLogin]
  );

  const cancelTwoFactorLogin = useCallback(() => {
    setPendingTwoFactorLogin(null);
    setPendingTwoFactorDebugCode(null);
    setError('');
  }, []);

  const handleRegister = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setAuthBusy(true);
      setError('');

      try {
        await axiosInstance.post('/auth/register', {
          name: registerData.name.trim(),
          registrationNumber: registerData.registrationNumber.trim().toUpperCase(),
          email: registerData.email.trim().toLowerCase(),
          password: registerData.password,
        });

        setIsAuthModeLogin(true);
        setLoginEmail(registerData.email.trim().toLowerCase());
        setRegisterData({ name: '', registrationNumber: '', email: '', password: '' });
      } catch (requestError) {
        console.error(requestError);
        setError('Registration failed. Check your details and try again.');
      } finally {
        setAuthBusy(false);
      }
    },
    [registerData]
  );

  const handleLogout = useCallback(() => {
    clearStoredSession();
    if (typingStopTimeoutRef.current) {
      window.clearTimeout(typingStopTimeoutRef.current);
    }
    socket?.disconnect();
    setSocket(null);
    setCurrentUser(null);
    setPendingTwoFactorLogin(null);
    setPendingTwoFactorDebugCode(null);
    setMessages([]);
    setGroups([]);
    setUsers([]);
    setInboxConversations([]);
    setNotifications([]);
    setActiveTarget(null);
  }, [socket]);

  const startEnableTwoFactor = useCallback(async () => {
    const res = await axiosInstance.post<
      BackendResponse<TwoFactorChallengePayload & { debugCode?: string }>
    >('/auth/2fa/enable', {});

    return {
      challenge: res.data.data,
      debugCode: res.data.data.debugCode || null,
    };
  }, []);

  const verifyEnableTwoFactor = useCallback(async (challengeId: string, code: string) => {
    const res = await axiosInstance.post<BackendResponse<TwoFactorEnableVerifyResult>>(
      '/auth/2fa/enable/verify',
      {
      challengeId,
      code: code.trim(),
      }
    );

    const updated = normalizeUser(res.data.data.user);
    setCurrentUser((prev) =>
      prev
        ? {
            ...prev,
            ...updated,
          }
        : prev
    );

    return {
      user: updated,
      recoveryCodes: Array.isArray(res.data.data.recoveryCodes) ? res.data.data.recoveryCodes : [],
    };
  }, []);

  const disableTwoFactor = useCallback(async (code: string) => {
    const res = await axiosInstance.post<BackendResponse<ChatUser>>('/auth/2fa/disable', {
      code,
    });

    const updated = normalizeUser(res.data.data);
    setCurrentUser((prev) =>
      prev
        ? {
            ...prev,
            ...updated,
          }
        : prev
    );

    return updated;
  }, []);

  const getRecoveryCodeStatus = useCallback(async () => {
    const res = await axiosInstance.get<BackendResponse<RecoveryCodeStatus>>(
      '/auth/2fa/recovery-codes/status'
    );
    return res.data.data;
  }, []);

  const regenerateRecoveryCodes = useCallback(async (currentPassword: string) => {
    const res = await axiosInstance.post<BackendResponse<RecoveryCodesRegenerateResult>>(
      '/auth/2fa/recovery-codes/regenerate',
      {
        currentPassword,
      }
    );

    return {
      recoveryCodes: Array.isArray(res.data.data.recoveryCodes) ? res.data.data.recoveryCodes : [],
      status: res.data.data.status,
    };
  }, []);

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    void loadGroups();
    void loadNotifications();
    void loadPermissions();
    void loadChatPermissions();
    void loadManagedUsers();
    void loadInboxConversations();
  }, [
    currentUser,
    loadChatPermissions,
    loadGroups,
    loadInboxConversations,
    loadManagedUsers,
    loadNotifications,
    loadPermissions,
  ]);

  useEffect(() => {
    return () => {
      if (typingStopTimeoutRef.current) {
        window.clearTimeout(typingStopTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.on(SOCKET_EVENTS.privateMessage, (payload: ChatMessage) => {
      const normalized = normalizeMessage(payload);
      const shouldShowInOpenThread = isMessageInActiveTarget(normalized, activeTarget);

      if (shouldShowInOpenThread) {
        applyIncomingMessage(normalized);
      }

      if (shouldShowInOpenThread && currentUser && normalized.senderId !== currentUser.id) {
        void markMessagesRead([normalized.id]);
      }

      void loadInboxConversations();
    });

    socket.on(SOCKET_EVENTS.groupMessage, (payload: ChatMessage) => {
      const normalized = normalizeMessage(payload);
      const shouldShowInOpenThread = isMessageInActiveTarget(normalized, activeTarget);

      if (shouldShowInOpenThread) {
        applyIncomingMessage(normalized);
      }

      if (shouldShowInOpenThread && currentUser && normalized.senderId !== currentUser.id) {
        void markMessagesRead([normalized.id]);
      }

      void loadInboxConversations();
    });

    socket.on(
      SOCKET_EVENTS.messageStatusUpdate,
      (payload: { messageId: string; status: string; tick?: ChatMessage['tick'] }) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === payload.messageId
              ? { ...msg, status: payload.status, tick: payload.tick || msg.tick }
              : msg
          )
        );
      }
    );

    socket.on(
      SOCKET_EVENTS.messageEdited,
      (payload: { messageId: string; content: string; isEdited: boolean }) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === payload.messageId
              ? { ...msg, content: payload.content, isEdited: payload.isEdited }
              : msg
          )
        );
      }
    );

    socket.on(
      SOCKET_EVENTS.messageDeleted,
      (payload: { messageId: string; deletedFor: 'everyone' | 'me' }) => {
        setMessages((prev) =>
          payload.deletedFor === 'everyone'
            ? prev.map((msg) =>
                msg.id === payload.messageId
                  ? { ...msg, content: '[This message was deleted]', attachments: [], replyTo: null }
                  : msg
              )
            : prev
        );
      }
    );

    socket.on(SOCKET_EVENTS.notification, () => {
      void loadNotifications();
      void loadPermissions();
      void loadChatPermissions();
      void loadInboxConversations();
    });

    socket.on(SOCKET_EVENTS.permissionRequestCreated, () => {
      void loadPermissions();
      void loadInboxConversations();
    });

    socket.on(SOCKET_EVENTS.permissionRequestUpdated, () => {
      void loadPermissions();
      void loadChatPermissions();
      void loadInboxConversations();
    });

    socket.on(
      SOCKET_EVENTS.typingStart,
      (payload: { from: string; type: 'private' | 'group'; groupId?: string }) => {
        if (!activeTarget || !currentUser) {
          return;
        }

        if (payload.from === currentUser.id) {
          return;
        }

        if (
          (activeTarget.kind === 'private' && payload.type === 'private' && payload.from === activeTarget.id) ||
          (activeTarget.kind === 'group' &&
            payload.type === 'group' &&
            normalizeId(payload.groupId) === activeTarget.id)
        ) {
          const foundUser = users.find((user) => user.id === payload.from);
          setTypingFromUser(
            foundUser || {
              id: payload.from,
              name: 'Someone',
              email: '',
              registrationNumber: '',
              role: 'user',
            }
          );
        }
      }
    );

    socket.on(
      SOCKET_EVENTS.typingStop,
      (payload: { from: string; type: 'private' | 'group'; groupId?: string }) => {
        if (!activeTarget) {
          return;
        }

        if (
          (activeTarget.kind === 'private' && payload.type === 'private' && payload.from === activeTarget.id) ||
          (activeTarget.kind === 'group' &&
            payload.type === 'group' &&
            normalizeId(payload.groupId) === activeTarget.id)
        ) {
          setTypingFromUser(null);
        }
      }
    );

    return () => {
      socket.removeAllListeners();
    };
  }, [
    activeTarget,
    applyIncomingMessage,
    currentUser,
    loadChatPermissions,
    markMessagesRead,
    loadInboxConversations,
    loadNotifications,
    loadPermissions,
    socket,
    users,
  ]);

  return {
    currentUser,
    isAdminView,
    isAuthModeLogin,
    authBusy,
    pendingTwoFactorLogin,
    pendingTwoFactorDebugCode,
    chatBusy,
    uploadBusy,
    error,
    loginEmail,
    loginPassword,
    registerData,

    groups,
    users,
    inboxConversations,
    userSearch,
    activeTarget,
    messages,
    messageText,
    replyToMessage,
    editingMessageId,
    pendingFiles,
    typingFromUser,

    messageSearchTerm,
    messageSearchResults,
    searchBusy,

    notifications,
    unreadNotifications,
    permissions,
    permissionsBusy,
    chatPermissions,
    chatPermissionsBusy,

    permissionTargetUserId,
    permissionReason,
    permissionExpiresAt,
    adminRemark,
    adminExpiresAt,

    fileInputRef,

    setIsAuthModeLogin,
    setLoginEmail,
    setLoginPassword,
    setRegisterData,

    setUserSearch,
    setMessageText,
    setMessageSearchTerm,

    setPermissionTargetUserId,
    setPermissionReason,
    setPermissionExpiresAt,
    setAdminRemark,
    setAdminExpiresAt,

    handleLogin,
    verifyLoginTwoFactor,
    cancelTwoFactorLogin,
    handleRegister,
    handleLogout,
    startEnableTwoFactor,
    verifyEnableTwoFactor,
    disableTwoFactor,
    getRecoveryCodeStatus,
    regenerateRecoveryCodes,

    searchUsers,
    loadManagedUsers,
    createGroup,
    updateGroup,
    addGroupMembers,
    removeGroupMembers,
    transferGroupOwnership,
    leaveGroup,
    deleteGroup,
    promoteGroupAdmin,
    demoteGroupAdmin,
    uploadGroupAvatar,
    loadInboxConversations,
    createManagedUser,
    updateManagedUser,
    deleteManagedUser,
    loadConversation,
    sendMessage,
    startReply,
    cancelReply,
    startEdit,
    cancelEdit,
    deleteChatMessage,
    deleteConversation,
    searchMessages,
    openSearchResult,

    createPermissionRequest,
    updatePermissionRequest,
    revokeChatPermission,

    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    deleteNotificationsBulk,
    updateMyProfile,
    uploadMyAvatar,
    handleMessageInputChange,
    handleComposerKeyDown,
    handleFileSelection,
    removePendingFile,
    clearPendingFiles,
  };
};
