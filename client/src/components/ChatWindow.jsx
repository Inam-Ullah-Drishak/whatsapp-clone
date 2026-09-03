import { useEffect, useRef, useState } from "react";
import { useChats } from "../context/ChatContext.jsx";
import { useMessages } from "../context/MessageContext.jsx";
import { useSocketEvent } from "../context/SocketContext.jsx";
import Avatar from "./Avatar.jsx";
import MessageBubble from "./MessageBubble.jsx";
import Composer from "./Composer.jsx";
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
  const { activeChat, activeChatId, currentUserId } = useChats();
  const { messages, loading, hasMore, loadOlder, loadingOlder } = useMessages();

  const [typingUsers, setTypingUsers] = useState([]);
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);

  const other = otherParticipant(activeChat, currentUserId);
  const name = chatName(activeChat, currentUserId);

  // Jump to the newest message on load and whenever one arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages.length, activeChatId]);

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
      <header className="flex items-center gap-3 border-b border-neutral-200 bg-neutral-100 px-4 py-2.5">
        <Avatar
          src={chatAvatar(activeChat, currentUserId)}
          name={name}
          size="sm"
          online={other?.isOnline}
        />
        <div className="min-w-0">
          <p className="truncate font-medium text-neutral-900">{name}</p>
          <p className="truncate text-xs text-neutral-500">{subtitle()}</p>
        </div>
      </header>

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
              />
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      <Composer />
    </section>
  );
}