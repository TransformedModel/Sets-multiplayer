const { generateDeck, shuffle } = require("./cards");
const { isSet, hasAnySet } = require("./setRules");

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

let nextPlayerId = 1;

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.connections = new Map();
  }

  createRoom(hostNickname) {
    let roomCode;
    do {
      roomCode = makeRoomCode();
    } while (this.rooms.has(roomCode));

    const playerId = String(nextPlayerId++);
    const player = {
      playerId,
      nickname: hostNickname,
      score: 0,
      isHost: true,
      connected: true,
    };

    const room = {
      roomCode,
      hostId: playerId,
      players: [player],
      deck: [],
      board: [],
      status: "waiting",
      claimedSets: [],
      reshuffleCount: 0,
      gameStartedAt: null,
      gameEndedAt: null,
    };

    this.rooms.set(roomCode, room);
    return { room, playerId };
  }

  joinRoom(roomCode, nickname) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { ok: false, error: "Room not found" };
    }
    if (room.status !== "waiting") {
      return { ok: false, error: "Game already started" };
    }
    if (room.players.length >= 6) {
      return { ok: false, error: "Room is full" };
    }
    const playerId = String(nextPlayerId++);
    const player = {
      playerId,
      nickname,
      score: 0,
      isHost: false,
      connected: true,
    };
    room.players.push(player);
    return { ok: true, playerId };
  }

  startGame(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: "Room not found" };
    if (String(room.hostId) !== String(playerId)) {
      return { ok: false, error: "Only host can start the game" };
    }
    if (room.status !== "waiting") {
      return { ok: false, error: "Game already started" };
    }
    const deck = shuffle(generateDeck());
    const board = deck.splice(0, 12);
    room.deck = deck;
    room.board = board;
    room.status = "in-progress";
    room.reshuffleCount = 0;
    room.gameStartedAt = Date.now();
    room.gameEndedAt = null;
    return { ok: true };
  }

  handleClaimSet(roomCode, playerId, cardIds) {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: "Room not found" };
    if (room.status !== "in-progress") {
      return { ok: false, error: "Game is not in progress" };
    }
    if (!Array.isArray(cardIds) || cardIds.length !== 3) {
      return { ok: false, error: "Must claim exactly 3 cards" };
    }
    const indices = cardIds.map((id) =>
      room.board.findIndex((c) => c && String(c.id) === String(id))
    );
    if (indices.some((idx) => idx === -1)) {
      return { ok: false, error: "One or more cards not on board" };
    }
    const [i1, i2, i3] = indices;
    if (i1 === i2 || i1 === i3 || i2 === i3) {
      return { ok: false, error: "Duplicate card in claim" };
    }
    const cards = [room.board[i1], room.board[i2], room.board[i3]];
    if (!isSet(cards[0], cards[1], cards[2])) {
      return { ok: false, error: "Not a valid set" };
    }

    const player = room.players.find((p) => p.playerId === playerId);
    if (!player) {
      return { ok: false, error: "Player not found" };
    }

    player.score += 1;
    room.claimedSets.push({ by: playerId, cards, at: Date.now() });

    // Keep other cards in the same grid slots: only swap out the three taken.
    // (Splice+push compacts the array and makes every surviving card jump position.)
    if (room.board.length === 12 && room.deck.length >= 3) {
      const sortedSlots = [...indices].sort((a, b) => a - b);
      for (let s = 0; s < 3; s++) {
        room.board[sortedSlots[s]] = room.deck.shift();
      }
    } else {
      indices.sort((a, b) => b - a);
      for (const idx of indices) {
        room.board.splice(idx, 1);
      }
      while (room.board.length < 12 && room.deck.length > 0) {
        room.board.push(room.deck.shift());
      }
    }

    // End when no cards left to deal and no valid set remains on the board.
    if (room.deck.length === 0 && !hasAnySet(room.board)) {
      room.status = "finished";
      room.gameEndedAt = Date.now();
    }

    return { ok: true };
  }

  reshuffleBoard(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: "Room not found" };
    if (String(room.hostId) !== String(playerId)) {
      return { ok: false, error: "Only host can reshuffle the board" };
    }
    if (room.status !== "in-progress") {
      return { ok: false, error: "Game is not in progress" };
    }
    const combined = room.board.concat(room.deck);
    if (combined.length === 0) {
      return { ok: false, error: "No cards to reshuffle" };
    }
    const shuffled = shuffle(combined);
    const onBoard = Math.min(12, shuffled.length);
    room.board = shuffled.slice(0, onBoard);
    room.deck = shuffled.slice(onBoard);
    room.reshuffleCount = (room.reshuffleCount || 0) + 1;
    if (room.deck.length === 0 && !hasAnySet(room.board)) {
      room.status = "finished";
      room.gameEndedAt = Date.now();
    }
    return { ok: true };
  }

  disconnectPlayer(playerId) {
    this.connections.delete(playerId);
    for (const room of this.rooms.values()) {
      const player = room.players.find((p) => p.playerId === playerId);
      if (player) {
        player.connected = false;
      }
    }
  }

  attachConnection(playerId, ws) {
    this.connections.set(playerId, ws);
  }

  /**
   * Re-attach a WebSocket to an existing player after a disconnect (same roomCode + playerId).
   */
  reconnect(roomCode, playerId, ws) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { ok: false, error: "Room not found" };
    }
    const player = room.players.find(
      (p) => String(p.playerId) === String(playerId),
    );
    if (!player) {
      return { ok: false, error: "Not a member of this room" };
    }
    player.connected = true;
    this.attachConnection(playerId, ws);
    return { ok: true };
  }

  getPublicRoomState(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    return {
      roomCode: room.roomCode,
      status: room.status,
      players: room.players.map((p) => ({
        playerId: p.playerId,
        nickname: p.nickname,
        score: p.score,
        isHost: p.isHost,
        connected: p.connected,
      })),
      board: room.board,
      deckCount: room.deck.length,
      claimedSets: room.claimedSets.map((entry) => ({
        by: entry.by,
        at: entry.at,
        cards: entry.cards.map((c) => ({
          id: c.id,
          shape: c.shape,
          color: c.color,
          fill: c.fill,
          count: c.count,
        })),
      })),
      reshuffleCount: room.reshuffleCount ?? 0,
      gameStartedAt: room.gameStartedAt ?? null,
      gameEndedAt: room.gameEndedAt ?? null,
    };
  }

  broadcastRoom(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const publicState = this.getPublicRoomState(roomCode);
    const payload = JSON.stringify({
      type: "gameState",
      room: publicState,
    });
    for (const player of room.players) {
      const ws = this.connections.get(player.playerId);
      if (ws && ws.readyState === 1) {
        ws.send(payload);
      }
    }
  }
}

module.exports = {
  RoomManager,
};

