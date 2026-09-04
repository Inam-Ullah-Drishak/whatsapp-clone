import mongoose from "mongoose";
import Message from "../models/Message.js";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import { getIO, chatRoom, userRoom } from "../socket/io.js";

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
    const { chatId, content, type = "text", replyTo, mediaUrl, fileName, fileSize, mimeType } =
      req.body;

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

    const message = await Message.create({
      chat: chatId,
      sender: req.user._id,
      type,
      content: content || "",
      mediaUrl: mediaUrl || "",
      fileName: fileName || "",
      fileSize,
      mimeType: mimeType || "",
      replyTo: replyTo || null,
    });

    // Keep the sidebar in sync: preview pointer, badge counts, and
    // updatedAt (which drives chat list ordering).
    chat.lastMessage = message._id;
    chat.bumpUnread(req.user._id);
    await chat.save();

    await message.populate([
      { path: "sender", select: SENDER_FIELDS },
      { path: "replyTo", populate: { path: "sender", select: SENDER_FIELDS } },
    ]);

    // Live delivery. The sender receives this too — clients should replace
    // their optimistic bubble by matching _id rather than appending blindly.
    getIO().to(chatRoom(chatId)).emit("message:new", { message });
    emitChatUpdate(chat, message);

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

    // Your own messages are excluded — you don't read-receipt yourself.
    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: req.user._id },
        "readBy.user": { $ne: req.user._id },
      },
      {
        $push: { readBy: { user: req.user._id, at: new Date() } },
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