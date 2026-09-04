import { useState, useEffect } from "react";
import { useChats } from "../context/ChatContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "./Avatar.jsx";
import api, { mediaUrl } from "../lib/api.js";
import {
  notificationsSupported,
  notificationPermission,
  requestNotificationPermission,
} from "../lib/notify.js";
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

function ChatRow({ chat, active, currentUserId, onClick, onPin, onFavourite, onArchive, onMute, onDelete }) {
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
          {chat.isFavourite && (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-rose-500" fill="currentColor">
              <path d="M12 21s-7-4.6-9.3-8.3A5.4 5.4 0 0 1 12 6a5.4 5.4 0 0 1 9.3 6.7C19 16.4 12 21 12 21z" />
            </svg>
          )}
          {chat.isMuted && (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l18 18M18 8a6 6 0 0 0-9.3-5M6 9v3l-2 3h11M9 19a3 3 0 0 0 6 0" />
            </svg>
          )}
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

      {/* Chevron on hover, matching WhatsApp Web's row control */}
      <div className="absolute bottom-4 right-3">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className={`rounded p-0.5 text-neutral-400 transition hover:text-neutral-700 ${
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          aria-label="Chat options"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {menuOpen && (
          <>
            {/* Invisible backdrop so the next click closes the menu */}
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute bottom-7 right-0 z-20 w-52 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg">
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
                  onFavourite();
                  setMenuOpen(false);
                }}
                className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100"
              >
                {chat.isFavourite ? "Remove from favourites" : "Add to favourites"}
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
                  onMute();
                  setMenuOpen(false);
                }}
                className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100"
              >
                {chat.isMuted ? "Unmute" : "Mute"}
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
    toggleMute,
    toggleFavourite,
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
  const [showMenu, setShowMenu] = useState(false);
  const [filter, setFilter] = useState("all");
  const [permission, setPermission] = useState(notificationPermission());

  const enableNotifications = async () => {
    setPermission(await requestNotificationPermission());
  };
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

  // Chips narrow the list further
  const filtered = matches.filter((c) => {
    if (filter === "unread") return (c.unreadCount || 0) > 0;
    if (filter === "favourites") return c.isFavourite;
    if (filter === "groups") return c.isGroup;
    return true;
  });

  const archived = filtered.filter((c) => c.isArchived);

  // Pinned chats sit above the rest; both keep their recency order
  const active = filtered.filter((c) => !c.isArchived);
  const visible = [
    ...active.filter((c) => c.isPinned),
    ...active.filter((c) => !c.isPinned),
  ];

  return (
    <aside className="flex h-full w-full flex-col border-r border-neutral-200 bg-white sm:w-96">
      <header className="flex items-center justify-between px-5 pb-3 pt-5">
        <h1 className="text-xl font-semibold text-neutral-900">Chats</h1>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNewChat(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700"
            title="New chat"
            aria-label="New chat"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
              title="Menu"
              aria-label="Menu"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <circle cx="12" cy="5" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="12" cy="19" r="1.8" />
              </svg>
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowNewGroup(true);
                    }}
                    className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100"
                  >
                    New group
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowStarred(true);
                    }}
                    className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100"
                  >
                    Starred messages
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowProfile(true);
                    }}
                    className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100"
                  >
                    Profile
                  </button>
                  <button
                    onClick={logout}
                    className="block w-full px-4 py-2 text-left text-red-600 hover:bg-red-50"
                  >
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {notificationsSupported() && permission === "default" && (
        <button
          onClick={enableNotifications}
          className="w-full bg-emerald-50 px-4 py-2 text-left text-sm text-emerald-800 transition hover:bg-emerald-100"
        >
          Turn on desktop notifications
        </button>
      )}

      <div className="px-3 pb-1">
        <div className="flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or start a new chat"
            className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
          />
        </div>
      </div>

      <div className="flex gap-2 px-3 py-2">
        {[
          { id: "all", label: "All" },
          { id: "unread", label: "Unread" },
          { id: "favourites", label: "Favourites" },
          { id: "groups", label: "Groups" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              filter === f.id
                ? "bg-emerald-100 text-emerald-800"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="px-4 py-6 text-center text-sm text-neutral-400">Loading chats...</p>
        )}

        {error && <p className="px-4 py-6 text-center text-sm text-red-600">{error}</p>}

        {!loading && !error && visible.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-neutral-400">
            {query
              ? "No chats match that name or number"
              : filter !== "all"
              ? "Nothing here"
              : "No chats yet"}
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
            onMute={() => toggleMute(chat._id)}
            onFavourite={() => toggleFavourite(chat._id)}
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
                  onMute={() => toggleMute(chat._id)}
                  onFavourite={() => toggleFavourite(chat._id)}
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