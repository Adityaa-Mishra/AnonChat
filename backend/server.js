// ─────────────────────────────────────────────
//  server/server.js  –  Entry point
// ─────────────────────────────────────────────

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const multer = require("multer");
const registerSocketHandlers = require("./socket/index");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // allow all origins for local dev
});

const PORT = process.env.PORT || 3000;

// ── File upload configuration ──────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  }
});

// ── Serve static frontend files ──────────────
// Points to the /frontend folder at the project root
app.use(express.static(path.join(__dirname, "../frontend")));

// ── Serve uploaded files ─────────────────────
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ── File upload endpoint ─────────────────────
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // Return file info to client
  res.json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    url: `/uploads/${req.file.filename}`
  });
});

// ── Catch-all: serve index.html ──────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ── Register all Socket.io handlers ──────────
registerSocketHandlers(io);

// ── Start server ──────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀  AnonChat server running at http://localhost:${PORT}\n`);
});
