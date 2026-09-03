import jwt from "jsonwebtoken";
import User from "../models/User.js";

/**
 * Verifies the Bearer token and attaches the full user document to req.user.
 *
 * The user is re-fetched on every request rather than trusted from the token
 * payload, so a deleted or updated account takes effect immediately instead of
 * lingering until the token expires.
 */
export const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const token = header.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // Distinguished so the client knows whether to re-login silently
      // or show an error.
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Session expired", code: "TOKEN_EXPIRED" });
      }
      return res.status(401).json({ message: "Not authorized, invalid token" });
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: "Phone number not verified" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("protect middleware failed:", err.message);
    return res.status(500).json({ message: "Authorization check failed" });
  }
};

/**
 * Same verification logic, for the Socket.IO handshake.
 * Client connects with: io(URL, { auth: { token } })
 */
export const protectSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Not authorized, no token"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isVerified) {
      return next(new Error("Not authorized"));
    }

    socket.user = user;
    next();
  } catch (err) {
    next(new Error("Not authorized, invalid token"));
  }
};