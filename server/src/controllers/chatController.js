import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import { getIO, chatRoom, userRoom } from "../socket/io.js";

const PARTICIPANT_FIELDS = "_id name about avatar phone isOnline lastSeen";

/**
 * Attach a plain unreadCount for the requesting user so the client doesn't
 * have to dig through the whole unreadCounts map on every chat.
 */
const withUnreadCount = (chat, userId) => {
  const obj = chat.toObject ? chat.toObject() : chat;
  const counts = chat.unreadCounts || new Map();

  // userId is null for room-wide broadcasts, which can't carry a
  // per-user badge — clients keep their own count in that case.
  const key = userId ? userId.toString() : null;
  obj.unreadCount = key ? (counts.get ? counts.get(key) : counts[key]) || 0 : 0;

  // Flatten the per-user flags into booleans for this requester
  const has = (list) =>
    Boolean(key) && (list || []).some((id) => (id._id ? id._id : id).toString() === key);
  obj.isPinned = has(chat.pinnedBy);
  obj.isArchived = has(chat.archivedBy);
  obj.isMuted = has(chat.mutedBy);
  obj.isFavourite = has(chat.favouritedBy);
  obj.disappearingAfter = chat.disappearingAfter || 0;

  delete obj.unreadCounts;
  delete obj.pinnedBy;
  delete obj.archivedBy;
  delete obj.mutedBy;
  delete obj.favouritedBy;
  return obj;
};

/** Toggle a user id in one of the per-user arrays on a chat. */
const toggleFlag = async (field, req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid chat id" });
  }

  const chat = await Chat.findById(id).select(`participants ${field}`);
  if (!chat) return res.status(404).json({ message: "Chat not found" });

  const isMember = chat.participants.some(
    (p) => p.toString() === req.user._id.toString()
  );
  if (!isMember) {
    return res.status(403).json({ message: "You are not part of this chat" });
  }

  const already = (chat[field] || []).some(
    (u) => u.toString() === req.user._id.toString()
  );

  await Chat.updateOne(
    { _id: id },
    already
      ? { $pull: { [field]: req.user._id } }
      : { $addToSet: { [field]: req.user._id } }
  );

  const keys = {
    pinnedBy: "pinned",
    archivedBy: "archived",
    mutedBy: "muted",
    favouritedBy: "favourite",
  };
  const key = keys[field];
  return res.status(200).json({ [key]: !already });
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
    const chats = await Chat.find({
      participants: req.user._id,
      deletedBy: { $ne: req.user._id },
    })
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


/* ------------------------------------------------------------------ */
/* Group management                                                    */
/* ------------------------------------------------------------------ */

/** Load a group and check the caller's rights. Returns [chat, errorResponse]. */
const loadGroup = async (chatId, userId, { adminRequired = false } = {}) => {
  if (!mongoose.isValidObjectId(chatId)) {
    return [null, { status: 400, message: "Invalid chat id" }];
  }

  const chat = await Chat.findById(chatId);
  if (!chat) return [null, { status: 404, message: "Chat not found" }];
  if (!chat.isGroup) return [null, { status: 400, message: "This is not a group chat" }];

  const isMember = chat.participants.some((p) => p.toString() === userId.toString());
  if (!isMember) {
    return [null, { status: 403, message: "You are not part of this group" }];
  }

  if (adminRequired) {
    const isAdmin = chat.groupAdmins.some((a) => a.toString() === userId.toString());
    if (!isAdmin) {
      return [null, { status: 403, message: "Only group admins can do that" }];
    }
  }

  return [chat, null];
};

/** Push the updated group to everyone in it. */
const broadcastGroup = async (chat) => {
  await chat.populate("participants", PARTICIPANT_FIELDS);
  getIO().to(chatRoom(chat._id.toString())).emit("group:updated", {
    chat: withUnreadCount(chat, null),
  });
};

/**
 * PATCH /api/chats/:id/group
 * Body: { name?, avatar? }   Admins only.
 */
export const updateGroup = async (req, res) => {
  try {
    const [chat, err] = await loadGroup(req.params.id, req.user._id, {
      adminRequired: true,
    });
    if (err) return res.status(err.status).json({ message: err.message });

    const { name, avatar } = req.body;

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ message: "Group name cannot be empty" });
      if (trimmed.length > 100) {
        return res.status(400).json({ message: "Group name must be 100 characters or fewer" });
      }
      chat.groupName = trimmed;
    }

    if (avatar !== undefined) chat.groupAvatar = avatar;

    await chat.save();
    await broadcastGroup(chat);

    return res.status(200).json({ chat: withUnreadCount(chat, req.user._id) });
  } catch (e) {
    console.error("updateGroup failed:", e.message);
    return res.status(500).json({ message: "Could not update group" });
  }
};

/**
 * POST /api/chats/:id/participants
 * Body: { participants: [userId, ...] }   Admins only.
 */
export const addParticipants = async (req, res) => {
  try {
    const [chat, err] = await loadGroup(req.params.id, req.user._id, {
      adminRequired: true,
    });
    if (err) return res.status(err.status).json({ message: err.message });

    const { participants } = req.body;
    if (!Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ message: "No users to add" });
    }
    if (participants.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const found = await User.countDocuments({
      _id: { $in: participants },
      isVerified: true,
    });
    if (found !== new Set(participants).size) {
      return res.status(400).json({ message: "One or more users do not exist" });
    }

    // $addToSet ignores anyone already in the group
    await Chat.updateOne(
      { _id: chat._id },
      { $addToSet: { participants: { $each: participants } } }
    );

    const updated = await Chat.findById(chat._id);

    // Pull the new members' sockets into the room so they get messages live
    participants.forEach((id) => {
      getIO().in(userRoom(id.toString())).socketsJoin(chatRoom(chat._id.toString()));
    });

    await broadcastGroup(updated);

    return res.status(200).json({ chat: withUnreadCount(updated, req.user._id) });
  } catch (e) {
    console.error("addParticipants failed:", e.message);
    return res.status(500).json({ message: "Could not add participants" });
  }
};

/**
 * DELETE /api/chats/:id/participants/:userId
 * Admins remove others; anyone may remove themselves (that's leaving).
 */
export const removeParticipant = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const self = userId === req.user._id.toString();

    const [chat, err] = await loadGroup(req.params.id, req.user._id, {
      adminRequired: !self,
    });
    if (err) return res.status(err.status).json({ message: err.message });

    if (!chat.participants.some((p) => p.toString() === userId)) {
      return res.status(400).json({ message: "That user is not in this group" });
    }

    await Chat.updateOne(
      { _id: chat._id },
      { $pull: { participants: userId, groupAdmins: userId } }
    );

    const updated = await Chat.findById(chat._id);

    // Nobody left — delete the group rather than leave an orphan
    if (updated.participants.length === 0) {
      await Chat.deleteOne({ _id: chat._id });
      getIO().to(chatRoom(chat._id.toString())).emit("group:deleted", {
        chatId: chat._id.toString(),
      });
      return res.status(200).json({ message: "Group deleted" });
    }

    // Last admin left — promote the longest-standing member so the group
    // can still be managed
    if (updated.groupAdmins.length === 0) {
      updated.groupAdmins = [updated.participants[0]];
      await updated.save();
    }

    getIO().to(chatRoom(chat._id.toString())).emit("group:removed", {
      chatId: chat._id.toString(),
      userId,
    });

    getIO().in(userRoom(userId)).socketsLeave(chatRoom(chat._id.toString()));

    await broadcastGroup(updated);

    return res.status(200).json({ message: self ? "You left the group" : "Member removed" });
  } catch (e) {
    console.error("removeParticipant failed:", e.message);
    return res.status(500).json({ message: "Could not remove participant" });
  }
};

/**
 * POST /api/chats/:id/admins/:userId    Admins only.
 */
export const promoteAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const [chat, err] = await loadGroup(req.params.id, req.user._id, {
      adminRequired: true,
    });
    if (err) return res.status(err.status).json({ message: err.message });

    if (!chat.participants.some((p) => p.toString() === userId)) {
      return res.status(400).json({ message: "That user is not in this group" });
    }

    await Chat.updateOne({ _id: chat._id }, { $addToSet: { groupAdmins: userId } });

    const updated = await Chat.findById(chat._id);
    await broadcastGroup(updated);

    return res.status(200).json({ message: "Member promoted to admin" });
  } catch (e) {
    console.error("promoteAdmin failed:", e.message);
    return res.status(500).json({ message: "Could not promote member" });
  }
};


/** PATCH /api/chats/:id/pin      (toggles) */
export const togglePin = async (req, res) => {
  try {
    return await toggleFlag("pinnedBy", req, res);
  } catch (err) {
    console.error("togglePin failed:", err.message);
    return res.status(500).json({ message: "Could not pin chat" });
  }
};

/** PATCH /api/chats/:id/archive  (toggles) */
export const toggleArchive = async (req, res) => {
  try {
    return await toggleFlag("archivedBy", req, res);
  } catch (err) {
    console.error("toggleArchive failed:", err.message);
    return res.status(500).json({ message: "Could not archive chat" });
  }
};


/**
 * DELETE /api/chats/:id
 *
 * Clears the conversation for the caller only: every message is marked
 * deleted-for-them and the chat is hidden from their list. The other
 * participants keep everything. A new message un-hides it.
 */
export const deleteChat = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid chat id" });
    }

    const chat = await Chat.findById(id).select("participants");
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    const isMember = chat.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: "You are not part of this chat" });
    }

    const Message = (await import("../models/Message.js")).default;

    await Message.updateMany(
      { chat: id, deletedFor: { $ne: req.user._id } },
      { $addToSet: { deletedFor: req.user._id } }
    );

    await Chat.updateOne(
      { _id: id },
      {
        $addToSet: { deletedBy: req.user._id },
        $unset: { [`unreadCounts.${req.user._id}`]: "" },
      }
    );

    return res.status(200).json({ message: "Chat deleted" });
  } catch (err) {
    console.error("deleteChat failed:", err.message);
    return res.status(500).json({ message: "Could not delete chat" });
  }
};


/** PATCH /api/chats/:id/mute     (toggles) */
export const toggleMute = async (req, res) => {
  try {
    return await toggleFlag("mutedBy", req, res);
  } catch (err) {
    console.error("toggleMute failed:", err.message);
    return res.status(500).json({ message: "Could not mute chat" });
  }
};


/**
 * DELETE /api/chats/:id/group     Admins only.
 *
 * Removes the group for everyone and deletes its messages. Unlike
 * "delete chat", which only hides a conversation for one person, this is
 * destructive and cannot be undone.
 */
export const deleteGroup = async (req, res) => {
  try {
    const [chat, err] = await loadGroup(req.params.id, req.user._id, {
      adminRequired: true,
    });
    if (err) return res.status(err.status).json({ message: err.message });

    const Message = (await import("../models/Message.js")).default;

    await Message.deleteMany({ chat: chat._id });
    await Chat.deleteOne({ _id: chat._id });

    const room = chatRoom(chat._id.toString());
    getIO().to(room).emit("group:deleted", { chatId: chat._id.toString() });
    getIO().socketsLeave(room);

    return res.status(200).json({ message: "Group deleted" });
  } catch (e) {
    console.error("deleteGroup failed:", e.message);
    return res.status(500).json({ message: "Could not delete group" });
  }
};


/** PATCH /api/chats/:id/favourite    (toggles) */
export const toggleFavourite = async (req, res) => {
  try {
    return await toggleFlag("favouritedBy", req, res);
  } catch (err) {
    console.error("toggleFavourite failed:", err.message);
    return res.status(500).json({ message: "Could not update favourites" });
  }
};


const DISAPPEARING_OPTIONS = [0, 24, 168, 2160];

/**
 * PATCH /api/chats/:id/disappearing
 * Body: { hours }
 *
 * Applies to new messages only — existing ones keep whatever lifetime
 * they were created with, as changing history retroactively would be
 * surprising.
 */
export const setDisappearing = async (req, res) => {
  try {
    const { id } = req.params;
    const hours = Number(req.body.hours);

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid chat id" });
    }

    if (!DISAPPEARING_OPTIONS.includes(hours)) {
      return res.status(400).json({ message: "Unsupported duration" });
    }

    const chat = await Chat.findById(id);
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    const isMember = chat.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: "You are not part of this chat" });
    }

    // In groups this is an admin setting, as it affects everyone
    if (chat.isGroup) {
      const isAdmin = chat.groupAdmins.some(
        (a) => a.toString() === req.user._id.toString()
      );
      if (!isAdmin) {
        return res.status(403).json({ message: "Only group admins can change this" });
      }
    }

    chat.disappearingAfter = hours;
    await chat.save();

    getIO().to(chatRoom(chat._id.toString())).emit("chat:disappearing", {
      chatId: chat._id.toString(),
      hours,
      changedBy: req.user.name || req.user.phone,
    });

    return res.status(200).json({ disappearingAfter: hours });
  } catch (err) {
    console.error("setDisappearing failed:", err.message);
    return res.status(500).json({ message: "Could not update setting" });
  }
};