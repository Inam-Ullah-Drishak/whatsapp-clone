import express from "express";
import {
  updateProfile,
  searchUser,
  getUserById,
  blockUser,
  unblockUser,
  getBlockedUsers,
} from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Every user route requires a valid token
router.use(protect);

// Literal paths must be declared before "/:id", otherwise Express matches
// "search" and "blocked" as an :id value and getUserById rejects them.
router.get("/search", searchUser);
router.get("/blocked", getBlockedUsers);

router.patch("/me", updateProfile);

router.get("/:id", getUserById);
router.post("/:id/block", blockUser);
router.post("/:id/unblock", unblockUser);

export default router;