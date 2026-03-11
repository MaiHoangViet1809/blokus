export const CHESS_GAME_TYPE = "chess";
export const CHESS_BOARD_SIZE = 8;

export const CHESS_RULESETS = {
  standard_2p: {
    ruleset: "standard_2p",
    boardSize: CHESS_BOARD_SIZE,
    maxPlayers: 2,
    modeLabel: "Standard 2P"
  }
};

export const SIDE_OPTIONS = [
  {
    colorIndex: 0,
    side: "white",
    name: "White",
    fill: "#f8fafc",
    textFill: "#0f172a",
    turnNote: "Moves first"
  },
  {
    colorIndex: 1,
    side: "black",
    name: "Black",
    fill: "#475569",
    textFill: "#f8fafc",
    turnNote: "Moves second"
  }
];

export const FILE_LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"];
export const RANK_LABELS = ["8", "7", "6", "5", "4", "3", "2", "1"];

export const PIECE_GLYPHS = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚"
};

export const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};

const PIECE_SVG_TEMPLATES = {
  p: `
    <circle cx="32" cy="18" r="7" />
    <path d="M24 30c0-6 4.5-10 8-10s8 4 8 10c0 3-1.2 5.6-3.4 8.4H42v6H22v-6h5.4C25.2 35.6 24 33 24 30Z" />
    <rect x="18" y="47" width="28" height="5" rx="2.2" />
    <rect x="14" y="54" width="36" height="5" rx="2.5" />
  `,
  r: `
    <path d="M18 14h6v6h4v-6h8v6h4v-6h6v10H18Z" />
    <path d="M22 26h20v15H22Z" />
    <path d="M20 43h24v5H20Z" />
    <path d="M16 51h32v8H16Z" />
  `,
  n: `
    <path d="M22 54h24v5H22Z" />
    <path d="M24 49h18l2 5H20Z" />
    <path d="M22 46c0-10 4-17 11-23l4-3 5 3-3 6 3 4-2 14H22Z" />
    <circle cx="36" cy="28" r="1.8" fill="rgba(0,0,0,0.28)" />
  `,
  b: `
    <path d="M31 12h2l3 4-3 4h-2l-3-4Z" />
    <path d="M26 28c0-4 2.6-7 6-7s6 3 6 7c0 2.8-1.2 5.4-3.4 8.4H40v6H24v-6h5.4C27.2 33.4 26 30.8 26 28Z" />
    <path d="M30 18l4 7-4 7-4-7Z" />
    <rect x="18" y="47" width="28" height="5" rx="2.2" />
    <rect x="14" y="54" width="36" height="5" rx="2.5" />
  `,
  q: `
    <circle cx="20" cy="18" r="3.2" />
    <circle cx="32" cy="14" r="3.2" />
    <circle cx="44" cy="18" r="3.2" />
    <path d="M20 22l4 14h16l4-14-8 6-4-8-4 8Z" />
    <path d="M24 38h16l3 8H21Z" />
    <rect x="18" y="47" width="28" height="5" rx="2.2" />
    <rect x="14" y="54" width="36" height="5" rx="2.5" />
  `,
  k: `
    <path d="M30 10h4v6h6v4h-6v6h-4v-6h-6v-4h6Z" />
    <path d="M26 28c0-4 2.6-7 6-7s6 3 6 7c0 2.8-1.2 5.4-3.4 8.4H40v6H24v-6h5.4C27.2 33.4 26 30.8 26 28Z" />
    <rect x="18" y="47" width="28" height="5" rx="2.2" />
    <rect x="14" y="54" width="36" height="5" rx="2.5" />
  `
};

export function buildChessConfig(config = {}) {
  const requestedRuleset = String(config?.ruleset || "standard_2p").trim();
  return CHESS_RULESETS[requestedRuleset] || CHESS_RULESETS.standard_2p;
}

export function sideMeta(colorIndex) {
  return SIDE_OPTIONS[colorIndex] || SIDE_OPTIONS[0];
}

export function pieceColor(piece) {
  return piece ? piece[0] : null;
}

export function pieceType(piece) {
  return piece ? piece[1] : null;
}

export function oppositeColor(color) {
  return color === "w" ? "b" : "w";
}

export function makeInitialBoard() {
  return [
    ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"],
    ["bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp"],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ["wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp"],
    ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"]
  ];
}

export function emptyBoard() {
  return Array.from({ length: CHESS_BOARD_SIZE }, () => Array(CHESS_BOARD_SIZE).fill(null));
}

export function initialPieceCounts() {
  return {
    w: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
    b: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 }
  };
}

export function squareName(x, y) {
  return `${FILE_LABELS[x]}${CHESS_BOARD_SIZE - y}`;
}

export function pieceSvgMarkup(piece) {
  if (!piece) return "";
  const template = PIECE_SVG_TEMPLATES[piece[1]];
  if (!template) return "";
  return `
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g class="piece-svg__shape">${template}</g>
    </svg>
  `;
}

function pieceLetter(piece) {
  const type = piece?.[1];
  if (type === "n") return "N";
  if (["b", "r", "q", "k"].includes(type)) return type.toUpperCase();
  return "";
}

function pieceColorCode(piece) {
  return piece?.[0] || "";
}

function moveLabelFromFrame(frame, previousBoard) {
  const payload = frame?.payload || {};
  if (payload.castle === "king") return "O-O";
  if (payload.castle === "queen") return "O-O-O";
  const from = payload.from;
  const to = payload.to;
  const movingPiece = from ? previousBoard?.[from.y]?.[from.x] : null;
  if (!movingPiece || !to) return frame?.label || "Move";
  const captureMark = payload.capture ? "x" : "";
  const promotionMark = payload.promotion ? `=${String(payload.promotion).charAt(0).toUpperCase()}` : "";
  const checkMark = payload.termination === "checkmate" ? "#" : payload.termination === "check" ? "+" : "";
  const fromFile = FILE_LABELS[from.x];
  const toSquare = squareName(to.x, to.y);
  const prefix = pieceLetter(movingPiece);
  if (movingPiece[1] === "p") {
    return `${payload.capture ? fromFile : ""}${captureMark}${toSquare}${promotionMark}${checkMark}`;
  }
  return `${prefix}${captureMark}${toSquare}${promotionMark}${checkMark}`;
}

export function buildMoveRowsFromFrames(frames = []) {
  const moveFrames = frames.filter((frame) => frame.eventType === "move_made");
  const rows = [];
  moveFrames.forEach((frame, index) => {
    const previousFrame = frames[frames.indexOf(frame) - 1];
    const san = moveLabelFromFrame(frame, previousFrame?.board);
    const color = pieceColorCode(previousFrame?.board?.[frame.payload?.from?.y]?.[frame.payload?.from?.x]) || (index % 2 === 0 ? "w" : "b");
    const moveNumber = Math.floor(index / 2) + 1;
    if (color === "w" || !rows.length) {
      rows.push({
        moveNumber,
        white: { label: san, frameStep: frame.step },
        black: null
      });
      return;
    }
    rows[rows.length - 1].black = { label: san, frameStep: frame.step };
  });
  return rows;
}
