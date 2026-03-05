import express from "express";
import http from "http";
import { Server } from "socket.io";
import { randomBytes } from "crypto";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public"));

/**
 * Board: 20x20
 * Cell values: 0 empty, 1..4 playerIndex+1
 */
const BOARD_SIZE = 20;
const MAX_PLAYERS = 4;

// --- IP -> Name binding (best-effort) ---
const ipToName = new Map(); // ip -> name

function getClientIp(socket) {
  // If behind reverse proxy, you can also pass x-forwarded-for via extraHeaders.
  // socket.handshake.headers["x-forwarded-for"] may exist.
  const xff = socket.handshake.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  // socket.handshake.address typically looks like "::ffff:192.168.1.10"
  const addr = socket.handshake.address || "";
  return addr.replace("::ffff:", "");
}

// --- Blokus piece set (21 pieces) as base shapes (list of [x,y]) ---
/**
 * We use a canonical definition; we will generate unique orientations (rot/flip) server-side.
 * Anchor point is (0,0) included in each piece for consistent placement.
 */
const PIECES = [
  { id: "mono", cells: [[0, 0]] },

  { id: "domino", cells: [[0, 0], [1, 0]] },

  { id: "tromino_I", cells: [[0, 0], [1, 0], [2, 0]] },
  { id: "tromino_L", cells: [[0, 0], [0, 1], [1, 0]] },

  { id: "tetromino_I", cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { id: "tetromino_O", cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "tetromino_T", cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  { id: "tetromino_L", cells: [[0, 0], [0, 1], [0, 2], [1, 0]] },
  { id: "tetromino_S", cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },

  // Pentominoes (12)
  { id: "pentomino_F", cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 2]] },
  { id: "pentomino_I", cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
  { id: "pentomino_L", cells: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0]] },
  { id: "pentomino_P", cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]] },
  { id: "pentomino_N", cells: [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1]] },
  { id: "pentomino_T", cells: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]] },
  { id: "pentomino_U", cells: [[0, 0], [0, 1], [1, 1], [2, 0], [2, 1]] },
  { id: "pentomino_V", cells: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]] },
  { id: "pentomino_W", cells: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]] },
  { id: "pentomino_X", cells: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]] },
  { id: "pentomino_Y", cells: [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1]] },
  { id: "pentomino_Z", cells: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]] }
];

// --- Orientation generation ---
function normalizeCells(cells) {
  // shift so min x,y becomes 0,0; sort for stable signature
  const xs = cells.map(c => c[0]);
  const ys = cells.map(c => c[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const shifted = cells.map(([x, y]) => [x - minX, y - minY]);
  shifted.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  return shifted;
}

function rotate90([x, y]) { return [y, -x]; }
function flipX([x, y]) { return [-x, y]; }

function cellsSignature(cells) {
  return normalizeCells(cells).map(([x, y]) => `${x}:${y}`).join("|");
}

function generateUniqueOrientations(baseCells) {
  const variants = [];
  const seen = new Set();
  const transforms = [];

  // 4 rotations of original + 4 rotations of flipped
  let cur = baseCells.map(c => [...c]);
  for (let r = 0; r < 4; r++) {
    transforms.push(cur);
    cur = cur.map(rotate90);
  }
  cur = baseCells.map(flipX);
  for (let r = 0; r < 4; r++) {
    transforms.push(cur);
    cur = cur.map(rotate90);
  }

  for (const t of transforms) {
    const sig = cellsSignature(t);
    if (!seen.has(sig)) {
      seen.add(sig);
      variants.push(normalizeCells(t));
    }
  }
  return variants; // each is normalized
}

const PIECE_ORIENTATIONS = Object.fromEntries(
  PIECES.map(p => [p.id, generateUniqueOrientations(p.cells)])
);

// --- Session -> Name binding ---
const sessions = new Map(); // socket.id -> name

// --- Rooms / game state ---
const rooms = new Map();

function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      players: [],
      started: false,
      turn: 0,
      board: emptyBoard()
    });
  }
  return rooms.get(roomId);
}

function publicRoomState(room) {
  return {
    id: room.id,
    started: room.started,
    turn: room.turn,
    players: room.players.map(p => ({
      socketId: p.socketId,
      name: p.name,
      colorIndex: p.colorIndex,
      hasMoved: p.hasMoved,
      remainingCount: p.remainingPieces.size
    })),
    board: room.board
  };
}

function broadcastRooms() {
  const roomList = Array.from(rooms.values()).map(r => ({
    id: r.id,
    playerCount: r.players.length,
    started: r.started
  }));
  io.emit("room_list", roomList);
}

function leaveRoomHelper(socket, roomId, room) {
  const idx = room.players.findIndex(p => p.socketId === socket.id);
  if (idx >= 0) {
    room.players.splice(idx, 1);

    if (room.started && room.players.length > 0) {
      if (idx < room.turn) {
        room.turn -= 1;
      } else if (idx === room.turn && room.turn >= room.players.length) {
        room.turn = 0;
      }
      if (room.turn < 0 || room.turn >= room.players.length) {
        room.turn = room.turn % room.players.length;
        if (room.turn < 0) room.turn += room.players.length;
      }
    } else if (!room.started) {
      // If the game hasn't started, reassign colors so there are no gaps
      room.players.forEach((p, i) => (p.colorIndex = i));
    }
  }

  socket.leave(roomId);

  if (room.players.length === 0) {
    rooms.delete(roomId);
  } else {
    io.to(roomId).emit("room_state", { roomId, state: publicRoomState(room) });
  }

  broadcastRooms();
}

function generateRejoinToken() {
  return randomBytes(24).toString("hex");
}

function removePlayerFromOtherRooms(socket, keepRoomId) {
  for (const [roomId, room] of rooms.entries()) {
    if (roomId === keepRoomId) continue;
    if (room.players.some(p => p.socketId === socket.id)) {
      leaveRoomHelper(socket, roomId, room);
    }
  }
}

// --- Rules helpers ---
const PLAYER_START_CORNERS = [
  [0, 0],                       // P1 top-left
  [BOARD_SIZE - 1, 0],             // P2 top-right
  [BOARD_SIZE - 1, BOARD_SIZE - 1],  // P3 bottom-right
  [0, BOARD_SIZE - 1]              // P4 bottom-left
];

function inBounds(x, y) { return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE; }

function wouldOverlap(board, cellsAbs) {
  return cellsAbs.some(([x, y]) => board[y][x] !== 0);
}

function touchesEdgeSameColor(board, cellsAbs, colorVal) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [x, y] of cellsAbs) {
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (inBounds(nx, ny) && board[ny][nx] === colorVal) return true;
    }
  }
  return false;
}

function touchesCornerSameColor(board, cellsAbs, colorVal) {
  const diags = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const [x, y] of cellsAbs) {
    for (const [dx, dy] of diags) {
      const nx = x + dx, ny = y + dy;
      if (inBounds(nx, ny) && board[ny][nx] === colorVal) return true;
    }
  }
  return false;
}

function coversRequiredStartCorner(cellsAbs, colorIndex) {
  const [cx, cy] = PLAYER_START_CORNERS[colorIndex];
  return cellsAbs.some(([x, y]) => x === cx && y === cy);
}

function placeCells(board, cellsAbs, colorVal) {
  for (const [x, y] of cellsAbs) board[y][x] = colorVal;
}

function buildAbsCells(pieceId, orientationIndex, anchorX, anchorY) {
  const ori = PIECE_ORIENTATIONS[pieceId]?.[orientationIndex];
  if (!ori) return null;
  return ori.map(([dx, dy]) => [anchorX + dx, anchorY + dy]);
}

function isLegalMove(room, player, move) {
  const { pieceId, orientationIndex, x, y } = move;
  if (!player.remainingPieces.has(pieceId)) return { ok: false, reason: "Piece already used." };

  const abs = buildAbsCells(pieceId, orientationIndex, x, y);
  if (!abs) return { ok: false, reason: "Invalid piece/orientation." };

  for (const [cx, cy] of abs) {
    if (!inBounds(cx, cy)) return { ok: false, reason: "Out of bounds." };
  }
  if (wouldOverlap(room.board, abs)) return { ok: false, reason: "Overlap." };

  const colorVal = player.colorIndex + 1;

  if (!player.hasMoved) {
    if (!coversRequiredStartCorner(abs, player.colorIndex)) {
      return { ok: false, reason: "First move must cover your starting corner." };
    }
    return { ok: true };
  }

  if (touchesEdgeSameColor(room.board, abs, colorVal)) {
    return { ok: false, reason: "Cannot touch your own pieces by edge." };
  }
  if (!touchesCornerSameColor(room.board, abs, colorVal)) {
    return { ok: false, reason: "Must touch your own pieces by corner." };
  }

  return { ok: true };
}

function advanceTurn(room) {
  if (!room.started) return;
  room.turn = (room.turn + 1) % room.players.length;
}

// --- Socket handlers ---
io.on("connection", (socket) => {
  // Send current rooms to newly connected client
  socket.emit("room_list", Array.from(rooms.values()).map(r => ({
    id: r.id,
    playerCount: r.players.length,
    started: r.started
  })));

  socket.on("register_name", ({ name }) => {
    const clean = String(name || "").trim().slice(0, 24);
    if (!clean) return socket.emit("error_msg", { message: "Name is required." });

    sessions.set(socket.id, clean);
    socket.emit("registered", { name: clean });
  });

  socket.on("get_rooms", () => {
    broadcastRooms();
  });

  socket.on("join_room", ({ roomId }) => {
    if (!roomId) return socket.emit("error_msg", { message: "Room ID required." });

    const boundName = sessions.get(socket.id);
    if (!boundName) {
      return socket.emit("need_name", { message: "Please enter your name first." });
    }

    removePlayerFromOtherRooms(socket, roomId);
    const room = getOrCreateRoom(roomId);

    // already in players?
    if (room.players.some(p => p.socketId === socket.id)) return;

    if (room.started) {
      socket.join(roomId);
      socket.emit("room_state", { roomId, state: publicRoomState(room), spectator: true });
      return;
    }

    if (room.players.length >= MAX_PLAYERS) {
      socket.emit("error_msg", { message: "Room is full (max 4)." });
      return;
    }

    const colorIndex = room.players.length; // 0..3
    const player = {
      socketId: socket.id,
      name: boundName,
      colorIndex,
      hasMoved: false,
      remainingPieces: new Set(PIECES.map(p => p.id)),
      rejoinToken: generateRejoinToken()
    };

    room.players.push(player);
    socket.join(roomId);
    socket.emit("rejoin_token", { roomId, token: player.rejoinToken });

    io.to(roomId).emit("room_state", { roomId, state: publicRoomState(room), spectator: false });
    broadcastRooms();
  });

  // Rejoin an existing room after page refresh (swap old socket.id with new one)
  socket.on("rejoin_room", ({ roomId, token }) => {
    if (!roomId || !rooms.has(roomId)) {
      return socket.emit("error_msg", { message: "Room no longer exists." });
    }

    const boundName = sessions.get(socket.id);
    if (!boundName) {
      return socket.emit("need_name", { message: "Please enter your name first." });
    }

    removePlayerFromOtherRooms(socket, roomId);
    const room = rooms.get(roomId);

    // Already in room with current socket? No-op.
    if (room.players.some(p => p.socketId === socket.id)) {
      socket.join(roomId);
      socket.emit("room_state", { roomId, state: publicRoomState(room), spectator: false });
      return;
    }

    // Reclaim requires possession of the rejoin token.
    const existingPlayer = room.players.find(p => p.rejoinToken === token);
    if (existingPlayer) {
      // Swap socket.id to reclaim the slot
      existingPlayer.socketId = socket.id;
      socket.join(roomId);
      socket.emit("rejoin_token", { roomId, token: existingPlayer.rejoinToken });
      io.to(roomId).emit("room_state", { roomId, state: publicRoomState(room), spectator: false });
      return;
    }

    // No existing slot — treat like a normal join
    if (room.started) {
      socket.join(roomId);
      socket.emit("room_state", { roomId, state: publicRoomState(room), spectator: true });
      return;
    }

    if (room.players.length >= MAX_PLAYERS) {
      return socket.emit("error_msg", { message: "Room is full (max 4)." });
    }

    const colorIndex = room.players.length;
    const player = {
      socketId: socket.id,
      name: boundName,
      colorIndex,
      hasMoved: false,
      remainingPieces: new Set(PIECES.map(p => p.id)),
      rejoinToken: generateRejoinToken()
    };

    room.players.push(player);
    socket.join(roomId);
    socket.emit("rejoin_token", { roomId, token: player.rejoinToken });
    io.to(roomId).emit("room_state", { roomId, state: publicRoomState(room), spectator: false });
    broadcastRooms();
  });

  socket.on("leave_room", ({ roomId }) => {
    if (!roomId || !rooms.has(roomId)) return;
    leaveRoomHelper(socket, roomId, rooms.get(roomId));
  });

  socket.on("start_game", ({ roomId }) => {
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    const isPlayer = room.players.some(p => p.socketId === socket.id);
    if (!isPlayer) return socket.emit("error_msg", { message: "Only players can start." });
    if (room.players.length < 2) return socket.emit("error_msg", { message: "Need at least 2 players." });
    if (room.started) return socket.emit("error_msg", { message: "Game already started." });

    room.started = true;
    room.turn = 0;
    room.board = emptyBoard();
    for (const p of room.players) {
      p.hasMoved = false;
      p.remainingPieces = new Set(PIECES.map(pp => pp.id));
    }

    io.to(roomId).emit("room_state", { roomId, state: publicRoomState(room) });
    broadcastRooms();
  });

  socket.on("place_move", ({ roomId, move } = {}) => {
    const emitPlaceMoveError = (message) => socket.emit("error_msg", { message, code: "PLACE_MOVE_REJECTED" });
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    if (!room.started) return emitPlaceMoveError("Game not started.");

    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex < 0) return emitPlaceMoveError("You are not a player.");
    if (playerIndex !== room.turn) return emitPlaceMoveError("Not your turn.");

    const player = room.players[playerIndex];
    const verdict = isLegalMove(room, player, move);
    if (!verdict.ok) return emitPlaceMoveError(verdict.reason);

    const abs = buildAbsCells(move.pieceId, move.orientationIndex, move.x, move.y);
    placeCells(room.board, abs, player.colorIndex + 1);

    player.remainingPieces.delete(move.pieceId);
    player.hasMoved = true;

    advanceTurn(room);
    io.to(roomId).emit("room_state", { roomId, state: publicRoomState(room) });
  });

  socket.on("disconnect", () => {
    const playerName = sessions.get(socket.id);
    sessions.delete(socket.id);

    // Grace period: wait 10s before removing from room (allows page refresh)
    setTimeout(() => {
      for (const [roomId, room] of rooms.entries()) {
        const playerIdx = room.players.findIndex(p => p.socketId === socket.id);
        if (playerIdx >= 0) {
          // Check if this player has already been reclaimed by a new socket (rejoin)
          // If the socketId still matches the disconnected one, they didn't come back
          const player = room.players[playerIdx];
          if (player.socketId === socket.id) {
            leaveRoomHelper(socket, roomId, room);
          }
        }
      }
    }, 10000);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Blokus running on http://localhost:${PORT}`));
