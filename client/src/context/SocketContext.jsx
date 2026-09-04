import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { API_URL, getToken } from "../lib/api.js";
import { useAuth } from "./AuthContext.jsx";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();

  /**
   * The socket is kept in STATE, not just a ref.
   *
   * Child effects run before parent effects in React, so a consumer's
   * useSocketEvent would run while the socket was still null and never
   * subscribe. Storing it in state re-renders consumers the moment the
   * connection exists, so their effects run again and attach properly.
   */
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      return;
    }

    const s = io(API_URL, {
      auth: { token: getToken() },
      transports: ["websocket", "polling"],
    });

    socketRef.current = s;
    setSocket(s);

    // Dev aid: lets you inspect the connection from the browser console,
    // e.g. window.__socket.connected
    if (import.meta.env.DEV) window.__socket = s;

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", (err) => {
      console.error("Socket connection failed:", err.message);
      setConnected(false);
    });

    // StrictMode mounts effects twice in development; without this you
    // would end up with two live sockets per user.
    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [isAuthenticated]);

  const emit = useCallback((event, ...args) => {
    socketRef.current?.emit(event, ...args);
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected, emit }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used inside SocketProvider");
  return ctx;
};

/**
 * Subscribe to a socket event for the lifetime of a component.
 *
 * The handler lives in a ref so inline arrow functions don't cause a
 * resubscribe on every render, while `socket` in the deps means the
 * subscription attaches as soon as the connection is created.
 */
export const useSocketEvent = (event, handler) => {
  const { socket } = useSocket();
  const saved = useRef(handler);

  useEffect(() => {
    saved.current = handler;
  });

  useEffect(() => {
    if (!socket) return;

    const wrapped = (...args) => saved.current?.(...args);
    socket.on(event, wrapped);
    return () => socket.off(event, wrapped);
  }, [socket, event]);
};