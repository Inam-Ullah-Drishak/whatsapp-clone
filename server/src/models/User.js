import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const OTP_TTL_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;

const userSchema = new mongoose.Schema(
  {
    // Always stored in E.164 format, e.g. +923001234567
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
      match: [/^\+[1-9]\d{7,14}$/, "Phone must be in E.164 format (e.g. +923001234567)"],
    },

    name: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "",
    },

    about: {
      type: String,
      trim: true,
      maxlength: 139,
      default: "Hey there! I am using WhatsApp",
    },

    // Relative path or URL to the uploaded avatar
    avatar: {
      type: String,
      default: "",
    },

    // Becomes true after the first successful OTP verification
    isVerified: {
      type: Boolean,
      default: false,
    },

    isOnline: {
      type: Boolean,
      default: false,
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },

    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    privacy: {
      lastSeen: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
      profilePhoto: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
      about: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
    },

    // --- OTP fields: never sent to the client ---
    otpHash: {
      type: String,
      select: false,
    },
    otpExpiresAt: {
      type: Date,
      select: false,
    },
    otpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    otpLastSentAt: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

/**
 * Hash and attach a freshly generated OTP to this user.
 * Does not save — the caller decides when to persist.
 */
userSchema.methods.setOtp = async function (code) {
  this.otpHash = await bcrypt.hash(code, 10);
  this.otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  this.otpAttempts = 0;
  this.otpLastSentAt = new Date();
};

/**
 * Check a submitted code against the stored hash.
 * Returns { ok, reason }. Increments the attempt counter on failure.
 * NOTE: the document must be loaded with .select("+otpHash +otpExpiresAt +otpAttempts")
 */
userSchema.methods.verifyOtp = async function (code) {
  if (!this.otpHash || !this.otpExpiresAt) {
    return { ok: false, reason: "no_otp" };
  }
  if (this.otpExpiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (this.otpAttempts >= MAX_OTP_ATTEMPTS) {
    return { ok: false, reason: "too_many_attempts" };
  }

  const match = await bcrypt.compare(code, this.otpHash);
  if (!match) {
    this.otpAttempts += 1;
    await this.save();
    return { ok: false, reason: "invalid" };
  }

  // Single-use: burn the OTP immediately on success.
  this.otpHash = undefined;
  this.otpExpiresAt = undefined;
  this.otpAttempts = 0;
  this.isVerified = true;
  await this.save();

  return { ok: true };
};

// Strip internals from every JSON response
userSchema.set("toJSON", {
  transform(doc, ret) {
    delete ret.otpHash;
    delete ret.otpExpiresAt;
    delete ret.otpAttempts;
    delete ret.otpLastSentAt;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model("User", userSchema);

export default User;