import express from "express";
import { requestOtp, verifyOtp, getMe } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public
router.post("/request-otp", requestOtp);
router.post("/verify-otp", verifyOtp);

// Protected
router.get("/me", protect, getMe);

export default router;