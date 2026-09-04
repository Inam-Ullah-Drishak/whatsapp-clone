import { useEffect, useRef, useState } from "react";
import { mediaUrl, errorMessage } from "../lib/api.js";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useStatus } from "../context/StatusContext.jsx";
import Avatar from "./Avatar.jsx";
import { formatChatTime } from "../lib/chatUtils.js";

const SLIDE_MS = 5000;
const TICK_MS = 50;

export default function StatusViewer({ group, startIndex = 0, onClose }) {
  const { user } = useAuth();
  const { markViewed, deleteStatus } = useStatus();

  const [index, setIndex] = useState(startIndex);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState(null);

  const timerRef = useRef(null);
  const item = group.items[index];
  const isMine = group.user._id === user?._id;

  // Record the view once per slide
  useEffect(() => {
    if (item && !isMine) markViewed(item._id);
    setElapsed(0);
    setViewers(null);
  }, [item?._id, isMine, markViewed]);

  // Advance automatically, unless paused or reading the viewer list
  useEffect(() => {
    if (paused || viewers) return;

    timerRef.current = setInterval(() => {
      setElapsed((e) => {
        if (e + TICK_MS >= SLIDE_MS) {
          clearInterval(timerRef.current);
          // Defer so we don't set state during another component's render
          queueMicrotask(next);
          return SLIDE_MS;
        }
        return e + TICK_MS;
      });
    }, TICK_MS);

    return () => clearInterval(timerRef.current);
  }, [index, paused, viewers]);

  const next = () => {
    if (index < group.items.length - 1) {
      setIndex((i) => i + 1);
      setElapsed(0);
    } else {
      onClose();
    }
  };

  const prev = () => {
    if (index > 0) {
      setIndex((i) => i - 1);
      setElapsed(0);
    }
  };

  // Keyboard control, as this is a full-screen surface
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index]);

  const loadViewers = async () => {
    try {
      const { data } = await api.get(`/status/${item._id}/viewers`);
      setViewers(data.viewers);
    } catch (err) {
      setViewers([]);
      console.error(errorMessage(err));
    }
  };

  const removeThis = async () => {
    if (!confirm("Delete this status?")) return;
    await deleteStatus(item._id);
    onClose();
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-neutral-900">
      {/* Segment progress bars */}
      <div className="flex gap-1 px-3 pt-3">
        {group.items.map((it, i) => (
          <div key={it._id} className="h-0.5 flex-1 overflow-hidden rounded bg-white/30">
            <div
              style={{
                width:
                  i < index ? "100%" : i === index ? `${(elapsed / SLIDE_MS) * 100}%` : "0%",
              }}
              className="h-full bg-white dark:bg-neutral-900"
            />
          </div>
        ))}
      </div>

      <header className="flex items-center gap-3 px-4 py-3">
        <Avatar
          src={mediaUrl(group.user.avatar)}
          name={group.user.name || group.user.phone}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {isMine ? "My status" : group.user.name || group.user.phone}
          </p>
          <p className="text-xs text-white/60">{formatChatTime(item.createdAt)}</p>
        </div>

        {isMine && (
          <button
            onClick={removeThis}
            className="rounded px-2 py-1 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            Delete
          </button>
        )}

        <button
          onClick={onClose}
          className="rounded px-2 text-2xl leading-none text-white/70 hover:text-white"
          aria-label="Close"
        >
          &times;
        </button>
      </header>

      {/* Slide */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
      >
        {/* Tap zones, as WhatsApp has */}
        <button
          onClick={prev}
          className="absolute inset-y-0 left-0 w-1/3 cursor-default"
          aria-label="Previous"
        />
        <button
          onClick={next}
          className="absolute inset-y-0 right-0 w-1/3 cursor-default"
          aria-label="Next"
        />

        {item.type === "text" ? (
          <div
            style={{ background: item.background }}
            className="flex h-full w-full items-center justify-center p-10"
          >
            <p className="max-w-2xl text-center text-2xl font-medium leading-relaxed text-white">
              {item.content}
            </p>
          </div>
        ) : (
          <>
            <img
              src={mediaUrl(item.mediaUrl)}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
            {item.content && (
              <p className="absolute bottom-6 left-0 right-0 px-8 text-center text-white">
                {item.content}
              </p>
            )}
          </>
        )}
      </div>

      {/* Viewer count, author only */}
      {isMine && (
        <footer className="px-4 py-3">
          <button
            onClick={loadViewers}
            className="flex items-center gap-2 text-sm text-white/80 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {item.viewerCount ?? 0} viewed
          </button>

          {viewers && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-white/10 p-2">
              {viewers.length === 0 ? (
                <p className="p-2 text-sm text-white/60">No views yet</p>
              ) : (
                viewers.map((v) => (
                  <div key={v.user?._id} className="flex items-center gap-2 p-1.5">
                    <Avatar src={mediaUrl(v.user?.avatar)} name={v.user?.name} size="sm" />
                    <span className="flex-1 truncate text-sm text-white">
                      {v.user?.name || v.user?.phone}
                    </span>
                    <span className="text-xs text-white/60">{formatChatTime(v.at)}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </footer>
      )}
    </div>
  );
}
