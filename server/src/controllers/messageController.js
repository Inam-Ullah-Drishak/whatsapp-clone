import mongoose from "mongoose";
import Message from "../models/Message.js";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import { getIO, chatRoom, userRoom } from "../socket/io.js";
import { firstUrl, fetchLinkPreview } from "../utils/linkPreview.js";

const SENDER_FIELDS = "_id name avatar";
// WhatsApp allows edits for 15 minutes; the same window keeps history honest
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

/**
 * Push a sidebar refresh to each participant individually, because the
 * unread badge differs per person — a single room-wide emit can't carry
 * a per-user number.
 */
const emitChatUpdate = (chat, lastMessage) => {
  const io = getIO();

  chat.participants.forEach((p) => {
    const id = p._id ? p._id.toString() : p.toString();
    io.to(userRoom(id)).emit("chat:updated", {
      chatId: chat._id.toString(),
      lastMessage,
      unreadCount: chat.unreadCounts.get(id) || 0,
      updatedAt: chat.updatedAt,
    });
  });
};

/**
 * POST /api/messages
 * Body: { chatId, content, type?, replyTo?, mediaUrl?, fileName?, fileSize?, mimeType? }
 */
export const sendMessage = async (req, res) => {
  try {
    const {
      chatId,
      content,
      type = "text",
      replyTo,
      mediaUrl,
      fileName,
      fileSize,
      mimeType,
      isForwarded = false,
    } = req.body;

    if (!mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({ message: "Invalid chat id" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const isMember = chat.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: "You are not part of this chat" });
    }

    // Blocking only applies to direct chats. Either direction stops the send:
    // you can't message someone who blocked you, or someone you blocked.
    if (!chat.isGroup) {
      const otherId = chat.participants.find(
        (p) => p.toString() !== req.user._id.toString()
      );

      const other = await User.findById(otherId).select("blockedUsers");

      const theyBlockedMe = other?.blockedUsers?.some(
        (id) => id.toString() === req.user._id.toString()
      );
      const iBlockedThem = req.user.blockedUsers?.some(
        (id) => id.toString() === otherId.toString()
      );

      if (theyBlockedMe || iBlockedThem) {
        return res.status(403).json({ message: "Message could not be delivered" });
      }
    }

    // A reply must point at a message in this same chat
    if (replyTo) {
      if (!mongoose.isValidObjectId(replyTo)) {
        return res.status(400).json({ message: "Invalid replyTo id" });
      }
      const parent = await Message.findById(replyTo).select("chat");
      if (!parent || parent.chat.toString() !== chatId) {
        return res.status(400).json({ message: "Cannot reply to a message from another chat" });
      }
    }

    // Disappearing messages: stamp a lifetime so Mongo's TTL index
    // removes it later. Null means it never expires.
    const expiresAt = chat.disappearingAfter
      ? new Date(Date.now() + chat.disappearingAfter * 60 * 60 * 1000)
      : null;

    const message = await Message.create({
      chat: chatId,
      expiresAt,
      sender: req.user._id,
      type,
      content: content || "",
      mediaUrl: mediaUrl || "",
      fileName: fileName || "",
      fileSize,
      mimeType: mimeType || "",
      replyTo: replyTo || null,
      isForwarded: Boolean(isForwarded),
    });

    // Keep the sidebar in sync: preview pointer, badge counts, and
    // updatedAt (which drives chat list ordering).
    chat.lastMessage = message._id;
    chat.bumpUnread(req.user._id);
    // A new message brings the chat back for anyone who deleted it.
    // Their old messages stay hidden via deletedFor.
    chat.deletedBy = [];
    await chat.save();

    await message.populate([
      { path: "sender", select: SENDER_FIELDS },
      { path: "replyTo", populate: { path: "sender", select: SENDER_FIELDS } },
    ]);

    // Live delivery. The sender receives this too — clients should replace
    // their optimistic bubble by matching _id rather than appending blindly.
    getIO().to(chatRoom(chatId)).emit("message:new", { message });
    emitChatUpdate(chat, message);

    // Link preview runs after the response so a slow site never delays
    // the send. It arrives separately over the socket.
    const link = message.type === "text" ? firstUrl(message.content) : null;
    if (link) {
      fetchLinkPreview(link)
        .then(async (preview) => {
          if (!preview) return;
          await Message.updateOne({ _id: message._id }, { $set: { preview } });
          getIO().to(chatRoom(chatId)).emit("message:preview", {
            messageId: message._id.toString(),
            chatId,
            preview,
          });
        })
        .catch(() => {});
    }

    return res.status(201).json({ message });
  } catch (err) {
    console.error("sendMessage failed:", err.message);
    return res.status(500).json({ message: err.message || "Could not send message" });
  }
};

/**
 * GET /api/messages/:chatId?limit=30&before=<ISO date>
 *
 * Cursor pagination on createdAt rather than skip/limit: skip drifts when
 * new messages arrive mid-scroll, so users see duplicates or gaps.
 */
export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { before } = req.query;
    const limit = Math.min(Number(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);

    if (!mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({ message: "Invalid chat id" });
    }

    const chat = await Chat.findById(chatId).select("participants");
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const isMember = chat.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: "You are not part of this chat" });
    }

    const query = {
      chat: chatId,
      deletedFor: { $ne: req.user._id },
      // Mongo's TTL monitor only sweeps once a minute, so filter expired
      // messages out rather than briefly showing them again
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    };

    if (before) {
      const cursor = new Date(before);
      if (isNaN(cursor.getTime())) {
        return res.status(400).json({ message: "Invalid 'before' timestamp" });
      }
      query.createdAt = { $lt: cursor };
    }

    const messages = await Message.find(query)
      .populate("sender", SENDER_FIELDS)
      .populate({ path: "replyTo", populate: { path: "sender", select: SENDER_FIELDS } })
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.status(200).json({
      // Reversed so the client renders oldest-to-newest
      messages: messages.reverse(),
      hasMore: messages.length === limit,
      nextCursor: messages.length ? messages[0].createdAt : null,
    });
  } catch (err) {
    console.error("getMessages failed:", err.message);
    return res.status(500).json({ message: "Could not load messages" });
  }
};

/**
 * PATCH /api/messages/:chatId/read
 * Marks every unread message in the chat as read by this user.
 */
export const markMessagesRead = async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({ message: "Invalid chat id" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const isMember = chat.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: "You are not part of this chat" });
    }

    const now = new Date();

    // Reading implies delivery, so record that first — otherwise a message
    // can show as read by someone with an empty delivered list.
    // Two passes because a single updateMany can't push conditionally to
    // two different arrays.
    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: req.user._id },
        "deliveredTo.user": { $ne: req.user._id },
      },
      { $push: { deliveredTo: { user: req.user._id, at: now } } }
    );

    // Your own messages are excluded — you don't read-receipt yourself.
    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: req.user._id },
        "readBy.user": { $ne: req.user._id },
      },
      {
        $push: { readBy: { user: req.user._id, at: now } },
        $set: { status: "read" },
      }
    );

    chat.clearUnread(req.user._id);
    await chat.save();

    // Turns the other side's ticks blue without them refreshing
    getIO().to(chatRoom(chatId)).emit("messages:read", {
      chatId,
      readBy: req.user._id.toString(),
      at: new Date(),
    });

    return res.status(200).json({ message: "Messages marked as read" });
  } catch (err) {
    console.error("markMessagesRead failed:", err.message);
    return res.status(500).json({ message: "Could not mark messages as read" });
  }
};

/**
 * DELETE /api/messages/:id?scope=me|everyone
 */
export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = req.query.scope === "everyone" ? "everyone" : "me";

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid message id" });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const chat = await Chat.findById(message.chat).select("participants");
    const isMember = chat?.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: "You are not part of this chat" });
    }

    if (scope === "everyone") {
      if (message.sender.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "You can only unsend your own messages" });
      }
      message.deleteForEveryone();
    } else {
      const already = message.deletedFor.some(
        (u) => u.toString() === req.user._id.toString()
      );
      if (!already) message.deletedFor.push(req.user._id);
    }

    await message.save();

    // "Delete for me" is private, so only broadcast the shared case
    if (scope === "everyone") {
      getIO().to(chatRoom(message.chat.toString())).emit("message:deleted", {
        messageId: message._id.toString(),
        chatId: message.chat.toString(),
      });
    }

    return res.status(200).json({ message: "Message deleted", scope });
  } catch (err) {
    console.error("deleteMessage failed:", err.message);
    return res.status(500).json({ message: "Could not delete message" });
  }
};


/**
 * PATCH /api/messages/:id
 * Body: { content }
 *
 * Text only, sender only, within the edit window.
 */
export const editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid message id" });
    }

    if (!content?.trim()) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only edit your own messages" });
    }

    if (message.isDeletedForEveryone) {
      return res.status(400).json({ message: "This message was deleted" });
    }

    if (message.type !== "text") {
      return res.status(400).json({ message: "Only text messages can be edited" });
    }

    if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
      return res.status(400).json({ message: "This message is too old to edit" });
    }

    message.content = content.trim();
    message.editedAt = new Date();
    await message.save();

    await message.populate([
      { path: "sender", select: SENDER_FIELDS },
      { path: "replyTo", populate: { path: "sender", select: SENDER_FIELDS } },
    ]);

    getIO().to(chatRoom(message.chat.toString())).emit("message:edited", {
      message,
    });

    // The sidebar preview may be showing this message
    const chat = await Chat.findById(message.chat);
    if (chat?.lastMessage?.toString() === message._id.toString()) {
      emitChatUpdate(chat, message);
    }

    return res.status(200).json({ message });
  } catch (err) {
    console.error("editMessage failed:", err.message);
    return res.status(500).json({ message: "Could not edit message" });
  }
};


/**
 * POST /api/messages/:id/star     (toggles)
 *
 * Starring is private: only you see your own stars, so this stores the
 * user id on the message rather than a shared boolean.
 */
export const toggleStar = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid message id" });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const chat = await Chat.findById(message.chat).select("participants");
    const isMember = chat?.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: "You are not part of this chat" });
    }

    const already = message.starredBy.some(
      (u) => u.toString() === req.user._id.toString()
    );

    await Message.updateOne(
      { _id: id },
      already
        ? { $pull: { starredBy: req.user._id } }
        : { $addToSet: { starredBy: req.user._id } }
    );

    return res.status(200).json({ starred: !already });
  } catch (err) {
    console.error("toggleStar failed:", err.message);
    return res.status(500).json({ message: "Could not star message" });
  }
};

/**
 * GET /api/messages/starred/all
 * Every message you've starred, newest first, across all chats.
 */
export const getStarredMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      starredBy: req.user._id,
      deletedFor: { $ne: req.user._id },
      isDeletedForEveryone: false,
    })
      .populate("sender", SENDER_FIELDS)
      .populate({ path: "chat", select: "isGroup groupName participants" })
      .sort({ createdAt: -1 })
      .limit(200);

    return res.status(200).json({ messages });
  } catch (err) {
    console.error("getStarredMessages failed:", err.message);
    return res.status(500).json({ message: "Could not load starred messages" });
  }
};


/**
 * GET /api/messages/search?q=hello&chatId=optional
 *
 * Searches only chats the user belongs to, skipping anything they've
 * deleted. Case-insensitive substring match.
 */
export const searchMessages = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const { chatId } = req.query;

    if (q.length < 2) {
      return res.status(400).json({ message: "Search needs at least 2 characters" });
    }

    // Escape regex metacharacters so a query like "a+b" is literal
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    let chatFilter;
    if (chatId) {
      if (!mongoose.isValidObjectId(chatId)) {
        return res.status(400).json({ message: "Invalid chat id" });
      }
      const chat = await Chat.findById(chatId).select("participants");
      const isMember = chat?.participants.some(
        (p) => p.toString() === req.user._id.toString()
      );
      if (!isMember) {
        return res.status(403).json({ message: "You are not part of this chat" });
      }
      chatFilter = chatId;
    } else {
      // All chats the user is in, minus ones they deleted
      const chats = await Chat.find({
        participants: req.user._id,
        deletedBy: { $ne: req.user._id },
      }).select("_id");
      chatFilter = { $in: chats.map((c) => c._id) };
    }

    const messages = await Message.find({
      chat: chatFilter,
      content: { $regex: safe, $options: "i" },
      deletedFor: { $ne: req.user._id },
      isDeletedForEveryone: false,
    })
      .populate("sender", SENDER_FIELDS)
      .populate({ path: "chat", select: "isGroup groupName participants" })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({ messages, query: q });
  } catch (err) {
    console.error("searchMessages failed:", err.message);
    return res.status(500).json({ message: "Search failed" });
  }
};


/**
 * Any single emoji is allowed, but the value still has to be validated:
 * without a check, this field would accept arbitrary strings and the
 * client would render whatever anyone posted.
 */
const isValidEmoji = (value) => {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 12) return false;
  if (/[a-zA-Z0-9\s]/.test(value)) return false;
  // At least one character outside the basic multilingual plane or a
  // known symbol range
  return /\p{Extended_Pictographic}/u.test(value);
};

export const reactToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid message id" });
    }

    if (emoji && !isValidEmoji(emoji)) {
      return res.status(400).json({ message: "Unsupported reaction" });
    }

    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ message: "Message not found" });

    const chat = await Chat.findById(message.chat).select("participants");
    const isMember = chat?.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: "You are not part of this chat" });
    }

    const mine = message.reactions.find(
      (r) => r.user.toString() === req.user._id.toString()
    );

    // Always drop the existing one first, then add unless it was a toggle-off
    message.reactions = message.reactions.filter(
      (r) => r.user.toString() !== req.user._id.toString()
    );

    const removing = !emoji || mine?.emoji === emoji;
    if (!removing) {
      message.reactions.push({ user: req.user._id, emoji });
    }

    await message.save();

    getIO().to(chatRoom(message.chat.toString())).emit("message:reaction", {
      messageId: message._id.toString(),
      chatId: message.chat.toString(),
      reactions: message.reactions,
    });

    return res.status(200).json({ reactions: message.reactions });
  } catch (err) {
    console.error("reactToMessage failed:", err.message);
    return res.status(500).json({ message: "Could not react to message" });
  }
};


/**
 * GET /api/messages/:id/info
 *
 * Per-recipient receipts for one of your own messages. Restricted to the
 * sender: who has read your message is not something other participants
 * should be able to query.
 */
export const getMessageInfo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid message id" });
    }

    const message = await Message.findById(id)
      .populate("readBy.user", SENDER_FIELDS)
      .populate("deliveredTo.user", SENDER_FIELDS)
      .populate({ path: "chat", select: "participants isGroup" });

    if (!message) return res.status(404).json({ message: "Message not found" });

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only view info for your own messages" });
    }

    const readIds = message.readBy.map((r) => r.user?._id?.toString());

    // Anyone in the chat who is neither the sender nor a reader
    const pending = (message.chat?.participants || [])
      .map((p) => p.toString())
      .filter((p) => p !== req.user._id.toString() && !readIds.includes(p));

    const User = (await import("../models/User.js")).default;
    const pendingUsers = await User.find({ _id: { $in: pending } }).select(SENDER_FIELDS);

    return res.status(200).json({
      readBy: message.readBy,
      deliveredTo: message.deliveredTo,
      pending: pendingUsers,
      sentAt: message.createdAt,
      isGroup: Boolean(message.chat?.isGroup),
    });
  } catch (err) {
    console.error("getMessageInfo failed:", err.message);
    return res.status(500).json({ message: "Could not load message info" });
  }
};


/**
 * GET /api/messages/:chatId/around/:messageId?limit=20
 *
 * A window of history centred on one message, so search results and reply
 * quotes can jump straight to it instead of loading from the newest end.
 */
export const getMessagesAround = async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    if (!mongoose.isValidObjectId(chatId) || !mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const chat = await Chat.findById(chatId).select("participants");
    const isMember = chat?.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: "You are not part of this chat" });
    }

    const target = await Message.findById(messageId).select("chat createdAt");
    if (!target || target.chat.toString() !== chatId) {
      return res.status(404).json({ message: "Message not found in this chat" });
    }

    const base = {
      chat: chatId,
      deletedFor: { $ne: req.user._id },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    };

    const populate = (q) =>
      q
        .populate("sender", SENDER_FIELDS)
        .populate({ path: "replyTo", populate: { path: "sender", select: SENDER_FIELDS } });

    // Half a page each side of the target
    const [older, newer] = await Promise.all([
      populate(
        Message.find({ ...base, createdAt: { $lt: target.createdAt } })
          .sort({ createdAt: -1 })
          .limit(Math.floor(limit / 2))
      ),
      populate(
        Message.find({ ...base, createdAt: { $gte: target.createdAt } })
          .sort({ createdAt: 1 })
          .limit(Math.ceil(limit / 2))
      ),
    ]);

    const messages = [...older.reverse(), ...newer];

    // Is there more history above this window?
    const hasMore = messages.length
      ? (await Message.countDocuments({
          ...base,
          createdAt: { $lt: messages[0].createdAt },
        })) > 0
      : false;

    return res.status(200).json({
      messages,
      hasMore,
      nextCursor: messages.length ? messages[0].createdAt : null,
      // The client may be showing a window rather than the live tail
      atBottom: newer.length < Math.ceil(limit / 2),
    });
  } catch (err) {
    console.error("getMessagesAround failed:", err.message);
    return res.status(500).json({ message: "Could not load messages" });
  }
};
