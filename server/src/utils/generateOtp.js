import crypto from "crypto";

const OTP_LENGTH = 6;

/**
 * Generate a cryptographically secure numeric OTP.
 * Returns a zero-padded string, e.g. "042917".
 *
 * Math.random() is NOT used here on purpose: it is seeded predictably
 * and is not safe for anything that gates account access.
 */
export const generateOtp = (length = OTP_LENGTH) => {
  const max = 10 ** length;
  return String(crypto.randomInt(0, max)).padStart(length, "0");
};