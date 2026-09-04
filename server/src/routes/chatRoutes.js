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
  togglePin,
  toggleArchive,
  toggleMute,
  toggleFavourite,
  setDisappearing,
  deleteChat,
  clearChat,
  deleteGroup,
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
router.patch("/:id/pin", togglePin);
router.patch("/:id/archive", toggleArchive);
router.patch("/:id/mute", toggleMute);
router.patch("/:id/favourite", toggleFavourite);
router.patch("/:id/disappearing", setDisappearing);
router.delete("/:id", deleteChat);
router.delete("/:id/messages", clearChat);

// Group management
router.patch("/:id/group", updateGroup);
router.delete("/:id/group", deleteGroup);
router.post("/:id/participants", addParticipants);
router.delete("/:id/participants/:userId", removeParticipant);
router.post("/:id/admins/:userId", promoteAdmin);

export default router;
