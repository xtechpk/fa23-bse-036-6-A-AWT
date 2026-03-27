import {
  ChangeEvent,
  Dispatch,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ChatMessage, ChatTarget, ChatUser, DensityMode, UploadedAttachment } from '../../types/chat';

interface ChatPanelProps {
  densityMode: DensityMode;
  setDensityMode: Dispatch<SetStateAction<DensityMode>>;
  currentUser: ChatUser;
  activeTarget: ChatTarget | null;
  chatBusy: boolean;
  error: string;
  typingFromUser: ChatUser | null;
  messages: ChatMessage[];
  onOpenSidebar: () => void;

  pendingFiles: File[];
  uploadBusy: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  handleFileSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  removePendingFile: (index: number) => void;
  clearPendingFiles: () => void;

  messageText: string;
  replyToMessage: ChatMessage | null;
  handleMessageInputChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleComposerKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  sendMessage: () => Promise<void>;
  startReply: (message: ChatMessage) => void;
  cancelReply: () => void;
  deleteChatMessage: (message: ChatMessage, deleteFor: 'me') => Promise<void>;
}

const getAttachmentUrl = (messageAttachment: UploadedAttachment) => {
  return messageAttachment.url || messageAttachment.publicUrl || '';
};

const getTickDisplay = (tick?: ChatMessage['tick']) => {
  if (tick === 'single') return { symbol: '✓', className: 'text-slate-500' };
  if (tick === 'double') return { symbol: '✓✓', className: 'text-slate-500' };
  if (tick === 'blue') return { symbol: '✓✓', className: 'text-sky-600' };
  return { symbol: '', className: 'text-slate-500' };
};

const toReplyPreview = (message: ChatMessage) => {
  const text = (message.content || '').trim();
  if (!text) {
    return 'Attachment';
  }

  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
};

const ChatPanel = ({
  densityMode,
  setDensityMode,
  currentUser,
  activeTarget,
  chatBusy,
  error,
  typingFromUser,
  messages,
  onOpenSidebar,
  pendingFiles,
  uploadBusy,
  fileInputRef,
  handleFileSelection,
  removePendingFile,
  clearPendingFiles,
  messageText,
  replyToMessage,
  handleMessageInputChange,
  handleComposerKeyDown,
  sendMessage,
  startReply,
  cancelReply,
  deleteChatMessage,
}: ChatPanelProps) => {
  const [openActionMenuFor, setOpenActionMenuFor] = useState<string | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const messageListBottomRef = useRef<HTMLDivElement | null>(null);
  const rowGapClass = densityMode === 'compact' ? 'gap-2 px-3 py-3' : 'gap-3 px-4 py-4';
  const bubbleBase = densityMode === 'compact' ? 'px-3 py-2' : 'px-3.5 py-2.5';

  useEffect(() => {
    if (chatBusy) {
      return;
    }

    if (messageListBottomRef.current) {
      messageListBottomRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
      return;
    }

    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [activeTarget?.id, chatBusy, messages.length]);

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" aria-label="Chat conversation panel">
      <header className="theme-panel sticky top-0 z-20 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur" role="banner">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className="inline-flex rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800 lg:hidden"
            onClick={onOpenSidebar}
            aria-label="Open sidebar"
            aria-controls="chat-sidebar"
          >
            Menu
          </button>
          {activeTarget?.kind === 'private' ? (
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
              {activeTarget.avatar ? (
                <img
                  src={activeTarget.avatar}
                  alt={activeTarget.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-600">
                  {activeTarget.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          ) : null}
          <h2 className="truncate font-['Space_Grotesk'] text-base font-bold sm:text-lg">
            {activeTarget ? activeTarget.name : 'Select a user or group'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="theme-soft theme-border inline-flex rounded-lg border p-1" role="group" aria-label="Density mode">
            <button
              type="button"
              aria-pressed={densityMode === 'comfortable'}
              onClick={() => setDensityMode('comfortable')}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                densityMode === 'comfortable' ? 'theme-panel shadow-sm' : 'theme-subtext'
              }`}
            >
              Comfortable
            </button>
            <button
              type="button"
              aria-pressed={densityMode === 'compact'}
              onClick={() => setDensityMode('compact')}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                densityMode === 'compact' ? 'theme-panel shadow-sm' : 'theme-subtext'
              }`}
            >
              Compact
            </button>
          </div>
          {activeTarget ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              {activeTarget.kind}
            </span>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="mx-4 mt-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <div
        ref={messageListRef}
        className={`grid min-h-0 flex-1 content-start overflow-y-auto pb-3 ${rowGapClass}`}
        role="log"
        aria-live="polite"
      >
        {chatBusy ? (
          <div className="grid gap-3">
            <div className="h-16 w-2/3 animate-pulse rounded-2xl bg-slate-100" />
            <div className="ml-auto h-16 w-1/2 animate-pulse rounded-2xl bg-emerald-100" />
            <div className="h-16 w-3/5 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        ) : null}
        {typingFromUser ? (
          <p className="theme-subtext text-sm">{typingFromUser.name || 'Someone'} is typing...</p>
        ) : null}
        {!chatBusy && messages.length === 0 ? (
          <div className="theme-panel theme-border rounded-2xl border border-dashed px-4 py-6 text-center">
            <p className="text-sm font-semibold">No messages yet</p>
            <p className="theme-subtext mt-1 text-xs">
              Start the conversation with a first message or send an attachment.
            </p>
          </div>
        ) : null}
        {messages.map((message) => {
          const mine = message.senderId === currentUser.id;
          const tick = getTickDisplay(message.tick);
          return (
            <article
              key={message.id}
              className={`max-w-[98%] ${mine ? 'ml-auto' : 'mr-auto'} sm:max-w-[86%]`}
            >
              <div className="flex items-start gap-2">
                {!mine ? (
                  <div className="mt-1 h-8 w-8 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                    {message.sender?.avatar ? (
                      <img
                        src={message.sender.avatar}
                        alt={message.sender?.name || 'User'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-600">
                        {(message.sender?.name || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                ) : null}
                <div
                  className={`relative w-fit rounded-2xl border shadow-sm ${bubbleBase} ${
                    mine
                      ? 'border-[color:var(--panel-border)] bg-[color:var(--panel-soft-bg)]'
                      : 'border-[color:var(--panel-border)] bg-[color:var(--panel-bg)]'
                  }`}
                >
                  <header className="theme-subtext flex items-start justify-between gap-2 text-[11px]">
                    <strong>{mine ? 'You' : message.sender?.name || 'User'}</strong>
                    <div className="flex items-center gap-1.5">
                      <span>{new Date(message.createdAt).toLocaleString()}</span>
                      <button
                        type="button"
                        aria-label="Message actions"
                        className="theme-muted rounded-md px-1.5 py-0.5 text-xs font-semibold"
                        onClick={() =>
                          setOpenActionMenuFor((prev) => (prev === message.id ? null : message.id))
                        }
                      >
                        ⋮
                      </button>
                    </div>
                  </header>
                  {openActionMenuFor === message.id ? (
                    <div className="theme-panel theme-border absolute right-2 top-7 z-20 min-w-36 rounded-lg border p-1 shadow-lg">
                      <button
                        type="button"
                        className="block w-full rounded-md px-2.5 py-1.5 text-left text-xs font-semibold hover:bg-[var(--panel-soft-bg)]"
                        onClick={() => {
                          startReply(message);
                          setOpenActionMenuFor(null);
                        }}
                      >
                        Reply
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded-md px-2.5 py-1.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        onClick={() => {
                          void deleteChatMessage(message, 'me');
                          setOpenActionMenuFor(null);
                        }}
                      >
                        Delete for me
                      </button>
                    </div>
                  ) : null}
              {message.replyTo ? (
                <div className="theme-soft theme-border mt-2 rounded-lg border px-2.5 py-1.5 text-xs">
                  <p className="font-semibold">{message.replyTo.sender?.name || 'User'}</p>
                  <p className="theme-subtext mt-0.5 truncate">{toReplyPreview(message.replyTo as ChatMessage)}</p>
                </div>
              ) : null}
              <p className="mt-2 whitespace-pre-wrap text-sm">{message.content}</p>
              {Array.isArray(message.attachments) && message.attachments.length > 0 ? (
                <div className="mt-2 grid gap-2">
                  {message.attachments.map((attachment) => {
                    const attachmentUrl = getAttachmentUrl(attachment);
                    const name = attachment.fileName || attachment.originalName || 'attachment';
                    if (!attachmentUrl) {
                      return null;
                    }
                    if (attachment.mimeType.startsWith('image/')) {
                      return (
                        <a href={attachmentUrl} target="_blank" rel="noreferrer" key={attachment.id} className="block">
                          <img
                            src={attachmentUrl}
                            alt={name}
                            className="theme-border max-h-56 w-full rounded-xl border object-cover"
                          />
                        </a>
                      );
                    }
                    if (attachment.mimeType.startsWith('video/')) {
                      return (
                        <video
                          key={attachment.id}
                          src={attachmentUrl}
                          controls
                          className="theme-border max-h-56 w-full rounded-xl border bg-slate-900"
                        />
                      );
                    }
                    return (
                      <a
                        href={attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        key={attachment.id}
                        className="text-sm font-semibold text-blue-700 hover:underline"
                      >
                        {name}
                      </a>
                    );
                  })}
                </div>
              ) : null}
              <footer className="theme-subtext mt-2 flex items-center justify-between gap-3 text-[11px]">
                <span>{message.isEdited ? 'edited' : ''}</span>
                <span className={tick.className}>{tick.symbol}</span>
              </footer>
                </div>
              </div>
            </article>
          );
        })}
        <div ref={messageListBottomRef} />
      </div>

      {replyToMessage ? (
        <div className="theme-panel theme-border border-t border-dashed px-4 py-2">
          <div className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <div className="min-w-0">
              <p className="font-semibold">Replying to {replyToMessage.sender?.name || 'User'}</p>
              <p className="theme-subtext truncate">{toReplyPreview(replyToMessage)}</p>
            </div>
            <button
              type="button"
              className="theme-muted rounded-md px-2 py-1 text-[11px] font-semibold"
              onClick={cancelReply}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <form
        className="theme-panel theme-border grid gap-2 border-t px-4 py-3"
        aria-label="Message composer"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          void sendMessage();
        }}
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="file-upload" className="theme-subtext block text-xs font-semibold">
              Attach
            </label>
            {pendingFiles.length > 0 ? (
              <button
                type="button"
                className="theme-muted rounded-md px-2 py-1 text-[11px] font-semibold"
                onClick={() => {
                  clearPendingFiles();
                }}
              >
                Clear all
              </button>
            ) : null}
          </div>
          <input
            id="file-upload"
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelection}
            disabled={!activeTarget || uploadBusy}
            aria-label="Upload message attachments"
            className="theme-subtext mt-1 block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-[color:var(--panel-muted-bg)] file:px-2 file:py-1 file:text-xs file:font-semibold file:text-[color:var(--panel-text)] hover:file:brightness-95"
          />
          <ul className="mt-2 grid gap-1.5">
            {pendingFiles.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="theme-panel theme-border flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
              >
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    removePendingFile(index);
                    if (pendingFiles.length === 1 && fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="theme-muted rounded-md px-2 py-1 text-[11px] font-semibold transition hover:brightness-95"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
        <textarea
          value={messageText}
          placeholder={
            !activeTarget
              ? 'Select a chat first'
              : 'Write a message...'
          }
          onChange={handleMessageInputChange}
          onKeyDown={handleComposerKeyDown}
          disabled={!activeTarget}
          rows={densityMode === 'compact' ? 1 : 2}
          aria-label="Type your message"
          className="theme-panel theme-border min-h-[2.75rem] flex-1 resize-none rounded-xl border px-3.5 py-2 text-sm text-[color:var(--panel-text)] placeholder:text-[color:var(--panel-subtext)] outline-none transition focus:ring-2 focus:ring-emerald-200"
        />
        <button
          type="submit"
          disabled={!activeTarget || (!messageText.trim() && pendingFiles.length === 0) || uploadBusy}
          className="theme-accent-btn h-11 rounded-xl px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          Send
        </button>
        </div>
      </form>
    </section>
  );
};

export default ChatPanel;
