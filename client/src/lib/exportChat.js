import api, { API_URL } from "./api.js";

const PAGE = 100;

const stamp = (value) =>
  new Date(value).toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** One line per message, in WhatsApp's own export format. */
const lineFor = (m, currentUserId) => {
  const who = m.sender?._id === currentUserId ? "You" : m.sender?.name || "Unknown";

  let body;
  if (m.isDeletedForEveryone) {
    body = "This message was deleted";
  } else if (m.type === "text") {
    body = m.content;
  } else {
    const label = { image: "image", video: "video", audio: "voice note" }[m.type] || "file";
    const name = m.fileName ? ` (${m.fileName})` : "";
    body = `<${label} omitted>${name}${m.content ? " " + m.content : ""}`;
  }

  return `[${stamp(m.createdAt)}] ${who}: ${body}`;
};

/**
 * Page backwards through the whole history and build a text file.
 *
 * Attachments aren't bundled — the export lists them as omitted, the same
 * as WhatsApp's "without media" option, which keeps this to one small file.
 */
export const exportChat = async ({ chatId, chatName, currentUserId, onProgress }) => {
  const all = [];
  let before;

  // Loop until a page comes back short, meaning we've reached the start
  for (;;) {
    const { data } = await api.get(`/messages/${chatId}`, {
      params: { limit: PAGE, ...(before ? { before } : {}) },
    });

    if (!data.messages.length) break;

    all.unshift(...data.messages);
    onProgress?.(all.length);

    if (!data.hasMore) break;
    before = data.nextCursor;
  }

  const header = [
    `Chat export: ${chatName}`,
    `Exported: ${stamp(new Date())}`,
    `Messages: ${all.length}`,
    "",
  ].join("\n");

  const text = header + all.map((m) => lineFor(m, currentUserId)).join("\n") + "\n";

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${chatName.replace(/[^\w\s-]/g, "")} chat.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return all.length;
};
