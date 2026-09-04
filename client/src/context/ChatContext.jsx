import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../lib/api.js";
import { useAuth } from "./AuthContext.jsx";
import { useSocket, useSocketEvent } from "./SocketContext.jsx";
import { showNotification, setTitleBadge } from "../lib/notify.js";
import { chatName } from "../lib/chatUtils.js";

const ChatContext = createContext(null);

/** Newest activity first — the sidebar's ordering. */
const byRecent = (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt);

export const ChatProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const { emit } = useSocket();

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadChats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/chats");
      setChats(data.chats.sort(byRecent));
    } catch {
      setError("Could not load chats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadChats();
    else {
      setChats([]);
      setActiveChatId(null);
    }
  }, [isAuthenticated, loadChats]);

  /** Open (or create) a direct chat with a user, then select it. */
  const openChatWith = useCallback(async (userId) => {
    const { data } = await api.post("/chats", { userId });

    // Sockets auto-join rooms on connect, so a chat created afterwards
    // needs an explicit join or its messages never arrive live.
    emit("chat:join", data.chat._id);

    setChats((prev) => {
      const exists = prev.some((c) => c._id === data.chat._id);
      return exists ? prev : [data.chat, ...prev].sort(byRecent);
    });
    setActiveChatId(data.chat._id);
    return data.chat;
  }, [emit]);

  const selectChat = useCallback(
    async (chatId) => {
      setActiveChatId(chatId);

      // Optimistically clear the badge, then tell the server
      setChats((prev) =>
        prev.map((c) => (c._id === chatId ? { ...c, unreadCount: 0 } : c))
      );
      try {
        await api.patch(`/messages/${chatId}/read`);
      } catch {
        // Not fatal — the badge will correct itself on next load
      }
    },
    []
  );

  const togglePin = useCallback(async (chatId) => {
    const { data } = await api.patch(`/chats/${chatId}/pin`);
    setChats((prev) =>
      prev.map((c) => (c._id === chatId ? { ...c, isPinned: data.pinned } : c))
    );
  }, []);

  const toggleFavourite = useCallback(async (chatId) => {
    const { data } = await api.patch(`/chats/${chatId}/favourite`);
    setChats((prev) =>
      prev.map((c) => (c._id === chatId ? { ...c, isFavourite: data.favourite } : c))
    );
  }, []);

  const toggleMute = useCallback(async (chatId) => {
    const { data } = await api.patch(`/chats/${chatId}/mute`);
    setChats((prev) =>
      prev.map((c) => (c._id === chatId ? { ...c, isMuted: data.muted } : c))
    );
  }, []);

  const toggleArchive = useCallback(async (chatId) => {
    const { data } = await api.patch(`/chats/${chatId}/archive`);
    setChats((prev) =>
      prev.map((c) => (c._id === chatId ? { ...c, isArchived: data.archived } : c))
    );
  }, []);

  const deleteChat = useCallback(async (chatId) => {
    await api.delete(`/chats/${chatId}`);
    setChats((prev) => prev.filter((c) => c._id !== chatId));
    setActiveChatId((cur) => (cur === chatId ? null : cur));
  }, []);

  /* ---- Live updates ---- */

  // Fired whenever a message lands in any of your chats
  useSocketEvent("chat:updated", ({ chatId, lastMessage, unreadCount, updatedAt }) => {
    setChats((prev) => {
      const found = prev.find((c) => c._id === chatId);

      // Notify only for other people's messages, in chats that aren't
      // muted, and only when the user isn't already looking at them.
      const fromSomeoneElse = lastMessage?.sender?._id !== user?._id;
      const looking = chatId === activeChatId && !document.hidden;

      if (found && fromSomeoneElse && !found.isMuted && !looking) {
        const body =
          lastMessage?.type === "text"
            ? lastMessage.content
            : lastMessage?.type
            ? `Sent ${lastMessage.type === "image" ? "a photo" : "an attachment"}`
            : "New message";

        showNotification({
          title: chatName(found, user?._id),
          body,
          tag: chatId,
          onClick: () => setActiveChatId(chatId),
        });
      }

      // A chat we don't have yet (someone messaged us first) — refetch
      if (!found) {
        emit("chat:join", chatId);
        loadChats();
        return prev;
      }

      return prev
        .map((c) =>
          c._id === chatId
            ? {
                ...c,
                lastMessage,
                updatedAt,
                // Don't badge the chat the user is currently reading
                unreadCount: c._id === activeChatId ? 0 : unreadCount,
              }
            : c
        )
        .sort(byRecent);
    });
  });

  // A group was renamed, or members changed
  useSocketEvent("chat:disappearing", ({ chatId, hours }) => {
    setChats((prev) =>
      prev.map((c) => (c._id === chatId ? { ...c, disappearingAfter: hours } : c))
    );
  });

  useSocketEvent("group:updated", ({ chat }) => {
    setChats((prev) =>
      prev.map((c) =>
        c._id === chat._id
          ? // Keep our own unread count: the broadcast can't carry a
            // per-user number, so it arrives as 0 for everyone.
            { ...chat, unreadCount: c.unreadCount }
          : c
      )
    );
  });

  useSocketEvent("group:removed", ({ chatId, userId }) => {
    if (userId !== user?._id) return;
    setChats((prev) => prev.filter((c) => c._id !== chatId));
    setActiveChatId((cur) => (cur === chatId ? null : cur));
  });

  useSocketEvent("group:deleted", ({ chatId }) => {
    setChats((prev) => prev.filter((c) => c._id !== chatId));
    setActiveChatId((cur) => (cur === chatId ? null : cur));
  });

  useSocketEvent("presence:update", ({ userId, isOnline, lastSeen }) => {
    setChats((prev) =>
      prev.map((c) => ({
        ...c,
        participants: c.participants?.map((p) =>
          p._id === userId ? { ...p, isOnline, lastSeen: lastSeen ?? p.lastSeen } : p
        ),
      }))
    );
  });

  // Unread total in the tab title, muted chats excluded
  useEffect(() => {
    const total = chats
      .filter((c) => !c.isMuted)
      .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    setTitleBadge(total);
  }, [chats]);

  const activeChat = chats.find((c) => c._id === activeChatId) || null;

  const value = {
    chats,
    setChats,
    activeChat,
    activeChatId,
    selectChat,
    setActiveChatId,
    openChatWith,
    togglePin,
    toggleArchive,
    toggleMute,
    toggleFavourite,
    deleteChat,
    loadChats,
    loading,
    error,
    currentUserId: user?._id,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChats = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChats must be used inside ChatProvider");
  return ctx;
};
