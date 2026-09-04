import { useState } from "react";
import api, { errorMessage, mediaUrl } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "./Avatar.jsx";
import { formatChatTime } from "../lib/chatUtils.js";

import DisappearingSelect from "./DisappearingSelect.jsx";

export default function ContactInfoModal({ person, chat, onClose }) {
  const { user, setUser } = useAuth();

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const blocked = (user?.blockedUsers || []).some(
    (id) => (id._id ? id._id : id).toString() === person._id
  );

  const toggleBlock = async () => {
    if (!blocked && !confirm(`Block ${person.name || person.phone}? Neither of you will be able to message the other.`)) {
      return;
    }

    setError("");
    setBusy(true);
    try {
      await api.post(`/users/${person._id}/${blocked ? "unblock" : "block"}`);
      // The block endpoints return only a message, so refresh our own
      // user to pick up the updated blockedUsers list.
      const { data } = await api.get("/auth/me");
      setUser(data.user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white dark:bg-neutral-900 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-neutral-100 dark:border-neutral-800 p-6 pb-5">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">Contact info</h2>
            <button
              onClick={onClose}
              className="text-2xl leading-none text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <div className="mt-4 flex flex-col items-center gap-2">
            <Avatar
              src={mediaUrl(person.avatar)}
              name={person.name || person.phone}
              size="lg"
              online={person.isOnline}
            />
            <p className="mt-1 text-lg font-medium text-neutral-900 dark:text-neutral-100">
              {person.name || person.phone}
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {person.isOnline
                ? "online"
                : person.lastSeen
                ? `last seen ${formatChatTime(person.lastSeen)}`
                : ""}
            </p>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              About
            </p>
            <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">{person.about || "—"}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Phone
            </p>
            <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">{person.phone}</p>
          </div>

          {chat && <DisappearingSelect chat={chat} />}

          {blocked && (
            <p className="rounded bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-700">
              You blocked this contact. Messages won't be delivered in either
              direction.
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={toggleBlock}
            disabled={busy}
            className={`w-full rounded border py-2.5 text-sm font-medium transition disabled:opacity-40 ${
              blocked
                ? "border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                : "border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
            }`}
          >
            {busy
              ? "..."
              : blocked
              ? `Unblock ${person.name || "contact"}`
              : `Block ${person.name || "contact"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
