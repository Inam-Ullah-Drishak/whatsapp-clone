import express from "express";
import {
  accessChat,
  getChats,
  getChatById,
  createGroup,
  markChatRead,
} from "../controllers/chatController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

// "/group" must come before "/:id" or Express treats "group" as a chat id
router.post("/group", createGroup);

router.post("/", accessChat);
router.get("/", getChats);

router.get("/:id", getChatById);
router.patch("/:id/read", markChatRead);

export default router;