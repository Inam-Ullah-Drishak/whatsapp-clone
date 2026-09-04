import { useState, useRef } from "react";
import api, { errorMessage, mediaUrl } from "../lib/api.js";
import { useStatus } from "../context/StatusContext.jsx";

const BACKGROUNDS = [
  "#075E54", "#128C7E", "#1f2937", "#7c3aed",
  "#be123c", "#c2410c", "#0369a1", "#4d7c0f",
];

export default function StatusComposer({ onClose }) {
  const { createStatus } = useStatus();

  const [mode, setMode] = useState("text"); // "text" | "image"
  const [text, setText] = useState("");
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [media, setMedia] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fileRef = useRef(null);

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/uploads/media", form);

      if (data.type !== "image") {
        setError("Status images must be a photo");
        return;
      }

      setMedia(data);
      setMode("image");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const post = async () => {
    setError("");
    setBusy(true);
    try {
      await createStatus(
        mode === "text"
          ? { type: "text", content: text.trim(), background }
          : { type: "image", mediaUrl: media.mediaUrl, content: text.trim() }
      );
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const canPost = mode === "text" ? text.trim().length > 0 : Boolean(media);

  return (
    <div
      className="fixed inset-0 z-60 flex items-start justify-center bg-black/50 p-4 pt-16"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white dark:bg-neutral-900 p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">New status</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Disappears after 24 hours.</p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Preview */}
        <div className="mt-5 overflow-hidden rounded-lg">
          {mode === "text" ? (
            <div
              style={{ background }}
              className="flex min-h-40 items-center justify-center p-6"
            >
              <p className="text-center text-lg font-medium text-white">
                {text || "Type something..."}
              </p>
            </div>
          ) : (
            <img
              src={mediaUrl(media.mediaUrl)}
              alt=""
              className="max-h-64 w-full object-contain"
            />
          )}
        </div>

        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 700))}
          placeholder={mode === "text" ? "What's on your mind?" : "Add a caption"}
          className="mt-4 w-full resize-none rounded-lg bg-neutral-100 dark:bg-neutral-800 px-4 py-2.5 text-sm outline-none placeholder:text-neutral-400"
        />

        {mode === "text" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {BACKGROUNDS.map((c) => (
              <button
                key={c}
                onClick={() => setBackground(c)}
                style={{ background: c }}
                className={`h-7 w-7 rounded-full transition ${
                  background === c ? "ring-2 ring-neutral-800 ring-offset-2" : ""
                }`}
                aria-label={`Background ${c}`}
              />
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:underline disabled:opacity-50"
          >
            {media ? "Change photo" : "Use a photo instead"}
          </button>
          {media && (
            <button
              onClick={() => {
                setMedia(null);
                setMode("text");
              }}
              className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100"
            >
              Remove
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={pickImage}
            className="hidden"
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          onClick={post}
          disabled={!canPost || busy}
          className="mt-5 w-full rounded bg-emerald-600 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
        >
          {busy ? "Posting..." : "Post status"}
        </button>
      </div>
    </div>
  );
}
