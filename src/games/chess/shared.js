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
