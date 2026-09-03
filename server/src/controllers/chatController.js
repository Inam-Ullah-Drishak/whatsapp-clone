import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import User from "../models/User.js";

const PARTICIPANT_FIELDS = "_id name about avatar phone isOnline lastSeen";

/**
 * Attach a plain unreadCount for the requesting user so the client doesn't
 * have to dig through the whole unreadCounts map on every chat.
 */
const withUnreadCount = (chat, userId) => {
  const obj = chat.toObject ? chat.toObject() : chat;
  const counts = chat.unreadCounts || new Map();
  obj.unreadCount = (counts.get ? counts.get(userId.toString()) : counts[userId]) || 0;
  delete obj.unreadCounts;
  return obj;
};

/**
 * POST /api/chats
 * Body: { userId }
 *
 * Opens the direct chat with someone, creating it on first contact.
 * Idempotent — tapping a contact twice returns the same chat.
 */
export const accessChat = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot start a chat with yourself" });
    }

    const other = await User.findById(userId).select("_id isVerified");
    if (!other || !other.isVerified) {
      return res.status(404).json({ message: "User not found" });
    }

    const chat = await Chat.findOrCreateDirect(req.user._id, other._id);
    await chat.populate("participants", PARTICIPANT_FIELDS);

    return res.status(200).json({ chat: withUnreadCount(chat, req.user._id) });
  } catch (err) {
    console.error("accessChat failed:", err.message);
    return res.status(500).json({ message: "Could not open chat" });
  }
};

/**
 * GET /api/chats
 * The sidebar list: every chat you're in, most recent activity first.
 */
export const getChats = async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.user._id })
      .populate("participants", PARTICIPANT_FIELDS)
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "_id name" },
      })
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      chats: chats.map((c) => withUnreadCount(c, req.user._id)),
    });
  } catch (err) {
    console.error("getChats failed:", err.message);
    return res.status(500).json({ message: "Could not load chats" });
  }
};

/**
 * GET /api/chats/:id
 */
export const getChatById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid chat id" });
    }

    const chat = await Chat.findById(id).populate("participants", PARTICIPANT_FIELDS);

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // Membership check — without this, any logged-in user could read any
    // chat just by knowing its id.
    const isMember = chat.participants.some(
      (p) => p._id.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: "You are not part of this chat" });
    }

    return res.status(200).json({ chat: withUnreadCount(chat, req.user._id) });
  } catch (err) {
    console.error("getChatById failed:", err.message);
    return res.status(500).json({ message: "Could not load chat" });
  }
};

/**
 * POST /api/chats/group
 * Body: { name, participants: [userId, ...] }
 */
export const createGroup = async (req, res) => {
  try {
    const { name, participants } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    if (!Array.isArray(participants) || participants.length < 1) {
      return res.status(400).json({ message: "Add at least one other member" });
    }

    if (participants.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ message: "Invalid user id in participants" });
    }

    // Creator is always a member; Set removes duplicates and any attempt
    // to pass the creator in twice.
    const ids = [...new Set([...participants, req.user._id.toString()])];

    const found = await User.countDocuments({ _id: { $in: ids }, isVerified: true });
    if (found !== ids.length) {
      return res.status(400).json({ message: "One or more users do not exist" });
    }

    const chat = await Chat.create({
      isGroup: true,
      groupName: name.trim(),
      participants: ids,
      groupAdmins: [req.user._id],
      createdBy: req.user._id,
    });

    await chat.populate("participants", PARTICIPANT_FIELDS);

    return res.status(201).json({ chat: withUnreadCount(chat, req.user._id) });
  } catch (err) {
    console.error("createGroup failed:", err.message);
    return res.status(500).json({ message: "Could not create group" });
  }
};

/**
 * PATCH /api/chats/:id/read
 * Called when the user opens a chat — resets their badge only.
 */
export const markChatRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid chat id" });
    }

    const chat = await Chat.findById(id);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const isMember = chat.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: "You are not part of this chat" });
    }

    chat.clearUnread(req.user._id);
    await chat.save();

    return res.status(200).json({ message: "Marked as read" });
  } catch (err) {
    console.error("markChatRead failed:", err.message);
    return res.status(500).json({ message: "Could not mark chat as read" });
  }
};