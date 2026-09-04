import express from "express";
import {
  createStatus,
  getStatusFeed,
  viewStatus,
  getStatusViewers,
  deleteStatus,
} from "../controllers/statusController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/", createStatus);
router.get("/", getStatusFeed);

router.post("/:id/view", viewStatus);
router.get("/:id/viewers", getStatusViewers);
router.delete("/:id", deleteStatus);

export default router;
