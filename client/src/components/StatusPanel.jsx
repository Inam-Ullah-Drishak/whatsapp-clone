import { useState } from "react";
import { mediaUrl } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useStatus } from "../context/StatusContext.jsx";
import { formatChatTime } from "../lib/chatUtils.js";
import Avatar from "./Avatar.jsx";
import StatusViewer from "./StatusViewer.jsx";
import StatusComposer from "./StatusComposer.jsx";

/** Avatar with a segmented ring, one arc per status item. */
function StatusRing({ src, name, count, unseen, size = 48 }) {
  const gap = 4;
  const r = size / 2 + 3;
  const circumference = 2 * Math.PI * r;
  const seg = count > 1 ? circumference / count - gap : circumference;

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size + 10, height: size + 10 }}>
      <svg
        viewBox={`0 0 ${size + 10} ${size + 10}`}
        className="absolute inset-0"
        style={{ transform: "rotate(-90deg)" }}
      >
        {Array.from({ length: Math.max(count, 1) }).map((_, i) => (
          <circle
            key={i}
            cx={(size + 10) / 2}
            cy={(size + 10) / 2}
            r={r}
            fill="none"
            stroke={unseen ? "#25D366" : "#c9ced1"}
            strokeWidth="2.5"
            strokeDasharray={`${seg} ${circumference - seg}`}
            strokeDashoffset={-i * (seg + gap)}
            strokeLinecap="round"
          />
        ))}
      </svg>

      <span className="absolute" style={{ left: 5, top: 5 }}>
        <Avatar src={src} name={name} size="md" />
      </span>
    </span>
  );
}

export default function StatusPanel() {
  const { user } = useAuth();
  const { mine, others, loading } = useStatus();

  const [viewing, setViewing] = useState(null);
  const [composing, setComposing] = useState(false);

  const lastOf = (group) => group.items[group.items.length - 1];

  return (
    <aside className="flex h-full w-full flex-col border-r border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 sm:w-96">
      <header className="flex items-center justify-between px-5 pb-3 pt-5">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Status</h1>
        <button
          onClick={() => setComposing(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700"
          title="Add status"
          aria-label="Add status"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Your own */}
        <button
          onClick={() => (mine ? setViewing({ group: mine, index: 0 }) : setComposing(true))}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          {mine ? (
            <StatusRing
              src={mediaUrl(user?.avatar)}
              name={user?.name}
              count={mine.items.length}
              unseen
            />
          ) : (
            <span className="relative">
              <Avatar src={mediaUrl(user?.avatar)} name={user?.name || user?.phone} />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-white">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">My status</p>
            <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
              {mine
                ? `${mine.items.length} update${mine.items.length > 1 ? "s" : ""} · ${formatChatTime(lastOf(mine).createdAt)}`
                : "Tap to add a status update"}
            </p>
          </div>
        </button>

        {others.length > 0 && (
          <p className="px-5 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Recent updates
          </p>
        )}

        {loading && others.length === 0 && (
          <p className="px-5 py-6 text-sm text-neutral-400 dark:text-neutral-500">Loading...</p>
        )}

        {!loading && others.length === 0 && (
          <p className="px-5 py-6 text-sm text-neutral-400 dark:text-neutral-500">
            No status updates from your contacts yet.
          </p>
        )}

        {others.map((group) => (
          <button
            key={group.user._id}
            onClick={() =>
              setViewing({
                group,
                index: Math.max(0, group.items.findIndex((i) => !i.seen)),
              })
            }
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <StatusRing
              src={mediaUrl(group.user.avatar)}
              name={group.user.name}
              count={group.items.length}
              unseen={group.hasUnseen}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                {group.user.name || group.user.phone}
              </p>
              <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                {formatChatTime(lastOf(group).createdAt)}
              </p>
            </div>
          </button>
        ))}
      </div>

      {viewing && (
        <StatusViewer
          group={viewing.group}
          startIndex={viewing.index}
          onClose={() => setViewing(null)}
        />
      )}

      {composing && <StatusComposer onClose={() => setComposing(false)} />}
    </aside>
  );
}
