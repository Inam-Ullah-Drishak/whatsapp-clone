import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    isGroup: {
      type: Boolean,
      default: false,
    },

    // Group-only fields, ignored for one-to-one chats
    groupName: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    groupAvatar: {
      type: String,
      default: "",
    },
    groupAdmins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // 0 means off. Any other value is a lifetime in hours applied to new
    // messages in this chat.
    disappearingAfter: {
      type: Number,
      default: 0,
      enum: [0, 24, 168, 2160], // off, 24 hours, 7 days, 90 days
    },

    // Denormalized pointer so the chat list can render without loading
    // messages. Sorting by updatedAt gives you the sidebar order for free.
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },

    // Per-user flags: pinning and archiving are personal, so they're
    // arrays of user ids rather than booleans on the chat.
    pinnedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    archivedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    mutedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    favouritedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // "Delete chat" hides it for one person only. A new message clears
    // the flag so the conversation reappears, with history still hidden.
    deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // userId -> number of unread messages, so each participant has their
    // own badge count on the same chat document.
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

// Fetching a user's chat list, newest activity first
chatSchema.index({ participants: 1, updatedAt: -1 });

/**
 * A group needs a name; a one-to-one chat needs exactly two people.
 */
chatSchema.pre("validate", function () {
  if (this.isGroup) {
    if (!this.groupName?.trim()) {
      throw new Error("Group chats require a name");
    }
    if (this.participants.length < 2) {
      throw new Error("Group chats require at least 2 participants");
    }
  } else if (this.participants.length !== 2) {
    throw new Error("One-to-one chats must have exactly 2 participants");
  }
});

/**
 * Find the existing one-to-one chat between two users, or create it.
 *
 * $all with $size is the correct query here: $all alone would also match a
 * group that happens to contain both users.
 */
chatSchema.statics.findOrCreateDirect = async function (userA, userB) {
  const existing = await this.findOne({
    isGroup: false,
    participants: { $all: [userA, userB], $size: 2 },
  });

  if (existing) return existing;

  return this.create({
    isGroup: false,
    participants: [userA, userB],
  });
};

/** Increment everyone's unread count except the sender. */
chatSchema.methods.bumpUnread = function (senderId) {
  this.participants.forEach((p) => {
    const id = p._id ? p._id.toString() : p.toString();
    if (id === senderId.toString()) return;
    this.unreadCounts.set(id, (this.unreadCounts.get(id) || 0) + 1);
  });
};

/** Clear a single user's unread count, e.g. when they open the chat. */
chatSchema.methods.clearUnread = function (userId) {
  this.unreadCounts.set(userId.toString(), 0);
};

const Chat = mongoose.model("Chat", chatSchema);

export default Chat;