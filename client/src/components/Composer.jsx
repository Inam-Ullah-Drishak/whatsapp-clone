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

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const tickRef = useRef(null);

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

  /**
   * Voice notes use MediaRecorder, which needs a secure context —
   * localhost counts, but a LAN IP over plain http will not prompt for
   * microphone access.
   */
  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Always release the mic, or the browser keeps showing the
        // recording indicator in the tab
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(tickRef.current);

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        if (blob.size < 1000) return; // ignore accidental taps

        // WhatsApp sends on release rather than staging an attachment,
        // so upload and send in one go.
        setUploading(true);
        try {
          const form = new FormData();
          form.append("file", blob, `voice-${Date.now()}.webm`);
          const { data } = await api.post("/uploads/media", form);
          await sendMessage("", { ...data, type: "audio" });
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setUploading(false);
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Microphone access was denied");
    }
  };

  const stopRecording = (keep = true) => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    if (!keep) chunksRef.current = [];
    recorder.stop();
    recorderRef.current = null;
    setRecording(false);
    clearInterval(tickRef.current);
  };

  const mmss = (s) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

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
          ) : attachment.type === "audio" ? (
            <div className="flex h-16 w-16 items-center justify-center rounded bg-emerald-100 text-emerald-700">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
              </svg>
            </div>
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

      {recording ? (
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => stopRecording(false)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200 hover:text-red-600"
            title="Discard"
            aria-label="Discard recording"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
            </svg>
          </button>

          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <span className="font-mono text-sm tabular-nums text-neutral-700">
            {mmss(seconds)}
          </span>

          <span className="flex-1 text-sm text-neutral-400">
            Recording — tap send when you're done
          </span>

          <button
            type="button"
            onClick={() => stopRecording(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700"
            title="Send"
            aria-label="Send voice note"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      ) : (
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

        {!text.trim() && !attachment && !editingMessage ? (
          <button
            type="button"
            onClick={startRecording}
            disabled={uploading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-40"
            title="Record a voice note"
            aria-label="Record a voice note"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
            </svg>
          </button>
        ) : (
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
        )}
      </form>
      )}
    </div>
  );
}