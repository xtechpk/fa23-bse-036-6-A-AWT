import { Dispatch, SetStateAction, useMemo } from 'react';
import { ChatTarget, ChatUser, DensityMode, InboxConversation } from '../../types/chat';

interface SidebarProps {
  densityMode: DensityMode;
  isOpen: boolean;
  onClose: () => void;
  currentUser: ChatUser;
  activeTarget: ChatTarget | null;
  activeScreen: 'conversations' | 'directory' | 'search' | 'permissions' | 'notifications';
  setActiveScreen: Dispatch<
    SetStateAction<'conversations' | 'directory' | 'search' | 'permissions' | 'notifications'>
  >;
  users: ChatUser[];
  inboxConversations: InboxConversation[];
  loadConversation: (target: {
    kind: 'private' | 'group';
    id: string;
    name: string;
    avatar?: string | null;
  }) => Promise<void>;
  unreadNotifications: number;
}

const Sidebar = ({
  densityMode,
  isOpen,
  onClose,
  currentUser,
  activeTarget,
  activeScreen,
  setActiveScreen,
  users,
  inboxConversations,
  loadConversation,
  unreadNotifications,
}: SidebarProps) => {
  const managedRoles = useMemo(
    () =>
      currentUser.role === 'superadmin'
        ? ['admin']
        : currentUser.role === 'admin'
          ? ['user']
          : ['admin'],
    [currentUser.role]
  );

  const screens: Array<{
    key: 'conversations' | 'directory' | 'search' | 'permissions' | 'notifications';
    label: string;
    count?: number;
  }> = [
    { key: 'conversations', label: 'Inbox', count: inboxConversations.length },
    {
      key: 'directory',
      label:
        currentUser.role === 'superadmin'
          ? 'Admins'
          : currentUser.role === 'admin'
            ? 'Users'
            : 'Support',
      count: users.filter((user) => managedRoles.includes(user.role)).length,
    },
    { key: 'search', label: 'Search' },
    { key: 'permissions', label: 'Permissions' },
    { key: 'notifications', label: 'Notifications', count: unreadNotifications },
  ];

  const panelClass = `theme-panel mt-4 rounded-2xl border shadow-sm backdrop-blur ${
    densityMode === 'compact' ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4'
  }`;
  const sectionTitleClass =
    "mb-2 font-['Space_Grotesk'] text-xs font-bold uppercase tracking-[0.12em] theme-subtext";
  const nameButtonClass =
    'w-full rounded-xl border border-transparent theme-soft px-3 py-2 text-left text-sm transition hover:bg-[var(--panel-bg)]';
  const emptyStateClass =
    'rounded-xl border border-dashed theme-border theme-soft px-3 py-3 text-center text-xs theme-subtext';

  return (
    <aside
      id="chat-sidebar"
      role="complementary"
      aria-label="Chat workspace controls"
      className={`fixed inset-y-0 left-0 z-50 h-dvh w-[88vw] max-w-sm overflow-y-auto border-r theme-border theme-soft p-3 backdrop-blur-lg transition-transform duration-200 lg:static lg:z-10 lg:h-full lg:min-h-0 lg:w-full lg:max-w-none lg:translate-x-0 lg:border-r ${
        isOpen ? 'translate-x-0' : '-translate-x-[105%]'
      }`}
    >
      <header className="theme-panel flex items-center justify-end gap-2 rounded-2xl border p-2 shadow-sm lg:hidden">
        <button
          type="button"
          className="theme-muted inline-flex rounded-lg px-2.5 py-1.5 text-xs font-semibold transition"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          Close
        </button>
      </header>

      <nav className={`${panelClass} mt-3 lg:mt-4`} aria-label="Sidebar screens">
        <h3 className={sectionTitleClass}>Workspace</h3>
        <div className="grid gap-2">
          {screens.map((screen) => (
            <button
              key={screen.key}
              type="button"
              onClick={() => setActiveScreen(screen.key)}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition ${
                activeScreen === screen.key
                  ? 'theme-accent-btn'
                  : 'theme-panel border hover:bg-[var(--panel-soft-bg)]'
              }`}
            >
              <span>{screen.label}</span>
              <span className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-none ${
                activeScreen === screen.key ? 'bg-white/20 text-white' : 'theme-muted theme-subtext'
              }`}>
                {screen.count ?? 0}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <section className={panelClass}>
        <h3 className={sectionTitleClass}>Inbox</h3>
        <ul className="grid gap-2">
          {inboxConversations.map((conversation) => (
            <li key={conversation.id}>
              {(() => {
                const isActive =
                  activeTarget?.id === conversation.threadId &&
                  activeTarget.kind === (conversation.type === 'group' ? 'group' : 'private');

                return (
              <button
                type="button"
                className={`${nameButtonClass} ${isActive ? 'border-[color:var(--accent-bg)] bg-[color:var(--panel-muted-bg)] shadow-sm' : ''}`}
                onClick={() => {
                  setActiveScreen('conversations');
                  void loadConversation({
                    kind: conversation.type === 'group' ? 'group' : 'private',
                    id: conversation.threadId,
                    name: conversation.name,
                    avatar: conversation.type === 'private' ? conversation.peer?.avatar || null : null,
                  });
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                    {conversation.type === 'private' && conversation.peer?.avatar ? (
                      <img
                        src={conversation.peer.avatar}
                        alt={conversation.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-600">
                        {conversation.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{conversation.name}</span>
                      {conversation.unreadCount > 0 ? (
                        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-semibold leading-none text-white">
                          {conversation.unreadCount}
                        </span>
                      ) : null}
                    </div>
                    {isActive ? (
                      <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wide text-[color:var(--accent-bg)]">
                        Active conversation
                      </span>
                    ) : null}
                    <span className="theme-subtext mt-1 block truncate text-[11px]">
                      {conversation.lastMessagePreview || 'No message preview'}
                    </span>
                  </div>
                </div>
              </button>
                );
              })()}
            </li>
          ))}
        </ul>
        {inboxConversations.length === 0 ? (
          <p className={emptyStateClass}>No names available yet.</p>
        ) : null}
      </section>
    </aside>
  );
};

export default Sidebar;
