import { useState, useEffect } from "react";
import { useChats } from "../context/ChatContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "./Avatar.jsx";
import api, { mediaUrl } from "../lib/api.js";
import NewChatModal from "./NewChatModal.jsx";
import ProfileModal from "./ProfileModal.jsx";
import NewGroupModal from "./NewGroupModal.jsx";
import StarredModal from "./StarredModal.jsx";
import {
  chatName,
  chatAvatar,
  messagePreview,
  formatChatTime,
  otherParticipant,
} from "../lib/chatUtils.js";

function ChatRow({ chat, active, currentUserId, onClick, onPin, onArchive, onDelete }) {
  const name = chatName(chat, currentUserId);
  const other = otherParticipant(chat, currentUserId);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={`group relative flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-neutral-50 ${
        active ? "bg-neutral-100" : ""
      }`}
    >
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
      <Avatar
        src={chatAvatar(chat, currentUserId)}
        name={name}
        online={other?.isOnline}
      />

      <div className="min-w-0 flex-1 border-b border-neutral-100 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium text-neutral-900">{name}</span>
          <span
            className={`shrink-0 text-xs ${
              chat.unreadCount > 0 ? "text-emerald-600" : "text-neutral-400"
            }`}
          >
            {formatChatTime(chat.lastMessage?.createdAt || chat.updatedAt)}
          </span>
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-sm text-neutral-500">
            {messagePreview(chat.lastMessage, currentUserId) || "No messages yet"}
          </span>
          {chat.isPinned && (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-neutral-400" fill="currentColor">
              <path d="M16 3v2l-1 1v5l3 3v2h-5v6l-1 1-1-1v-6H6v-2l3-3V6L8 5V3z" />
            </svg>
          )}
          {chat.unreadCount > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-xs font-medium text-white">
              {chat.unreadCount}
            </span>
          )}
        </div>
      </div>
      </button>

      <div className="absolute right-2 top-3">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className={`rounded p-1 text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-700 ${
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          aria-label="Chat options"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
        </button>

        {menuOpen && (
          <>
            {/* Invisible backdrop so the next click closes the menu */}
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-7 z-20 w-40 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg">
              <button
                onClick={() => {
                  onPin();
                  setMenuOpen(false);
                }}
                className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100"
              >
                {chat.isPinned ? "Unpin" : "Pin"}
              </button>
              <button
                onClick={() => {
                  onArchive();
                  setMenuOpen(false);
                }}
                className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100"
              >
                {chat.isArchived ? "Unarchive" : "Archive"}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="block w-full px-4 py-2 text-left text-red-600 hover:bg-red-50"
              >
                Delete chat
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const {
    chats,
    activeChatId,
    selectChat,
    loading,
    error,
    currentUserId,
    togglePin,
    toggleArchive,
    deleteChat,
    openChatWith,
  } = useChats();
  const { user, logout } = useAuth();
  const [query, setQuery] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showStarred, setShowStarred] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [msgResults, setMsgResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [contactResult, setContactResult] = useState(null);

  // Debounced message search — waits for a pause in typing so we don't
  // fire a request per keystroke.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setMsgResults([]);
      setContactResult(null);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      api
        .get("/messages/search/all", { params: { q } })
        .then(({ data }) => setMsgResults(data.messages))
        .catch(() => setMsgResults([]))
        .finally(() => setSearching(false));

      // If it looks like a phone number, also look up someone you may
      // not have a chat with yet.
      if (/^\+?\d[\d\s-]{6,}$/.test(q)) {
        const phone = q.startsWith("+") ? q : `+${q.replace(/\D/g, "")}`;
        api
          .get("/users/search", { params: { phone } })
          .then(({ data }) => setContactResult(data.user))
          .catch(() => setContactResult(null));
      } else {
        setContactResult(null);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      setSearching(false);
    };
  }, [query]);

  const confirmDelete = (chat) => {
    const label = chatName(chat, currentUserId);
    if (
      confirm(
        `Delete your copy of the chat with ${label}? Messages stay visible for everyone else.`
      )
    ) {
      deleteChat(chat._id);
    }
  };

  // A user with no name has never completed setup — open it for them once
  const needsSetup = Boolean(user) && !user.name;

  /**
   * Matches the chat title, any participant's name, or any participant's
   * phone. Digits are compared with punctuation stripped, so "0300 123"
   * finds "+923001234567".
   */
  const digitsOf = (v) => (v || "").replace(/\D/g, "");

  const chatMatches = (chat, raw) => {
    const q = raw.toLowerCase();
    const qDigits = digitsOf(raw);

    if (chatName(chat, currentUserId).toLowerCase().includes(q)) return true;

    return (chat.participants || []).some((p) => {
      if (p._id === currentUserId) return false;
      if ((p.name || "").toLowerCase().includes(q)) return true;
      return qDigits.length >= 3 && digitsOf(p.phone).includes(qDigits);
    });
  };

  const matches = query.trim()
    ? chats.filter((c) => chatMatches(c, query.trim()))
    : chats;

  const archived = matches.filter((c) => c.isArchived);

  // Pinned chats sit above the rest; both keep their recency order
  const active = matches.filter((c) => !c.isArchived);
  const visible = [
    ...active.filter((c) => c.isPinned),
    ...active.filter((c) => !c.isPinned),
  ];

  return (
    <aside className="flex h-full w-full flex-col border-r border-neutral-200 bg-white sm:w-96">
      <header className="flex items-center justify-between bg-neutral-100 px-4 py-2.5">
        <button
          onClick={() => setShowProfile(true)}
          className="flex items-center gap-3 rounded px-1 py-0.5 transition hover:bg-neutral-200"
          title="Edit profile"
        >
          <Avatar src={mediaUrl(user?.avatar)} name={user?.name || user?.phone} size="sm" />
          <span className="text-sm font-medium text-neutral-700">
            {user?.name || user?.phone}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewChat(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-800"
            title="New chat"
            aria-label="New chat"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            onClick={() => setShowStarred(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200 hover:text-amber-600"
            title="Starred messages"
            aria-label="Starred messages"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.9 6.3 6.8.8-5 4.7 1.3 6.8L12 17.3 6 20.6l1.3-6.8-5-4.7 6.8-.8z" />
            </svg>
          </button>
          <button
            onClick={logout}
            className="text-sm text-neutral-500 hover:text-neutral-800"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="px-3 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats and messages"
          className="w-full rounded-lg bg-neutral-100 px-4 py-2 text-sm outline-none placeholder:text-neutral-400 focus:bg-neutral-50"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="px-4 py-6 text-center text-sm text-neutral-400">Loading chats...</p>
        )}

        {error && <p className="px-4 py-6 text-center text-sm text-red-600">{error}</p>}

        {!loading && !error && visible.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-neutral-400">
            {query ? "No chats match that name or number" : "No chats yet"}
          </p>
        )}

        {visible.map((chat) => (
          <ChatRow
            key={chat._id}
            chat={chat}
            active={chat._id === activeChatId}
            currentUserId={currentUserId}
            onClick={() => selectChat(chat._id)}
            onPin={() => togglePin(chat._id)}
            onArchive={() => toggleArchive(chat._id)}
            onDelete={() => confirmDelete(chat)}
          />
        ))}

        {contactResult && !matches.some((c) =>
          (c.participants || []).some((p) => p._id === contactResult._id)
        ) && (
          <>
            <p className="px-4 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Not in your chats
            </p>
            <button
              onClick={async () => {
                await openChatWith(contactResult._id);
                setQuery("");
              }}
              className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-neutral-50"
            >
              <Avatar
                src={mediaUrl(contactResult.avatar)}
                name={contactResult.name || contactResult.phone}
                size="sm"
                online={contactResult.isOnline}
              />
              <div className="min-w-0 flex-1 border-b border-neutral-100 pb-2">
                <p className="truncate text-sm font-medium text-neutral-800">
                  {contactResult.name || contactResult.phone}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {contactResult.phone} · tap to start a chat
                </p>
              </div>
            </button>
          </>
        )}

        {query.trim().length >= 2 && (
          <>
            <p className="px-4 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Messages {searching && "..."}
            </p>

            {!searching && msgResults.length === 0 && (
              <p className="px-4 pb-2 text-sm text-neutral-400">No matching messages</p>
            )}

            {msgResults.map((m) => (
              <button
                key={m._id}
                onClick={() => selectChat(m.chat?._id || m.chat)}
                className="flex w-full items-start gap-3 px-4 py-2 text-left transition hover:bg-neutral-50"
              >
                <Avatar
                  src={mediaUrl(m.sender?.avatar)}
                  name={m.sender?.name}
                  size="sm"
                />
                <div className="min-w-0 flex-1 border-b border-neutral-100 pb-2">
                  <p className="truncate text-sm font-medium text-neutral-800">
                    {m.sender?._id === currentUserId ? "You" : m.sender?.name}
                    <span className="ml-1 font-normal text-neutral-400">
                      in{" "}
                      {m.chat?.isGroup
                        ? m.chat.groupName
                        : m.sender?._id === currentUserId
                        ? "chat"
                        : m.sender?.name}
                    </span>
                  </p>
                  <p className="truncate text-sm text-neutral-500">{m.content}</p>
                  <p className="text-xs text-neutral-400">
                    {formatChatTime(m.createdAt)}
                  </p>
                </div>
              </button>
            ))}
          </>
        )}

        {archived.length > 0 && (
          <>
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm text-neutral-500 transition hover:bg-neutral-50"
            >
              <span>Archived ({archived.length})</span>
              <span className="text-xs">{showArchived ? "Hide" : "Show"}</span>
            </button>

            {showArchived &&
              archived.map((chat) => (
                <ChatRow
                  key={chat._id}
                  chat={chat}
                  active={chat._id === activeChatId}
                  currentUserId={currentUserId}
                  onClick={() => selectChat(chat._id)}
                  onPin={() => togglePin(chat._id)}
                  onArchive={() => toggleArchive(chat._id)}
                  onDelete={() => confirmDelete(chat)}
                />
              ))}
          </>
        )}
      </div>

      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onNewGroup={() => {
            setShowNewChat(false);
            setShowNewGroup(true);
          }}
        />
      )}

      {showNewGroup && <NewGroupModal onClose={() => setShowNewGroup(false)} />}

      {showStarred && <StarredModal onClose={() => setShowStarred(false)} />}

      {(showProfile || needsSetup) && (
        <ProfileModal
          firstTime={needsSetup}
          onClose={() => setShowProfile(false)}
        />
      )}
    </aside>
  );
}