const fs = require("fs");
const path = require("path");
const express = require("express");
const http = require("http");
const cors = require("cors");
const { WebSocketServer } = require("ws");

const { RoomManager } = require("./src/roomManager");

const PORT = process.env.PORT || 4000;

function resolveClientDist() {
  const candidates = [
    path.join(__dirname, "..", "client", "dist"),
    path.join(process.cwd(), "client", "dist"),
  ];
  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, "index.html"))) return dir;
    } catch {
      /* ignore */
    }
  }
  return null;
}

const app = express();
app.use(cors());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const clientDist = resolveClientDist();
if (clientDist) {
  const assetsDir = path.join(clientDist, "assets");
  if (fs.existsSync(assetsDir)) {
    app.use(
      "/assets",
      express.static(assetsDir, {
        maxAge: "1y",
        immutable: true,
        setHeaders(res, filePath) {
          if (filePath.endsWith(".css")) {
            res.setHeader("Content-Type", "text/css; charset=utf-8");
          } else if (filePath.endsWith(".js")) {
            res.setHeader("Content-Type", "text/javascript; charset=utf-8");
          }
        },
      }),
    );
  }
  app.use(
    express.static(clientDist, {
      index: ["index.html"],
    }),
  );
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (path.extname(req.path)) {
      res.status(404).end();
      return;
    }
    res.sendFile(path.join(clientDist, "index.html"), (err) => {
      if (err) next(err);
    });
  });
  console.log(`Static: client dist → ${clientDist}`);
} else {
  console.warn(
    "client/dist not found (checked __dirname-relative and cwd-relative). Run npm run build before start.",
  );
}

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

    if (type === "ping") {
      send(ws, "pong", {});
      return;
    }

    if (type === "reconnect") {
      const code = msg.roomCode;
      const pid = msg.playerId;
      if (!code || pid === undefined || pid === null) {
        send(ws, "error", { message: "Invalid reconnect payload" });
        return;
      }
      const result = roomManager.reconnect(String(code), String(pid), ws);
      if (!result.ok) {
        send(ws, "error", { message: result.error || "Unable to reconnect" });
        return;
      }
      playerId = String(pid);
      roomCode = String(code);
      send(ws, "gameState", {
        room: roomManager.getPublicRoomState(roomCode),
      });
      roomManager.broadcastRoom(roomCode);
      return;
    }

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
      send(ws, "reshuffleResult", { ok: true });
      roomManager.broadcastRoom(roomCode);
    }
  });

  ws.on("close", (code, reason) => {
    console.log(
      JSON.stringify({
        event: "ws_close",
        playerId,
        roomCode,
        code,
        reason: typeof reason !== "undefined" ? reason.toString() : "",
      }),
    );
    if (playerId) {
      roomManager.disconnectPlayer(playerId);
      if (roomCode) {
        roomManager.broadcastRoom(roomCode);
      }
    }
  });
});

const HOST = process.env.HOST || "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});

