const socket = io();

const netInfo = document.getElementById("netInfo");
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
  0: "#0e1420",
  1: "#5aa9ff",
  2: "#ff6b6b",
  3: "#6bff95",
  4: "#ffd36b"
};

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

// --- orientation utils (same logic as server) ---
function normalizeCells(cells) {
  const xs = cells.map(c => c[0]);
  const ys = cells.map(c => c[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const shifted = cells.map(([x,y]) => [x-minX, y-minY]);
  shifted.sort((a,b) => (a[0]-b[0]) || (a[1]-b[1]));
  return shifted;
}
function rotate90([x,y]) { return [y, -x]; }
function flipX([x,y]) { return [-x, y]; }
function signature(cells) {
  return normalizeCells(cells).map(([x,y]) => `${x}:${y}`).join("|");
}
function generateUniqueOrientations(baseCells) {
  const seen = new Set();
  const variants = [];
  let cur = baseCells.map(c => [...c]);
  for (let r=0;r<4;r++){
    const sig = signature(cur);
    if (!seen.has(sig)) { seen.add(sig); variants.push(normalizeCells(cur)); }
    cur = cur.map(rotate90);
  }
  cur = baseCells.map(flipX);
  for (let r=0;r<4;r++){
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

let hoverCell = { x: -1, y: -1 };

// MVP local remaining
let localRemaining = new Set(PIECES.map(p => p.id));

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

// --- Board drawing ---
function drawGrid() {
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let i=0;i<=BOARD_SIZE;i++){
    const p = i*CELL;
    ctx.beginPath(); ctx.moveTo(p,0); ctx.lineTo(p,canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,p); ctx.lineTo(canvas.width,p); ctx.stroke();
  }
}

function drawStartCorners() {
  const corners = [
    [0,0], [BOARD_SIZE-1,0], [BOARD_SIZE-1,BOARD_SIZE-1], [0,BOARD_SIZE-1]
  ];
  ctx.globalAlpha = 0.25;
  for (let i=0;i<corners.length;i++){
    const [x,y] = corners[i];
    ctx.fillStyle = COLORS[i+1];
    ctx.fillRect(x*CELL, y*CELL, CELL, CELL);
  }
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if (!state) {
    drawGrid();
    return;
  }

  for (let y=0;y<BOARD_SIZE;y++){
    for (let x=0;x<BOARD_SIZE;x++){
      const v = state.board[y][x];
      ctx.fillStyle = COLORS[v] || COLORS[0];
      ctx.fillRect(x*CELL, y*CELL, CELL, CELL);
    }
  }

  drawGrid();
  drawStartCorners();

  if (isMyTurn() && localRemaining.has(selectedPieceId) && hoverCell.x >= 0 && hoverCell.y >= 0) {
    const ori = ORIS[selectedPieceId]?.[orientationIndex] || [];
    ctx.globalAlpha = 0.55;
    const colorVal = (myColorIndex ?? 0) + 1;
    ctx.fillStyle = COLORS[colorVal] || "#ffffff";
    for (const [dx,dy] of ori) {
      const ax = hoverCell.x + dx;
      const ay = hoverCell.y + dy;
      if (ax>=0 && ay>=0 && ax<BOARD_SIZE && ay<BOARD_SIZE) {
        ctx.fillRect(ax*CELL, ay*CELL, CELL, CELL);
      }
    }
    ctx.globalAlpha = 1;
  }
}

// --- Rack rendering (unique orientation per piece; unit tile size constant) ---
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

    // rack shows unique orientation only (index 0)
    drawPiecePreview(c, ORIS[p.id]?.[0] || [], fill);

    const label = document.createElement("div");
    label.className = "pieceLabel";
    label.textContent = p.id;

    tile.appendChild(c);
    tile.appendChild(label);

    tile.addEventListener("click", () => {
      if (!available) return;
      selectedPieceId = p.id;
      orientationIndex = 0;
      setError("");
      renderRack();
      draw();
    });

    tile.addEventListener("dragstart", (e) => {
      if (!available || !isMyTurn()) { e.preventDefault(); return; }
      selectedPieceId = p.id;
      e.dataTransfer.setData("text/plain", p.id);
      e.dataTransfer.effectAllowed = "move";
      setError("");
      renderRack();
      draw();
    });

    pieceRack.appendChild(tile);
  }

  if (!state?.started) rackHint.textContent = "Join room → Start game.";
  else if (isMyTurn()) rackHint.textContent = "R=rotate • F=flip • Esc=reset • Drag-drop to place.";
  else rackHint.textContent = "Waiting for your turn.";
}

function drawPiecePreview(canvasEl, cells, fillStyle) {
  const g = canvasEl.getContext("2d");
  g.clearRect(0,0,canvasEl.width,canvasEl.height);

  g.fillStyle = "#0b101a";
  g.fillRect(0,0,canvasEl.width,canvasEl.height);

  if (!cells.length) return;

  // CONSTANT unit tile size (all pieces use same square size)
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
  for (const [x,y] of cells) {
    g.fillRect(offsetX + x*UNIT, offsetY + y*UNIT, UNIT, UNIT);
  }

  g.strokeStyle = "rgba(255,255,255,0.10)";
  g.lineWidth = 1;
  for (const [x,y] of cells) {
    g.strokeRect(offsetX + x*UNIT, offsetY + y*UNIT, UNIT, UNIT);
  }
}

// --- UI sync ---
function updateUI() {
  if (!state) return;

  playersList.innerHTML = "";
  for (let i=0;i<state.players.length;i++){
    const p = state.players[i];
    const row = document.createElement("div");
    row.className = "playerRow";

    const left = document.createElement("div");
    left.textContent = `${p.name}`;

    const badge = document.createElement("span");
    badge.className = "badge";
    const turnMark = (state.started && state.turn === i) ? " • TURN" : "";
    badge.textContent = `P${p.colorIndex+1}${turnMark}`;

    row.appendChild(left);
    row.appendChild(badge);
    playersList.appendChild(row);
  }

  const me = myPlayer();
  spectator = !me && spectator;

  if (me) {
    myColorIndex = me.colorIndex;
    roomStatus.textContent = `Joined as P${me.colorIndex+1}`;
  } else {
    roomStatus.textContent = spectator ? "Spectating" : "Not joined";
  }

  if (!state.started) {
    turnHint.textContent = "Game not started.";
  } else {
    const cur = state.players[state.turn];
    turnHint.textContent = isMyTurn()
      ? "Your turn: drag a piece onto the board."
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
});

socket.on("disconnect", () => {
  netInfo.textContent = "Disconnected";
  netInfo.style.color = "";
});

socket.on("need_name", ({ message }) => setError(message));

socket.on("error_msg", ({ message }) => {
  if (selectedPieceId) localRemaining.add(selectedPieceId);
  renderRack();
  setError(message);
});

socket.on("registered", ({ ip, name }) => {
  idStatus.textContent = `Name "${name}" bound to IP ${ip}`;
  setError("");
});

socket.on("room_state", ({ state: newState, spectator: spec }) => {
  state = newState;
  if (typeof spec === "boolean") spectator = spec;

  if (state.started && state.board.flat().every(v => v===0)) {
    resetLocalRemaining();
  }

  updateUI();
});

// --- Buttons ---
saveNameBtn.addEventListener("click", () => {
  setError("");
  socket.emit("register_name", { name: nameInput.value });
});

joinBtn.addEventListener("click", () => {
  setError("");
  socket.emit("join_room", { roomId });
});

startBtn.addEventListener("click", () => {
  setError("");
  socket.emit("start_game", { roomId });
});

// --- Board hover + DnD ---
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * BOARD_SIZE);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * BOARD_SIZE);
  hoverCell = { x, y };
  draw();
});

canvas.addEventListener("mouseleave", () => {
  hoverCell = { x: -1, y: -1 };
  draw();
});

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

  const rect = canvas.getBoundingClientRect();
  const cx = Math.floor(((e.clientX - rect.left) / rect.width) * BOARD_SIZE);
  const cy = Math.floor(((e.clientY - rect.top) / rect.height) * BOARD_SIZE);

  selectedPieceId = droppedPieceId;

  socket.emit("place_move", {
    roomId,
    move: { pieceId: droppedPieceId, orientationIndex, x: cx, y: cy }
  });

  localRemaining.delete(droppedPieceId);
  renderRack();
});

// bootstrap
renderRack();
draw();