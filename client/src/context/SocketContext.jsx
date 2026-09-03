import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API_URL, getToken } from "../lib/api.js";
import { useAuth } from "./AuthContext.jsx";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);

  // Held in a ref, not state: replacing the socket object on every render
  // would tear down and rebuild the connection constantly.
  const socketRef = useRef(null);

  useEffect(() => {
    // No connection until there's a token to authenticate with
    if (!isAuthenticated) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io(API_URL, {
      auth: { token: getToken() },
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err) => {
      console.error("Socket connection failed:", err.message);
      setConnected(false);
    });

    // StrictMode mounts effects twice in development, so without this
    // cleanup you would end up with two live sockets per user.
    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [isAuthenticated]);

  /** Subscribe to a server event; returns an unsubscribe function. */
  const on = (event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  };

  const emit = (event, ...args) => {
    socketRef.current?.emit(event, ...args);
  };

  return (
    <SocketContext.Provider value={{ socket: socketRef, connected, on, emit }}>
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
 * The handler is kept in a ref so passing an inline arrow function does not
 * resubscribe on every render.
 */
export const useSocketEvent = (event, handler) => {
  const { socket } = useSocket();
  const saved = useRef(handler);

  useEffect(() => {
    saved.current = handler;
  });

  useEffect(() => {
    const s = socket.current;
    if (!s) return;

    const wrapped = (...args) => saved.current?.(...args);
    s.on(event, wrapped);
    return () => s.off(event, wrapped);
  }, [socket, event]);
};
