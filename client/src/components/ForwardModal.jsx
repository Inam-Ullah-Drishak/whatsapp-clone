import { useState } from "react";
import api, { errorMessage } from "../lib/api.js";
import { useChats } from "../context/ChatContext.jsx";
import { chatName, chatAvatar } from "../lib/chatUtils.js";
import Avatar from "./Avatar.jsx";

export default function ForwardModal({ message, onClose }) {
  const { chats, currentUserId } = useChats();

  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const visible = query.trim()
    ? chats.filter((c) =>
        chatName(c, currentUserId).toLowerCase().includes(query.trim().toLowerCase())
      )
    : chats;

  const toggle = (chatId) =>
    setSelected((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]
    );

  const forward = async () => {
    setError("");
    setBusy(true);

    // One request per target. Sequential rather than parallel so a
    // rate limit or a blocked contact fails cleanly instead of
    // firing ten requests at once.
    let done = 0;
    try {
      for (const chatId of selected) {
        await api.post("/messages", {
          chatId,
          content: message.content || "",
          type: message.type,
          mediaUrl: message.mediaUrl || undefined,
          fileName: message.fileName || undefined,
          fileSize: message.fileSize || undefined,
          mimeType: message.mimeType || undefined,
          isForwarded: true,
        });
        done += 1;
        setSentCount(done);
      }
      onClose();
    } catch (err) {
      setError(`${errorMessage(err)} (${done} of ${selected.length} sent)`);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-neutral-100 p-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-medium text-neutral-900">Forward to</h2>
              <p className="mt-1 truncate text-sm text-neutral-500">
                {message.content || message.fileName || "Attachment"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-2xl leading-none text-neutral-400 hover:text-neutral-700"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="mt-4 w-full rounded-lg bg-neutral-100 px-4 py-2.5 text-sm outline-none placeholder:text-neutral-400"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {visible.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-400">No chats found</p>
          )}

          {visible.map((chat) => {
            const name = chatName(chat, currentUserId);
            const picked = selected.includes(chat._id);
            return (
              <button
                key={chat._id}
                onClick={() => toggle(chat._id)}
                className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition ${
                  picked ? "bg-emerald-50" : "hover:bg-neutral-50"
                }`}
              >
                <Avatar src={chatAvatar(chat, currentUserId)} name={name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800">
                  {name}
                </span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    picked ? "border-emerald-600 bg-emerald-600 text-white" : "border-neutral-300"
                  }`}
                >
                  {picked && (
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
              </button>
            );
          })}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="border-t border-neutral-100 p-6 pt-4">
          <button
            onClick={forward}
            disabled={selected.length === 0 || busy}
            className="w-full rounded bg-emerald-600 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
          >
            {busy
              ? `Sending ${sentCount}/${selected.length}...`
              : `Forward${selected.length ? ` to ${selected.length}` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}