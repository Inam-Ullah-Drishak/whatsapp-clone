import mongoose from "mongoose";
import User from "../models/User.js";

// Fields safe to expose when returning someone *other* than the logged-in user
const PUBLIC_FIELDS = "_id name about avatar phone isOnline lastSeen";

const normalizePhone = (raw = "") => raw.replace(/[\s()-]/g, "").trim();

/**
 * PATCH /api/users/me
 * Body: { name?, about? }
 *
 * Whitelisted on purpose — spreading req.body into the document would let a
 * client set isVerified, blockedUsers, or otpHash on itself.
 */
export const updateProfile = async (req, res) => {
  try {
    const { name, about } = req.body;

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) {
        return res.status(400).json({ message: "Name cannot be empty" });
      }
      if (trimmed.length > 50) {
        return res.status(400).json({ message: "Name must be 50 characters or fewer" });
      }
      req.user.name = trimmed;
    }

    if (about !== undefined) {
      const trimmed = String(about).trim();
      if (trimmed.length > 139) {
        return res.status(400).json({ message: "About must be 139 characters or fewer" });
      }
      req.user.about = trimmed;
    }

    await req.user.save();

    return res.status(200).json({ user: req.user });
  } catch (err) {
    console.error("updateProfile failed:", err.message);
    return res.status(500).json({ message: "Could not update profile" });
  }
};

/**
 * GET /api/users/search?phone=+923001234567
 *
 * Exact-match only. WhatsApp finds people by number, never by browsing names —
 * a partial-name search would turn the whole user base into a directory.
 */
export const searchUser = async (req, res) => {
  try {
    const phone = normalizePhone(req.query.phone || "");

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    if (phone === req.user.phone) {
      return res.status(400).json({ message: "That's your own number" });
    }

    const user = await User.findOne({ phone, isVerified: true }).select(PUBLIC_FIELDS);

    if (!user) {
      return res.status(404).json({ message: "No user found with that number" });
    }

    return res.status(200).json({ user });
  } catch (err) {
    console.error("searchUser failed:", err.message);
    return res.status(500).json({ message: "Search failed" });
  }
};

/**
 * GET /api/users/:id
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await User.findById(id).select(PUBLIC_FIELDS);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (err) {
    console.error("getUserById failed:", err.message);
    return res.status(500).json({ message: "Could not fetch user" });
  }
};

/**
 * POST /api/users/:id/block
 */
export const blockUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (id === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot block yourself" });
    }

    const target = await User.findById(id).select("_id");
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    // $addToSet keeps the list unique without a manual includes() check
    await User.updateOne({ _id: req.user._id }, { $addToSet: { blockedUsers: id } });

    return res.status(200).json({ message: "User blocked" });
  } catch (err) {
    console.error("blockUser failed:", err.message);
    return res.status(500).json({ message: "Could not block user" });
  }
};

/**
 * POST /api/users/:id/unblock
 */
export const unblockUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    await User.updateOne({ _id: req.user._id }, { $pull: { blockedUsers: id } });

    return res.status(200).json({ message: "User unblocked" });
  } catch (err) {
    console.error("unblockUser failed:", err.message);
    return res.status(500).json({ message: "Could not unblock user" });
  }
};

/**
 * GET /api/users/blocked
 */
export const getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("blockedUsers", PUBLIC_FIELDS);

    return res.status(200).json({ blockedUsers: user.blockedUsers });
  } catch (err) {
    console.error("getBlockedUsers failed:", err.message);
    return res.status(500).json({ message: "Could not fetch blocked users" });
  }
};