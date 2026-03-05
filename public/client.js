const socket = io();

const netInfo = document.getElementById("netInfo");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const nameInput = document.getElementById("nameInput");
const saveNameBtn = document.getElementById("saveNameBtn");
const idStatus = document.getElementById("idStatus");

const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");
const roomStatus = document.getElementById("roomStatus");
const playersList = document.getElementById("playersList");

const turnHint = document.getElementById("turnHint");
const errBox = document.getElementById("errBox");

const pieceRack = document.getElementById("pieceRack");
const rackHint = document.getElementById("rackHint");

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const BOARD_SIZE = 20;
const CELL = canvas.width / BOARD_SIZE;

const COLORS = {
  0: "rgba(0, 0, 0, 0)",
  1: "#5aa9ff",
  2: "#ff4d4d",
  3: "#2ed573",
  4: "#ffa502"
};

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

// --- orientation utils (same logic as server) ---
function normalizeCells(cells) {
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
function signature(cells) {
  return normalizeCells(cells).map(([x, y]) => `${x}:${y}`).join("|");
}
function generateUniqueOrientations(baseCells) {
  const seen = new Set();
  const variants = [];
  let cur = baseCells.map(c => [...c]);
  for (let r = 0; r < 4; r++) {
    const sig = signature(cur);
    if (!seen.has(sig)) { seen.add(sig); variants.push(normalizeCells(cur)); }
    cur = cur.map(rotate90);
  }
  cur = baseCells.map(flipX);
  for (let r = 0; r < 4; r++) {
    const sig = signature(cur);
    if (!seen.has(sig)) { seen.add(sig); variants.push(normalizeCells(cur)); }
    cur = cur.map(rotate90);
  }
  return variants;
}
const ORIS = Object.fromEntries(PIECES.map(p => [p.id, generateUniqueOrientations(p.cells)]));

let roomId = "main";
let mySocketId = null;
let myColorIndex = null;

let state = null;
let spectator = false;

let selectedPieceId = "mono";
let orientationIndex = 0;
let pendingPlacedPieceId = null;

let hoverCell = { x: -1, y: -1 };
let ghostValid = false;

const PLAYER_START_CORNERS = [
  [0, 0], [BOARD_SIZE - 1, 0], [BOARD_SIZE - 1, BOARD_SIZE - 1], [0, BOARD_SIZE - 1]
];

// MVP local remaining
let localRemaining = new Set(PIECES.map(p => p.id));
let rejoinTokens = {};
try {
  rejoinTokens = JSON.parse(localStorage.getItem("blokus-rejoin-tokens") || "{}");
} catch {
  rejoinTokens = {};
}

function saveRejoinTokens() {
  localStorage.setItem("blokus-rejoin-tokens", JSON.stringify(rejoinTokens));
}

function setError(msg) { errBox.textContent = msg || ""; }

function resetLocalRemaining() {
  localRemaining = new Set(PIECES.map(p => p.id));
  selectedPieceId = "mono";
  orientationIndex = 0;
  renderRack();
}

function myPlayer() {
  if (!state) return null;
  return state.players.find(p => p.socketId === mySocketId) || null;
}

function isMyTurn() {
  if (!state) return false;
  return !spectator && state.started && state.players[state.turn]?.socketId === mySocketId;
}

// --- Rules helpers (port from server) ---
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

function buildAbsCells(pieceId, oriIdx, anchorX, anchorY) {
  const ori = ORIS[pieceId]?.[oriIdx];
  if (!ori) return null;
  return ori.map(([dx, dy]) => [anchorX + dx, anchorY + dy]);
}

function clampBoardCell(value) {
  return Math.max(0, Math.min(BOARD_SIZE - 1, value));
}

function getBoardCellFromPointer(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clampBoardCell(Math.floor(((clientX - rect.left) / rect.width) * BOARD_SIZE)),
    y: clampBoardCell(Math.floor(((clientY - rect.top) / rect.height) * BOARD_SIZE))
  };
}

function checkLegalMoveLocal(pieceId, oriIdx, x, y) {
  if (!state || !isMyTurn()) return false;
  const me = myPlayer();
  if (!me || !localRemaining.has(pieceId)) return false;

  const abs = buildAbsCells(pieceId, oriIdx, x, y);
  if (!abs) return false;

  for (const [cx, cy] of abs) {
    if (!inBounds(cx, cy)) return false;
  }
  if (wouldOverlap(state.board, abs)) return false;

  const colorVal = me.colorIndex + 1;

  if (!me.hasMoved) {
    return coversRequiredStartCorner(abs, me.colorIndex);
  }

  if (touchesEdgeSameColor(state.board, abs, colorVal)) return false;
  if (!touchesCornerSameColor(state.board, abs, colorVal)) return false;

  return true;
}

// --- Board drawing ---
function drawGrid() {
  const isDark = document.body.classList.contains("dark-theme");
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= BOARD_SIZE; i++) {
    const p = i * CELL;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(canvas.width, p); ctx.stroke();
  }
}

function drawStartCorners() {
  const corners = [
    [0, 0], [BOARD_SIZE - 1, 0], [BOARD_SIZE - 1, BOARD_SIZE - 1], [0, BOARD_SIZE - 1]
  ];
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < corners.length; i++) {
    const [x, y] = corners[i];
    ctx.fillStyle = COLORS[i + 1];
    ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!state) {
    drawGrid();
    return;
  }

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const v = state.board[y][x];
      ctx.fillStyle = COLORS[v] || COLORS[0];
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  drawGrid();
  drawStartCorners();

  if (isMyTurn() && localRemaining.has(selectedPieceId) && hoverCell.x >= 0 && hoverCell.y >= 0) {
    const ori = ORIS[selectedPieceId]?.[orientationIndex] || [];
    ghostValid = checkLegalMoveLocal(selectedPieceId, orientationIndex, hoverCell.x, hoverCell.y);

    ctx.globalAlpha = 0.55;
    const colorVal = (myColorIndex ?? 0) + 1;

    // UX: Green/Glow for valid, Red for invalid
    if (ghostValid) {
      ctx.fillStyle = COLORS[colorVal] || "#ffffff";
      ctx.shadowColor = COLORS[colorVal];
      ctx.shadowBlur = 15;
    } else {
      ctx.fillStyle = "#ff4d4d"; // Red alert
      ctx.shadowBlur = 0;
    }

    for (const [dx, dy] of ori) {
      const ax = hoverCell.x + dx;
      const ay = hoverCell.y + dy;
      if (ax >= 0 && ay >= 0 && ax < BOARD_SIZE && ay < BOARD_SIZE) {
        ctx.fillRect(ax * CELL, ay * CELL, CELL, CELL);
      }
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
}
// --- Rack rendering ---
// Track multi-click state globally (survives DOM rebuilds)
const _clickState = {};

function renderRack() {
  const colorVal = (myColorIndex ?? 0) + 1;
  const fill = COLORS[colorVal] || "#ffffff";

  pieceRack.innerHTML = "";

  for (const p of PIECES) {
    const tile = document.createElement("div");
    tile.className = "pieceTile";
    tile.dataset.pieceId = p.id;

    const available = localRemaining.has(p.id);
    if (!available) tile.classList.add("disabled");
    if (p.id === selectedPieceId) tile.classList.add("selected");

    tile.draggable = available && isMyTurn();

    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 70;
    c.className = "pieceCanvas";

    // Show current orientation for selected piece
    const previewOriIdx = (p.id === selectedPieceId) ? orientationIndex : 0;
    drawPiecePreview(c, ORIS[p.id]?.[previewOriIdx] || ORIS[p.id]?.[0] || [], fill);

    const label = document.createElement("div");
    label.className = "pieceLabel";
    label.textContent = p.id;

    tile.appendChild(c);
    tile.appendChild(label);

    // --- INSTANT single click: select piece (like original) ---
    tile.addEventListener("click", () => {
      if (!available) return;

      // Track rapid clicks for triple-click detection
      if (!_clickState[p.id]) _clickState[p.id] = { count: 0, lastClick: 0 };
      const s = _clickState[p.id];
      const now = Date.now();
      s.count = (now - s.lastClick < 400) ? s.count + 1 : 1;
      s.lastClick = now;

      if (s.count >= 3) {
        // Triple Click: Flip
        s.count = 0;
        selectedPieceId = p.id;
        const oriCount = ORIS[p.id]?.length || 1;
        const halfWay = Math.max(1, Math.floor(oriCount / 2));
        orientationIndex = (orientationIndex + halfWay) % oriCount;
      } else {
        // Single click: just select
        selectedPieceId = p.id;
        orientationIndex = 0;
      }

      setError("");
      renderRack();
      draw();
    });

    // --- Native dblclick: rotate piece ---
    tile.addEventListener("dblclick", (e) => {
      e.preventDefault();
      if (!available) return;
      selectedPieceId = p.id;
      const oriCount = ORIS[p.id]?.length || 1;
      orientationIndex = (orientationIndex + 1) % oriCount;
      setError("");
      renderRack();
      draw();
    });

    // --- Drag: set custom drag image from the piece canvas ---
    tile.addEventListener("dragstart", (e) => {
      if (!available || !isMyTurn()) { e.preventDefault(); return; }
      selectedPieceId = p.id;
      e.dataTransfer.setData("text/plain", p.id);
      e.dataTransfer.effectAllowed = "move";

      // Use the piece canvas as the drag image (shows the piece shape)
      e.dataTransfer.setDragImage(c, c.width / 2, c.height / 2);

      setError("");
      draw();
    });

    pieceRack.appendChild(tile);
  }

  if (!state?.started) rackHint.textContent = "Join room → Start game.";
  else if (isMyTurn()) rackHint.textContent = "Dbl-click=rotate • Triple-click=flip • Drag to place.";
  else rackHint.textContent = "Waiting for your turn.";
}

function drawPiecePreview(canvasEl, cells, fillStyle) {
  const g = canvasEl.getContext("2d");
  g.clearRect(0, 0, canvasEl.width, canvasEl.height);

  // Draw background (needed for visible drag ghost)
  const isDark = document.body.classList.contains("dark-theme");
  g.fillStyle = isDark ? "#0b101a" : "#e8ecf2";
  g.fillRect(0, 0, canvasEl.width, canvasEl.height);

  if (!cells.length) return;

  const UNIT = 12;

  const xs = cells.map(c => c[0]);
  const ys = cells.map(c => c[1]);
  const w = Math.max(...xs) + 1;
  const h = Math.max(...ys) + 1;

  const shapeW = w * UNIT;
  const shapeH = h * UNIT;

  const offsetX = Math.floor((canvasEl.width - shapeW) / 2);
  const offsetY = Math.floor((canvasEl.height - shapeH) / 2);

  g.fillStyle = fillStyle;
  for (const [x, y] of cells) {
    g.fillRect(offsetX + x * UNIT, offsetY + y * UNIT, UNIT, UNIT);
  }

  // Subtle grid lines on piece cells (like original)
  g.strokeStyle = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.15)";
  g.lineWidth = 1;
  for (const [x, y] of cells) {
    g.strokeRect(offsetX + x * UNIT, offsetY + y * UNIT, UNIT, UNIT);
  }
}

const lobbyView = document.getElementById("lobbyView");
const inRoomView = document.getElementById("inRoomView");
const newRoomInput = document.getElementById("newRoomInput");
const createRoomBtn = document.getElementById("createRoomBtn");
const roomListContainer = document.getElementById("roomListContainer");
const leaveBtn = document.getElementById("leaveBtn");

// --- UI sync & View Switching ---
function showLobby() {
  lobbyView.style.display = "block";
  inRoomView.style.display = "none";
  roomId = null;
  state = null;
  draw();
  socket.emit("get_rooms");
}

function showRoom() {
  lobbyView.style.display = "none";
  inRoomView.style.display = "block";
}

function updateUI() {
  if (!state) return;

  playersList.innerHTML = "";
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    const row = document.createElement("div");
    row.className = "playerRow";

    const left = document.createElement("div");
    left.textContent = `${p.name}`;

    const badge = document.createElement("span");
    badge.className = "badge";
    const turnMark = (state.started && state.turn === i) ? " • TURN" : "";
    badge.textContent = `P${p.colorIndex + 1}${turnMark}`;

    row.appendChild(left);
    row.appendChild(badge);
    playersList.appendChild(row);
  }

  const me = myPlayer();
  spectator = !me && spectator;

  if (me) {
    myColorIndex = me.colorIndex;
    roomStatus.textContent = `Room: ${roomId} (P${me.colorIndex + 1})`;
  } else {
    roomStatus.textContent = `Room: ${roomId} ` + (spectator ? "(Spectating)" : "");
  }

  if (!state.started) {
    turnHint.textContent = "Game not started.";
  } else {
    const cur = state.players[state.turn];
    turnHint.textContent = isMyTurn()
      ? "Your turn: click to place."
      : `Waiting: ${cur?.name}'s turn.`;
  }

  renderRack();
  draw();
}

// --- Keyboard transforms (no UI buttons) ---
window.addEventListener("keydown", (e) => {
  const key = (e.key || "").toLowerCase();
  if (!state?.started) return;
  if (!isMyTurn()) return;
  if (!localRemaining.has(selectedPieceId)) return;

  if (key === "r") {
    const count = ORIS[selectedPieceId]?.length || 1;
    orientationIndex = (orientationIndex + 1) % count;
    setError("");
    draw();
  } else if (key === "f") {
    const list = ORIS[selectedPieceId] || [];
    if (list.length > 1) {
      orientationIndex = (orientationIndex + Math.max(1, Math.floor(list.length / 2))) % list.length;
      setError("");
      draw();
    }
  } else if (key === "escape") {
    orientationIndex = 0;
    setError("");
    draw();
  }
});

// --- Socket lifecycle ---
socket.on("connect", () => {
  mySocketId = socket.id;
  netInfo.textContent = "Connected";
  netInfo.style.color = "#9bffb2";

  // Auto-reconnect: restore session from localStorage
  const savedName = localStorage.getItem("blokus-name");
  const savedRoom = localStorage.getItem("blokus-room");
  if (savedName) {
    nameInput.value = savedName;
    socket.emit("register_name", { name: savedName });
    // After registration, rejoin the room
    if (savedRoom) {
      roomId = savedRoom;
      const token = rejoinTokens[savedRoom] || null;
      // Use a small delay to ensure registration completes first
      setTimeout(() => socket.emit("rejoin_room", { roomId: savedRoom, token }), 100);
    }
  }
});

socket.on("disconnect", () => {
  netInfo.textContent = "Disconnected";
  netInfo.style.color = "";
});

socket.on("need_name", ({ message }) => setError(message));

socket.on("error_msg", ({ message, code }) => {
  if (code === "PLACE_MOVE_REJECTED" && pendingPlacedPieceId) {
    localRemaining.add(pendingPlacedPieceId);
    pendingPlacedPieceId = null;
  }
  renderRack();
  setError(message);
});

socket.on("rejoin_token", ({ roomId: tokenRoomId, token }) => {
  if (!tokenRoomId || !token) return;
  rejoinTokens[tokenRoomId] = token;
  saveRejoinTokens();
});

socket.on("registered", ({ name }) => {
  idStatus.textContent = `Name saved: "${name}"`;
  setError("");
  // Persist name
  localStorage.setItem("blokus-name", name);
});

socket.on("room_list", (rooms) => {
  roomListContainer.innerHTML = "";
  if (rooms.length === 0) {
    roomListContainer.innerHTML = `<div class="hint">No active rooms.</div>`;
    return;
  }

  rooms.forEach(r => {
    const row = document.createElement("div");
    row.className = "playerRow";

    const info = document.createElement("div");
    info.textContent = `${r.id} (${r.playerCount}/4 players) ${r.started ? '[Started]' : ''}`;

    const joinBtnRow = document.createElement("button");
    joinBtnRow.className = "btn";
    joinBtnRow.style.padding = "6px 12px";
    joinBtnRow.textContent = "Join";
    joinBtnRow.onclick = () => {
      roomId = r.id;
      socket.emit("join_room", { roomId: r.id });
    };

    row.appendChild(info);
    row.appendChild(joinBtnRow);
    roomListContainer.appendChild(row);
  });
});

socket.on("room_state", ({ roomId: incomingRoomId, state: newState, spectator: spec }) => {
  if (incomingRoomId) {
    roomId = incomingRoomId;
    // Persist current room
    localStorage.setItem("blokus-room", roomId);
  }
  state = newState;
  pendingPlacedPieceId = null;
  if (typeof spec === "boolean") spectator = spec;

  if (state.started && state.board.flat().every(v => v === 0)) {
    resetLocalRemaining();
  }

  showRoom();
  updateUI();
});

// --- Buttons ---
saveNameBtn.addEventListener("click", () => {
  setError("");
  socket.emit("register_name", { name: nameInput.value });
});

createRoomBtn.addEventListener("click", () => {
  const newName = newRoomInput.value.trim();
  if (!newName) return setError("Enter a room name.");
  roomId = newName;
  socket.emit("join_room", { roomId });
});

leaveBtn.addEventListener("click", () => {
  if (roomId) socket.emit("leave_room", { roomId });
  // Clear saved room on explicit leave
  if (roomId) {
    delete rejoinTokens[roomId];
    saveRejoinTokens();
  }
  localStorage.removeItem("blokus-room");
  showLobby();
});

startBtn.addEventListener("click", () => {
  if (!roomId) return setError("You are not in a room.");
  setError("");
  socket.emit("start_game", { roomId });
});

// --- Theme toggle ---
themeToggleBtn.addEventListener("click", () => {
  const body = document.body;
  body.classList.toggle("dark-theme");
  const isDark = body.classList.contains("dark-theme");
  localStorage.setItem("blokus-theme", isDark ? "dark" : "light");
  themeToggleBtn.textContent = isDark ? "🌗" : "☀️";
  draw();
  renderRack();
});

// Init theme (Light is default now)
if (localStorage.getItem("blokus-theme") === "dark") {
  document.body.classList.add("dark-theme");
  themeToggleBtn.textContent = "🌗";
} else {
  themeToggleBtn.textContent = "☀️";
}

// --- Board hover + DnD ---
canvas.addEventListener("mousemove", (e) => {
  hoverCell = getBoardCellFromPointer(e.clientX, e.clientY);
  draw();
});

canvas.addEventListener("mouseleave", () => {
  hoverCell = { x: -1, y: -1 };
  draw();
});

// Click-to-place support
canvas.addEventListener("click", (e) => {
  if (!state?.started || !isMyTurn()) return;
  if (!localRemaining.has(selectedPieceId)) return;

  const { x: ax, y: ay } = getBoardCellFromPointer(e.clientX, e.clientY);

  if (checkLegalMoveLocal(selectedPieceId, orientationIndex, ax, ay)) {
    setError("");
    pendingPlacedPieceId = selectedPieceId;
    socket.emit("place_move", {
      roomId,
      move: { pieceId: selectedPieceId, orientationIndex, x: ax, y: ay }
    });
    localRemaining.delete(selectedPieceId);
    renderRack();
  } else {
    setError("Invalid move location.");
  }
});

// Right-click to rotate
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (!state?.started || !isMyTurn()) return;

  const count = ORIS[selectedPieceId]?.length || 1;
  orientationIndex = (orientationIndex + 1) % count;
  draw();
});

// Mouse wheel to rotate
canvas.addEventListener("wheel", (e) => {
  if (!state?.started || !isMyTurn()) return;
  e.preventDefault();

  const count = ORIS[selectedPieceId]?.length || 1;
  if (e.deltaY > 0) {
    orientationIndex = (orientationIndex + 1) % count;
  } else {
    orientationIndex = (orientationIndex - 1 + count) % count;
  }
  draw();
}, { passive: false });

canvas.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
});

canvas.addEventListener("drop", (e) => {
  e.preventDefault();
  setError("");

  if (!state?.started) return setError("Game not started.");
  if (!isMyTurn()) return setError("Not your turn.");

  const droppedPieceId = e.dataTransfer.getData("text/plain") || selectedPieceId;
  if (!droppedPieceId) return setError("No piece selected.");
  if (!localRemaining.has(droppedPieceId)) return setError("Piece already used.");

  const { x: ax, y: ay } = getBoardCellFromPointer(e.clientX, e.clientY);

  if (checkLegalMoveLocal(droppedPieceId, orientationIndex, ax, ay)) {
    selectedPieceId = droppedPieceId;
    pendingPlacedPieceId = droppedPieceId;

    socket.emit("place_move", {
      roomId,
      move: { pieceId: droppedPieceId, orientationIndex, x: ax, y: ay }
    });

    localRemaining.delete(droppedPieceId);
    renderRack();
  } else {
    setError("Invalid move location.");
  }
});

// bootstrap
renderRack();
draw();
