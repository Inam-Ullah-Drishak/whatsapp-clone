import { mediaUrl } from "./api.js";

/** The other person in a direct chat. Undefined for groups. */
export const otherParticipant = (chat, currentUserId) => {
  if (!chat || chat.isGroup) return undefined;
  return chat.participants?.find((p) => p._id !== currentUserId);
};

/** What to show as the chat's title. */
export const chatName = (chat, currentUserId) => {
  if (!chat) return "";
  if (chat.isGroup) return chat.groupName || "Group";
  const other = otherParticipant(chat, currentUserId);
  return other?.name || other?.phone || "Unknown";
};

/** Full URL of the chat's avatar, or "" to fall back to initials. */
export const chatAvatar = (chat, currentUserId) => {
  if (!chat) return "";
  if (chat.isGroup) return mediaUrl(chat.groupAvatar);
  return mediaUrl(otherParticipant(chat, currentUserId)?.avatar);
};

/** First letter, for the placeholder avatar. */
export const initial = (name) => (name || "?").trim().charAt(0).toUpperCase();

/** One-line preview of the newest message. */
export const messagePreview = (message, currentUserId) => {
  if (!message) return "";

  if (message.isDeletedForEveryone) return "This message was deleted";

  const icons = { image: "Photo", video: "Video", audio: "Audio", document: "Document" };
  const body = message.type === "text" ? message.content : icons[message.type] || "Attachment";

  const mine = message.sender?._id === currentUserId;
  return mine ? `You: ${body}` : body;
};

/**
 * WhatsApp-style timestamp: time for today, "Yesterday", weekday within
 * the last week, otherwise a short date.
 */
export const formatChatTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  const now = new Date();

  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  const daysAgo = (now - d) / 86400000;
  if (daysAgo < 7) return d.toLocaleDateString([], { weekday: "short" });

  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "2-digit" });
};
