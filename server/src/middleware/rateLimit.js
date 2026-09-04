import rateLimit from "express-rate-limit";

/**
 * Rate limits are per IP. They protect against scripted abuse, not against
 * a determined attacker with many addresses — that's what the OTP attempt
 * counter and resend cooldown in the User model are for.
 */

const message = (text) => ({ message: text });

/** Broad ceiling on the whole API. Generous enough to never hit normally. */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: message("Too many requests. Please slow down."),
});

/**
 * OTP requests are the expensive endpoint: each one can send a real SMS.
 * The model already enforces a 60-second cooldown per phone number; this
 * stops someone cycling through many numbers from one machine.
 */
export const otpRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: message("Too many verification codes requested. Try again later."),
});

/**
 * Verification attempts. The per-user counter locks an account after 5
 * wrong codes; this stops someone spreading guesses across many accounts.
 */
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: message("Too many verification attempts. Try again later."),
});

/** Uploads are disk-expensive, so they get their own tighter budget. */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: message("Too many uploads. Please wait a moment."),
});
