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

export const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};

const PIECE_SVG_ASSETS = {
  wp: new URL("./assets/Chess_plt45.svg", import.meta.url).href,
  wn: new URL("./assets/Chess_nlt45.svg", import.meta.url).href,
  wb: new URL("./assets/Chess_blt45.svg", import.meta.url).href,
  wr: new URL("./assets/Chess_rlt45.svg", import.meta.url).href,
  wq: new URL("./assets/Chess_qlt45.svg", import.meta.url).href,
  wk: new URL("./assets/Chess_klt45.svg", import.meta.url).href,
  bp: new URL("./assets/Chess_pdt45.svg", import.meta.url).href,
  bn: new URL("./assets/Chess_ndt45.svg", import.meta.url).href,
  bb: new URL("./assets/Chess_bdt45.svg", import.meta.url).href,
  br: new URL("./assets/Chess_rdt45.svg", import.meta.url).href,
  bq: new URL("./assets/Chess_qdt45.svg", import.meta.url).href,
  bk: new URL("./assets/Chess_kdt45.svg", import.meta.url).href
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

export function pieceSvgAsset(piece) {
  return piece ? (PIECE_SVG_ASSETS[piece] || "") : "";
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
