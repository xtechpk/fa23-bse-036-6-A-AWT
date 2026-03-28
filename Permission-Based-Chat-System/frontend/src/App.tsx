import { useEffect, useMemo, useState } from 'react';
import { Dropdown, Modal, notification } from 'antd';
import axiosInstance from './api/axiosInstance';
import AuthView from './components/auth/AuthView';
import ChatPanel from './components/chat/ChatPanel';
import Sidebar from './components/layout/Sidebar';
import WorkspacePanel from './components/layout/WorkspacePanel';
import AppInput from './components/ui/AppInput';
import { useChatApp } from './hooks/useChatApp';
import { DensityMode, RecoveryCodeStatus } from './types/chat';
import { toAbsoluteAssetUrl } from './utils/assetUrl';

const DENSITY_STORAGE_KEY = 'chat_density_mode';
const THEME_STORAGE_KEY = 'chat_theme_mode';

type ThemeMode = 'sunrise' | 'slate' | 'midnight';

const getInitialThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'sunrise';
  }

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === 'sunrise' || saved === 'slate' || saved === 'midnight' ? saved : 'sunrise';
};

const getDayGreeting = (name: string): string => {
  const hour = new Date().getHours();
  if (hour < 12) {
    return `Good morning, ${name}`;
  }
  if (hour < 17) {
    return `Good afternoon, ${name}`;
  }
  if (hour < 21) {
    return `Good evening, ${name}`;
  }
  return `Good night, ${name}`;
};

const getInitialDensityMode = (): DensityMode => {
  if (typeof window === 'undefined') {
    return 'comfortable';
  }

  const saved = window.localStorage.getItem(DENSITY_STORAGE_KEY);
  return saved === 'compact' || saved === 'comfortable' ? saved : 'comfortable';
};

const App = () => {
  const app = useChatApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [densityMode, setDensityMode] = useState<DensityMode>(getInitialDensityMode);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);
  const [activeScreen, setActiveScreen] = useState<
    'conversations' | 'groups' | 'directory' | 'search' | 'permissions' | 'notifications'
  >('conversations');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    registrationNumber: '',
    password: '',
  });
  const [profileBusy, setProfileBusy] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [conversationDropdownQuery, setConversationDropdownQuery] = useState('');
  const [headerConversationMenuFor, setHeaderConversationMenuFor] = useState<string | null>(null);
  const [profileAvatarVersion, setProfileAvatarVersion] = useState(0);
  const [isTwoFactorModalOpen, setIsTwoFactorModalOpen] = useState(false);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [twoFactorChallengeId, setTwoFactorChallengeId] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorQrImageDataUrl, setTwoFactorQrImageDataUrl] = useState<string | null>(null);
  const [twoFactorManualKey, setTwoFactorManualKey] = useState<string | null>(null);
  const [disableTwoFactorCode, setDisableTwoFactorCode] = useState('');
  const [recoveryRegeneratePassword, setRecoveryRegeneratePassword] = useState('');
  const [twoFactorRecoveryCodes, setTwoFactorRecoveryCodes] = useState<string[]>([]);
  const [twoFactorRecoveryStatus, setTwoFactorRecoveryStatus] = useState<RecoveryCodeStatus | null>(
    null
  );
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [resetPasswordBusy, setResetPasswordBusy] = useState(false);
  const [resetPasswordForm, setResetPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const managedRoleLabel =
    app.currentUser?.role === 'superadmin'
      ? 'admins'
      : app.currentUser?.role === 'admin'
        ? 'users'
        : 'admins';
  const isTwoFactorEnabled = Boolean(app.currentUser?.twoFactorEnabled);
  const getRecoveryCodeStatus = app.getRecoveryCodeStatus;

  const unreadConversations = app.inboxConversations.filter((item) => item.unreadCount > 0);
  // Header shows number of unread conversation threads (not total unread messages).
  const unreadConversationCount = unreadConversations.length;
  const filteredUnreadConversations = useMemo(() => {
    const query = conversationDropdownQuery.trim().toLowerCase();
    if (!query) {
      return unreadConversations;
    }

    return unreadConversations.filter((conversation) => {
      const name = conversation.name.toLowerCase();
      const preview = (conversation.lastMessagePreview || '').toLowerCase();
      return name.includes(query) || preview.includes(query);
    });
  }, [conversationDropdownQuery, unreadConversations]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isSidebarOpen]);

  useEffect(() => {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, densityMode);
  }, [densityMode]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (!app.currentUser?.uiDensityMode) {
      return;
    }

    const backendDensity = app.currentUser.uiDensityMode;
    if (backendDensity !== densityMode) {
      setDensityMode(backendDensity);
    }
  }, [app.currentUser?.uiDensityMode, densityMode]);

  useEffect(() => {
    if (!app.currentUser?.id) {
      return;
    }

    if (app.currentUser.uiDensityMode === densityMode) {
      return;
    }

    void axiosInstance
      .put(`/users/${app.currentUser.id}`, { uiDensityMode: densityMode })
      .catch(() => {
        // Density sync failure should never block UI behavior.
      });
  }, [app.currentUser?.id, app.currentUser?.uiDensityMode, densityMode]);

  useEffect(() => {
    if (!isProfileModalOpen) {
      return;
    }

    if (avatarFile) {
      return;
    }

    setAvatarPreview(toAbsoluteAssetUrl(app.currentUser?.avatar || null));
  }, [app.currentUser?.avatar, avatarFile, isProfileModalOpen]);

  useEffect(() => {
    if (!isTwoFactorModalOpen || !isTwoFactorEnabled) {
      return;
    }

    void getRecoveryCodeStatus()
      .then((status) => setTwoFactorRecoveryStatus(status))
      .catch(() => {
        setTwoFactorRecoveryStatus(null);
      });
  }, [getRecoveryCodeStatus, isTwoFactorEnabled, isTwoFactorModalOpen]);

  const handleConversationSelect = async (target: {
    kind: 'private' | 'group';
    id: string;
    name: string;
    avatar?: string | null;
  }) => {
    setActiveScreen('conversations');
    await app.loadConversation(target);
    if (window.innerWidth <= 900) {
      setIsSidebarOpen(false);
    }
  };

  const handleSearchResultOpen = async (message: Parameters<typeof app.openSearchResult>[0]) => {
    setActiveScreen('conversations');
    await app.openSearchResult(message);
    if (window.innerWidth <= 900) {
      setIsSidebarOpen(false);
    }
  };

  const handleDeleteConversation = async (target: {
    kind: 'private' | 'group';
    id: string;
    name: string;
  }) => {
    const shouldDelete = window.confirm(`Delete conversation with ${target.name} for you?`);
    if (!shouldDelete) {
      return;
    }

    try {
      const result = await app.deleteConversation(target);
      notificationApi.success({
        message: 'Conversation deleted',
        description: `Deleted ${result?.deletedMessagesCount ?? 0} message(s) from ${target.name}.`,
      });
    } catch {
      notificationApi.error({
        message: 'Delete failed',
        description: `Could not delete conversation with ${target.name}.`,
      });
    }
  };

  if (!app.currentUser) {
    return (
      <AuthView
        error={app.error}
        isAuthModeLogin={app.isAuthModeLogin}
        authBusy={app.authBusy}
        loginEmail={app.loginEmail}
        loginPassword={app.loginPassword}
        pendingTwoFactorLogin={app.pendingTwoFactorLogin}
        pendingTwoFactorDebugCode={app.pendingTwoFactorDebugCode}
        registerData={app.registerData}
        setIsAuthModeLogin={app.setIsAuthModeLogin}
        setLoginEmail={app.setLoginEmail}
        setLoginPassword={app.setLoginPassword}
        setRegisterData={app.setRegisterData}
        handleLogin={app.handleLogin}
        verifyLoginTwoFactor={app.verifyLoginTwoFactor}
        cancelTwoFactorLogin={app.cancelTwoFactorLogin}
        handleRegister={app.handleRegister}
      />
    );
  }

  const currentUser = app.currentUser;
  const currentUserAvatar = toAbsoluteAssetUrl(currentUser.avatar || null);

  const openProfileModal = () => {
    setProfileForm({
      name: currentUser.name,
      email: currentUser.email,
      registrationNumber: currentUser.registrationNumber,
      password: '',
    });
    setAvatarFile(null);
    setAvatarPreview(toAbsoluteAssetUrl(currentUser.avatar || null));
    setIsProfileModalOpen(true);
  };

  const saveProfile = async () => {
    const payload = {
      name: profileForm.name.trim(),
      email: profileForm.email.trim().toLowerCase(),
      registrationNumber: profileForm.registrationNumber.trim().toUpperCase(),
      ...(profileForm.password.trim() ? { password: profileForm.password.trim() } : {}),
    };

    if (!payload.name || !payload.email || !payload.registrationNumber) {
      notificationApi.warning({
        message: 'Missing fields',
        description: 'Name, email, and registration number are required.',
      });
      return;
    }

    setProfileBusy(true);
    try {
      await app.updateMyProfile(payload);

      if (avatarFile) {
        await app.uploadMyAvatar(avatarFile);
        setProfileAvatarVersion((prev) => prev + 1);
      }

      notificationApi.success({
        message: 'Profile updated',
        description: 'Your profile information has been saved successfully.',
      });
      setIsProfileModalOpen(false);
    } catch {
      notificationApi.error({
        message: 'Update failed',
        description: 'Could not update profile. Please verify inputs and retry.',
      });
    } finally {
      setProfileBusy(false);
    }
  };

  const openTwoFactorModal = () => {
    setIsTwoFactorModalOpen(true);
    setTwoFactorCode('');
    setTwoFactorChallengeId(null);
    setTwoFactorQrImageDataUrl(null);
    setTwoFactorManualKey(null);
    setDisableTwoFactorCode('');
    setRecoveryRegeneratePassword('');
    setTwoFactorRecoveryCodes([]);
    setTwoFactorRecoveryStatus(null);
  };

  const startTwoFactorEnableFlow = async () => {
    setTwoFactorBusy(true);
    try {
      const result = await app.startEnableTwoFactor();
      setTwoFactorChallengeId(result.challenge.challengeId);
      setTwoFactorQrImageDataUrl(result.challenge.qrImageDataUrl || null);
      setTwoFactorManualKey(result.challenge.manualEntryKey || null);
      notificationApi.success({
        message: '2FA code sent',
        description: 'Scan the QR in your authenticator app, then enter the 6-digit code.',
      });
    } catch {
      notificationApi.error({
        message: 'Could not start 2FA setup',
        description: 'Please try again in a moment.',
      });
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const verifyTwoFactorEnableFlow = async () => {
    if (!twoFactorChallengeId || twoFactorCode.trim().length !== 6) {
      notificationApi.warning({
        message: 'Verification code required',
        description: 'Enter a valid 6-digit code.',
      });
      return;
    }

    setTwoFactorBusy(true);
    try {
      const result = await app.verifyEnableTwoFactor(twoFactorChallengeId, twoFactorCode.trim());
      setTwoFactorChallengeId(null);
      setTwoFactorCode('');
      setTwoFactorQrImageDataUrl(null);
      setTwoFactorManualKey(null);
      setTwoFactorRecoveryCodes(result.recoveryCodes);
      setTwoFactorRecoveryStatus({
        total: result.recoveryCodes.length,
        used: 0,
        remaining: result.recoveryCodes.length,
      });
      notificationApi.success({
        message: 'Two-factor enabled',
        description: 'Your account is now protected. Save the recovery codes shown below.',
      });
    } catch {
      notificationApi.error({
        message: 'Verification failed',
        description: 'Invalid code or expired challenge. Start setup again.',
      });
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const disableTwoFactorFlow = async () => {
    if (disableTwoFactorCode.trim().length !== 6) {
      notificationApi.warning({
        message: 'Authenticator code required',
        description: 'Enter a valid 6-digit code from your authenticator app.',
      });
      return;
    }

    setTwoFactorBusy(true);
    try {
      await app.disableTwoFactor(disableTwoFactorCode.trim());
      setDisableTwoFactorCode('');
      setRecoveryRegeneratePassword('');
      setTwoFactorRecoveryCodes([]);
      setTwoFactorRecoveryStatus(null);
      setIsTwoFactorModalOpen(false);
      notificationApi.success({
        message: 'Two-factor disabled',
        description: 'Two-factor authentication has been disabled for your account.',
      });
    } catch {
      notificationApi.error({
        message: 'Disable failed',
        description: 'Current password is incorrect or request failed.',
      });
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const regenerateRecoveryCodesFlow = async () => {
    if (!recoveryRegeneratePassword.trim()) {
      notificationApi.warning({
        message: 'Current password required',
        description: 'Enter your current password to regenerate recovery codes.',
      });
      return;
    }

    setTwoFactorBusy(true);
    try {
      const result = await app.regenerateRecoveryCodes(recoveryRegeneratePassword.trim());
      setTwoFactorRecoveryCodes(result.recoveryCodes);
      setTwoFactorRecoveryStatus(result.status);
      notificationApi.success({
        message: 'Recovery codes regenerated',
        description: 'Your old recovery codes are now invalid. Save the new set securely.',
      });
    } catch {
      notificationApi.error({
        message: 'Regeneration failed',
        description: 'Current password is incorrect or request failed.',
      });
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const openResetPasswordModal = () => {
    setResetPasswordForm({ newPassword: '', confirmPassword: '' });
    setIsResetPasswordModalOpen(true);
  };

  const handleResetPassword = async () => {
    const newPassword = resetPasswordForm.newPassword.trim();
    const confirmPassword = resetPasswordForm.confirmPassword.trim();

    if (newPassword.length < 8) {
      notificationApi.warning({
        message: 'Weak password',
        description: 'Password must be at least 8 characters.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      notificationApi.warning({
        message: 'Password mismatch',
        description: 'New password and confirmation must match.',
      });
      return;
    }

    setResetPasswordBusy(true);
    try {
      await app.updateMyProfile({ password: newPassword });
      setIsResetPasswordModalOpen(false);
      notificationApi.success({
        message: 'Password updated',
        description: 'Your password has been reset successfully.',
      });
    } catch {
      notificationApi.error({
        message: 'Password reset failed',
        description: 'Could not reset password. Please try again.',
      });
    } finally {
      setResetPasswordBusy(false);
    }
  };

  return (
    <main className="app-shell relative grid h-dvh min-h-screen grid-rows-[auto_1fr_auto] overflow-hidden text-slate-800">
      {notificationContextHolder}
      <button
        type="button"
        className={`fixed inset-0 z-40 border-0 bg-slate-950/45 p-0 transition-opacity duration-200 lg:hidden ${
          isSidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setIsSidebarOpen(false)}
        aria-label="Close sidebar"
      />
      <header className="app-header z-30 border-b px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-['Space_Grotesk'] text-base font-bold sm:text-lg">
              {getDayGreeting(currentUser.name)}
            </p>
            <p className="text-xs uppercase tracking-wide opacity-80">
              {activeScreen} workspace · {currentUser.role}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl border p-1">
              <button
                type="button"
                onClick={() => setThemeMode('sunrise')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  themeMode === 'sunrise'
                    ? 'bg-amber-100 text-slate-900'
                    : themeMode === 'midnight'
                      ? 'text-slate-200 hover:bg-slate-800'
                      : 'text-slate-700 hover:bg-white/70'
                }`}
                aria-pressed={themeMode === 'sunrise'}
              >
                Sunrise
              </button>
              <button
                type="button"
                onClick={() => setThemeMode('slate')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  themeMode === 'slate'
                    ? 'bg-slate-200 text-slate-900'
                    : themeMode === 'midnight'
                      ? 'text-slate-200 hover:bg-slate-800'
                      : 'text-slate-700 hover:bg-white/70'
                }`}
                aria-pressed={themeMode === 'slate'}
              >
                Slate
              </button>
              <button
                type="button"
                onClick={() => setThemeMode('midnight')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  themeMode === 'midnight'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-white/70'
                }`}
                aria-pressed={themeMode === 'midnight'}
              >
                Midnight
              </button>
            </div>
            <Dropdown
              trigger={['click']}
              placement="bottomRight"
              dropdownRender={() => (
                <div className="theme-panel min-w-[19rem] rounded-xl border p-2.5 shadow-xl">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide">Conversations</p>
                    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-semibold leading-none text-white">
                      {unreadConversationCount}
                    </span>
                  </div>
                  <p className="theme-subtext mb-2 text-[11px]">
                    Unread threads from your inbox
                  </p>
                  <input
                    type="text"
                    value={conversationDropdownQuery}
                    onChange={(event) => setConversationDropdownQuery(event.target.value)}
                    placeholder="Search conversation"
                    className="theme-panel theme-border mb-2.5 block w-full rounded-lg border px-2.5 py-1.5 text-xs text-[color:var(--panel-text)] placeholder:text-[color:var(--panel-subtext)] outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                  {unreadConversations.length === 0 ? (
                    <p className="theme-subtext rounded-lg border border-dashed theme-border px-3 py-2 text-xs">
                      No unread conversations.
                    </p>
                  ) : filteredUnreadConversations.length === 0 ? (
                    <p className="theme-subtext rounded-lg border border-dashed theme-border px-3 py-2 text-xs">
                      No conversation found for this search.
                    </p>
                  ) : (
                    <ul className="grid max-h-72 gap-1.5 overflow-y-auto">
                      {filteredUnreadConversations.map((conversation) => {
                        const isActiveConversation =
                          app.activeTarget?.id === conversation.threadId &&
                          app.activeTarget.kind === (conversation.type === 'group' ? 'group' : 'private');

                        const conversationTarget = {
                          kind: conversation.type === 'group' ? 'group' : 'private',
                          id: conversation.threadId,
                          name: conversation.name,
                          avatar:
                            conversation.type === 'private'
                              ? conversation.peer?.avatar || null
                              : conversation.group?.avatar || null,
                        } as const;

                        return (
                        <li key={conversation.id}>
                          <div className="flex items-start gap-1.5">
                            <button
                              type="button"
                              className={`theme-soft w-full rounded-lg px-2.5 py-2 text-left text-xs ${
                                isActiveConversation
                                  ? 'border border-[color:var(--accent-bg)] bg-[color:var(--panel-muted-bg)]'
                                  : ''
                              }`}
                              onClick={() => {
                                void handleConversationSelect(conversationTarget);
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <strong className="truncate">{conversation.name}</strong>
                                <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-semibold leading-none text-white">
                                  {conversation.unreadCount}
                                </span>
                              </div>
                              {isActiveConversation ? (
                                <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wide text-[color:var(--accent-bg)]">
                                  Active conversation
                                </span>
                              ) : null}
                              <span className="theme-subtext mt-1 block truncate text-[11px]">
                                {conversation.lastMessagePreview || 'No preview'}
                              </span>
                            </button>
                            <div className="relative mt-1">
                              <button
                                type="button"
                                title="Conversation actions"
                                aria-label="Conversation actions"
                                className="theme-muted theme-subtext inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border theme-border text-sm font-semibold"
                                onClick={() => {
                                  setHeaderConversationMenuFor((prev) =>
                                    prev === conversation.id ? null : conversation.id
                                  );
                                }}
                              >
                                ⋮
                              </button>
                              {headerConversationMenuFor === conversation.id ? (
                                <div className="theme-panel theme-border absolute right-0 top-9 z-20 min-w-32 rounded-lg border p-1 shadow-lg">
                                  <button
                                    type="button"
                                    className="block w-full rounded-md px-2.5 py-1.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50"
                                    onClick={() => {
                                      setHeaderConversationMenuFor(null);
                                      void handleDeleteConversation({
                                        kind: conversationTarget.kind,
                                        id: conversationTarget.id,
                                        name: conversationTarget.name,
                                      });
                                    }}
                                  >
                                    Delete conversation
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            >
              <button
                type="button"
                className="relative inline-flex h-9 w-9 items-center justify-center overflow-visible rounded-full border border-slate-300 bg-white/90 text-sm font-bold"
                aria-label="Unread conversations"
              >
                <span aria-hidden="true">👥</span>
                {unreadConversationCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                    {unreadConversationCount > 99 ? '99+' : unreadConversationCount}
                  </span>
                ) : null}
              </button>
            </Dropdown>
            <Dropdown
              trigger={['click']}
              placement="bottomRight"
              dropdownRender={() => (
                <div className="theme-panel min-w-[19rem] rounded-xl border p-2.5 shadow-xl">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide">Unread Notifications</p>
                    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-semibold leading-none text-white">
                      {app.unreadNotifications}
                    </span>
                  </div>
                  {app.notifications.filter((item) => !item.isRead).length === 0 ? (
                    <p className="theme-subtext rounded-lg border border-dashed theme-border px-3 py-2 text-xs">
                      No unread notifications.
                    </p>
                  ) : (
                    <ul className="grid max-h-72 gap-1.5 overflow-y-auto">
                      {app.notifications
                        .filter((item) => !item.isRead)
                        .slice(0, 30)
                        .map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              className="theme-soft w-full rounded-lg px-2.5 py-2 text-left text-xs"
                              onClick={() => {
                                void app.markNotificationRead(item.id);
                                setActiveScreen('notifications');
                              }}
                            >
                              <strong className="block truncate">{item.title || 'Notification'}</strong>
                              <span className="theme-subtext mt-1 block truncate text-[11px]">
                                {item.message}
                              </span>
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}
            >
              <button
                type="button"
                className="relative inline-flex h-9 w-9 items-center justify-center overflow-visible rounded-full border border-slate-300 bg-white/90 text-sm font-bold"
                aria-label="Unread notifications"
              >
                <span aria-hidden="true">🔔</span>
                {app.unreadNotifications > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                    {app.unreadNotifications > 99 ? '99+' : app.unreadNotifications}
                  </span>
                ) : null}
              </button>
            </Dropdown>
            <Dropdown
              trigger={['click']}
              placement="bottomRight"
              dropdownRender={() => (
                <div className="theme-panel min-w-[18rem] rounded-xl border p-3 shadow-xl">
                  <p className="font-['Space_Grotesk'] text-sm font-bold text-slate-800">{currentUser.name}</p>
                  <p className="theme-subtext mt-0.5 text-xs capitalize">
                    {currentUser.role} · {currentUser.registrationNumber}
                  </p>
                  <p className="theme-subtext mt-1 text-[11px] uppercase tracking-wide">
                    Scope: {currentUser.role} {'>'} {managedRoleLabel}
                  </p>
                  <div className="mt-3 grid gap-2">
                    <button
                      type="button"
                      className="theme-panel theme-border rounded-lg border px-3 py-1.5 text-left text-xs font-semibold"
                      onClick={openProfileModal}
                    >
                      Update Profile
                    </button>
                    <button
                      type="button"
                      className="theme-panel theme-border rounded-lg border px-3 py-1.5 text-left text-xs font-semibold"
                      onClick={openTwoFactorModal}
                    >
                      Two-Factor Security
                    </button>
                    <button
                      type="button"
                      className="theme-panel theme-border rounded-lg border px-3 py-1.5 text-left text-xs font-semibold"
                      onClick={openResetPasswordModal}
                    >
                      Reset Password
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-rose-700 px-3 py-1.5 text-left text-xs font-semibold text-white"
                      onClick={app.handleLogout}
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            >
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white/90"
                aria-label="Open profile menu"
              >
                <span className="block h-[30px] w-[30px] overflow-hidden rounded-full bg-emerald-700">
                  {currentUserAvatar ? (
                    <img
                      key={`${currentUserAvatar}-${profileAvatarVersion}`}
                      src={currentUserAvatar}
                      alt={currentUser.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-white">
                      {currentUser.name?.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
              </button>
            </Dropdown>
            <button
              type="button"
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              Names
            </button>
          </div>
        </div>
      </header>

      <div className="grid h-full min-h-0 items-stretch overflow-hidden lg:grid-cols-[22rem_1fr]">
        <Sidebar
          densityMode={densityMode}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          currentUser={currentUser}
          activeTarget={app.activeTarget}
          activeScreen={activeScreen}
          setActiveScreen={setActiveScreen}
          users={app.users}
          groups={app.groups}
          inboxConversations={app.inboxConversations}
          loadConversation={handleConversationSelect}
          deleteConversation={handleDeleteConversation}
          unreadNotifications={app.unreadNotifications}
        />
        {activeScreen === 'conversations' ? (
          <ChatPanel
            densityMode={densityMode}
            setDensityMode={setDensityMode}
            currentUser={currentUser}
            activeTarget={app.activeTarget}
            chatBusy={app.chatBusy}
            error={app.error}
            typingFromUser={app.typingFromUser}
            messages={app.messages}
            onOpenSidebar={() => setIsSidebarOpen(true)}
            pendingFiles={app.pendingFiles}
            uploadBusy={app.uploadBusy}
            fileInputRef={app.fileInputRef}
            handleFileSelection={app.handleFileSelection}
            removePendingFile={app.removePendingFile}
            clearPendingFiles={app.clearPendingFiles}
            messageText={app.messageText}
            replyToMessage={app.replyToMessage}
            handleMessageInputChange={app.handleMessageInputChange}
            handleComposerKeyDown={app.handleComposerKeyDown}
            sendMessage={app.sendMessage}
            startReply={app.startReply}
            cancelReply={app.cancelReply}
            deleteChatMessage={app.deleteChatMessage}
          />
        ) : (
          <WorkspacePanel
            activeScreen={activeScreen}
            currentUser={currentUser}
            users={app.users}
            groups={app.groups}
            loadManagedUsers={app.loadManagedUsers}
            searchUsers={app.searchUsers}
            createGroup={app.createGroup}
            updateGroup={app.updateGroup}
            addGroupMembers={app.addGroupMembers}
            removeGroupMembers={app.removeGroupMembers}
            transferGroupOwnership={app.transferGroupOwnership}
            leaveGroup={app.leaveGroup}
            deleteGroup={app.deleteGroup}
            promoteGroupAdmin={app.promoteGroupAdmin}
            demoteGroupAdmin={app.demoteGroupAdmin}
            uploadGroupAvatar={app.uploadGroupAvatar}
            createManagedUser={app.createManagedUser}
            updateManagedUser={app.updateManagedUser}
            deleteManagedUser={app.deleteManagedUser}
            loadConversation={handleConversationSelect}
            messageSearchTerm={app.messageSearchTerm}
            setMessageSearchTerm={app.setMessageSearchTerm}
            searchMessages={app.searchMessages}
            searchBusy={app.searchBusy}
            messageSearchResults={app.messageSearchResults}
            openSearchResult={handleSearchResultOpen}
            setPermissionTargetUserId={app.setPermissionTargetUserId}
            permissionReason={app.permissionReason}
            setPermissionReason={app.setPermissionReason}
            permissionExpiresAt={app.permissionExpiresAt}
            setPermissionExpiresAt={app.setPermissionExpiresAt}
            createPermissionRequest={app.createPermissionRequest}
            permissions={app.permissions}
            permissionsBusy={app.permissionsBusy}
            isAdminView={app.isAdminView}
            adminRemark={app.adminRemark}
            setAdminRemark={app.setAdminRemark}
            adminExpiresAt={app.adminExpiresAt}
            setAdminExpiresAt={app.setAdminExpiresAt}
            updatePermissionRequest={app.updatePermissionRequest}
            chatPermissions={app.chatPermissions}
            chatPermissionsBusy={app.chatPermissionsBusy}
            revokeChatPermission={app.revokeChatPermission}
            notifications={app.notifications}
            unreadNotifications={app.unreadNotifications}
            markNotificationRead={app.markNotificationRead}
            markAllNotificationsRead={app.markAllNotificationsRead}
            deleteNotification={app.deleteNotification}
            deleteNotificationsBulk={app.deleteNotificationsBulk}
            onOpenSidebar={() => setIsSidebarOpen(true)}
          />
        )}
      </div>

      <footer className="app-footer border-t px-4 py-2 sm:px-6">
        <p className="text-center text-xs font-medium opacity-85">
          Permission Based Chat System · Secure role-scoped messaging workspace
        </p>
      </footer>

      <Modal
        title="Update Profile"
        open={isProfileModalOpen}
        width={700}
        onCancel={() => setIsProfileModalOpen(false)}
        onOk={() => void saveProfile()}
        okText="Save"
        confirmLoading={profileBusy}
      >
        <div className="grid gap-3">
          <AppInput
            value={profileForm.name}
            placeholder="Full name"
            onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <AppInput
            type="email"
            value={profileForm.email}
            placeholder="Email"
            onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <AppInput
            value={profileForm.registrationNumber}
            placeholder="Registration number"
            onChange={(event) =>
              setProfileForm((prev) => ({ ...prev, registrationNumber: event.target.value }))
            }
          />
          <AppInput
            type="password"
            value={profileForm.password}
            placeholder="New password (optional)"
            onChange={(event) => setProfileForm((prev) => ({ ...prev, password: event.target.value }))}
          />
          <div className="theme-panel theme-border flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
            <div className="mx-auto h-24 w-24 overflow-hidden rounded-full border border-slate-200 sm:mx-0">
              {avatarPreview ? (
                <img
                  width={96}
                  height={96}
                  alt="Avatar preview"
                  src={toAbsoluteAssetUrl(avatarPreview) || avatarPreview}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xl font-bold text-slate-600">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <label className="theme-subtext mb-1 block text-xs font-semibold uppercase tracking-wide">
                Upload avatar
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setAvatarFile(file);

                  if (!file) {
                    setAvatarPreview(toAbsoluteAssetUrl(currentUser.avatar || null));
                    return;
                  }

                  const reader = new FileReader();
                  reader.onload = () => {
                    setAvatarPreview(typeof reader.result === 'string' ? reader.result : null);
                  };
                  reader.readAsDataURL(file);
                }}
                className="block w-full text-xs sm:text-sm"
              />
              {avatarFile ? (
                <p className="theme-subtext mt-1 truncate text-xs">Selected: {avatarFile.name}</p>
              ) : null}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        title="Two-Factor Authentication"
        open={isTwoFactorModalOpen}
        onCancel={() => setIsTwoFactorModalOpen(false)}
        footer={null}
      >
        <div className="grid gap-3">
          <p className="theme-subtext text-sm">
            Status: <strong>{currentUser.twoFactorEnabled ? 'Enabled' : 'Disabled'}</strong>
          </p>

          {!currentUser.twoFactorEnabled ? (
            <>
              <button
                type="button"
                disabled={twoFactorBusy}
                onClick={() => void startTwoFactorEnableFlow()}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {twoFactorBusy ? 'Preparing QR...' : 'Enable Two-Factor'}
              </button>
              {twoFactorQrImageDataUrl ? (
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                  <img
                    src={twoFactorQrImageDataUrl}
                    alt="Scan this QR in your authenticator app"
                    className="mx-auto h-44 w-44 rounded-md border border-slate-200"
                  />
                </div>
              ) : null}
              {twoFactorManualKey ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Manual key: <strong>{twoFactorManualKey}</strong>
                </p>
              ) : null}
              {twoFactorChallengeId ? (
                <>
                  <AppInput
                    value={twoFactorCode}
                    placeholder="Enter 6-digit verification code"
                    onChange={(event) =>
                      setTwoFactorCode(event.target.value.replace(/\D+/g, '').slice(0, 6))
                    }
                  />
                  <button
                    type="button"
                    disabled={twoFactorBusy || twoFactorCode.length !== 6}
                    onClick={() => void verifyTwoFactorEnableFlow()}
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-60"
                  >
                    Verify & Enable
                  </button>
                </>
              ) : null}
            </>
          ) : (
            <>
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                Recovery codes remaining:{' '}
                <strong>{twoFactorRecoveryStatus?.remaining ?? 'unknown'}</strong>
              </p>
              <AppInput
                value={disableTwoFactorCode}
                placeholder="Enter 6-digit authenticator code to disable"
                onChange={(event) =>
                  setDisableTwoFactorCode(event.target.value.replace(/\D+/g, '').slice(0, 6))
                }
              />
              <AppInput
                type="password"
                value={recoveryRegeneratePassword}
                placeholder="Enter current password"
                onChange={(event) => setRecoveryRegeneratePassword(event.target.value)}
              />
              <button
                type="button"
                disabled={twoFactorBusy}
                onClick={() => void regenerateRecoveryCodesFlow()}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 disabled:opacity-60"
              >
                {twoFactorBusy ? 'Regenerating...' : 'Regenerate Recovery Codes'}
              </button>
              {twoFactorRecoveryCodes.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="mb-2 text-xs font-semibold text-amber-800">Save these recovery codes now:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono text-amber-900">
                    {twoFactorRecoveryCodes.map((item) => (
                      <span key={item} className="rounded border border-amber-300 bg-white px-2 py-1 text-center">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                disabled={twoFactorBusy || disableTwoFactorCode.length !== 6}
                onClick={() => void disableTwoFactorFlow()}
                className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {twoFactorBusy ? 'Disabling...' : 'Disable Two-Factor'}
              </button>
            </>
          )}
        </div>
      </Modal>

      <Modal
        title="Reset Password"
        open={isResetPasswordModalOpen}
        onCancel={() => setIsResetPasswordModalOpen(false)}
        onOk={() => void handleResetPassword()}
        okText="Update Password"
        confirmLoading={resetPasswordBusy}
      >
        <div className="grid gap-3">
          <AppInput
            type="password"
            value={resetPasswordForm.newPassword}
            placeholder="New password"
            onChange={(event) =>
              setResetPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
            }
          />
          <AppInput
            type="password"
            value={resetPasswordForm.confirmPassword}
            placeholder="Confirm new password"
            onChange={(event) =>
              setResetPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
            }
          />
          <p className="theme-subtext text-xs">
            Use at least 8 characters with uppercase, lowercase, and a number.
          </p>
        </div>
      </Modal>
    </main>
  );
};

export default App;
