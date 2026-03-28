import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Popconfirm, Space, Tag, notification } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ChatGroup,
  ChatMessage,
  ChatPermission,
  ChatUser,
  NotificationItem,
  PermissionRequest,
} from '../../types/chat';
import AppDataTable from '../ui/AppDataTable';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';

interface WorkspacePanelProps {
  activeScreen: 'conversations' | 'groups' | 'directory' | 'search' | 'permissions' | 'notifications';
  currentUser: ChatUser;
  users: ChatUser[];
  groups: ChatGroup[];
  loadManagedUsers: (roleFilter?: ChatUser['role']) => Promise<void>;
  searchUsers: () => Promise<void>;
  createGroup: (payload: {
    name: string;
    description?: string;
    memberIds?: string[];
  }) => Promise<ChatGroup>;
  updateGroup: (groupId: string, payload: { name?: string; description?: string }) => Promise<ChatGroup>;
  addGroupMembers: (groupId: string, memberIds: string[]) => Promise<ChatGroup | null>;
  removeGroupMembers: (groupId: string, memberIds: string[]) => Promise<ChatGroup | null>;
  transferGroupOwnership: (groupId: string, newOwnerId: string) => Promise<ChatGroup>;
  leaveGroup: (groupId: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  promoteGroupAdmin: (groupId: string, userId: string) => Promise<ChatGroup>;
  demoteGroupAdmin: (groupId: string, userId: string) => Promise<ChatGroup>;
  uploadGroupAvatar: (groupId: string, file: File) => Promise<ChatGroup>;
  createManagedUser: (payload: {
    name: string;
    registrationNumber: string;
    email: string;
    password: string;
    role?: ChatUser['role'];
  }) => Promise<void>;
  updateManagedUser: (
    userId: string,
    payload: {
      name?: string;
      registrationNumber?: string;
      email?: string;
      password?: string;
      role?: ChatUser['role'];
    }
  ) => Promise<void>;
  deleteManagedUser: (userId: string) => Promise<void>;
  loadConversation: (target: {
    kind: 'private' | 'group';
    id: string;
    name: string;
    avatar?: string | null;
  }) => Promise<void>;

  messageSearchTerm: string;
  setMessageSearchTerm: Dispatch<SetStateAction<string>>;
  searchMessages: () => Promise<void>;
  searchBusy: boolean;
  messageSearchResults: ChatMessage[];
  openSearchResult: (message: ChatMessage) => Promise<void>;

  setPermissionTargetUserId: Dispatch<SetStateAction<string>>;
  permissionReason: string;
  setPermissionReason: Dispatch<SetStateAction<string>>;
  permissionExpiresAt: string;
  setPermissionExpiresAt: Dispatch<SetStateAction<string>>;
  createPermissionRequest: () => Promise<void>;

  permissions: PermissionRequest[];
  permissionsBusy: boolean;
  isAdminView: boolean;
  adminRemark: string;
  setAdminRemark: Dispatch<SetStateAction<string>>;
  adminExpiresAt: string;
  setAdminExpiresAt: Dispatch<SetStateAction<string>>;
  updatePermissionRequest: (requestId: string, action: 'approve' | 'reject') => Promise<void>;

  chatPermissions: ChatPermission[];
  chatPermissionsBusy: boolean;
  revokeChatPermission: (permissionId: string) => Promise<void>;

  notifications: NotificationItem[];
  unreadNotifications: number;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteNotificationsBulk: (ids: string[]) => Promise<void>;

  onOpenSidebar: () => void;
}

const WorkspacePanel = ({
  activeScreen,
  currentUser,
  users,
  groups,
  loadManagedUsers,
  searchUsers,
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
  createManagedUser,
  updateManagedUser,
  deleteManagedUser,
  loadConversation,
  messageSearchTerm,
  setMessageSearchTerm,
  searchMessages,
  searchBusy,
  messageSearchResults,
  openSearchResult,
  setPermissionTargetUserId,
  permissionReason,
  setPermissionReason,
  permissionExpiresAt,
  setPermissionExpiresAt,
  createPermissionRequest,
  permissions,
  permissionsBusy,
  isAdminView,
  adminRemark,
  setAdminRemark,
  adminExpiresAt,
  setAdminExpiresAt,
  updatePermissionRequest,
  chatPermissions,
  chatPermissionsBusy,
  revokeChatPermission,
  notifications,
  unreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteNotificationsBulk,
  onOpenSidebar,
}: WorkspacePanelProps) => {
  const [notificationVisibleCount, setNotificationVisibleCount] = useState(30);
  const [showPermissionForm, setShowPermissionForm] = useState(false);
  const [permissionScreen, setPermissionScreen] = useState<'requests' | 'links'>('requests');
  const [selectedDirectoryUserId, setSelectedDirectoryUserId] = useState('');
  const [directoryForm, setDirectoryForm] = useState({
    name: '',
    registrationNumber: '',
    email: '',
    password: '',
    role: currentUser.role === 'superadmin' ? ('admin' as ChatUser['role']) : ('user' as ChatUser['role']),
  });
  const [directoryBusy, setDirectoryBusy] = useState(false);
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<string[]>([]);
  const [groupForm, setGroupForm] = useState({ name: '', description: '' });
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([]);
  const [groupCreateAvatarFile, setGroupCreateAvatarFile] = useState<File | null>(null);
  const [groupBusy, setGroupBusy] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupEditForm, setGroupEditForm] = useState({ name: '', description: '' });
  const [groupMemberAddIds, setGroupMemberAddIds] = useState<string[]>([]);
  const [groupMemberRemoveIds, setGroupMemberRemoveIds] = useState<string[]>([]);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [groupAvatarFile, setGroupAvatarFile] = useState<File | null>(null);
  const hasRequestedUsersRef = useRef(false);
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [directoryRoleScope, setDirectoryRoleScope] = useState<ChatUser['role']>(
    currentUser.role === 'superadmin' ? 'admin' : 'user'
  );

  const managedRoles =
    currentUser.role === 'superadmin'
      ? ['superadmin', 'admin']
      : currentUser.role === 'admin'
        ? ['user']
        : ['admin'];
  const managedRoleLabel =
    currentUser.role === 'superadmin' ? 'admins' : currentUser.role === 'admin' ? 'users' : 'admins';

  const managedUsersAll = useMemo(
    () => users.filter((user) => managedRoles.includes(user.role) && user.role === directoryRoleScope),
    [users, managedRoles, directoryRoleScope]
  );

  const formatUserOption = (user: ChatUser) => `${user.name} (${user.registrationNumber}) - ${user.email}`;

  const groupEligibleUsers = useMemo(() => {
    if (currentUser.role === 'superadmin') {
      return users.filter((user) => user.role === 'admin' || user.role === 'user');
    }

    if (currentUser.role === 'admin') {
      return users.filter((user) => user.role === 'user');
    }

    return [];
  }, [currentUser.role, users]);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  useEffect(() => {
    if (!selectedGroup) {
      setGroupEditForm({ name: '', description: '' });
      setGroupMemberAddIds([]);
      setGroupMemberRemoveIds([]);
      setNewOwnerId('');
      return;
    }

    setGroupEditForm({
      name: selectedGroup.name || '',
      description: selectedGroup.description || '',
    });
    setGroupMemberAddIds([]);
    setGroupMemberRemoveIds([]);
    setNewOwnerId('');
    setGroupAvatarFile(null);
  }, [selectedGroup]);

  const selectedGroupMembers = useMemo(
    () => (selectedGroup?.members ? selectedGroup.members : []),
    [selectedGroup]
  );

  const selectedGroupMemberIdsSet = useMemo(
    () => new Set(selectedGroupMembers.map((member) => member.id)),
    [selectedGroupMembers]
  );

  const addableGroupMembers = useMemo(
    () => groupEligibleUsers.filter((user) => !selectedGroupMemberIdsSet.has(user.id)),
    [groupEligibleUsers, selectedGroupMemberIdsSet]
  );

  const removableGroupMembers = useMemo(
    () =>
      selectedGroupMembers.filter((member) => member.id !== selectedGroup?.createdById),
    [selectedGroup?.createdById, selectedGroupMembers]
  );

  const transferOwnerCandidates = useMemo(
    () =>
      selectedGroupMembers.filter((member) => member.id !== selectedGroup?.createdById),
    [selectedGroup?.createdById, selectedGroupMembers]
  );

  const isSelectedGroupOwner = Boolean(
    selectedGroup && selectedGroup.createdById && selectedGroup.createdById === currentUser.id
  );

  useEffect(() => {
    if (!['directory', 'permissions'].includes(activeScreen)) {
      return;
    }

    if (users.length > 0 || hasRequestedUsersRef.current) {
      return;
    }

    hasRequestedUsersRef.current = true;
    if (activeScreen === 'directory') {
      void loadManagedUsers(directoryRoleScope);
      return;
    }

    void searchUsers();
  }, [activeScreen, users.length, searchUsers, loadManagedUsers, directoryRoleScope]);

  useEffect(() => {
    if (activeScreen !== 'directory') {
      return;
    }

    void loadManagedUsers(directoryRoleScope);
  }, [activeScreen, directoryRoleScope, loadManagedUsers]);

  const selectedDirectoryUser = useMemo(
    () => managedUsersAll.find((user) => user.id === selectedDirectoryUserId) || null,
    [managedUsersAll, selectedDirectoryUserId]
  );

  const selectManagedUser = (user: ChatUser | null) => {
    if (!user) {
      setSelectedDirectoryUserId('');
      setDirectoryForm({
        name: '',
        registrationNumber: '',
        email: '',
        password: '',
        role: currentUser.role === 'superadmin' ? directoryRoleScope : 'user',
      });
      return;
    }

    setSelectedDirectoryUserId(user.id);
    setDirectoryForm({
      name: user.name,
      registrationNumber: user.registrationNumber,
      email: user.email,
      password: '',
        role: user.role,
    });
  };

  const handleSubmitDirectoryForm = async () => {
    const payload = {
      name: directoryForm.name.trim(),
      registrationNumber: directoryForm.registrationNumber.trim().toUpperCase(),
      email: directoryForm.email.trim().toLowerCase(),
      ...(directoryForm.password.trim() ? { password: directoryForm.password.trim() } : {}),
      ...(currentUser.role === 'superadmin' ? { role: directoryForm.role } : {}),
    };

    if (!payload.name || !payload.registrationNumber || !payload.email) {
      notificationApi.warning({
        message: 'Missing fields',
        description: 'Name, registration number, and email are required.',
      });
      return;
    }

    if (!selectedDirectoryUserId && !payload.password) {
      notificationApi.warning({
        message: 'Password required',
        description: 'Password is required while adding a new user.',
      });
      return;
    }

    setDirectoryBusy(true);
    try {
      if (selectedDirectoryUserId) {
        await updateManagedUser(selectedDirectoryUserId, payload);
        notificationApi.success({
          message: 'User updated',
          description: 'Managed user information updated successfully.',
        });
      } else {
        await createManagedUser(payload as {
          name: string;
          registrationNumber: string;
          email: string;
          password: string;
          role?: ChatUser['role'];
        });
        notificationApi.success({
          message: 'User created',
          description: 'New managed user created successfully.',
        });
      }

      await loadManagedUsers(directoryRoleScope);
      selectManagedUser(null);
    } catch {
      notificationApi.error({
        message: 'Save failed',
        description: 'Could not save this user. Please check uniqueness and format.',
      });
    } finally {
      setDirectoryBusy(false);
    }
  };

  const handleDeleteDirectoryUser = async (userId: string) => {
    setDirectoryBusy(true);
    try {
      await deleteManagedUser(userId);
      await loadManagedUsers(directoryRoleScope);
      if (selectedDirectoryUserId === userId) {
        selectManagedUser(null);
      }
      notificationApi.success({
        message: 'User deleted',
        description: 'Managed user deleted successfully.',
      });
    } catch {
      notificationApi.error({
        message: 'Delete failed',
        description: 'Could not delete this user.',
      });
    } finally {
      setDirectoryBusy(false);
    }
  };

  const handleCreateGroup = async () => {
    const name = groupForm.name.trim();
    const description = groupForm.description.trim();

    if (!name) {
      notificationApi.warning({
        message: 'Missing group name',
        description: 'Group name is required.',
      });
      return;
    }

    setGroupBusy(true);
    try {
      const created = await createGroup({
        name,
        description,
        memberIds: selectedGroupMemberIds,
      });

      if (groupCreateAvatarFile) {
        await uploadGroupAvatar(created.id, groupCreateAvatarFile);
      }

      notificationApi.success({
        message: 'Group created',
        description: `${created.name} has been created successfully.`,
      });

      setGroupForm({ name: '', description: '' });
      setSelectedGroupMemberIds([]);
      setGroupCreateAvatarFile(null);
    } catch {
      notificationApi.error({
        message: 'Group creation failed',
        description: 'Could not create group. Verify permissions and try again.',
      });
    } finally {
      setGroupBusy(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!selectedGroup) {
      return;
    }

    setGroupBusy(true);
    try {
      await updateGroup(selectedGroup.id, {
        name: groupEditForm.name,
        description: groupEditForm.description,
      });
      notificationApi.success({
        message: 'Group updated',
        description: `${groupEditForm.name || selectedGroup.name} updated successfully.`,
      });
    } catch {
      notificationApi.error({
        message: 'Update failed',
        description: 'Could not update this group.',
      });
    } finally {
      setGroupBusy(false);
    }
  };

  const handleAddGroupMembers = async () => {
    if (!selectedGroup || groupMemberAddIds.length === 0) {
      return;
    }

    setGroupBusy(true);
    try {
      await addGroupMembers(selectedGroup.id, groupMemberAddIds);
      setGroupMemberAddIds([]);
      notificationApi.success({
        message: 'Members added',
        description: 'Selected members were added to the group.',
      });
    } catch {
      notificationApi.error({
        message: 'Add members failed',
        description: 'Could not add selected members.',
      });
    } finally {
      setGroupBusy(false);
    }
  };

  const handleRemoveGroupMembers = async () => {
    if (!selectedGroup || groupMemberRemoveIds.length === 0) {
      return;
    }

    setGroupBusy(true);
    try {
      await removeGroupMembers(selectedGroup.id, groupMemberRemoveIds);
      setGroupMemberRemoveIds([]);
      notificationApi.success({
        message: 'Members removed',
        description: 'Selected members were removed from the group.',
      });
    } catch {
      notificationApi.error({
        message: 'Remove members failed',
        description: 'Could not remove selected members.',
      });
    } finally {
      setGroupBusy(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedGroup || !newOwnerId) {
      return;
    }

    setGroupBusy(true);
    try {
      await transferGroupOwnership(selectedGroup.id, newOwnerId);
      setNewOwnerId('');
      notificationApi.success({
        message: 'Ownership transferred',
        description: 'Group ownership updated successfully.',
      });
    } catch {
      notificationApi.error({
        message: 'Transfer failed',
        description: 'Could not transfer group ownership.',
      });
    } finally {
      setGroupBusy(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup) {
      return;
    }

    const shouldLeave = window.confirm(`Leave group ${selectedGroup.name}?`);
    if (!shouldLeave) {
      return;
    }

    setGroupBusy(true);
    try {
      await leaveGroup(selectedGroup.id);
      setSelectedGroupId('');
      notificationApi.success({
        message: 'Left group',
        description: `You left ${selectedGroup.name}.`,
      });
    } catch {
      notificationApi.error({
        message: 'Leave failed',
        description: `Could not leave ${selectedGroup.name}.`,
      });
    } finally {
      setGroupBusy(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) {
      return;
    }

    const shouldDelete = window.confirm(`Delete group ${selectedGroup.name}? This cannot be undone.`);
    if (!shouldDelete) {
      return;
    }

    setGroupBusy(true);
    try {
      await deleteGroup(selectedGroup.id);
      setSelectedGroupId('');
      notificationApi.success({
        message: 'Group deleted',
        description: `${selectedGroup.name} has been deleted.`,
      });
    } catch {
      notificationApi.error({
        message: 'Delete failed',
        description: `Could not delete ${selectedGroup.name}.`,
      });
    } finally {
      setGroupBusy(false);
    }
  };

  const handleUploadGroupAvatar = async () => {
    if (!selectedGroup || !groupAvatarFile) {
      return;
    }

    setGroupBusy(true);
    try {
      await uploadGroupAvatar(selectedGroup.id, groupAvatarFile);
      setGroupAvatarFile(null);
      notificationApi.success({
        message: 'Group picture updated',
        description: `${selectedGroup.name} picture updated successfully.`,
      });
    } catch {
      notificationApi.error({
        message: 'Upload failed',
        description: 'Could not update group picture.',
      });
    } finally {
      setGroupBusy(false);
    }
  };

  const handlePromoteAdmin = async (userId: string, name: string) => {
    if (!selectedGroup) {
      return;
    }

    setGroupBusy(true);
    try {
      await promoteGroupAdmin(selectedGroup.id, userId);
      notificationApi.success({
        message: 'Admin updated',
        description: `${name} is now a group admin.`,
      });
    } catch {
      notificationApi.error({
        message: 'Promotion failed',
        description: `Could not make ${name} an admin.`,
      });
    } finally {
      setGroupBusy(false);
    }
  };

  const handleDemoteAdmin = async (userId: string, name: string) => {
    if (!selectedGroup) {
      return;
    }

    setGroupBusy(true);
    try {
      await demoteGroupAdmin(selectedGroup.id, userId);
      notificationApi.success({
        message: 'Admin updated',
        description: `${name} is now a regular member.`,
      });
    } catch {
      notificationApi.error({
        message: 'Demotion failed',
        description: `Could not demote ${name}.`,
      });
    } finally {
      setGroupBusy(false);
    }
  };

  const userColumns: ColumnsType<ChatUser> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (_, user) => (
        <button
          type="button"
          className="text-left font-semibold text-emerald-700 hover:underline"
          onClick={() => {
            selectManagedUser(user);
            void loadConversation({
              kind: 'private',
              id: user.id,
              name: user.name,
              avatar: user.avatar || null,
            });
          }}
        >
          {user.name}
        </button>
      ),
    },
    {
      title: 'Registration',
      dataIndex: 'registrationNumber',
      key: 'registrationNumber',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 120,
      render: (_, user) => (
        <Tag color={user.isActive === false ? 'red' : 'green'}>{user.isActive === false ? 'Inactive' : 'Active'}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      render: (_, user) => (
        <Space size={8}>
          <Button size="small" onClick={() => selectManagedUser(user)}>
            Edit
          </Button>
          <Button
            size="small"
            type="default"
            onClick={() =>
              void loadConversation({
                kind: 'private',
                id: user.id,
                name: user.name,
                avatar: user.avatar || null,
              })
            }
          >
            Chat
          </Button>
          <Popconfirm
            title="Delete user"
            description="This will deactivate the selected user. Continue?"
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => void handleDeleteDirectoryUser(user.id)}
          >
            <Button size="small" danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const scopedPermissions = useMemo(
    () =>
      permissions.filter((item) => {
        if (!isAdminView) {
          return item.requesterId === currentUser.id || item.targetId === currentUser.id;
        }

        const requesterRole = item.requester?.role;
        const targetRole = item.target?.role;
        const requesterMatch = requesterRole ? managedRoles.includes(requesterRole) : true;
        const targetMatch = targetRole ? managedRoles.includes(targetRole) : true;
        return requesterMatch || targetMatch;
      }),
    [permissions, isAdminView, currentUser.id]
  );

  const visibleNotifications = useMemo(
    () =>
      [...notifications]
        .sort((a, b) => {
          if (a.isRead !== b.isRead) {
            return a.isRead ? 1 : -1;
          }

          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .slice(0, notificationVisibleCount),
    [notifications, notificationVisibleCount]
  );

  const readNotifications = useMemo(
    () => notifications.filter((notification) => notification.isRead).length,
    [notifications]
  );

  const unreadNotificationItems = useMemo(
    () => visibleNotifications.filter((notification) => !notification.isRead),
    [visibleNotifications]
  );

  const readNotificationItems = useMemo(
    () => visibleNotifications.filter((notification) => notification.isRead),
    [visibleNotifications]
  );

  const allVisibleNotificationIds = useMemo(
    () => visibleNotifications.map((notification) => notification.id),
    [visibleNotifications]
  );

  const allVisibleSelected =
    allVisibleNotificationIds.length > 0 &&
    allVisibleNotificationIds.every((id) => selectedNotificationIds.includes(id));

  const panelClass = 'theme-panel rounded-2xl border p-4 shadow-sm';
  const sectionTitleClass = "theme-subtext mb-3 font-['Space_Grotesk'] text-xs font-bold uppercase tracking-[0.12em]";
  const listButtonClass =
    'w-full rounded-xl border border-transparent theme-soft px-3 py-2 text-left text-sm transition hover:bg-[var(--panel-bg)]';
  const emptyStateClass =
    'theme-border theme-soft theme-subtext rounded-xl border border-dashed px-3 py-3 text-center text-xs';

  return (
    <section className="grid h-full min-h-0 min-w-0 grid-rows-[auto_1fr] overflow-hidden">
      {notificationContextHolder}
      <header className="theme-panel theme-border sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 backdrop-blur">
        <div>
          <h2 className="font-['Space_Grotesk'] text-lg font-bold capitalize">{activeScreen}</h2>
          <p className="theme-subtext text-xs">Detailed workspace data appears here.</p>
        </div>
        <button
          type="button"
          className="theme-accent-btn rounded-lg px-3 py-1.5 text-xs font-semibold lg:hidden"
          onClick={onOpenSidebar}
        >
          Names
        </button>
      </header>

      <div className="grid min-h-0 content-start gap-4 overflow-y-auto px-4 py-4">
        {activeScreen === 'directory' ? (
          <section className={panelClass}>
            <h3 className={sectionTitleClass}>Manage {managedRoleLabel}</h3>
            {currentUser.role === 'superadmin' ? (
              <AppSelect
                className="mb-3"
                value={directoryRoleScope}
                options={[
                  { value: 'admin', label: 'Manage Admins' },
                  { value: 'superadmin', label: 'Manage Superadmins' },
                ]}
                onChange={(value) => {
                  const nextScope = String(value) as ChatUser['role'];
                  setDirectoryRoleScope(nextScope);
                  setDirectoryForm((prev) => ({ ...prev, role: nextScope }));
                  setSelectedDirectoryUserId('');
                }}
              />
            ) : null}
            <AppSelect
              allowClear
              className="mb-3"
              placeholder={`Search and select ${managedRoleLabel}`}
              value={selectedDirectoryUserId || undefined}
              options={managedUsersAll.map((user) => ({
                value: user.id,
                label: formatUserOption(user),
              }))}
              onChange={(value) => {
                const selected = managedUsersAll.find((user) => user.id === String(value));
                selectManagedUser(selected || null);
              }}
              onClear={() => selectManagedUser(null)}
            />
            <div className="theme-panel theme-border mb-3 grid gap-2 rounded-xl border p-3">
              <p className="theme-subtext text-[11px] font-semibold uppercase tracking-wide">
                {selectedDirectoryUserId ? 'Update or Delete Selected User' : 'Add New User'}
              </p>
              <AppInput
                value={directoryForm.name}
                placeholder="Full name"
                onChange={(event) =>
                  setDirectoryForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
              />
              <AppInput
                value={directoryForm.registrationNumber}
                placeholder="Registration number"
                onChange={(event) =>
                  setDirectoryForm((prev) => ({
                    ...prev,
                    registrationNumber: event.target.value,
                  }))
                }
              />
              <AppInput
                type="email"
                value={directoryForm.email}
                placeholder="Email"
                onChange={(event) =>
                  setDirectoryForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
              />
              <AppInput
                type="password"
                value={directoryForm.password}
                placeholder={selectedDirectoryUserId ? 'Password (optional)' : 'Password'}
                onChange={(event) =>
                  setDirectoryForm((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
              />
              {currentUser.role === 'superadmin' ? (
                <AppSelect
                  value={directoryForm.role}
                  options={[
                    { value: 'superadmin', label: 'Superadmin' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                  onChange={(value) =>
                    setDirectoryForm((prev) => ({
                      ...prev,
                      role: String(value) as ChatUser['role'],
                    }))
                  }
                />
              ) : null}
              <div className="grid gap-2 sm:grid-cols-3">
                <Button type="primary" loading={directoryBusy} onClick={() => void handleSubmitDirectoryForm()}>
                  {selectedDirectoryUserId ? 'Update' : 'Add'}
                </Button>
                <Button
                  disabled={directoryBusy}
                  onClick={() => {
                    selectManagedUser(null);
                    setDirectoryForm((prev) => ({
                      ...prev,
                      role: currentUser.role === 'superadmin' ? directoryRoleScope : 'user',
                    }));
                  }}
                >
                  Clear
                </Button>
                <Popconfirm
                  title="Delete selected user"
                  description="This will deactivate the selected user. Continue?"
                  okText="Delete"
                  cancelText="Cancel"
                  okButtonProps={{ danger: true }}
                  disabled={!selectedDirectoryUserId || directoryBusy}
                  onConfirm={() =>
                    selectedDirectoryUser ? void handleDeleteDirectoryUser(selectedDirectoryUser.id) : undefined
                  }
                >
                  <Button danger disabled={!selectedDirectoryUserId || directoryBusy}>
                    Delete
                  </Button>
                </Popconfirm>
              </div>
            </div>
            <AppDataTable<ChatUser>
              rowKey="id"
              columns={userColumns}
              dataSource={managedUsersAll}
              loading={directoryBusy}
              pagination={{ pageSize: 8, showSizeChanger: false }}
            />
            {managedUsersAll.length === 0 ? (
              <p className={emptyStateClass}>No {managedRoleLabel} found in your scope.</p>
            ) : null}
          </section>
        ) : null}

        {activeScreen === 'groups' ? (
          <section className={panelClass}>
            <h3 className={sectionTitleClass}>Groups Workspace</h3>
            {currentUser.role === 'admin' || currentUser.role === 'superadmin' ? (
              <div className="theme-panel theme-border mb-4 grid gap-2 rounded-xl border p-3">
                <p className="theme-subtext text-[11px] font-semibold uppercase tracking-wide">
                  Create New Group
                </p>
                <AppInput
                  value={groupForm.name}
                  placeholder="Group name"
                  onChange={(event) =>
                    setGroupForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
                <AppInput
                  value={groupForm.description}
                  placeholder="Rules and regulations (owner controlled)"
                  onChange={(event) =>
                    setGroupForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                />
                <div className="theme-soft theme-border rounded-lg border px-3 py-2">
                  <label className="theme-subtext mb-1 block text-[11px] font-semibold uppercase tracking-wide">
                    Group Picture
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setGroupCreateAvatarFile(event.target.files?.[0] || null)}
                    className="block w-full text-xs"
                  />
                  {groupCreateAvatarFile ? (
                    <p className="theme-subtext mt-1 truncate text-[11px]">Selected: {groupCreateAvatarFile.name}</p>
                  ) : null}
                </div>
                <AppSelect
                  mode="multiple"
                  allowClear
                  placeholder="Select members"
                  value={selectedGroupMemberIds}
                  options={groupEligibleUsers.map((user) => ({
                    value: user.id,
                    label: formatUserOption(user),
                  }))}
                  onChange={(value) => {
                    const nextValues = Array.isArray(value) ? value : [value];
                    setSelectedGroupMemberIds(nextValues.map((item) => String(item)));
                  }}
                  onClear={() => setSelectedGroupMemberIds([])}
                />
                <div className="flex items-center gap-2">
                  <Button type="primary" loading={groupBusy} onClick={() => void handleCreateGroup()}>
                    Create Group
                  </Button>
                  <Button
                    disabled={groupBusy}
                    onClick={() => {
                      setGroupForm({ name: '', description: '' });
                      setSelectedGroupMemberIds([]);
                      setGroupCreateAvatarFile(null);
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            ) : (
              <p className={`${emptyStateClass} mb-4`}>
                Only admins and superadmins can create groups.
              </p>
            )}

            <h4 className="theme-subtext mb-2 text-[11px] font-semibold uppercase tracking-wide">
              Your Groups
            </h4>
            <ul className="grid gap-2">
              {groups.map((group) => (
                <li key={group.id}>
                  <button
                    type="button"
                    className={`${listButtonClass} ${selectedGroupId === group.id ? 'border border-[color:var(--accent-bg)] bg-[color:var(--panel-muted-bg)]' : ''}`}
                    onClick={() => setSelectedGroupId(group.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                        {group.avatar ? (
                          <img src={group.avatar} alt={group.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-600">
                            {group.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate font-semibold">{group.name}</span>
                        <span className="theme-subtext mt-1 block truncate text-xs">
                          {group.description || 'No description'}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {groups.length === 0 ? <p className={`${emptyStateClass} mt-2`}>No groups found.</p> : null}

            {selectedGroup ? (
              <div className="theme-panel theme-border mt-4 grid gap-3 rounded-xl border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="theme-subtext text-[11px] font-semibold uppercase tracking-wide">
                    Manage Group
                  </p>
                  <button
                    type="button"
                    className="theme-accent-btn rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                    onClick={() =>
                      void loadConversation({
                        kind: 'group',
                        id: selectedGroup.id,
                        name: selectedGroup.name,
                        avatar: selectedGroup.avatar || null,
                      })
                    }
                  >
                    Open Chat
                  </button>
                </div>

                <div className="theme-soft theme-border rounded-lg border p-2">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                      {selectedGroup.avatar ? (
                        <img src={selectedGroup.avatar} alt={selectedGroup.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-base font-bold text-slate-600">
                          {selectedGroup.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{selectedGroup.name}</p>
                      <p className="theme-subtext truncate text-xs">{selectedGroup.description || 'No description'}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setGroupAvatarFile(event.target.files?.[0] || null)}
                      className="block min-w-0 flex-1 text-xs"
                    />
                    <Button
                      size="small"
                      disabled={!groupAvatarFile}
                      loading={groupBusy}
                      onClick={() => void handleUploadGroupAvatar()}
                    >
                      Update Picture
                    </Button>
                  </div>
                </div>

                <AppInput
                  value={groupEditForm.name}
                  placeholder="Group name"
                  onChange={(event) =>
                    setGroupEditForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
                <AppInput
                  value={groupEditForm.description}
                  placeholder="Group rules and regulations"
                  disabled={!isSelectedGroupOwner}
                  onChange={(event) =>
                    setGroupEditForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                />
                {!isSelectedGroupOwner ? (
                  <p className="theme-subtext text-[11px]">
                    Only the owner can edit rules and regulations (group description).
                  </p>
                ) : null}
                <Button loading={groupBusy} type="primary" onClick={() => void handleUpdateGroup()}>
                  Update Group Info
                </Button>

                <AppSelect
                  mode="multiple"
                  allowClear
                  placeholder="Add new members"
                  value={groupMemberAddIds}
                  options={addableGroupMembers.map((member) => ({
                    value: member.id,
                    label: formatUserOption(member),
                  }))}
                  onChange={(value) => {
                    const nextValues = Array.isArray(value) ? value : [value];
                    setGroupMemberAddIds(nextValues.map((item) => String(item)));
                  }}
                  onClear={() => setGroupMemberAddIds([])}
                />
                <Button loading={groupBusy} onClick={() => void handleAddGroupMembers()}>
                  Add Members
                </Button>

                <AppSelect
                  mode="multiple"
                  allowClear
                  placeholder="Remove members"
                  value={groupMemberRemoveIds}
                  options={removableGroupMembers.map((member) => ({
                    value: member.id,
                    label: `${member.name} (${member.registrationNumber || 'N/A'})`,
                  }))}
                  onChange={(value) => {
                    const nextValues = Array.isArray(value) ? value : [value];
                    setGroupMemberRemoveIds(nextValues.map((item) => String(item)));
                  }}
                  onClear={() => setGroupMemberRemoveIds([])}
                />
                <Button danger loading={groupBusy} onClick={() => void handleRemoveGroupMembers()}>
                  Remove Members
                </Button>

                {isSelectedGroupOwner ? (
                  <>
                    <AppSelect
                      allowClear
                      placeholder="Transfer ownership to"
                      value={newOwnerId || undefined}
                      options={transferOwnerCandidates.map((member) => ({
                        value: member.id,
                        label: `${member.name} (${member.registrationNumber || 'N/A'})`,
                      }))}
                      onChange={(value) => setNewOwnerId(String(value || ''))}
                      onClear={() => setNewOwnerId('')}
                    />
                    <Button loading={groupBusy} onClick={() => void handleTransferOwnership()}>
                      Transfer Ownership
                    </Button>
                  </>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    danger
                    disabled={groupBusy || isSelectedGroupOwner}
                    onClick={() => void handleLeaveGroup()}
                  >
                    Leave Group
                  </Button>
                  <Button danger loading={groupBusy} onClick={() => void handleDeleteGroup()}>
                    Delete Group
                  </Button>
                </div>

                <div className="theme-border rounded-lg border p-2">
                  <p className="theme-subtext mb-1 text-[11px] font-semibold uppercase tracking-wide">
                    Members ({selectedGroup.memberCount || selectedGroupMembers.length})
                  </p>
                  <ul className="grid max-h-44 gap-1 overflow-y-auto">
                    {selectedGroupMembers.map((member) => (
                      <li key={member.id} className="theme-soft rounded-md px-2 py-1 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                              {member.avatar ? (
                                <img src={member.avatar} alt={member.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-600">
                                  {member.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="truncate font-semibold">{member.name}</span>
                              <span className="theme-subtext ml-1">{member.registrationNumber || ''}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="theme-muted theme-subtext rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase">
                              {member.role || (selectedGroup.createdById === member.id ? 'owner' : 'member')}
                            </span>
                            {isSelectedGroupOwner && member.id !== selectedGroup.createdById ? (
                              member.role === 'admin' ? (
                                <button
                                  type="button"
                                  className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                                  onClick={() => void handleDemoteAdmin(member.id, member.name)}
                                >
                                  Demote
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800"
                                  onClick={() => void handlePromoteAdmin(member.id, member.name)}
                                >
                                  Make admin
                                </button>
                              )
                            ) : null}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeScreen === 'search' ? (
          <section className={panelClass}>
            <h3 className={sectionTitleClass}>Message Search</h3>
            <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                type="text"
                value={messageSearchTerm}
                placeholder="Find text across conversations"
                onChange={(event) => setMessageSearchTerm(event.target.value)}
                className="theme-panel theme-border rounded-xl border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-200"
              />
              <button
                type="button"
                onClick={() => void searchMessages()}
                disabled={searchBusy}
                className="theme-accent-btn rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-70"
              >
                {searchBusy ? '...' : 'Search'}
              </button>
            </div>
            <ul className="grid max-h-80 gap-2 overflow-y-auto">
              {messageSearchResults.map((item) => (
                <li key={item.id}>
                  <button type="button" className={listButtonClass} onClick={() => void openSearchResult(item)}>
                    {(item.sender?.name || 'User') + ': ' + item.content.slice(0, 62)}
                    <small className="theme-subtext block text-xs">
                      {item.messageType === 'group'
                        ? `Group: ${item.group?.name || 'Unknown'}`
                        : 'Private chat'}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
            {!searchBusy && messageSearchTerm.trim() && messageSearchResults.length === 0 ? (
              <p className={`${emptyStateClass} mt-2`}>No messages matched your query.</p>
            ) : null}
          </section>
        ) : null}

        {activeScreen === 'permissions' ? (
          <>
            <section className={panelClass}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className={sectionTitleClass}>Permission Workspace</h3>
                <button
                  type="button"
                  onClick={() => setShowPermissionForm((prev) => !prev)}
                  className="theme-panel theme-border rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide"
                >
                  {showPermissionForm ? 'Hide Form' : 'New Request'}
                </button>
              </div>
              <div className="theme-border theme-muted mb-3 rounded-xl border p-1">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setPermissionScreen('requests')}
                    className={`rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-wide ${
                      permissionScreen === 'requests' ? 'theme-panel shadow-sm' : 'theme-subtext'
                    }`}
                  >
                    Requests
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermissionScreen('links')}
                    className={`rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-wide ${
                      permissionScreen === 'links' ? 'theme-panel shadow-sm' : 'theme-subtext'
                    }`}
                  >
                    Active Links
                  </button>
                </div>
              </div>
              {showPermissionForm ? (
                <div className="theme-panel theme-border grid gap-2 rounded-xl border p-3">
                  <AppSelect
                    allowClear
                    placeholder={`Search and select target ${managedRoleLabel.slice(0, -1)}`}
                    options={managedUsersAll.map((user) => ({
                      value: user.id,
                      label: formatUserOption(user),
                    }))}
                    onChange={(value) => setPermissionTargetUserId(String(value))}
                    onClear={() => setPermissionTargetUserId('')}
                  />
                  <AppInput
                    value={permissionReason}
                    onChange={(event) => setPermissionReason(event.target.value)}
                    placeholder="Reason"
                  />
                  <AppInput
                    type="text"
                    value={permissionExpiresAt}
                    onChange={(event) => setPermissionExpiresAt(event.target.value)}
                    placeholder="Expires at (YYYY-MM-DDTHH:mm)"
                  />
                  <button
                    type="button"
                    onClick={() => void createPermissionRequest()}
                    className="theme-accent-btn rounded-xl px-3 py-2 text-sm font-semibold"
                  >
                    Submit Request
                  </button>
                </div>
              ) : null}
            </section>

            {permissionScreen === 'requests' ? (
              <section className={panelClass}>
                <h3 className={sectionTitleClass}>Permission Requests</h3>
                {permissionsBusy ? <div className="theme-muted h-16 animate-pulse rounded-xl" /> : null}
                <ul className="grid max-h-80 gap-2 overflow-y-auto">
                  {scopedPermissions.map((item) => (
                    <li key={item.id}>
                      <div className="theme-panel theme-border rounded-xl border p-3 shadow-sm">
                        <p className="text-sm">
                          <strong>{item.requester?.name || item.requesterId}</strong> to{' '}
                          <strong>{item.target?.name || item.targetId}</strong>
                        </p>
                        <small className="theme-subtext mt-1 block text-xs">{item.reason}</small>
                        <small className="theme-subtext mt-1 block text-xs">Status: {item.status}</small>
                        {isAdminView && item.status === 'pending' ? (
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              className="theme-accent-btn rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                              onClick={() => void updatePermissionRequest(item.id, 'approve')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="rounded-lg bg-rose-700 px-2.5 py-1.5 text-xs font-semibold text-white"
                              onClick={() => void updatePermissionRequest(item.id, 'reject')}
                            >
                              Reject
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
                {isAdminView ? (
                  <div className="theme-panel theme-border mt-3 grid gap-2 rounded-xl border p-3">
                    <input
                      type="text"
                      value={adminRemark}
                      onChange={(event) => setAdminRemark(event.target.value)}
                      placeholder="Admin remark"
                      className="theme-panel theme-border rounded-xl border px-3 py-2 text-sm outline-none"
                    />
                    <input
                      type="datetime-local"
                      value={adminExpiresAt}
                      onChange={(event) => setAdminExpiresAt(event.target.value)}
                      className="theme-panel theme-border rounded-xl border px-3 py-2 text-sm outline-none"
                    />
                  </div>
                ) : null}
              </section>
            ) : null}

            {isAdminView && permissionScreen === 'links' ? (
              <section className={panelClass}>
                <h3 className={sectionTitleClass}>Active Chat Permissions</h3>
                {chatPermissionsBusy ? <div className="theme-muted h-16 animate-pulse rounded-xl" /> : null}
                <ul className="grid max-h-80 gap-2 overflow-y-auto">
                  {chatPermissions.map((item) => (
                    <li key={item.id}>
                      <div className="theme-panel theme-border rounded-xl border p-3 shadow-sm">
                        <p className="text-sm">
                          {item.userA?.name || item.userAId} ↔ {item.userB?.name || item.userBId}
                        </p>
                        <small className="theme-subtext mt-1 block text-xs">
                          {item.isActive ? 'Active' : 'Inactive'}
                        </small>
                        {item.isActive ? (
                          <button
                            type="button"
                            className="mt-2 rounded-lg bg-rose-700 px-2.5 py-1.5 text-xs font-semibold text-white"
                            onClick={() => void revokeChatPermission(item.id)}
                          >
                            Revoke
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}

        {activeScreen === 'notifications' ? (
          <section className={panelClass}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className={sectionTitleClass}>Notifications</h3>
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-white">
                  Unread {unreadNotifications}
                </span>
                <span className="theme-muted theme-subtext rounded-full px-2 py-0.5">
                  Read {readNotifications}
                </span>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="theme-accent-btn rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-60"
                disabled={unreadNotifications === 0}
                onClick={() => void markAllNotificationsRead()}
              >
                Mark All As Read
              </button>
              <button
                type="button"
                className="theme-panel theme-border rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                onClick={() => {
                  if (allVisibleSelected) {
                    setSelectedNotificationIds([]);
                    return;
                  }
                  setSelectedNotificationIds(allVisibleNotificationIds);
                }}
              >
                {allVisibleSelected ? 'Unselect Visible' : 'Select Visible'}
              </button>
              <button
                type="button"
                className="rounded-lg bg-rose-700 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                disabled={selectedNotificationIds.length === 0}
                onClick={async () => {
                  await deleteNotificationsBulk(selectedNotificationIds);
                  setSelectedNotificationIds([]);
                }}
              >
                Delete Selected ({selectedNotificationIds.length})
              </button>
            </div>
            <div className="max-h-80 space-y-3 overflow-y-auto">
              <div>
                <p className="theme-subtext mb-2 text-[11px] font-semibold uppercase tracking-wide">
                  Unread ({unreadNotificationItems.length})
                </p>
                <ul className="grid gap-2">
                  {unreadNotificationItems.map((notification) => (
                    <li key={notification.id}>
                      <div className="w-full rounded-xl border theme-border bg-[color:var(--panel-muted-bg)] px-3 py-2 text-left text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex min-w-0 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedNotificationIds.includes(notification.id)}
                              onChange={(event) => {
                                setSelectedNotificationIds((prev) =>
                                  event.target.checked
                                    ? [...new Set([...prev, notification.id])]
                                    : prev.filter((id) => id !== notification.id)
                                );
                              }}
                            />
                            <strong className="block truncate font-semibold">
                              {notification.title || 'Alert'}
                            </strong>
                          </label>
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                              Unread
                            </span>
                            <button
                              type="button"
                              className="rounded-md bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700"
                              onClick={() => void deleteNotification(notification.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <small className="theme-subtext mt-1 block text-xs">{notification.message}</small>
                        <div className="mt-2">
                          <button
                            type="button"
                            className="theme-panel theme-border rounded-md border px-2 py-1 text-[10px] font-semibold"
                            onClick={() => void markNotificationRead(notification.id)}
                          >
                            Mark as read
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                {unreadNotificationItems.length === 0 ? (
                  <p className="theme-subtext rounded-lg border border-dashed theme-border px-3 py-2 text-xs">
                    No unread notifications.
                  </p>
                ) : null}
              </div>

              <div>
                <p className="theme-subtext mb-2 text-[11px] font-semibold uppercase tracking-wide">
                  Read ({readNotificationItems.length})
                </p>
                <ul className="grid gap-2">
                  {readNotificationItems.map((notification) => (
                    <li key={notification.id}>
                      <div className="w-full rounded-xl border theme-border theme-soft px-3 py-2 text-left text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex min-w-0 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedNotificationIds.includes(notification.id)}
                              onChange={(event) => {
                                setSelectedNotificationIds((prev) =>
                                  event.target.checked
                                    ? [...new Set([...prev, notification.id])]
                                    : prev.filter((id) => id !== notification.id)
                                );
                              }}
                            />
                            <strong className="block truncate font-semibold">
                              {notification.title || 'Alert'}
                            </strong>
                          </label>
                          <div className="flex items-center gap-1.5">
                            <span className="theme-muted theme-subtext rounded-full px-2 py-0.5 text-[10px] font-semibold">
                              Read
                            </span>
                            <button
                              type="button"
                              className="rounded-md bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700"
                              onClick={() => void deleteNotification(notification.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <small className="theme-subtext mt-1 block text-xs">{notification.message}</small>
                      </div>
                    </li>
                  ))}
                </ul>
                {readNotificationItems.length === 0 ? (
                  <p className="theme-subtext rounded-lg border border-dashed theme-border px-3 py-2 text-xs">
                    No read notifications yet.
                  </p>
                ) : null}
              </div>
            </div>
            {notifications.length > visibleNotifications.length ? (
              <button
                type="button"
                onClick={() => setNotificationVisibleCount((prev) => prev + 20)}
                className="theme-panel theme-border mt-2 w-full rounded-xl border px-3 py-2 text-xs font-semibold"
              >
                Load More
              </button>
            ) : null}
            {notifications.length === 0 ? <p className={emptyStateClass}>No notifications yet.</p> : null}
          </section>
        ) : null}
      </div>
    </section>
  );
};

export default WorkspacePanel;