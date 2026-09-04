import { useState } from "react";
import { useChats } from "../context/ChatContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "./Avatar.jsx";
import { mediaUrl } from "../lib/api.js";
import NewChatModal from "./NewChatModal.jsx";
import ProfileModal from "./ProfileModal.jsx";
import NewGroupModal from "./NewGroupModal.jsx";
import {
  chatName,
  chatAvatar,
  messagePreview,
  formatChatTime,
  otherParticipant,
} from "../lib/chatUtils.js";

function ChatRow({ chat, active, currentUserId, onClick }) {
  const name = chatName(chat, currentUserId);
  const other = otherParticipant(chat, currentUserId);

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-neutral-50 ${
        active ? "bg-neutral-100" : ""
      }`}
    >
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
          {chat.unreadCount > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-xs font-medium text-white">
              {chat.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function Sidebar() {
  const { chats, activeChatId, selectChat, loading, error, currentUserId } = useChats();
  const { user, logout } = useAuth();
  const [query, setQuery] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);

  // A user with no name has never completed setup — open it for them once
  const needsSetup = Boolean(user) && !user.name;

  const visible = query.trim()
    ? chats.filter((c) =>
        chatName(c, currentUserId).toLowerCase().includes(query.trim().toLowerCase())
      )
    : chats;

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
          placeholder="Search chats"
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
            {query ? "No chats match that search" : "No chats yet"}
          </p>
        )}

        {visible.map((chat) => (
          <ChatRow
            key={chat._id}
            chat={chat}
            active={chat._id === activeChatId}
            currentUserId={currentUserId}
            onClick={() => selectChat(chat._id)}
          />
        ))}
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

      {(showProfile || needsSetup) && (
        <ProfileModal
          firstTime={needsSetup}
          onClose={() => setShowProfile(false)}
        />
      )}
    </aside>
  );
}