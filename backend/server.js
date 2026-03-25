// ─────────────────────────────────────────────
//  server/server.js  –  Entry point
// ─────────────────────────────────────────────

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const multer = require("multer");
const cors = require("cors");

const registerSocketHandlers = require("./socket/index");

const app = express();
const server = http.createServer(app);

// Socket.io CORS + transports
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

const PORT = process.env.PORT || 3000;

//Express CORS
app.use(cors());
app.use(express.json());

// ── File upload configuration ──────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed!"), false);
    }
  }
});

// ── Serve frontend (only useful locally / same server) ──
app.use(express.static(path.join(__dirname, "../frontend")));

// ── Serve uploaded files ────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ── File upload endpoint ────────────────────────────────
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // ✅ FIXED: Full backend URL for Netlify frontend
  res.json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    url: `https://anonchat-u8j3.onrender.com/uploads/${req.file.filename}`
  });
});

// ── Health check route (optional but useful) ────────────
app.get("/", (req, res) => {
  res.send("AnonChat backend is running 🚀");
});

// ── Register all Socket.io handlers ────────────────────
registerSocketHandlers(io);

// ── Start server ───────────────────────────────────────
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});