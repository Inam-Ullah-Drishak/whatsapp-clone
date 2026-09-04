import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { generateOtp } from "../utils/generateOtp.js";
import { sendOtp } from "../utils/sendOtp.js";

// Minimum gap between OTP requests for the same number
const RESEND_COOLDOWN_SECONDS = 60;

const E164 = /^\+[1-9]\d{7,14}$/;

const normalizePhone = (raw = "") => raw.replace(/[\s()-]/g, "").trim();

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });

/**
 * POST /api/auth/request-otp
 * Body: { phone }
 *
 * Creates the user on first contact — in WhatsApp there is no separate
 * "signup", the first login IS the signup.
 */
export const requestOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);

    if (!E164.test(phone)) {
      return res.status(400).json({
        message: "Phone must be in international format, e.g. +923001234567",
      });
    }

    let user = await User.findOne({ phone }).select("+otpLastSentAt");

    if (user?.otpLastSentAt) {
      const elapsed = (Date.now() - user.otpLastSentAt.getTime()) / 1000;
      if (elapsed < RESEND_COOLDOWN_SECONDS) {
        return res.status(429).json({
          message: "Please wait before requesting another code",
          retryAfter: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed),
        });
      }
    }

    if (!user) {
      user = new User({ phone });
    }

    const code = generateOtp();
    await user.setOtp(code);
    await user.save();

    await sendOtp(phone, code);

    // In console (dev) mode the code is not secret — it is already printed
    // to the terminal. Returning it lets Postman and automated tests run
    // end to end. It is never included once OTP_MODE=sms.
    const isDev = (process.env.OTP_MODE || "console") === "console";

    return res.status(200).json({
      message: "Verification code sent",
      expiresInMinutes: 5,
      ...(isDev ? { devCode: code } : {}),
    });
  } catch (err) {
    console.error("requestOtp failed:", err.message);
    return res.status(500).json({ message: "Could not send verification code" });
  }
};

/**
 * POST /api/auth/verify-otp
 * Body: { phone, code }
 * Returns a JWT on success.
 */
export const verifyOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const { code } = req.body;

    if (!E164.test(phone) || !code) {
      return res.status(400).json({ message: "Phone and code are required" });
    }

    const user = await User.findOne({ phone }).select(
      "+otpHash +otpExpiresAt +otpAttempts"
    );

    // Same generic response as a wrong code — do not reveal which
    // numbers are registered.
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    const result = await user.verifyOtp(code);

    if (!result.ok) {
      const responses = {
        no_otp: [400, "Invalid or expired code"],
        expired: [400, "Code has expired, request a new one"],
        too_many_attempts: [429, "Too many incorrect attempts, request a new code"],
        invalid: [400, "Invalid or expired code"],
      };
      const [status, message] = responses[result.reason] || [400, "Invalid or expired code"];
      return res.status(status).json({ message });
    }

    const token = signToken(user._id);

    return res.status(200).json({
      token,
      // Tells the client whether to route to profile setup or straight to chats
      isNewUser: !user.name,
      user,
    });
  } catch (err) {
    console.error("verifyOtp failed:", err.message);
    return res.status(500).json({ message: "Could not verify code" });
  }
};

/**
 * GET /api/auth/me
 * Requires the protect middleware, which attaches req.user.
 */
export const getMe = async (req, res) => {
  return res.status(200).json({ user: req.user });
};
