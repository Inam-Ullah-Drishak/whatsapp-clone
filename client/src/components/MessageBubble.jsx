import { useState, useRef, useEffect } from "react";
import { mediaUrl } from "../lib/api.js";
import { useMessages } from "../context/MessageContext.jsx";

const time = (value) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Single tick = sent, double = delivered, blue double = read. */
function Ticks({ status }) {
  if (status === "sending") return <span className="text-[10px] text-neutral-400">...</span>;
  if (status === "failed")
    return <span className="text-[10px] font-medium text-red-500">failed</span>;

  const blue = status === "read";
  const double = status === "delivered" || status === "read";

  return (
    <svg
      viewBox="0 0 18 12"
      className={`h-3.5 w-4 ${blue ? "text-sky-500" : "text-neutral-400"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 6.5 L4.5 10 L11 2" />
      {double && <path d="M7 6.5 L10.5 10 L17 2" />}
    </svg>
  );
}

export default function MessageBubble({ message, mine, showSender }) {
  const { deleteMessage, setReplyingTo, setEditingMessage } = useMessages();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef(null);

  const deleted = message.isDeletedForEveryone;
  // Editing is text-only, your own, and within 15 minutes
  const canEdit =
    mine &&
    !message.isDeletedForEveryone &&
    message.type === "text" &&
    Date.now() - new Date(message.createdAt).getTime() < 15 * 60 * 1000;
  const hasMedia = Boolean(message.mediaUrl) && !deleted;

  // Close the menu when clicking anywhere else
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const remove = async (scope) => {
    setBusy(true);
    try {
      await deleteMessage(message._id, scope);
    } catch {
      setBusy(false);
    }
    setMenuOpen(false);
  };

  return (
    <div className={`group flex ${mine ? "justify-end" : "justify-start"} px-4`}>
      <div
        className={`relative max-w-[75%] rounded-lg px-3 py-2 shadow-sm sm:max-w-[65%] ${
          mine ? "bg-emerald-100" : "bg-white"
        }`}
      >
        {!deleted && (
          <div ref={menuRef} className="absolute right-1.5 top-1.5 z-10">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={`flex h-6 w-6 items-center justify-center rounded-full border border-black/5 bg-white/85 text-neutral-600 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-neutral-900 ${
                menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              } ${hasMedia ? "sm:opacity-0" : ""}`}
              aria-label="Message options"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                <circle cx="12" cy="5" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="12" cy="19" r="1.8" />
              </svg>
            </button>

            {menuOpen && (
              <div
                className={`absolute top-7 z-20 w-48 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg ${
                  mine ? "right-0" : "left-0"
                }`}
              >
                <button
                  onClick={() => {
                    setReplyingTo(message);
                    setMenuOpen(false);
                  }}
                  className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100"
                >
                  Reply
                </button>

                {canEdit && (
                  <button
                    onClick={() => {
                      setEditingMessage(message);
                      setMenuOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100"
                  >
                    Edit
                  </button>
                )}

                {hasMedia && (
                  <a
                    href={mediaUrl(message.mediaUrl)}
                    download={message.fileName || true}
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100"
                  >
                    Download
                  </a>
                )}

                <button
                  onClick={() => remove("me")}
                  disabled={busy}
                  className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                >
                  Delete for me
                </button>

                {mine && (
                  <button
                    onClick={() => remove("everyone")}
                    disabled={busy}
                    className="block w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete for everyone
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {showSender && !mine && (
          <p className="mb-0.5 pr-6 text-xs font-medium text-teal-700">
            {message.sender?.name || "Unknown"}
          </p>
        )}

        {message.replyTo && !deleted && (
          <div className="mb-1.5 border-l-4 border-teal-600 bg-black/5 px-2 py-1">
            <p className="text-xs font-medium text-teal-700">
              {message.replyTo.sender?.name || "Unknown"}
            </p>
            <p className="truncate text-xs text-neutral-600">
              {message.replyTo.isDeletedForEveryone
                ? "This message was deleted"
                : message.replyTo.content ||
                  (message.replyTo.type ? message.replyTo.type : "Attachment")}
            </p>
          </div>
        )}

        {deleted ? (
          <p className="text-sm italic text-neutral-400">This message was deleted</p>
        ) : (
          <>
            {message.type === "image" && message.mediaUrl && (
              <a href={mediaUrl(message.mediaUrl)} target="_blank" rel="noreferrer">
                <img
                  src={mediaUrl(message.mediaUrl)}
                  alt={message.fileName || "image"}
                  className="mb-1 max-h-72 rounded object-cover"
                />
              </a>
            )}

            {message.type !== "image" && message.mediaUrl && (
              <a
                href={mediaUrl(message.mediaUrl)}
                target="_blank"
                rel="noreferrer"
                className="mb-1 block rounded bg-black/5 px-3 py-2 text-sm text-teal-800 underline"
              >
                {message.fileName || "Attachment"}
              </a>
            )}

            {message.content && (
              <p className="whitespace-pre-wrap break-words pr-6 text-sm text-neutral-800">
                {message.content}
              </p>
            )}
          </>
        )}

        <div className="mt-1 flex items-center justify-end gap-1">
          {message.editedAt && !deleted && (
            <span className="text-[11px] italic text-neutral-400">edited</span>
          )}
          <span className="text-[11px] text-neutral-400">{time(message.createdAt)}</span>
          {mine && !deleted && <Ticks status={message.status} />}
        </div>
      </div>
    </div>
  );
}