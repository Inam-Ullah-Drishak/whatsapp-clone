import { useEffect, useState } from "react";
import api, { errorMessage, mediaUrl } from "../lib/api.js";
import { useChats } from "../context/ChatContext.jsx";
import { useMessages } from "../context/MessageContext.jsx";
import { otherParticipant, formatChatTime } from "../lib/chatUtils.js";
import Avatar from "./Avatar.jsx";

export default function StarredModal({ onClose }) {
  const { currentUserId, selectChat } = useChats();
  // Go through the shared action so the open chat's bubble updates too,
  // rather than calling the API directly and leaving it stale.
  const { toggleStar } = useMessages();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/messages/starred/all")
      .then(({ data }) => setMessages(data.messages))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  /** Where the message came from — group name, or the other person. */
  const sourceName = (chat) => {
    if (!chat) return "";
    if (chat.isGroup) return chat.groupName || "Group";
    const other = otherParticipant(chat, currentUserId);
    return other?.name || other?.phone || "Chat";
  };

  const unstar = async (id) => {
    await toggleStar(id);
    setMessages((prev) => prev.filter((m) => m._id !== id));
  };

  const openChat = (chatId) => {
    selectChat(chatId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg bg-white dark:bg-neutral-900 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-neutral-100 dark:border-neutral-800 p-6 pb-4">
          <div>
            <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">Starred messages</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Only you can see these.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading && (
            <p className="py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">Loading...</p>
          )}

          {error && <p className="py-6 text-center text-sm text-red-600">{error}</p>}

          {!loading && !error && messages.length === 0 && (
            <p className="py-10 text-center text-sm text-neutral-400 dark:text-neutral-500">
              No starred messages yet. Star one from its menu to keep it here.
            </p>
          )}

          <div className="space-y-2">
            {messages.map((m) => (
              <div
                key={m._id}
                className="rounded-lg border border-neutral-100 dark:border-neutral-800 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <div className="flex items-center gap-2">
                  <Avatar
                    src={mediaUrl(m.sender?.avatar)}
                    name={m.sender?.name}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      {m.sender?._id === currentUserId ? "You" : m.sender?.name}
                    </p>
                    <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                      in {sourceName(m.chat)} · {formatChatTime(m.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => unstar(m._id)}
                    className="shrink-0 px-2 text-xs text-neutral-500 dark:text-neutral-400 hover:text-amber-600"
                  >
                    Unstar
                  </button>
                </div>

                <button
                  onClick={() => openChat(m.chat?._id || m.chat)}
                  className="mt-2 block w-full text-left"
                >
                  {m.mediaUrl && m.type === "image" && (
                    <img
                      src={mediaUrl(m.mediaUrl)}
                      alt=""
                      className="mb-1 max-h-32 rounded object-cover"
                    />
                  )}
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    {m.content || m.fileName || "Attachment"}
                  </p>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
