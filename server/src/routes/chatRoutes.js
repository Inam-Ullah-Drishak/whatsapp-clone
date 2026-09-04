import express from "express";
import {
  accessChat,
  getChats,
  getChatById,
  createGroup,
  markChatRead,
  updateGroup,
  addParticipants,
  removeParticipant,
  promoteAdmin,
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

// Group management
router.patch("/:id/group", updateGroup);
router.post("/:id/participants", addParticipants);
router.delete("/:id/participants/:userId", removeParticipant);
router.post("/:id/admins/:userId", promoteAdmin);

export default router;