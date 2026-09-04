import { useEffect, useState } from "react";
import api, { errorMessage, mediaUrl } from "../lib/api.js";
import Avatar from "./Avatar.jsx";

const when = (value) =>
  new Date(value).toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function PersonRow({ person, at }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Avatar
        src={mediaUrl(person?.avatar)}
        name={person?.name || "Unknown"}
        size="sm"
      />
      <span className="min-w-0 flex-1 truncate text-sm text-neutral-800 dark:text-neutral-200">
        {person?.name || "Unknown"}
      </span>
      {at && <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">{when(at)}</span>}
    </div>
  );
}

export default function MessageInfoModal({ message, onClose }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/messages/${message._id}/info`)
      .then(({ data }) => setInfo(data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [message._id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20"
      onClick={onClose}
    >
      <div
        className="flex max-h-[75vh] w-full max-w-sm flex-col rounded-lg bg-white dark:bg-neutral-900 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-neutral-100 dark:border-neutral-800 p-5 pb-4">
          <div className="min-w-0">
            <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">Message info</h2>
            <p className="mt-1 truncate text-sm text-neutral-500 dark:text-neutral-400">
              {message.content || message.fileName || "Attachment"}
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

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading && <p className="py-6 text-center text-sm text-neutral-400 dark:text-neutral-500">Loading...</p>}
          {error && <p className="py-6 text-center text-sm text-red-600">{error}</p>}

          {info && (
            <>
              <section>
                <p className="text-xs font-medium uppercase tracking-wide text-sky-600">
                  Read by {info.readBy.length > 0 && `(${info.readBy.length})`}
                </p>
                {info.readBy.length === 0 ? (
                  <p className="py-2 text-sm text-neutral-400 dark:text-neutral-500">Nobody yet</p>
                ) : (
                  info.readBy.map((r) => (
                    <PersonRow key={r.user?._id} person={r.user} at={r.at} />
                  ))
                )}
              </section>

              <section className="mt-4 border-t border-neutral-100 dark:border-neutral-800 pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Delivered to {info.deliveredTo.length > 0 && `(${info.deliveredTo.length})`}
                </p>
                {info.deliveredTo.length === 0 ? (
                  <p className="py-2 text-sm text-neutral-400 dark:text-neutral-500">Not delivered yet</p>
                ) : (
                  info.deliveredTo.map((d) => (
                    <PersonRow key={d.user?._id} person={d.user} at={d.at} />
                  ))
                )}
              </section>

              {info.pending.length > 0 && (
                <section className="mt-4 border-t border-neutral-100 dark:border-neutral-800 pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Waiting ({info.pending.length})
                  </p>
                  {info.pending.map((p) => (
                    <PersonRow key={p._id} person={p} />
                  ))}
                </section>
              )}

              <p className="mt-4 border-t border-neutral-100 dark:border-neutral-800 pt-3 text-xs text-neutral-500 dark:text-neutral-400">
                Sent {when(info.sentAt)}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
