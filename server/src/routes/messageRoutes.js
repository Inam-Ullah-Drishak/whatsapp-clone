import express from "express";
import {
  sendMessage,
  getMessages,
  markMessagesRead,
  deleteMessage,
} from "../controllers/messageController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/", sendMessage);
router.delete("/:id", deleteMessage);

router.get("/:chatId", getMessages);
router.patch("/:chatId/read", markMessagesRead);

export default router;