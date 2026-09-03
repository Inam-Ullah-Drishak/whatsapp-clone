import { mediaUrl } from "../lib/api.js";

const time = (value) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Single tick = sent, double = delivered, blue double = read. */
function Ticks({ status }) {
  if (status === "sending") {
    return <span className="text-[10px] text-neutral-400">clock</span>;
  }
  if (status === "failed") {
    return <span className="text-[10px] font-medium text-red-500">failed</span>;
  }

  const blue = status === "read";
  const double = status === "delivered" || status === "read";

  return (
    <svg
      viewBox="0 0 18 12"
      className={`h-3.5 w-4 ${blue ? "text-sky-500" : "text-neutral-400"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 6.5 L4.5 10 L11 2" />
      {double && <path d="M7 6.5 L10.5 10 L17 2" />}
    </svg>
  );
}

export default function MessageBubble({ message, mine, showSender }) {
  const deleted = message.isDeletedForEveryone;

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} px-4`}>
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm sm:max-w-[65%] ${
          mine ? "bg-emerald-100" : "bg-white"
        }`}
      >
        {showSender && !mine && (
          <p className="mb-0.5 text-xs font-medium text-teal-700">
            {message.sender?.name || "Unknown"}
          </p>
        )}

        {deleted ? (
          <p className="text-sm italic text-neutral-400">
            This message was deleted
          </p>
        ) : (
          <>
            {message.type === "image" && message.mediaUrl && (
              <img
                src={mediaUrl(message.mediaUrl)}
                alt={message.fileName || "image"}
                className="mb-1 max-h-72 rounded object-cover"
              />
            )}

            {message.type !== "image" && message.mediaUrl && (
              <a
                href={mediaUrl(message.mediaUrl)}
                target="_blank"
                rel="noreferrer"
                className="mb-1 block rounded bg-black/5 px-3 py-2 text-sm text-teal-800 underline"
              >
                {message.fileName || "Attachment"}
              </a>
            )}

            {message.content && (
              <p className="whitespace-pre-wrap break-words text-sm text-neutral-800">
                {message.content}
              </p>
            )}
          </>
        )}

        <div className="mt-1 flex items-center justify-end gap-1">
          <span className="text-[11px] text-neutral-400">
            {time(message.createdAt)}
          </span>
          {mine && !deleted && <Ticks status={message.status} />}
        </div>
      </div>
    </div>
  );
}
