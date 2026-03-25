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

const replyBar      = document.getElementById("reply-bar");
const replyUserEl   = document.getElementById("reply-user");
const replyTextEl   = document.getElementById("reply-text");
const replyCancelBtn = document.getElementById("reply-cancel");
const chatTimerEl   = document.getElementById("chat-timer");

// ── State ─────────────────────────────────────────────
let myUsername    = "";
let strangerName  = "";
let isConnected   = false;   // paired with someone
let typingTimeout = null;
let replyContext  = null;
let chatTimerInterval = null;
let chatEndsAt = null;

// ── Socket connection ─────────────────────────────────
const SERVER_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://anonchat-u8j3.onrender.com";

const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"]
});
// ── Helpers ───────────────────────────────────────────

/** Switch visible screen */
function showScreen(name) {
  screenLanding.classList.toggle("active", name === "landing");
  screenChat.classList.toggle("active",   name === "chat");
}

/** Append a bubble message to the chat */
function appendMessage({ username, text, replyTo, own }) {
  const wrapper = document.createElement("div");
  wrapper.className = `bubble-wrapper ${own ? "own" : "them"}`;

  const usernameEl = document.createElement("div");
  usernameEl.className = "bubble-username";
  usernameEl.textContent = own ? `you (${username})` : username;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (replyTo) {
    bubble.appendChild(buildReplyPreview(replyTo));
  }
  const textEl = document.createElement("div");
  textEl.className = "bubble-text";
  textEl.textContent = text;
  bubble.appendChild(textEl);

  wrapper.appendChild(usernameEl);
  const row = document.createElement("div");
  row.className = "bubble-row";
  row.appendChild(bubble);

  const actions = document.createElement("div");
  actions.className = "bubble-actions";
  actions.appendChild(createReplyButton({ username, text }));
  row.appendChild(actions);

  wrapper.appendChild(row);

  messagesInner.appendChild(wrapper);
  scrollToBottom();
}

/** Append a file message to the chat */
function appendFileMessage({ username, filename, originalName, mimetype, size, url, replyTo, own }) {
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

  if (replyTo) {
    bubble.appendChild(buildReplyPreview(replyTo));
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
  const row = document.createElement("div");
  row.className = "bubble-row";
  row.appendChild(bubble);

  const actions = document.createElement("div");
  actions.className = "bubble-actions";
  actions.appendChild(createReplyButton({ username, text: `[File] ${originalName}` }));
  row.appendChild(actions);

  wrapper.appendChild(row);

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

function startChatTimer(durationMs) {
  stopChatTimer();
  chatEndsAt = Date.now() + durationMs;
  chatTimerEl.classList.remove("hidden");
  tickChatTimer();
  chatTimerInterval = setInterval(tickChatTimer, 1000);
}

function stopChatTimer() {
  if (chatTimerInterval) clearInterval(chatTimerInterval);
  chatTimerInterval = null;
  chatEndsAt = null;
  chatTimerEl.classList.add("hidden");
  chatTimerEl.textContent = "15:00";
}

function tickChatTimer() {
  if (!chatEndsAt) return;
  const remaining = Math.max(0, chatEndsAt - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const secs = String(totalSeconds % 60).padStart(2, "0");
  chatTimerEl.textContent = `${mins}:${secs}`;
  if (remaining <= 0) {
    stopChatTimer();
  }
}

function buildReplyPreview(replyTo) {
  const wrap = document.createElement("div");
  wrap.className = "reply-preview";

  const user = document.createElement("div");
  user.className = "reply-user";
  user.textContent = replyTo.username || "Anon";

  const text = document.createElement("div");
  text.textContent = replyTo.text || "";

  wrap.appendChild(user);
  wrap.appendChild(text);
  return wrap;
}

function createReplyButton({ username, text }) {
  const btn = document.createElement("button");
  btn.className = "reply-btn";
  btn.title = "Reply";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h6");
  svg.appendChild(path);
  btn.appendChild(svg);
  btn.addEventListener("click", () => {
    setReplyContext({ username, text });
  });
  return btn;
}

function setReplyContext(ctx) {
  replyContext = ctx;
  replyUserEl.textContent = ctx.username || "Anon";
  replyTextEl.textContent = ctx.text || "";
  replyBar.classList.remove("hidden");
}

function clearReplyContext() {
  replyContext = null;
  replyBar.classList.add("hidden");
  replyUserEl.textContent = "";
  replyTextEl.textContent = "";
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
  clearReplyContext();
  stopChatTimer();
});

/** Successfully paired */
socket.on("matched", ({ strangerUsername }) => {
  strangerName = strangerUsername;
  isConnected  = true;
  clearMessages();
  setStatus("connected", `Chatting with ${strangerName}`);
  setInputEnabled(true);
  appendSystem(`🎉 Connected with ${strangerName}! Say hi.`);
  clearReplyContext();
  startChatTimer(15 * 60 * 1000);
});

/** Incoming message from stranger */
socket.on("message", ({ username, text, replyTo }) => {
  appendMessage({ username, text, replyTo, own: false });
  // Hide typing indicator when message received
  typingIndicator.classList.add("hidden");
});

/** Server echoes our own sent message back for confirmation */
socket.on("message_sent", ({ username, text, replyTo }) => {
  appendMessage({ username, text, replyTo, own: true });
  clearReplyContext();
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
  clearReplyContext();
  stopChatTimer();
});

socket.on("chat_timeout", () => {
  isConnected = false;
  typingIndicator.classList.add("hidden");
  setInputEnabled(false);
  setStatus("waiting", "Finding someone…");
  appendSystem("⏰ Chat ended after 15 minutes. Finding someone new…");
  clearReplyContext();
  stopChatTimer();
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
  socket.emit("message", { text, replyTo: replyContext });
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
  clearReplyContext();
  stopChatTimer();
});

replyCancelBtn.addEventListener("click", () => {
  clearReplyContext();
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

    const response = await fetch(`${SERVER_URL}/upload`, {
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
