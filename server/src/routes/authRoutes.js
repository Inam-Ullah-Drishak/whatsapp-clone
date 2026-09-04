import express from "express";
import { requestOtp, verifyOtp, getMe } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { otpRequestLimiter, otpVerifyLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

// Public
router.post("/request-otp", otpRequestLimiter, requestOtp);
router.post("/verify-otp", otpVerifyLimiter, verifyOtp);

// Protected
router.get("/me", protect, getMe);

export default router;
