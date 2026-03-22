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
    socket.on("message", ({ text }) => {
      const partnerId = pairs.get(socket.id);
      if (!partnerId) return;

      const username = usernames.get(socket.id) || "Anon";
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit("message", { username, text, own: false });
      }
      // Echo confirmation back to sender (so they see their bubble rendered cleanly)
      socket.emit("message_sent", { username, text });
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
      const partnerSocket = disconnectPair(io, socket);

      if (partnerSocket) {
        // Notify partner they were skipped
        partnerSocket.emit("stranger_left");
        // Put partner back in queue
        const partnerUsername = usernames.get(partnerSocket.id) || "Anon";
        if (waitingUser === null) {
          addToWaiting(partnerSocket, partnerUsername);
        } else {
          // Someone else is waiting – match partner immediately
          const { socket: ws, username: wu } = waitingUser;
          waitingUser = null;
          pairSockets(io, partnerSocket, partnerUsername, ws, wu);
        }
      }

      // Remove self from waiting if they were waiting
      if (waitingUser && waitingUser.socket.id === socket.id) {
        waitingUser = null;
      }

      // Put self back in queue with their username
      const myUsername = usernames.get(socket.id) || "Anon";
      if (waitingUser === null) {
        addToWaiting(socket, myUsername);
      } else {
        const { socket: ws, username: wu } = waitingUser;
        waitingUser = null;
        pairSockets(io, socket, myUsername, ws, wu);
      }
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
      const partnerSocket = disconnectPair(io, socket);
      if (partnerSocket) {
        partnerSocket.emit("stranger_left");
        const partnerUsername = usernames.get(partnerSocket.id) || "Anon";
        if (waitingUser === null) {
          addToWaiting(partnerSocket, partnerUsername);
        } else {
          const { socket: ws, username: wu } = waitingUser;
          waitingUser = null;
          pairSockets(io, partnerSocket, partnerUsername, ws, wu);
        }
      }

      usernames.delete(socket.id);
    });
  });
};
