import { useState, useRef, useEffect } from "react";
import { mediaUrl } from "../lib/api.js";
import { useMessages } from "../context/MessageContext.jsx";
import ForwardModal from "./ForwardModal.jsx";
import MessageInfoModal from "./MessageInfoModal.jsx";
import VoiceNote from "./VoiceNote.jsx";
import { EMOJI_GROUPS, QUICK_REACTIONS as REACTIONS } from "../lib/emoji.js";


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
  const {
    deleteMessage,
    setReplyingTo,
    setEditingMessage,
    toggleStar,
    reactToMessage,
    currentUserId,
  } = useMessages();
  const [menuOpen, setMenuOpen] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const reactRef = useRef(null);
  const triggerRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef(null);

  const deleted = message.isDeletedForEveryone;
  const hasMedia = Boolean(message.mediaUrl) && !deleted;

  // Editing is text-only, your own, and within 15 minutes.
  // An optimistic bubble may not have `type` yet, so treat missing as text.
  const isVoice = message.type === "audio" && Boolean(message.mediaUrl) && !message.isDeletedForEveryone;

  const reactions = message.reactions || [];
  const myReaction = reactions.find(
    (r) => (r.user?._id ? r.user._id : r.user)?.toString() === currentUserId
  )?.emoji;

  /** Group identical emoji so the chip shows a count. */
  const reactionGroups = reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  const starred = (message.starredBy || []).some(
    (id) => (id._id ? id._id : id).toString() === currentUserId
  );

  const ageMs = message.createdAt
    ? Date.now() - new Date(message.createdAt).getTime()
    : 0;
  const isText = (message.type || "text") === "text" && !message.mediaUrl;
  const canEdit = mine && !deleted && isText && ageMs < 15 * 60 * 1000;

  // Close the menu when clicking anywhere else
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  useEffect(() => {
    if (!reactOpen) return;
    const close = (e) => {
      if (!reactRef.current?.contains(e.target)) {
        setReactOpen(false);
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [reactOpen]);

  /**
   * The download attribute is ignored on cross-origin links, so the file
   * would just open in a tab. Fetching it as a blob gives us a same-origin
   * URL the browser will save, and keeps the original filename.
   */
  const download = async () => {
    setMenuOpen(false);
    try {
      const res = await fetch(mediaUrl(message.mediaUrl));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = message.fileName || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch {
      // Fall back to opening it if the fetch is blocked
      window.open(mediaUrl(message.mediaUrl), "_blank");
    }
  };

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
    <div
      className={`group flex ${mine ? "justify-end" : "justify-start"} px-4 ${
        Object.keys(reactionGroups).length > 0 && !deleted ? "mb-4" : ""
      }`}
    >
      <div
        className="relative max-w-[75%] rounded-lg px-3 py-2 shadow-sm sm:max-w-[65%]"
        style={{ background: mine ? "#d9fdd3" : "#ffffff" }}
      >
        {!deleted && (
          <div
            ref={reactRef}
            className={`absolute top-1/2 z-10 -translate-y-1/2 ${
              mine ? "right-full mr-1" : "left-full ml-1"
            }`}
          >
            <button
              onClick={() => setReactOpen((v) => !v)}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition hover:bg-black/5 hover:text-neutral-600 ${
                reactOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
              title="React"
              aria-label="React to message"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
                <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
                <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" strokeLinecap="round" />
              </svg>
            </button>

            {reactOpen && (
              <div
                className={`absolute bottom-9 z-30 flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1.5 shadow-lg ${
                  mine ? "right-0" : "left-0"
                }`}
              >
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      reactToMessage(message._id, emoji);
                      setReactOpen(false);
                    }}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none transition hover:scale-125 ${
                      myReaction === emoji ? "bg-emerald-100" : ""
                    }`}
                  >
                    {emoji}
                  </button>
                ))}

                <button
                  onClick={() => setMoreOpen((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100"
                  title="More emoji"
                  aria-label="More emoji"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>

                {moreOpen && (
                  <div
                    className={`absolute bottom-12 max-h-72 w-72 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg ${
                      mine ? "right-0" : "left-0"
                    }`}
                  >
                    {EMOJI_GROUPS.map((group) => (
                      <div key={group.name} className="mb-2 last:mb-0">
                        <p className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                          {group.name}
                        </p>
                        <div className="grid grid-cols-8 gap-0.5">
                          {group.emoji.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => {
                                reactToMessage(message._id, emoji);
                                setReactOpen(false);
                                setMoreOpen(false);
                              }}
                              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none transition hover:bg-neutral-100 ${
                                myReaction === emoji ? "bg-emerald-100" : ""
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!deleted && (
          <div ref={menuRef} className="absolute right-1.5 top-1.5 z-10">
            <button
              ref={triggerRef}
              onClick={() => {
                // Flip the menu above the button when there isn't room
                // below, so it never opens off the bottom of the window.
                if (!menuOpen && triggerRef.current) {
                  const rect = triggerRef.current.getBoundingClientRect();
                  setDropUp(window.innerHeight - rect.bottom < 240);
                }
                setMenuOpen((v) => !v);
              }}
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
                className={`absolute z-20 w-48 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg ${
                  mine ? "right-0" : "left-0"
                } ${dropUp ? "bottom-7" : "top-7"}`}
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

                <button
                  onClick={() => {
                    toggleStar(message._id);
                    setMenuOpen(false);
                  }}
                  className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100"
                >
                  {starred ? "Unstar" : "Star"}
                </button>

                <button
                  onClick={() => {
                    setForwarding(true);
                    setMenuOpen(false);
                  }}
                  className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100"
                >
                  Forward
                </button>

                {mine && (
                  <button
                    onClick={() => {
                      setInfoOpen(true);
                      setMenuOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100"
                  >
                    Info
                  </button>
                )}

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
                  <button
                    onClick={download}
                    className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-100"
                  >
                    Download
                  </button>
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

        {message.isForwarded && !deleted && (
          <p className="mb-0.5 flex items-center gap-1 text-xs italic text-neutral-400">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 17H5a2 2 0 0 1-2-2V9m0 0 4-4M3 9h12a4 4 0 0 1 4 4v4" />
            </svg>
            Forwarded
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

            {isVoice && (
              <VoiceNote
                message={message}
                meta={
                  <span className="flex items-center gap-1">
                    {starred && (
                      <svg viewBox="0 0 24 24" className="h-3 w-3 text-amber-500" fill="currentColor">
                        <path d="M12 2l2.9 6.3 6.8.8-5 4.7 1.3 6.8L12 17.3 6 20.6l1.3-6.8-5-4.7 6.8-.8z" />
                      </svg>
                    )}
                    {message.editedAt && (
                      <span className="text-[11px] italic text-neutral-400">edited</span>
                    )}
                    <span className="text-[11px] text-neutral-400">
                      {time(message.createdAt)}
                    </span>
                    {mine && <Ticks status={message.status} />}
                  </span>
                }
              />
            )}

            {message.type !== "image" && message.type !== "audio" && message.mediaUrl && (
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

        {Object.keys(reactionGroups).length > 0 && !deleted && (
          // Sits half outside the bubble's bottom edge, as WhatsApp does
          <div className="absolute -bottom-3 left-2 z-10 flex gap-1">
            {Object.entries(reactionGroups).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => reactToMessage(message._id, emoji)}
                title={myReaction === emoji ? "Remove your reaction" : "React"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  // A circle for a lone emoji, a pill once a count appears
                  minWidth: 24,
                  height: 24,
                  padding: count > 1 ? "0 7px" : 0,
                  borderRadius: 9999,
                  border: "none",
                  background: "#ffffff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                <span style={{ fontSize: 13, lineHeight: 1 }}>{emoji}</span>
                {count > 1 && (
                  <span style={{ fontSize: 11, color: "#667781" }}>{count}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {!isVoice && (
        <div className="mt-1 flex items-center justify-end gap-1">
          {starred && !deleted && (
            <svg viewBox="0 0 24 24" className="h-3 w-3 text-amber-500" fill="currentColor">
              <path d="M12 2l2.9 6.3 6.8.8-5 4.7 1.3 6.8L12 17.3 6 20.6l1.3-6.8-5-4.7 6.8-.8z" />
            </svg>
          )}
          {message.editedAt && !deleted && (
            <span className="text-[11px] italic text-neutral-400">edited</span>
          )}
          <span className="text-[11px] text-neutral-400">{time(message.createdAt)}</span>
          {mine && !deleted && <Ticks status={message.status} />}
        </div>
        )}
      </div>
      {forwarding && (
        <ForwardModal message={message} onClose={() => setForwarding(false)} />
      )}

      {infoOpen && (
        <MessageInfoModal message={message} onClose={() => setInfoOpen(false)} />
      )}
    </div>
  );
}