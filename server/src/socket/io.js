/**
 * Holds the Socket.IO instance so controllers can emit without importing
 * index.js (which would create a circular import).
 */

let io = null;

export const setIO = (instance) => {
  io = instance;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.IO has not been initialised yet");
  return io;
};

/** Room helpers — keep room naming in one place. */
export const chatRoom = (chatId) => `chat:${chatId}`;
export const userRoom = (userId) => `user:${userId}`;
