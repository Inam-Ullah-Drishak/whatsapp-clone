import { useEffect, useRef, useState } from "react";
import { useChats } from "../context/ChatContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useMessages } from "../context/MessageContext.jsx";
import { useSocketEvent } from "../context/SocketContext.jsx";
import Avatar from "./Avatar.jsx";
import MessageBubble from "./MessageBubble.jsx";
import Composer from "./Composer.jsx";
import GroupInfoModal from "./GroupInfoModal.jsx";
import ContactInfoModal from "./ContactInfoModal.jsx";
import {
  chatName,
  chatAvatar,
  otherParticipant,
  formatChatTime,
} from "../lib/chatUtils.js";

const dayLabel = (value) => {
  const d = new Date(value);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
};

export default function ChatWindow() {
  const { activeChat, activeChatId, currentUserId, setActiveChatId } = useChats();
  const { user } = useAuth();
  const { messages, loading, hasMore, loadOlder, loadingOlder, highlightId, setHighlightId } =
    useMessages();

  const [typingUsers, setTypingUsers] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);

  const other = otherParticipant(activeChat, currentUserId);
  const name = chatName(activeChat, currentUserId);

  // Only our own blocks are knowable — the server never reveals whether
  // the other person has blocked us.
  const iBlockedThem =
    Boolean(other) &&
    (user?.blockedUsers || []).some(
      (id) => (id._id ? id._id : id).toString() === other._id
    );

  // Jump to the newest message on load and whenever one arrives, unless
  // we've deliberately opened at an older message
  useEffect(() => {
    if (highlightId) return;
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages.length, activeChatId, highlightId]);

  // Scroll the jumped-to message into view, then clear the highlight
  useEffect(() => {
    if (!highlightId || loading) return;

    const el = document.getElementById(`msg-${highlightId}`);
    if (!el) return;

    el.scrollIntoView({ behavior: "auto", block: "center" });
    const timer = setTimeout(() => setHighlightId(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightId, loading, messages, setHighlightId]);

  useEffect(() => {
    setTypingUsers([]);
  }, [activeChatId]);

  useSocketEvent("typing:start", ({ chatId, userId, name: who }) => {
    if (chatId !== activeChatId || userId === currentUserId) return;
    setTypingUsers((prev) =>
      prev.some((u) => u.userId === userId) ? prev : [...prev, { userId, name: who }]
    );
  });

  useSocketEvent("typing:stop", ({ chatId, userId }) => {
    if (chatId !== activeChatId) return;
    setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
  });

  // Load older history when scrolled to the top
  const onScroll = (e) => {
    if (e.target.scrollTop < 60 && hasMore && !loadingOlder) loadOlder();
  };

  const subtitle = () => {
    if (typingUsers.length) {
      return activeChat?.isGroup
        ? `${typingUsers.map((u) => u.name).join(", ")} typing...`
        : "typing...";
    }
    if (activeChat?.isGroup) {
      return `${activeChat.participants?.length || 0} members`;
    }
    if (other?.isOnline) return "online";
    return other?.lastSeen ? `last seen ${formatChatTime(other.lastSeen)}` : "";
  };

  let lastDay = null;

  return (
    <section className="flex h-full flex-1 flex-col bg-[#efeae2]">
      <header className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-100 px-3 py-2.5">
        {/* Mobile only: the sidebar is hidden once a chat is open */}
        <button
          onClick={() => setActiveChatId(null)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-600 transition hover:bg-neutral-200 sm:hidden"
          aria-label="Back to chats"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <button
          onClick={() => setShowInfo(true)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded px-1 py-0.5 text-left transition hover:bg-neutral-200"
          title={activeChat?.isGroup ? "Group info" : "Contact info"}
        >
          <Avatar
            src={chatAvatar(activeChat, currentUserId)}
            name={name}
            size="sm"
            online={other?.isOnline}
          />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-medium text-neutral-900">
              {name}
              {activeChat?.disappearingAfter > 0 && (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" strokeLinecap="round" />
                </svg>
              )}
            </p>
            <p className="truncate text-xs text-neutral-500">{subtitle()}</p>
          </div>
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => activeChat?.isGroup || other ? setShowInfo(true) : null}
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-800"
            title="Chat info"
            aria-label="Chat info"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {showInfo &&
        (activeChat?.isGroup ? (
          <GroupInfoModal chat={activeChat} onClose={() => setShowInfo(false)} />
        ) : (
          other && (
            <ContactInfoModal
              person={other}
              chat={activeChat}
              onClose={() => setShowInfo(false)}
            />
          )
        ))}

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 space-y-1 overflow-y-auto py-4">
        {loadingOlder && (
          <p className="py-2 text-center text-xs text-neutral-500">Loading older messages...</p>
        )}

        {loading && (
          <p className="py-8 text-center text-sm text-neutral-500">Loading...</p>
        )}

        {!loading && messages.length === 0 && (
          <p className="py-10 text-center text-sm text-neutral-500">
            No messages yet. Say hello.
          </p>
        )}

        {messages.map((m) => {
          const day = dayLabel(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;

          return (
            <div key={m._id} className="space-y-1">
              {showDay && (
                <div className="flex justify-center py-2">
                  <span className="rounded bg-white/80 px-3 py-1 text-xs text-neutral-500 shadow-sm">
                    {day}
                  </span>
                </div>
              )}
              <MessageBubble
                message={m}
                mine={m.sender?._id === currentUserId}
                showSender={activeChat?.isGroup}
                highlighted={m._id === highlightId}
              />
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {iBlockedThem ? (
        <div className="border-t border-neutral-200 bg-neutral-100 px-4 py-4 text-center">
          <p className="text-sm text-neutral-600">
            You blocked {name}. Unblock to send messages.
          </p>
          <button
            onClick={() => setShowInfo(true)}
            className="mt-1 text-sm font-medium text-emerald-700 hover:underline"
          >
            Open contact info
          </button>
        </div>
      ) : (
        <Composer />
      )}
    </section>
  );
}