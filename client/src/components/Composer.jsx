import { useState, useRef, useEffect } from "react";
import { useMessages } from "../context/MessageContext.jsx";
import { useChats } from "../context/ChatContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";

const TYPING_TIMEOUT = 2000;

export default function Composer() {
  const { sendMessage } = useMessages();
  const { activeChatId } = useChats();
  const { emit } = useSocket();

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const typingRef = useRef(false);
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  // Reset when switching chats, and stop any in-flight typing signal
  useEffect(() => {
    setText("");
    if (typingRef.current && activeChatId) {
      emit("typing:stop", { chatId: activeChatId });
      typingRef.current = false;
    }
    inputRef.current?.focus();
  }, [activeChatId, emit]);

  const stopTyping = () => {
    clearTimeout(timerRef.current);
    if (typingRef.current) {
      emit("typing:stop", { chatId: activeChatId });
      typingRef.current = false;
    }
  };

  const handleChange = (e) => {
    setText(e.target.value);

    // Emit start once, then keep pushing the stop timer back
    if (!typingRef.current) {
      emit("typing:start", { chatId: activeChatId });
      typingRef.current = true;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(stopTyping, TYPING_TIMEOUT);
  };

  const submit = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;

    stopTyping();
    setText("");
    setSending(true);
    try {
      await sendMessage(body);
    } catch {
      // The bubble shows "failed"; put the text back so it isn't lost
      setText(body);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // Enter sends, Shift+Enter makes a new line
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex items-end gap-2 border-t border-neutral-200 bg-neutral-100 px-4 py-3"
    >
      <textarea
        ref={inputRef}
        rows={1}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={stopTyping}
        placeholder="Type a message"
        className="max-h-32 flex-1 resize-none rounded-lg bg-white px-4 py-2.5 text-sm outline-none placeholder:text-neutral-400"
      />

      <button
        type="submit"
        disabled={!text.trim() || sending}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-40"
        aria-label="Send message"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </form>
  );
}
