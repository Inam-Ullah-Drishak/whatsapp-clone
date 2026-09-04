import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// server/src/middleware -> server/uploads
export const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads");

const AVATAR_DIR = path.join(UPLOAD_ROOT, "avatars");
const MEDIA_DIR = path.join(UPLOAD_ROOT, "media");

// Multer will not create these itself — a missing folder is a runtime error
[AVATAR_DIR, MEDIA_DIR].forEach((dir) => {
  fs.mkdirSync(dir, { recursive: true });
});

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const MEDIA_TYPES = [
  ...IMAGE_TYPES,
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

/**
 * Random filename, original extension only.
 *
 * Never reuse the client's filename: "../../.env" or a duplicate name would
 * let an upload escape the folder or overwrite someone else's file.
 */
const makeStorage = (destination) =>
  multer.diskStorage({
    destination: (req, file, cb) => cb(null, destination),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
    },
  });

const EXT_FALLBACK = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
};

/**
 * Some clients send "application/octet-stream" when they can't identify a
 * file. Fall back to the extension so a valid .jpg isn't rejected — but
 * only for that generic type, so a client claiming "text/html" is still
 * held to what it said.
 */
const resolveMime = (file) => {
  if (file.mimetype && file.mimetype !== "application/octet-stream") {
    return file.mimetype;
  }
  const ext = path.extname(file.originalname).toLowerCase();
  return EXT_FALLBACK[ext] || file.mimetype;
};

const filterBy = (allowed) => (req, file, cb) => {
  const resolved = resolveMime(file);
  if (allowed.includes(resolved)) {
    // Carry the corrected type through so the controller stores the real
    // mimeType on the message rather than "octet-stream"
    file.mimetype = resolved;
    return cb(null, true);
  }
  cb(new Error(`Unsupported file type: ${file.mimetype}`));
};

export const uploadAvatar = multer({
  storage: makeStorage(AVATAR_DIR),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: filterBy(IMAGE_TYPES),
}).single("file");

export const uploadMedia = multer({
  storage: makeStorage(MEDIA_DIR),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: filterBy(MEDIA_TYPES),
}).single("file");

/**
 * Multer throws outside the normal middleware chain, so wrap it to turn
 * size/type failures into clean 400s instead of a 500.
 */
export const handleUpload = (uploader) => (req, res, next) => {
  uploader(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File is too large" });
      }
      return res.status(400).json({ message: err.message });
    }
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};
