import path from "path";
import fs from "fs";
import { UPLOAD_ROOT } from "../middleware/upload.js";

/** Map a mimetype onto the Message model's type enum. */
const messageTypeFor = (mimetype) => {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  return "document";
};

/**
 * POST /api/uploads/avatar   (multipart, field name: "file")
 * Sets the avatar on the logged-in user and returns the updated user.
 */
export const uploadAvatarFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const previous = req.user.avatar;

    req.user.avatar = `/uploads/avatars/${req.file.filename}`;
    await req.user.save();

    // Bin the old one so avatars don't accumulate forever
    if (previous?.startsWith("/uploads/avatars/")) {
      const oldPath = path.join(UPLOAD_ROOT, "avatars", path.basename(previous));
      fs.unlink(oldPath, () => {});
    }

    return res.status(200).json({ user: req.user });
  } catch (err) {
    console.error("uploadAvatarFile failed:", err.message);
    return res.status(500).json({ message: "Could not upload avatar" });
  }
};

/**
 * POST /api/uploads/media   (multipart, field name: "file")
 *
 * Upload and message-send are deliberately separate: the client uploads
 * first, then POSTs to /api/messages with the returned fields. That lets
 * the upload show a progress bar and be retried without duplicating a
 * message on failure.
 */
export const uploadMediaFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    return res.status(201).json({
      type: messageTypeFor(req.file.mimetype),
      mediaUrl: `/uploads/media/${req.file.filename}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });
  } catch (err) {
    console.error("uploadMediaFile failed:", err.message);
    return res.status(500).json({ message: "Could not upload file" });
  }
};