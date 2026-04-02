const fs = require("fs");
const path = require("path");
const express = require("express");
const http = require("http");
const cors = require("cors");
const { WebSocketServer } = require("ws");

const { RoomManager } = require("./src/roomManager");

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const roomManager = new RoomManager();

function send(ws, type, payload) {
  ws.send(JSON.stringify({ type, ...payload }));
}

wss.on("connection", (ws) => {
  let playerId = null;
  let roomCode = null;

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    const { type } = msg;

    if (type === "createRoom") {
      const { nickname } = msg;
      const result = roomManager.createRoom(nickname || "Player");
      playerId = result.playerId;
      roomCode = result.room.roomCode;
      roomManager.attachConnection(playerId, ws);
      send(ws, "roomCreated", {
        roomCode: result.room.roomCode,
        playerId: result.playerId,
        room: roomManager.getPublicRoomState(roomCode),
      });
      roomManager.broadcastRoom(roomCode);
    } else if (type === "joinRoom") {
      const { roomCode: code, nickname } = msg;
      const joinResult = roomManager.joinRoom(code, nickname || "Player");
      if (!joinResult.ok) {
        send(ws, "error", { message: joinResult.error || "Unable to join room" });
        return;
      }
      playerId = joinResult.playerId;
      roomCode = code;
      roomManager.attachConnection(playerId, ws);
      send(ws, "joinedRoom", {
        roomCode,
        playerId,
        room: roomManager.getPublicRoomState(roomCode),
      });
      roomManager.broadcastRoom(roomCode);
    } else if (type === "startGame") {
      if (!roomCode || !playerId) {
        send(ws, "error", {
          message: "Session expired — refresh the page and rejoin the room.",
        });
        return;
      }
      const result = roomManager.startGame(roomCode, playerId);
      if (!result.ok) {
        send(ws, "error", { message: result.error || "Unable to start game" });
        return;
      }
      roomManager.broadcastRoom(roomCode);
    } else if (type === "claimSet") {
      if (!roomCode || !playerId) {
        send(ws, "error", {
          message: "Session expired — refresh the page and rejoin the room.",
        });
        return;
      }
      const { cardIds } = msg;
      const result = roomManager.handleClaimSet(roomCode, playerId, cardIds || []);
      if (!result.ok) {
        send(ws, "setClaimResult", {
          success: false,
          reason: result.error || "Invalid set",
        });
        return;
      }
      send(ws, "setClaimResult", { success: true });
      roomManager.broadcastRoom(roomCode);
    } else if (type === "reshuffleBoard") {
      if (!roomCode || !playerId) {
        send(ws, "reshuffleResult", {
          ok: false,
          message: "Session expired — refresh the page and rejoin the room.",
        });
        return;
      }
      const result = roomManager.reshuffleBoard(roomCode, playerId);
      if (!result.ok) {
        send(ws, "reshuffleResult", {
          ok: false,
          message: result.error || "Unable to reshuffle",
        });
        return;
      }
      roomManager.broadcastRoom(roomCode);
    }
  });

  ws.on("close", () => {
    if (playerId) {
      roomManager.disconnectPlayer(playerId);
      if (roomCode) {
        roomManager.broadcastRoom(roomCode);
      }
    }
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const clientDist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { fallthrough: true }));
  // Express 5: avoid app.get('*', …) (path-to-regexp); catch-all after static
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(clientDist, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

const HOST = process.env.HOST || "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});

