import express from "express";
import { uploadAvatarFile, uploadMediaFile } from "../controllers/uploadController.js";
import { protect } from "../middleware/authMiddleware.js";
import { uploadAvatar, uploadMedia, handleUpload } from "../middleware/upload.js";
import { uploadLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router.use(protect);
router.use(uploadLimiter);

router.post("/avatar", handleUpload(uploadAvatar), uploadAvatarFile);
router.post("/media", handleUpload(uploadMedia), uploadMediaFile);

export default router;