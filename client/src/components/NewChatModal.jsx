import { useState } from "react";
import api, { errorMessage, mediaUrl } from "../lib/api.js";
import { useChats } from "../context/ChatContext.jsx";
import Avatar from "./Avatar.jsx";

export default function NewChatModal({ onClose, onNewGroup }) {
  const { openChatWith } = useChats();

  const [phone, setPhone] = useState("+92");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const search = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const { data } = await api.get("/users/search", { params: { phone } });
      setResult(data.user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const startChat = async () => {
    setBusy(true);
    try {
      await openChatWith(result._id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    // Clicking the backdrop closes; stopPropagation keeps clicks inside from doing so
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white dark:bg-neutral-900 p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">New chat</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Find someone by their phone number.
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

        <form onSubmit={search} className="mt-5 flex gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+923001234567"
            autoFocus
            className="flex-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-4 py-2.5 text-sm outline-none placeholder:text-neutral-400"
          />
          <button
            type="submit"
            disabled={busy || phone.trim().length < 8}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {busy ? "..." : "Search"}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={onNewGroup}
          className="mt-4 flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm font-medium text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>
          New group
        </button>

        {result && (
          <button
            onClick={startChat}
            disabled={busy}
            className="mt-5 flex w-full items-center gap-3 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
          >
            <Avatar
              src={mediaUrl(result.avatar)}
              name={result.name || result.phone}
              online={result.isOnline}
            />
            <div className="min-w-0">
              <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                {result.name || result.phone}
              </p>
              <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">{result.about}</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
