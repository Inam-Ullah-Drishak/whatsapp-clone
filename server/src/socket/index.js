import { Server } from "socket.io";
import { protectSocket } from "../middleware/authMiddleware.js";
import { setIO, chatRoom, userRoom } from "./io.js";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

/**
 * userId -> Set of socket ids.
 * A user on phone + laptop has two sockets; they only count as offline
 * when the last one disconnects.
 */
const onlineUsers = new Map();

const addSocket = (userId, socketId) => {
  const set = onlineUsers.get(userId) || new Set();
  set.add(socketId);
  onlineUsers.set(userId, set);
  return set.size === 1; // true = they just came online
};

const removeSocket = (userId, socketId) => {
  const set = onlineUsers.get(userId);
  if (!set) return true;
  set.delete(socketId);
  if (set.size === 0) {
    onlineUsers.delete(userId);
    return true; // true = last device disconnected
  }
  onlineUsers.set(userId, set);
  return false;
};

export const isUserOnline = (userId) => onlineUsers.has(userId.toString());

export const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
  });

  setIO(io);

  // Rejects the handshake unless the token is valid; attaches socket.user
  io.use(protectSocket);

  io.on("connection", async (socket) => {
    const userId = socket.user._id.toString();

    // Personal room — lets us reach a user on all their devices at once
    socket.join(userRoom(userId));

    // Join every chat room up front so incoming messages need no
    // subscription step from the client.
    const chats = await Chat.find({ participants: userId }).select("_id");
    chats.forEach((c) => socket.join(chatRoom(c._id.toString())));

    const justCameOnline = addSocket(userId, socket.id);

    if (justCameOnline) {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      // Tell everyone who shares a chat with them
      chats.forEach((c) => {
        socket.to(chatRoom(c._id.toString())).emit("presence:update", {
          userId,
          isOnline: true,
        });
      });
    }

    console.log(`Socket connected: ${socket.user.name || userId}`);

    /* ---------------- Rooms ---------------- */

    // Needed when a chat is created after the socket connected
    socket.on("chat:join", async (chatId, ack) => {
      try {
        const chat = await Chat.findById(chatId).select("participants");
        const isMember = chat?.participants.some((p) => p.toString() === userId);
        if (!isMember) return ack?.({ ok: false, error: "Not a member" });

        socket.join(chatRoom(chatId));
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, error: "Could not join chat" });
      }
    });

    socket.on("chat:leave", (chatId) => {
      socket.leave(chatRoom(chatId));
    });

    /* ---------------- Typing ---------------- */

    // socket.to(...) excludes the sender, so you never see your own indicator
    socket.on("typing:start", ({ chatId }) => {
      socket.to(chatRoom(chatId)).emit("typing:start", {
        chatId,
        userId,
        name: socket.user.name,
      });
    });

    socket.on("typing:stop", ({ chatId }) => {
      socket.to(chatRoom(chatId)).emit("typing:stop", { chatId, userId });
    });

    /* ---------------- Receipts ---------------- */

    // Fired by the recipient's client when a message reaches their device
    socket.on("message:delivered", async ({ messageId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;
        if (message.sender.toString() === userId) return;

        if (message.markDelivered(userId)) {
          await message.save();
          // Tell the sender their ticks changed
          io.to(userRoom(message.sender.toString())).emit("message:status", {
            messageId,
            chatId: message.chat.toString(),
            status: message.status,
          });
        }
      } catch (err) {
        console.error("message:delivered failed:", err.message);
      }
    });

    socket.on("message:read", async ({ messageId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;
        if (message.sender.toString() === userId) return;

        if (message.markRead(userId)) {
          await message.save();
          io.to(userRoom(message.sender.toString())).emit("message:status", {
            messageId,
            chatId: message.chat.toString(),
            status: "read",
          });
        }
      } catch (err) {
        console.error("message:read failed:", err.message);
      }
    });

    /* ---------------- Disconnect ---------------- */

    socket.on("disconnect", async () => {
      const wentOffline = removeSocket(userId, socket.id);
      if (!wentOffline) return;

      const lastSeen = new Date();
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });

      chats.forEach((c) => {
        socket.to(chatRoom(c._id.toString())).emit("presence:update", {
          userId,
          isOnline: false,
          lastSeen,
        });
      });

      console.log(`Socket disconnected: ${socket.user.name || userId}`);
    });
  });

  return io;
};
