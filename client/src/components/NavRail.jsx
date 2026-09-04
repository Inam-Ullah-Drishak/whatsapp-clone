import { mediaUrl } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useChats } from "../context/ChatContext.jsx";
import { useStatus } from "../context/StatusContext.jsx";
import Avatar from "./Avatar.jsx";

const Icon = ({ path, filled = false }) => (
  <svg
    viewBox="0 0 24 24"
    className="h-6 w-6"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {path}
  </svg>
);

function RailButton({ active, onClick, title, badge, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`relative flex h-11 w-11 items-center justify-center rounded-lg transition ${
        active
          ? "bg-neutral-200 text-neutral-900"
          : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
      }`}
    >
      {children}
      {badge > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-medium text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

export default function NavRail({ panel, setPanel, onOpenProfile, onOpenStarred }) {
  const { user } = useAuth();
  const { chats } = useChats();
  const { others } = useStatus();

  const unreadTotal = chats
    .filter((c) => !c.isMuted)
    .reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const unseenStatus = others.filter((g) => g.hasUnseen).length;

  return (
    <nav className="flex h-full w-16 shrink-0 flex-col items-center justify-between border-r border-neutral-200 bg-neutral-50 py-3">
      <div className="flex flex-col items-center gap-1">
        <RailButton
          active={panel === "chats"}
          onClick={() => setPanel("chats")}
          title="Chats"
          badge={unreadTotal}
        >
          <Icon path={<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-4-.9L3 21l1.9-4.9A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />} />
        </RailButton>

        <RailButton
          active={panel === "status"}
          onClick={() => setPanel("status")}
          title="Status"
          badge={unseenStatus}
        >
          <Icon
            path={
              <>
                <circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
                <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
              </>
            }
          />
        </RailButton>

        <RailButton onClick={onOpenStarred} title="Starred messages">
          <Icon path={<path d="M12 2l2.9 6.3 6.8.8-5 4.7 1.3 6.8L12 17.3 6 20.6l1.3-6.8-5-4.7 6.8-.8z" />} />
        </RailButton>
      </div>

      <button
        onClick={onOpenProfile}
        title="Profile"
        aria-label="Profile"
        className="rounded-full transition hover:opacity-80"
      >
        <Avatar src={mediaUrl(user?.avatar)} name={user?.name || user?.phone} size="sm" />
      </button>
    </nav>
  );
}