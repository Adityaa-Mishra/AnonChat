// ─────────────────────────────────────────────
//  socket/index.js  –  All Socket.io logic
// ─────────────────────────────────────────────

/**
 * State lives entirely in memory.
 * Nothing is persisted. Everything resets on server restart.
 *
 * waitingUser : { socket, username }  – at most ONE user waiting
 * pairs       : Map<socketId, socketId> – who is chatting with whom
 * usernames   : Map<socketId, string>   – socket id → username
 * onlineCount : number                  – total connected sockets
 */

let waitingUser = null;
const pairs = new Map();
const usernames = new Map();
let onlineCount = 0;
const pairTimeouts = new Map();
const CHAT_DURATION_MS = 15 * 60 * 1000;

// ── helpers ─────────────────────────────────

/** Broadcast current online count to everyone */
function broadcastOnlineCount(io) {
  io.emit("online_count", onlineCount);
}

/** Put a socket into the waiting queue and notify it */
function addToWaiting(socket, username) {
  waitingUser = { socket, username };
  socket.emit("waiting");
}

/** Pair two sockets into a private room */
function pairSockets(io, socketA, usernameA, socketB, usernameB) {
  const room = `room_${socketA.id}_${socketB.id}`;

  socketA.join(room);
  socketB.join(room);

  pairs.set(socketA.id, socketB.id);
  pairs.set(socketB.id, socketA.id);

  socketA.emit("matched", { strangerUsername: usernameB, room });
  socketB.emit("matched", { strangerUsername: usernameA, room });

  // Start max duration timer for this pair
  const key = makePairKey(socketA.id, socketB.id);
  clearPairTimeout(key);
  const t = setTimeout(() => {
    // If still paired, end the chat for both
    if (pairs.get(socketA.id) === socketB.id && pairs.get(socketB.id) === socketA.id) {
      endPair(io, socketA, socketB, "time");
    }
  }, CHAT_DURATION_MS);
  pairTimeouts.set(key, t);
}

/** Disconnect a user from their current chat partner */
function disconnectPair(io, socket) {
  const partnerId = pairs.get(socket.id);
  if (!partnerId) return null;

  pairs.delete(socket.id);
  pairs.delete(partnerId);

  const partnerSocket = io.sockets.sockets.get(partnerId);
  return partnerSocket || null;
}

function makePairKey(a, b) {
  return [a, b].sort().join("|");
}

function clearPairTimeout(key) {
  const t = pairTimeouts.get(key);
  if (t) clearTimeout(t);
  pairTimeouts.delete(key);
}

function clearTimeoutForSocket(socketId) {
  const partnerId = pairs.get(socketId);
  if (!partnerId) return;
  const key = makePairKey(socketId, partnerId);
  clearPairTimeout(key);
}

function enqueueOrMatch(io, socket, username) {
  if (waitingUser === null) {
    addToWaiting(socket, username);
  } else if (waitingUser.socket.id !== socket.id) {
    const { socket: ws, username: wu } = waitingUser;
    waitingUser = null;
    pairSockets(io, socket, username, ws, wu);
  }
}

function endPair(io, socketA, socketB, reason) {
  const key = makePairKey(socketA.id, socketB.id);
  clearPairTimeout(key);

  pairs.delete(socketA.id);
  pairs.delete(socketB.id);

  if (reason === "time") {
    socketA.emit("chat_timeout");
    socketB.emit("chat_timeout");
  } else if (reason === "left") {
    socketA.emit("stranger_left");
    socketB.emit("stranger_left");
  }

  const nameA = usernames.get(socketA.id) || "Anon";
  const nameB = usernames.get(socketB.id) || "Anon";
  enqueueOrMatch(io, socketA, nameA);
  enqueueOrMatch(io, socketB, nameB);
}

// ── main export ─────────────────────────────

module.exports = function registerSocketHandlers(io) {

  io.on("connection", (socket) => {
    onlineCount++;
    broadcastOnlineCount(io);

    // ── 1. User sets username and wants to start chatting ──
    socket.on("start_chat", ({ username }) => {
      if (!username || typeof username !== "string") return;
      const clean = username.trim().slice(0, 20) || "Anon";
      usernames.set(socket.id, clean);

      if (waitingUser && waitingUser.socket.id !== socket.id) {
        // Someone is waiting → match immediately
        const { socket: partnerSocket, username: partnerUsername } = waitingUser;
        waitingUser = null;
        pairSockets(io, socket, clean, partnerSocket, partnerUsername);
      } else {
        // Nobody waiting → join queue
        addToWaiting(socket, clean);
      }
    });

    // ── 2. Chat message ──
    socket.on("message", ({ text, replyTo }) => {
      const partnerId = pairs.get(socket.id);
      if (!partnerId) return;

      const username = usernames.get(socket.id) || "Anon";
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit("message", { username, text, replyTo, own: false });
      }
      // Echo confirmation back to sender (so they see their bubble rendered cleanly)
      socket.emit("message_sent", { username, text, replyTo });
    });

    // ── 2.5. File message ──
    socket.on("file_message", ({ filename, originalName, mimetype, size, url }) => {
      const partnerId = pairs.get(socket.id);
      if (!partnerId) return;

      const username = usernames.get(socket.id) || "Anon";
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit("file_message", {
          username,
          filename,
          originalName,
          mimetype,
          size,
          url,
          own: false
        });
      }
      // Echo confirmation back to sender
      socket.emit("file_message_sent", {
        username,
        filename,
        originalName,
        mimetype,
        size,
        url
      });
    });

    // ── 3. Typing indicator ──
    socket.on("typing", (isTyping) => {
      const partnerId = pairs.get(socket.id);
      if (!partnerId) return;
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit("stranger_typing", isTyping);
      }
    });

    // ── 4. Next / Skip ──
    socket.on("next", () => {
      clearTimeoutForSocket(socket.id);
      const partnerSocket = disconnectPair(io, socket);

      if (partnerSocket) {
        // Notify partner they were skipped
        partnerSocket.emit("stranger_left");
        // Put partner back in queue
        const partnerUsername = usernames.get(partnerSocket.id) || "Anon";
        enqueueOrMatch(io, partnerSocket, partnerUsername);
      }

      // Remove self from waiting if they were waiting
      if (waitingUser && waitingUser.socket.id === socket.id) {
        waitingUser = null;
      }

      // Put self back in queue with their username
      const myUsername = usernames.get(socket.id) || "Anon";
      enqueueOrMatch(io, socket, myUsername);
    });

    // ── 5. Disconnect ──
    socket.on("disconnect", () => {
      onlineCount = Math.max(0, onlineCount - 1);
      broadcastOnlineCount(io);

      // Remove from waiting queue
      if (waitingUser && waitingUser.socket.id === socket.id) {
        waitingUser = null;
      }

      // Notify and re-queue partner
      clearTimeoutForSocket(socket.id);
      const partnerSocket = disconnectPair(io, socket);
      if (partnerSocket) {
        partnerSocket.emit("stranger_left");
        const partnerUsername = usernames.get(partnerSocket.id) || "Anon";
        enqueueOrMatch(io, partnerSocket, partnerUsername);
      }

      usernames.delete(socket.id);
    });
  });
};
