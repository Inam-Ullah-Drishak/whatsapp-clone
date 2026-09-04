import mongoose from "mongoose";
import Status from "../models/Status.js";
import Chat from "../models/Chat.js";
import User from "../models/User.js";

const USER_FIELDS = "_id name avatar phone";

/**
 * Who can see your status: people you share a direct chat with.
 *
 * WhatsApp uses your address book. We don't have one, so an existing
 * conversation is the closest equivalent to "a contact".
 */
const contactIdsFor = async (userId) => {
  const chats = await Chat.find({ participants: userId, isGroup: false }).select(
    "participants"
  );

  const ids = new Set();
  chats.forEach((c) =>
    c.participants.forEach((p) => {
      const id = p.toString();
      if (id !== userId.toString()) ids.add(id);
    })
  );

  return [...ids];
};

/**
 * POST /api/status
 * Body: { type?, content?, mediaUrl?, background? }
 */
export const createStatus = async (req, res) => {
  try {
    const { type = "text", content, mediaUrl, background } = req.body;

    const status = await Status.create({
      user: req.user._id,
      type,
      content: content || "",
      mediaUrl: mediaUrl || "",
      ...(background ? { background } : {}),
    });

    await status.populate("user", USER_FIELDS);

    return res.status(201).json({ status });
  } catch (err) {
    console.error("createStatus failed:", err.message);
    return res.status(400).json({ message: err.message || "Could not post status" });
  }
};

/**
 * GET /api/status
 *
 * Your own statuses plus your contacts', grouped by author so the client
 * can render one ring per person.
 */
export const getStatusFeed = async (req, res) => {
  try {
    const contacts = await contactIdsFor(req.user._id);
    const authorIds = [...contacts, req.user._id.toString()];

    const statuses = await Status.find({
      user: { $in: authorIds },
      expiresAt: { $gt: new Date() },
    })
      .populate("user", USER_FIELDS)
      .sort({ createdAt: 1 });

    // Group by author, oldest first within each group
    const groups = new Map();
    statuses.forEach((s) => {
      const id = s.user._id.toString();
      if (!groups.has(id)) {
        groups.set(id, { user: s.user, items: [], hasUnseen: false });
      }

      const seen = s.viewers.some(
        (v) => v.user?.toString() === req.user._id.toString()
      );

      const entry = groups.get(id);
      entry.items.push({
        _id: s._id,
        type: s.type,
        content: s.content,
        mediaUrl: s.mediaUrl,
        background: s.background,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        seen,
        // Only the author learns who viewed a status
        viewerCount: id === req.user._id.toString() ? s.viewers.length : undefined,
      });
      if (!seen) entry.hasUnseen = true;
    });

    const all = [...groups.values()];
    const mine = all.find((g) => g.user._id.toString() === req.user._id.toString());
    const others = all.filter(
      (g) => g.user._id.toString() !== req.user._id.toString()
    );

    // Unseen first, then most recent
    others.sort((a, b) => {
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      const aLast = a.items[a.items.length - 1].createdAt;
      const bLast = b.items[b.items.length - 1].createdAt;
      return new Date(bLast) - new Date(aLast);
    });

    return res.status(200).json({ mine: mine || null, others });
  } catch (err) {
    console.error("getStatusFeed failed:", err.message);
    return res.status(500).json({ message: "Could not load statuses" });
  }
};

/**
 * POST /api/status/:id/view
 */
export const viewStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid status id" });
    }

    const status = await Status.findById(id).select("user viewers");
    if (!status) return res.status(404).json({ message: "Status not found" });

    // Viewing your own status shouldn't count
    if (status.user.toString() === req.user._id.toString()) {
      return res.status(200).json({ message: "Own status" });
    }

    const contacts = await contactIdsFor(req.user._id);
    if (!contacts.includes(status.user.toString())) {
      return res.status(403).json({ message: "Not visible to you" });
    }

    await Status.updateOne(
      { _id: id, "viewers.user": { $ne: req.user._id } },
      { $push: { viewers: { user: req.user._id, at: new Date() } } }
    );

    return res.status(200).json({ message: "Viewed" });
  } catch (err) {
    console.error("viewStatus failed:", err.message);
    return res.status(500).json({ message: "Could not record view" });
  }
};

/**
 * GET /api/status/:id/viewers    Author only.
 */
export const getStatusViewers = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid status id" });
    }

    const status = await Status.findById(id).populate("viewers.user", USER_FIELDS);
    if (!status) return res.status(404).json({ message: "Status not found" });

    if (status.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the author can see viewers" });
    }

    return res.status(200).json({ viewers: status.viewers });
  } catch (err) {
    console.error("getStatusViewers failed:", err.message);
    return res.status(500).json({ message: "Could not load viewers" });
  }
};

/**
 * DELETE /api/status/:id     Author only.
 */
export const deleteStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid status id" });
    }

    const status = await Status.findById(id).select("user");
    if (!status) return res.status(404).json({ message: "Status not found" });

    if (status.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only delete your own status" });
    }

    await Status.deleteOne({ _id: id });

    return res.status(200).json({ message: "Status deleted" });
  } catch (err) {
    console.error("deleteStatus failed:", err.message);
    return res.status(500).json({ message: "Could not delete status" });
  }
};
