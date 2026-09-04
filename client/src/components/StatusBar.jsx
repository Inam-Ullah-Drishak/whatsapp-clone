import { useState } from "react";
import { mediaUrl } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useStatus } from "../context/StatusContext.jsx";
import { initial } from "../lib/chatUtils.js";
import StatusViewer from "./StatusViewer.jsx";
import StatusComposer from "./StatusComposer.jsx";

/** Avatar wrapped in a ring: green when unseen, grey once viewed. */
function Ring({ src, name, unseen, children, onClick, label }) {
  return (
    <button onClick={onClick} className="flex w-16 shrink-0 flex-col items-center gap-1">
      <span
        style={{
          padding: 2,
          borderRadius: 9999,
          border: `2px solid ${unseen ? "#25D366" : "#c9ced1"}`,
          display: "inline-flex",
        }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            style={{ width: 48, height: 48, borderRadius: 9999, objectFit: "cover" }}
          />
        ) : (
          <span
            style={{
              width: 48,
              height: 48,
              borderRadius: 9999,
              background: "#0f766e",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}
          >
            {initial(name)}
          </span>
        )}
        {children}
      </span>
      <span className="w-16 truncate text-center text-[11px] text-neutral-600 dark:text-neutral-300">
        {label}
      </span>
    </button>
  );
}

export default function StatusBar() {
  const { user } = useAuth();
  const { mine, others } = useStatus();

  const [viewing, setViewing] = useState(null); // { group, index }
  const [composing, setComposing] = useState(false);

  return (
    <>
      <div className="flex gap-2 overflow-x-auto border-b border-neutral-100 dark:border-neutral-800 px-3 py-3">
        {/* Your own status, or the button to add one */}
        <div className="relative">
          <Ring
            src={mediaUrl(user?.avatar)}
            name={user?.name || user?.phone}
            unseen={Boolean(mine)}
            label={mine ? "My status" : "Add status"}
            onClick={() =>
              mine ? setViewing({ group: mine, index: 0 }) : setComposing(true)
            }
          />
          {mine && (
            <button
              onClick={() => setComposing(true)}
              className="absolute -bottom-0 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow"
              title="Add to my status"
              aria-label="Add to my status"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          )}
        </div>

        {others.map((group) => (
          <Ring
            key={group.user._id}
            src={mediaUrl(group.user.avatar)}
            name={group.user.name || group.user.phone}
            unseen={group.hasUnseen}
            label={group.user.name || group.user.phone}
            onClick={() =>
              setViewing({
                group,
                // Resume at the first unseen item
                index: Math.max(
                  0,
                  group.items.findIndex((i) => !i.seen)
                ),
              })
            }
          />
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
    </>
  );
}
