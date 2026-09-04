import { useState, useRef, useEffect } from "react";
import { useMessages } from "../context/MessageContext.jsx";
import { useChats } from "../context/ChatContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import api, { errorMessage, mediaUrl } from "../lib/api.js";

const TYPING_TIMEOUT = 2000;

const prettySize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export default function Composer() {
  const {
    sendMessage,
    replyingTo,
    setReplyingTo,
    editingMessage,
    setEditingMessage,
    editMessage,
  } = useMessages();
  const { activeChatId } = useChats();
  const { emit } = useSocket();

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [error, setError] = useState("");

  const typingRef = useRef(false);
  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    setText("");
    setAttachment(null);
    setError("");
    if (typingRef.current && activeChatId) {
      emit("typing:stop", { chatId: activeChatId });
      typingRef.current = false;
    }
    inputRef.current?.focus();
  }, [activeChatId, emit]);

  // Pull the message being edited into the input
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content || "");
      inputRef.current?.focus();
    }
  }, [editingMessage]);

  const cancelEdit = () => {
    setEditingMessage(null);
    setText("");
  };

  const stopTyping = () => {
    clearTimeout(timerRef.current);
    if (typingRef.current) {
      emit("typing:stop", { chatId: activeChatId });
      typingRef.current = false;
    }
  };

  const handleChange = (e) => {
    setText(e.target.value);
    if (!typingRef.current) {
      emit("typing:start", { chatId: activeChatId });
      typingRef.current = true;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(stopTyping, TYPING_TIMEOUT);
  };

  /**
   * Upload happens on pick, not on send — the file is already on the server
   * by the time the user hits send, so a failed upload never leaves a
   * half-created message behind.
   */
  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/uploads/media", form);
      setAttachment(data);
      inputRef.current?.focus();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const body = text.trim();

    if (editingMessage) {
      if (!body) return;
      setSending(true);
      try {
        await editMessage(editingMessage._id, body);
        setText("");
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setSending(false);
      }
      return;
    }

    if ((!body && !attachment) || sending) return;

    const pending = attachment;
    stopTyping();
    setText("");
    setAttachment(null);
    setSending(true);

    try {
      await sendMessage(body, pending || {});
    } catch {
      setText(body);
      setAttachment(pending);
      setError("Message failed to send");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape" && editingMessage) {
      cancelEdit();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  };

  return (
    <div className="border-t border-neutral-200 bg-neutral-100">
      {error && <p className="px-4 pt-2 text-sm text-red-600">{error}</p>}

      {editingMessage && (
        <div className="flex items-start gap-3 border-l-4 border-amber-500 bg-white px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-amber-600">Editing message</p>
            <p className="truncate text-sm text-neutral-600">
              {editingMessage.content}
            </p>
          </div>
          <button
            type="button"
            onClick={cancelEdit}
            className="text-xl leading-none text-neutral-400 hover:text-neutral-700"
            aria-label="Cancel edit"
          >
            &times;
          </button>
        </div>
      )}

      {replyingTo && (
        <div className="flex items-start gap-3 border-l-4 border-emerald-600 bg-white px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-emerald-700">
              Replying to {replyingTo.sender?.name || "Unknown"}
            </p>
            <p className="truncate text-sm text-neutral-600">
              {replyingTo.content || replyingTo.fileName || "Attachment"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="text-xl leading-none text-neutral-400 hover:text-neutral-700"
            aria-label="Cancel reply"
          >
            &times;
          </button>
        </div>
      )}

      {attachment && (
        <div className="flex items-center gap-3 px-4 pt-3">
          {attachment.type === "image" ? (
            <img
              src={mediaUrl(attachment.mediaUrl)}
              alt={attachment.fileName}
              className="h-16 w-16 rounded object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded bg-neutral-200 text-xs uppercase text-neutral-500">
              {attachment.type}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-neutral-800">{attachment.fileName}</p>
            <p className="text-xs text-neutral-500">{prettySize(attachment.fileSize)}</p>
          </div>

          <button
            type="button"
            onClick={() => setAttachment(null)}
            className="text-xl leading-none text-neutral-400 hover:text-neutral-700"
            aria-label="Remove attachment"
          >
            &times;
          </button>
        </div>
      )}

      <form onSubmit={submit} className="flex items-end gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || Boolean(editingMessage)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200 disabled:opacity-40"
          title="Attach a file"
          aria-label="Attach a file"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

        <input ref={fileRef} type="file" onChange={pickFile} className="hidden" />

        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={stopTyping}
          placeholder={
            editingMessage
              ? "Edit your message"
              : uploading
              ? "Uploading..."
              : "Type a message"
          }
          className="max-h-32 flex-1 resize-none rounded-lg bg-white px-4 py-2.5 text-sm outline-none placeholder:text-neutral-400"
        />

        <button
          type="submit"
          disabled={(!text.trim() && !attachment) || sending || uploading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-40"
          aria-label="Send message"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  );
}