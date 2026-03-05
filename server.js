import express from "express";
import http from "http";
import { Server } from "socket.io";

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
  { id: "mono",  cells: [[0,0]] },

  { id: "domino", cells: [[0,0],[1,0]] },

  { id: "tromino_I", cells: [[0,0],[1,0],[2,0]] },
  { id: "tromino_L", cells: [[0,0],[0,1],[1,0]] },

  { id: "tetromino_I", cells: [[0,0],[1,0],[2,0],[3,0]] },
  { id: "tetromino_O", cells: [[0,0],[1,0],[0,1],[1,1]] },
  { id: "tetromino_T", cells: [[0,0],[1,0],[2,0],[1,1]] },
  { id: "tetromino_L", cells: [[0,0],[0,1],[0,2],[1,0]] },
  { id: "tetromino_S", cells: [[0,0],[1,0],[1,1],[2,1]] },

  // Pentominoes (12)
  { id: "pentomino_F", cells: [[0,1],[1,0],[1,1],[1,2],[2,2]] },
  { id: "pentomino_I", cells: [[0,0],[1,0],[2,0],[3,0],[4,0]] },
  { id: "pentomino_L", cells: [[0,0],[0,1],[0,2],[0,3],[1,0]] },
  { id: "pentomino_P", cells: [[0,0],[1,0],[0,1],[1,1],[0,2]] },
  { id: "pentomino_N", cells: [[0,0],[1,0],[1,1],[2,1],[3,1]] },
  { id: "pentomino_T", cells: [[0,0],[1,0],[2,0],[1,1],[1,2]] },
  { id: "pentomino_U", cells: [[0,0],[0,1],[1,1],[2,0],[2,1]] },
  { id: "pentomino_V", cells: [[0,0],[0,1],[0,2],[1,0],[2,0]] },
  { id: "pentomino_W", cells: [[0,0],[1,0],[1,1],[2,1],[2,2]] },
  { id: "pentomino_X", cells: [[1,0],[0,1],[1,1],[2,1],[1,2]] },
  { id: "pentomino_Y", cells: [[0,0],[1,0],[2,0],[3,0],[2,1]] },
  { id: "pentomino_Z", cells: [[0,0],[1,0],[1,1],[2,1],[2,2]] }
];

// --- Orientation generation ---
function normalizeCells(cells) {
  // shift so min x,y becomes 0,0; sort for stable signature
  const xs = cells.map(c => c[0]);
  const ys = cells.map(c => c[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const shifted = cells.map(([x,y]) => [x - minX, y - minY]);
  shifted.sort((a,b) => (a[0]-b[0]) || (a[1]-b[1]));
  return shifted;
}

function rotate90([x,y]) { return [y, -x]; }
function flipX([x,y]) { return [-x, y]; }

function cellsSignature(cells) {
  return normalizeCells(cells).map(([x,y]) => `${x}:${y}`).join("|");
}

function generateUniqueOrientations(baseCells) {
  const variants = [];
  const seen = new Set();
  const transforms = [];

  // 4 rotations of original + 4 rotations of flipped
  let cur = baseCells.map(c => [...c]);
  for (let r=0; r<4; r++) {
    transforms.push(cur);
    cur = cur.map(rotate90);
  }
  cur = baseCells.map(flipX);
  for (let r=0; r<4; r++) {
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

// --- Rooms / game state ---
const rooms = new Map();
// room = {
//   players: [{ socketId, ip, name, colorIndex, hasMoved, remainingPieces:Set(pieceId) }],
//   started: bool,
//   turn: int (index in players),
//   board: number[20][20],
//   corners: Map(colorIndex -> Set("x,y")) // available corner-touch anchors for that player (optional)
// }

function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

function getOrCreateRoom(roomId = "main") {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
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

// --- Rules helpers ---
const PLAYER_START_CORNERS = [
  [0,0],                       // P1 top-left
  [BOARD_SIZE-1,0],             // P2 top-right
  [BOARD_SIZE-1,BOARD_SIZE-1],  // P3 bottom-right
  [0,BOARD_SIZE-1]              // P4 bottom-left
];

function inBounds(x,y){ return x>=0 && y>=0 && x<BOARD_SIZE && y<BOARD_SIZE; }

function wouldOverlap(board, cellsAbs) {
  return cellsAbs.some(([x,y]) => board[y][x] !== 0);
}

function touchesEdgeSameColor(board, cellsAbs, colorVal) {
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (const [x,y] of cellsAbs) {
    for (const [dx,dy] of dirs) {
      const nx=x+dx, ny=y+dy;
      if (inBounds(nx,ny) && board[ny][nx] === colorVal) return true;
    }
  }
  return false;
}

function touchesCornerSameColor(board, cellsAbs, colorVal) {
  const diags = [[1,1],[1,-1],[-1,1],[-1,-1]];
  for (const [x,y] of cellsAbs) {
    for (const [dx,dy] of diags) {
      const nx=x+dx, ny=y+dy;
      if (inBounds(nx,ny) && board[ny][nx] === colorVal) return true;
    }
  }
  return false;
}

function coversRequiredStartCorner(cellsAbs, colorIndex) {
  const [cx,cy] = PLAYER_START_CORNERS[colorIndex];
  return cellsAbs.some(([x,y]) => x===cx && y===cy);
}

function placeCells(board, cellsAbs, colorVal) {
  for (const [x,y] of cellsAbs) board[y][x] = colorVal;
}

function buildAbsCells(pieceId, orientationIndex, anchorX, anchorY) {
  const ori = PIECE_ORIENTATIONS[pieceId]?.[orientationIndex];
  if (!ori) return null;
  // Each cell is offset from anchor (anchor corresponds to ori's (0,0) after normalize)
  return ori.map(([dx,dy]) => [anchorX + dx, anchorY + dy]);
}

function isLegalMove(room, player, move) {
  const { pieceId, orientationIndex, x, y } = move;
  if (!player.remainingPieces.has(pieceId)) return { ok:false, reason:"Piece already used." };

  const abs = buildAbsCells(pieceId, orientationIndex, x, y);
  if (!abs) return { ok:false, reason:"Invalid piece/orientation." };

  // bounds
  for (const [cx,cy] of abs) {
    if (!inBounds(cx,cy)) return { ok:false, reason:"Out of bounds." };
  }
  if (wouldOverlap(room.board, abs)) return { ok:false, reason:"Overlap." };

  const colorVal = player.colorIndex + 1;

  // First move: must cover the player's start corner
  if (!player.hasMoved) {
    if (!coversRequiredStartCorner(abs, player.colorIndex)) {
      return { ok:false, reason:"First move must cover your starting corner." };
    }
    // no other adjacency constraints besides no overlap (typical Blokus allows anything on first move)
    return { ok:true };
  }

  // Subsequent moves:
  // - must NOT touch same color by edge
  if (touchesEdgeSameColor(room.board, abs, colorVal)) {
    return { ok:false, reason:"Cannot touch your own pieces by edge." };
  }
  // - must touch same color by corner at least once
  if (!touchesCornerSameColor(room.board, abs, colorVal)) {
    return { ok:false, reason:"Must touch your own pieces by corner." };
  }

  return { ok:true };
}

function advanceTurn(room) {
  if (!room.started) return;
  room.turn = (room.turn + 1) % room.players.length;
}

// --- Socket handlers ---
io.on("connection", (socket) => {
  const ip = getClientIp(socket);

  socket.on("register_name", ({ name }) => {
    const clean = String(name || "").trim().slice(0, 24);
    if (!clean) return socket.emit("error_msg", { message: "Name is required." });

    // bind name by IP
    ipToName.set(ip, clean);
    socket.emit("registered", { ip, name: clean });
  });

  socket.on("join_room", ({ roomId = "main" } = {}) => {
    const room = getOrCreateRoom(roomId);
    const boundName = ipToName.get(ip);

    if (!boundName) {
      return socket.emit("need_name", { message: "Please enter your name first." });
    }

    // already in players?
    if (room.players.some(p => p.socketId === socket.id)) return;

    if (room.started) {
      // allow spectators (join socket room but not in players list)
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
      ip,
      name: boundName,
      colorIndex,
      hasMoved: false,
      remainingPieces: new Set(PIECES.map(p => p.id))
    };

    room.players.push(player);
    socket.join(roomId);

    io.to(roomId).emit("room_state", { roomId, state: publicRoomState(room), spectator: false });
  });

  socket.on("start_game", ({ roomId = "main" } = {}) => {
    const room = getOrCreateRoom(roomId);
    const isPlayer = room.players.some(p => p.socketId === socket.id);
    if (!isPlayer) return socket.emit("error_msg", { message: "Only players can start." });
    if (room.players.length < 2) return socket.emit("error_msg", { message: "Need at least 2 players." });

    room.started = true;
    room.turn = 0;
    room.board = emptyBoard();
    for (const p of room.players) {
      p.hasMoved = false;
      p.remainingPieces = new Set(PIECES.map(pp => pp.id));
    }

    io.to(roomId).emit("room_state", { roomId, state: publicRoomState(room) });
  });

  socket.on("place_move", ({ roomId = "main", move } = {}) => {
    const room = getOrCreateRoom(roomId);
    if (!room.started) return socket.emit("error_msg", { message: "Game not started." });

    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex < 0) return socket.emit("error_msg", { message: "You are not a player." });
    if (playerIndex !== room.turn) return socket.emit("error_msg", { message: "Not your turn." });

    const player = room.players[playerIndex];
    const verdict = isLegalMove(room, player, move);
    if (!verdict.ok) return socket.emit("error_msg", { message: verdict.reason });

    const abs = buildAbsCells(move.pieceId, move.orientationIndex, move.x, move.y);
    placeCells(room.board, abs, player.colorIndex + 1);

    player.remainingPieces.delete(move.pieceId);
    player.hasMoved = true;

    advanceTurn(room);
    io.to(roomId).emit("room_state", { roomId, state: publicRoomState(room) });
  });

  socket.on("disconnect", () => {
    // remove from any non-started room players list; keep started game stable (treat as still in game)
    for (const [roomId, room] of rooms.entries()) {
      const idx = room.players.findIndex(p => p.socketId === socket.id);
      if (idx >= 0 && !room.started) {
        room.players.splice(idx, 1);
        // reassign colors for lobby simplicity
        room.players.forEach((p, i) => (p.colorIndex = i));
        io.to(roomId).emit("room_state", { roomId, state: publicRoomState(room) });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Blokus running on http://localhost:${PORT}`));