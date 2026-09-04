import mongoose from "mongoose";

const MESSAGE_TYPES = ["text", "image", "video", "audio", "document"];

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: MESSAGE_TYPES,
      default: "text",
    },

    // The text body, or the caption on a media message
    content: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    // Populated for every non-text type
    mediaUrl: { type: String, default: "" },
    fileName: { type: String, default: "" },
    fileSize: { type: Number },
    mimeType: { type: String, default: "" },

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    // Single overall status, used for the sender's tick marks.
    // sent = stored, delivered = reached a device, read = opened.
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },

    // Per-recipient receipts. Needed for groups, where "read" means
    // different things to different members.
    deliveredTo: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    readBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],

    // "Delete for me" — hidden for these users, still visible to everyone else
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // "Delete for everyone" — content is cleared, the tombstone remains so
    // the client can render "This message was deleted"
    isDeletedForEveryone: {
      type: Boolean,
      default: false,
    },

    editedAt: {
      type: Date,
      default: null,
    },

    // Shows the "Forwarded" label, same as WhatsApp
    isForwarded: {
      type: Boolean,
      default: false,
    },

    // One reaction per person; reacting again replaces it
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        emoji: { type: String },
        _id: false,
      },
    ],

    // Starring is per-user, so it's an array rather than a boolean
    starredBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

// Loading a chat's history, newest first, with pagination
messageSchema.index({ chat: 1, createdAt: -1 });

/**
 * A text message needs words; a media message needs a file.
 */
messageSchema.pre("validate", function () {
  if (this.isDeletedForEveryone) return;

  if (this.type === "text") {
    if (!this.content?.trim()) {
      throw new Error("Text messages cannot be empty");
    }
  } else if (!this.mediaUrl) {
    throw new Error(`A ${this.type} message requires a mediaUrl`);
  }
});

/** Record a delivery receipt, ignoring duplicates. */
messageSchema.methods.markDelivered = function (userId) {
  const already = this.deliveredTo.some((r) => r.user.toString() === userId.toString());
  if (already) return false;

  this.deliveredTo.push({ user: userId });
  if (this.status === "sent") this.status = "delivered";
  return true;
};

/** Record a read receipt, ignoring duplicates. */
messageSchema.methods.markRead = function (userId) {
  const already = this.readBy.some((r) => r.user.toString() === userId.toString());
  if (already) return false;

  this.readBy.push({ user: userId });
  this.markDelivered(userId);
  this.status = "read";
  return true;
};

/** Clear content in place for "delete for everyone". */
messageSchema.methods.deleteForEveryone = function () {
  this.isDeletedForEveryone = true;
  this.content = "";
  this.mediaUrl = "";
  this.fileName = "";
  this.fileSize = undefined;
  this.mimeType = "";
  this.replyTo = null;
};

const Message = mongoose.model("Message", messageSchema);

export default Message;
export { MESSAGE_TYPES };