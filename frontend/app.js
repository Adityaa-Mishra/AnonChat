/* ═══════════════════════════════════════════════════════
   AnonChat — client/public/js/app.js
   Vanilla JS. No frameworks. No dependencies beyond socket.io.
═══════════════════════════════════════════════════════ */

// ── DOM refs ─────────────────────────────────────────
const screenLanding = document.getElementById("screen-landing");
const screenChat    = document.getElementById("screen-chat");

const usernameInput = document.getElementById("username-input");
const startBtn      = document.getElementById("start-btn");

const statusIndicator = document.getElementById("status-indicator");
const statusText      = document.getElementById("status-text");
const typingIndicator = document.getElementById("typing-indicator");

const messagesInner = document.getElementById("messages-inner");
const msgInput      = document.getElementById("msg-input");
const sendBtn       = document.getElementById("send-btn");
const nextBtn       = document.getElementById("next-btn");

const fileInput     = document.getElementById("file-input");
const fileBtn       = document.getElementById("file-btn");

const onlineCountEl     = document.getElementById("online-count");
const onlineCountChatEl = document.getElementById("online-count-chat");

// ── State ─────────────────────────────────────────────
let myUsername    = "";
let strangerName  = "";
let isConnected   = false;   // paired with someone
let typingTimeout = null;

// ── Socket connection ─────────────────────────────────
const socket = io();
// ── Helpers ───────────────────────────────────────────

/** Switch visible screen */
function showScreen(name) {
  screenLanding.classList.toggle("active", name === "landing");
  screenChat.classList.toggle("active",   name === "chat");
}

/** Append a bubble message to the chat */
function appendMessage({ username, text, own }) {
  const wrapper = document.createElement("div");
  wrapper.className = `bubble-wrapper ${own ? "own" : "them"}`;

  const usernameEl = document.createElement("div");
  usernameEl.className = "bubble-username";
  usernameEl.textContent = own ? `you (${username})` : username;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  wrapper.appendChild(usernameEl);
  wrapper.appendChild(bubble);
  messagesInner.appendChild(wrapper);
  scrollToBottom();
}

/** Append a file message to the chat */
function appendFileMessage({ username, filename, originalName, mimetype, size, url, own }) {
  const wrapper = document.createElement("div");
  wrapper.className = `bubble-wrapper ${own ? "own" : "them"}`;

  const usernameEl = document.createElement("div");
  usernameEl.className = "bubble-username";
  usernameEl.textContent = own ? `you (${username})` : username;

  const bubble = document.createElement("div");
  bubble.className = "bubble file-message";

  // Create file preview
  let mediaElement;
  if (mimetype.startsWith('image/')) {
    mediaElement = document.createElement("img");
    mediaElement.src = url;
    mediaElement.alt = originalName;
    mediaElement.onclick = () => window.open(url, '_blank');
  } else if (mimetype.startsWith('video/')) {
    mediaElement = document.createElement("video");
    mediaElement.src = url;
    mediaElement.controls = true;
    mediaElement.preload = "metadata";
  }

  if (mediaElement) {
    bubble.appendChild(mediaElement);
  }

  // File info
  const fileInfo = document.createElement("div");
  fileInfo.className = "file-info";

  const fileName = document.createElement("span");
  fileName.className = "file-name";
  fileName.textContent = originalName;
  fileName.title = originalName;

  const fileSize = document.createElement("span");
  fileSize.className = "file-size";
  fileSize.textContent = formatFileSize(size);

  fileInfo.appendChild(fileName);
  fileInfo.appendChild(fileSize);
  bubble.appendChild(fileInfo);

  wrapper.appendChild(usernameEl);
  wrapper.appendChild(bubble);
  messagesInner.appendChild(wrapper);
  scrollToBottom();
}

/** Format file size in human readable format */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/** Append a system/event message */
function appendSystem(text) {
  const el = document.createElement("div");
  el.className = "system-msg";
  el.textContent = text;
  messagesInner.appendChild(el);
  scrollToBottom();
}

/** Scroll chat to bottom */
function scrollToBottom() {
  const area = document.querySelector(".messages-area");
  area.scrollTop = area.scrollHeight;
}

/** Update the connection status chip */
function setStatus(state, text) {
  statusIndicator.className = `status-indicator ${state}`;
  statusText.textContent = text;
}

/** Enable / disable the input controls */
function setInputEnabled(enabled) {
  msgInput.disabled    = !enabled;
  sendBtn.disabled     = !enabled;
  fileBtn.disabled     = !enabled;
  if (enabled) msgInput.focus();
}

/** Clear messages (but keep the welcome row) */
function clearMessages() {
  // Remove all children except the first welcome system msg
  while (messagesInner.children.length > 1) {
    messagesInner.removeChild(messagesInner.lastChild);
  }
}

// ── Socket events ─────────────────────────────────────

/** Server tells us how many users are online */
socket.on("online_count", (count) => {
  onlineCountEl.textContent     = count;
  onlineCountChatEl.textContent = count;
});

/** No partner yet — we are in queue */
socket.on("waiting", () => {
  isConnected = false;
  setStatus("waiting", "Finding someone…");
  setInputEnabled(false);
  appendSystem("⏳ Looking for a stranger…");
});

/** Successfully paired */
socket.on("matched", ({ strangerUsername }) => {
  strangerName = strangerUsername;
  isConnected  = true;
  clearMessages();
  setStatus("connected", `Chatting with ${strangerName}`);
  setInputEnabled(true);
  appendSystem(`🎉 Connected with ${strangerName}! Say hi.`);
});

/** Incoming message from stranger */
socket.on("message", ({ username, text }) => {
  appendMessage({ username, text, own: false });
  // Hide typing indicator when message received
  typingIndicator.classList.add("hidden");
});

/** Server echoes our own sent message back for confirmation */
socket.on("message_sent", ({ username, text }) => {
  appendMessage({ username, text, own: true });
});

/** Incoming file message from stranger */
socket.on("file_message", ({ username, filename, originalName, mimetype, size, url }) => {
  appendFileMessage({ username, filename, originalName, mimetype, size, url, own: false });
});

/** Server echoes our own sent file message back for confirmation */
socket.on("file_message_sent", ({ username, filename, originalName, mimetype, size, url }) => {
  appendFileMessage({ username, filename, originalName, mimetype, size, url, own: true });
});

/** Stranger is typing / stopped typing */
socket.on("stranger_typing", (isTyping) => {
  typingIndicator.classList.toggle("hidden", !isTyping);
});

/** Stranger left or skipped */
socket.on("stranger_left", () => {
  isConnected = false;
  typingIndicator.classList.add("hidden");
  setInputEnabled(false);
  setStatus("disconnected", "Stranger left");
  appendSystem(`👋 ${strangerName || "Stranger"} has left. Finding next…`);
  // Server will auto re-queue us — wait for "waiting" or "matched" event
});

// ── UI Interactions ───────────────────────────────────

/** Start button on landing screen */
startBtn.addEventListener("click", startChat);
usernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startChat();
});

function startChat() {
  const val = usernameInput.value.trim();
  if (!val) {
    usernameInput.focus();
    usernameInput.style.borderColor = "#ff4d6d";
    setTimeout(() => (usernameInput.style.borderColor = ""), 1200);
    return;
  }
  myUsername = val.slice(0, 20);
  showScreen("chat");
  socket.emit("start_chat", { username: myUsername });
}

/** Send button */
sendBtn.addEventListener("click", sendMessage);
msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) sendMessage();
});

function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || !isConnected) return;
  socket.emit("message", { text });
  msgInput.value = "";

  // Stop typing indicator for self
  socket.emit("typing", false);
  clearTimeout(typingTimeout);
}

/** Typing indicator — emit to server */
msgInput.addEventListener("input", () => {
  if (!isConnected) return;
  socket.emit("typing", true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit("typing", false), 1800);
});

/** Next / skip button */
nextBtn.addEventListener("click", () => {
  if (!isConnected) return;  // already looking, no-op
  socket.emit("next");
  isConnected = false;
  setInputEnabled(false);
  setStatus("waiting", "Finding someone…");
  appendSystem("⏭ Skipped. Looking for the next stranger…");
});

/** File button */
fileBtn.addEventListener("click", () => {
  if (!isConnected) return;
  fileInput.click();
});

/** File input change handler */
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file || !isConnected) return;

  // Validate file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    appendSystem("❌ File too large. Maximum size is 10MB.");
    return;
  }

  // Show uploading status
  appendSystem("📤 Uploading file…");

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("https://anonchat-u8j3.onrender.com/upload", {
  method: "POST",
  body: formData
});

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    const fileData = await response.json();

    // Send file message via socket
    socket.emit("file_message", fileData);

    // Clear file input
    fileInput.value = "";

  } catch (error) {
    console.error("File upload error:", error);
    appendSystem("❌ Failed to upload file. Please try again.");
  }
});
