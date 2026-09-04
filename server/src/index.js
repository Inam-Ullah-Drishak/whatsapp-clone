import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import statusRoutes from "./routes/statusRoutes.js";
import { initSocket } from "./socket/index.js";
import { generalLimiter } from "./middleware/rateLimit.js";

await connectDB();

const app = express();
const server = http.createServer(app);

initSocket(server);

// Behind a proxy (Render, Railway, nginx) the client IP arrives in a
// header. Without this, every request looks like it comes from the proxy
// and the rate limiter would throttle all users as one.
app.set("trust proxy", 1);

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

// Serve uploaded files. In production these would live in S3 or similar
// rather than being served off the app server.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api", generalLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/status", statusRoutes);

// Unknown route
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Catch-all error handler. Express 5 forwards rejected promises here
// automatically, so async route handlers no longer need try/catch to
// avoid crashing the process.
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));