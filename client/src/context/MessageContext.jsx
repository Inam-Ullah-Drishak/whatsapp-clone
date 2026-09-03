import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../lib/api.js";
import { useAuth } from "./AuthContext.jsx";
import { useChats } from "./ChatContext.jsx";
import { useSocket, useSocketEvent } from "./SocketContext.jsx";

const MessageContext = createContext(null);

const PAGE_SIZE = 30;

export const MessageProvider = ({ children }) => {
  const { user } = useAuth();
  const { activeChatId } = useChats();
  const { emit } = useSocket();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");

  const cursorRef = useRef(null);
  // Read inside socket handlers, which close over stale state otherwise
  const activeChatIdRef = useRef(activeChatId);
  activeChatIdRef.current = activeChatId;

  /* ---- Loading ---- */

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      setHasMore(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    api
      .get(`/messages/${activeChatId}`, { params: { limit: PAGE_SIZE } })
      .then(({ data }) => {
        // Guard against a fast chat switch resolving out of order
        if (cancelled) return;
        setMessages(data.messages);
        setHasMore(data.hasMore);
        cursorRef.current = data.nextCursor;
      })
      .catch(() => !cancelled && setError("Could not load messages"))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [activeChatId]);

  const loadOlder = useCallback(async () => {
    if (!activeChatId || !hasMore || loadingOlder || !cursorRef.current) return;

    setLoadingOlder(true);
    try {
      const { data } = await api.get(`/messages/${activeChatId}`, {
        params: { limit: PAGE_SIZE, before: cursorRef.current },
      });
      setMessages((prev) => [...data.messages, ...prev]);
      setHasMore(data.hasMore);
      cursorRef.current = data.nextCursor;
    } catch {
      setError("Could not load older messages");
    } finally {
      setLoadingOlder(false);
    }
  }, [activeChatId, hasMore, loadingOlder]);

  /* ---- Sending ---- */

  const sendMessage = useCallback(
    async (content, extra = {}) => {
      const chatId = activeChatId;
      if (!chatId || (!content.trim() && !extra.mediaUrl)) return;

      // Optimistic bubble so the UI never waits on the network
      const tempId = `temp-${Date.now()}`;
      const optimistic = {
        _id: tempId,
        chat: chatId,
        sender: { _id: user._id, name: user.name, avatar: user.avatar },
        type: extra.type || "text",
        content: content.trim(),
        createdAt: new Date().toISOString(),
        status: "sending",
        readBy: [],
        deliveredTo: [],
        ...extra,
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        const { data } = await api.post("/messages", {
          chatId,
          content: content.trim(),
          ...extra,
        });

        // Swap the placeholder for the server's copy
        setMessages((prev) =>
          prev.map((m) => (m._id === tempId ? data.message : m))
        );
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) => (m._id === tempId ? { ...m, status: "failed" } : m))
        );
        throw err;
      }
    },
    [activeChatId, user]
  );

  /* ---- Live updates ---- */

  useSocketEvent("message:new", ({ message }) => {
    if (message.chat !== activeChatIdRef.current) return;

    setMessages((prev) => {
      // The sender receives this too; skip if we already have it
      if (prev.some((m) => m._id === message._id)) return prev;
      return [...prev, message];
    });

    // We're looking at this chat, so acknowledge immediately
    if (message.sender?._id !== user?._id) {
      emit("message:read", { messageId: message._id });
    }
  });

  useSocketEvent("messages:read", ({ chatId, readBy }) => {
    if (chatId !== activeChatIdRef.current) return;
    if (readBy === user?._id) return;

    // Every message we sent in this chat is now read
    setMessages((prev) =>
      prev.map((m) => (m.sender?._id === user?._id ? { ...m, status: "read" } : m))
    );
  });

  useSocketEvent("message:status", ({ messageId, status }) => {
    setMessages((prev) =>
      prev.map((m) => (m._id === messageId ? { ...m, status } : m))
    );
  });

  useSocketEvent("message:deleted", ({ messageId, chatId }) => {
    if (chatId !== activeChatIdRef.current) return;
    setMessages((prev) =>
      prev.map((m) =>
        m._id === messageId
          ? { ...m, isDeletedForEveryone: true, content: "", mediaUrl: "" }
          : m
      )
    );
  });

  const value = {
    messages,
    loading,
    loadingOlder,
    hasMore,
    error,
    sendMessage,
    loadOlder,
    currentUserId: user?._id,
  };

  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
};

export const useMessages = () => {
  const ctx = useContext(MessageContext);
  if (!ctx) throw new Error("useMessages must be used inside MessageProvider");
  return ctx;
};