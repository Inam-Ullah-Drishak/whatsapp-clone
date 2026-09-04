import express from "express";
import {
  sendMessage,
  getMessages,
  markMessagesRead,
  deleteMessage,
  editMessage,
  toggleStar,
  getStarredMessages,
  searchMessages,
  reactToMessage,
  getMessageInfo,
} from "../controllers/messageController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/", sendMessage);

// Literal path first, or "starred" is read as a :chatId
router.get("/starred/all", getStarredMessages);
router.get("/search/all", searchMessages);
router.post("/:id/star", toggleStar);
router.post("/:id/react", reactToMessage);
router.get("/:id/info", getMessageInfo);
router.delete("/:id", deleteMessage);
router.patch("/:id", editMessage);

router.get("/:chatId", getMessages);
router.patch("/:chatId/read", markMessagesRead);

export default router;