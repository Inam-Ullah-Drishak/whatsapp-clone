import mongoose from "mongoose";

const STATUS_TTL_HOURS = 24;

const statusSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["text", "image", "video"],
      default: "text",
    },

    // Caption for media, or the whole post for a text status
    content: {
      type: String,
      trim: true,
      maxlength: 700,
      default: "",
    },

    mediaUrl: { type: String, default: "" },

    // Text statuses render as coloured cards, same as WhatsApp
    background: { type: String, default: "#075E54" },

    viewers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

/**
 * Mongo deletes documents automatically once expiresAt passes.
 * expireAfterSeconds: 0 means "expire at the time in this field" rather
 * than a fixed delay, so no cleanup job is needed.
 */
statusSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Feed query: recent statuses from a set of users
statusSchema.index({ user: 1, createdAt: -1 });

statusSchema.pre("validate", function () {
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + STATUS_TTL_HOURS * 60 * 60 * 1000);
  }

  if (this.type === "text") {
    if (!this.content?.trim()) throw new Error("A text status needs some text");
  } else if (!this.mediaUrl) {
    throw new Error(`A ${this.type} status requires a mediaUrl`);
  }
});

const Status = mongoose.model("Status", statusSchema);

export default Status;
export { STATUS_TTL_HOURS };
