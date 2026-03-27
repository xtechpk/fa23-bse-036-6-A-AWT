import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Popconfirm, Space, Tag, notification } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ChatMessage, ChatPermission, ChatUser, NotificationItem, PermissionRequest } from '../../types/chat';
import AppDataTable from '../ui/AppDataTable';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';

interface WorkspacePanelProps {
  activeScreen: 'conversations' | 'directory' | 'search' | 'permissions' | 'notifications';
  currentUser: ChatUser;
  users: ChatUser[];
  loadManagedUsers: (roleFilter?: ChatUser['role']) => Promise<void>;
  searchUsers: () => Promise<void>;
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
  loadManagedUsers,
  searchUsers,
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