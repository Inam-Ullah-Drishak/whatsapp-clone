import { useEffect, useRef, useState } from "react";
import { mediaUrl } from "../lib/api.js";
import { initial } from "../lib/chatUtils.js";

const BARS = 40;
const BAR_W = 2;
const BAR_GAP = 2;
const TRACK_H = 26;
const SPEEDS = [1, 1.5, 2];

// WhatsApp's palette, sampled from the reference
const C = {
  icon: "var(--wa-icon)",       // play triangle
  meta: "var(--wa-meta)",       // duration and timestamp text
  barPlayed: "var(--wa-bar-played)",
  barIdle: "var(--wa-bar-idle)",
  handle: "#53bdeb",     // blue scrubber
  micUnplayed: "#53bdeb",
  micPlayed: "#8696a0",
  avatarBg: "#e7e0ff",
  avatarFg: "#7c5cd6",
};

/**
 * Deterministic bar heights from the message id.
 *
 * A true waveform means downloading the clip and decoding it with the Web
 * Audio API before anything renders. For short voice notes the bars are
 * decoration, so a stable pseudo-random pattern gives the same look with no
 * extra fetch, and never shifts between renders.
 */
const barsFor = (seed = "") => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;

  return Array.from({ length: BARS }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    const base = (h % 100) / 100;
    const taper = Math.sin((Math.PI * (i + 1)) / (BARS + 1));
    return 0.18 + base * 0.82 * taper;
  });
};

const mmss = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

export default function VoiceNote({ message, meta }) {
  const audioRef = useRef(null);
  const barRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [dragging, setDragging] = useState(false);

  const bars = barsFor(message._id);
  const progress = duration ? Math.min(current / duration, 1) : 0;
  const trackW = BARS * BAR_W + (BARS - 1) * BAR_GAP;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrent(audio.currentTime);
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
      audio.currentTime = 0;
    };
    const onMeta = () => {
      // Chrome reports Infinity for webm recordings until it has seeked
      // to the end at least once.
      if (isFinite(audio.duration)) {
        setDuration(audio.duration);
      } else {
        audio.currentTime = 1e101;
        audio.ontimeupdate = () => {
          audio.ontimeupdate = null;
          setDuration(audio.duration);
          audio.currentTime = 0;
        };
      }
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("loadedmetadata", onMeta);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
      setStarted(true);
    }
  };

  const cycleSpeed = () => {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  };

  const seekToClientX = (clientX) => {
    const el = barRef.current;
    const audio = audioRef.current;
    if (!el || !audio || !duration) return;

    const rect = el.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    audio.currentTime = ratio * duration;
    setCurrent(audio.currentTime);
  };

  // Listeners on the window so a drag survives leaving the track
  useEffect(() => {
    if (!dragging) return;

    const onMove = (e) => seekToClientX(e.clientX);
    const onUp = () => setDragging(false);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, duration]);

  const startDrag = (e) => {
    e.preventDefault();
    setDragging(true);
    setStarted(true);
    seekToClientX(e.clientX);
  };

  const avatar = mediaUrl(message.sender?.avatar);
  const handleSize = dragging ? 13 : 11;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "2px 0" }}>
      <audio ref={audioRef} src={mediaUrl(message.mediaUrl)} preload="metadata" />

      {/* Avatar with mic badge */}
      <div
        style={{
          position: "relative",
          flex: "0 0 42px",
          width: 42,
          height: 42,
          marginTop: 1,
        }}
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            style={{ width: 42, height: 42, borderRadius: 9999, objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 9999,
              background: C.avatarBg,
              color: C.avatarFg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            {initial(message.sender?.name)}
          </div>
        )}

        <span
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: 17,
            height: 17,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: started ? C.micPlayed : C.micUnplayed,
          }}
        >
          <svg viewBox="0 0 24 24" style={{ width: 17, height: 17 }} fill="currentColor">
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
            <path d="M17 11a5 5 0 0 1-10 0H5.5a6.5 6.5 0 0 0 5.75 6.46V20h1.5v-2.54A6.5 6.5 0 0 0 18.5 11z" />
          </svg>
        </span>
      </div>

      {/* Play / pause */}
      <button
        onClick={toggle}
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 20,
          height: TRACK_H,
          color: C.icon,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }} fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }} fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Track + meta */}
      <div style={{ flex: "0 0 auto" }}>
        <div
          ref={barRef}
          onPointerDown={startDrag}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: BAR_GAP,
            width: trackW,
            height: TRACK_H,
            cursor: "pointer",
            touchAction: "none",
            userSelect: "none",
          }}
        >
          {bars.map((h, i) => {
            const played = (i + 1) / BARS <= progress;
            return (
              <span
                key={i}
                style={{
                  display: "block",
                  flex: `0 0 ${BAR_W}px`,
                  width: BAR_W,
                  height: Math.max(3, Math.round(h * (TRACK_H - 4))),
                  borderRadius: 9999,
                  background: played ? C.barPlayed : C.barIdle,
                }}
              />
            );
          })}

          <span
            style={{
              position: "absolute",
              top: "50%",
              left: `calc(${progress * 100}% - ${handleSize / 2}px)`,
              width: handleSize,
              height: handleSize,
              transform: "translateY(-50%)",
              borderRadius: 9999,
              background: C.handle,
              pointerEvents: "none",
              transition: dragging ? "none" : "left 80ms linear",
            }}
          />
        </div>

        {/* Duration on the left, the bubble's timestamp and ticks on the right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginTop: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: C.meta }}>
              {mmss(started || current ? current : duration)}
            </span>
            {started && (
              <button
                onClick={cycleSpeed}
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: C.meta,
                  background: "rgba(0,0,0,0.06)",
                  border: "none",
                  borderRadius: 9999,
                  padding: "0 5px",
                  cursor: "pointer",
                }}
              >
                {SPEEDS[speedIndex]}x
              </button>
            )}
          </div>

          {meta}
        </div>
      </div>
    </div>
  );
}
