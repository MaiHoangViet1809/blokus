export const BOARD_SIZE = 20;

export const COLORS = {
  0: "rgba(0, 0, 0, 0)",
  1: "#5aa9ff",
  2: "#ff4d4d",
  3: "#2ed573",
  4: "#ffa502"
};

export function buildStartCorners(boardSize = BOARD_SIZE) {
  return [
    [0, 0],
    [boardSize - 1, 0],
    [boardSize - 1, boardSize - 1],
    [0, boardSize - 1]
  ];
}

export function buildPlayerColors(boardSize = BOARD_SIZE) {
  const startCorners = buildStartCorners(boardSize);
  return [
    { colorIndex: 0, name: "Blue", fill: COLORS[1], shortCorner: "TL", cornerLabel: "Top-left", start: startCorners[0] },
    { colorIndex: 1, name: "Red", fill: COLORS[2], shortCorner: "TR", cornerLabel: "Top-right", start: startCorners[1] },
    { colorIndex: 2, name: "Green", fill: COLORS[3], shortCorner: "BR", cornerLabel: "Bottom-right", start: startCorners[2] },
    { colorIndex: 3, name: "Orange", fill: COLORS[4], shortCorner: "BL", cornerLabel: "Bottom-left", start: startCorners[3] }
  ];
}

export const START_CORNERS = buildStartCorners();
export const PLAYER_COLORS = buildPlayerColors();

const BASE_PIECES = [
  { id: "mono", label: "Mono", cells: [[0, 0]] },
  { id: "domino", label: "Domino", cells: [[0, 0], [1, 0]] },
  { id: "tromino_I", label: "I3", cells: [[0, 0], [1, 0], [2, 0]] },
  { id: "tromino_L", label: "V3", cells: [[0, 0], [0, 1], [1, 0]] },
  { id: "tetromino_I", label: "I4", cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { id: "tetromino_O", label: "O4", cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "tetromino_T", label: "T4", cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  { id: "tetromino_L", label: "L4", cells: [[0, 0], [0, 1], [0, 2], [1, 0]] },
  { id: "tetromino_S", label: "Z4", cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { id: "pentomino_F", label: "F", cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 2]] },
  { id: "pentomino_I", label: "I", cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
  { id: "pentomino_L", label: "L", cells: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0]] },
  { id: "pentomino_P", label: "P", cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]] },
  { id: "pentomino_N", label: "N", cells: [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1]] },
  { id: "pentomino_T", label: "T", cells: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]] },
  { id: "pentomino_U", label: "U", cells: [[0, 0], [0, 1], [1, 1], [2, 0], [2, 1]] },
  { id: "pentomino_V", label: "V", cells: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]] },
  { id: "pentomino_W", label: "W", cells: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]] },
  { id: "pentomino_X", label: "X", cells: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]] },
  { id: "pentomino_Y", label: "Y", cells: [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1]] },
  { id: "pentomino_Z", label: "Z", cells: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]] }
];

function normalizeCells(cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells
    .map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
}

function rotate90([x, y]) {
  return [y, -x];
}

function flipX([x, y]) {
  return [-x, y];
}

function signature(cells) {
  return normalizeCells(cells).map(([x, y]) => `${x}:${y}`).join("|");
}

function uniqueOrientations(baseCells) {
  const seen = new Set();
  const variants = [];
  let current = baseCells.map((cell) => [...cell]);
  for (let i = 0; i < 4; i += 1) {
    const sig = signature(current);
    if (!seen.has(sig)) {
      seen.add(sig);
      variants.push(normalizeCells(current));
    }
    current = current.map(rotate90);
  }
  current = baseCells.map(flipX);
  for (let i = 0; i < 4; i += 1) {
    const sig = signature(current);
    if (!seen.has(sig)) {
      seen.add(sig);
      variants.push(normalizeCells(current));
    }
    current = current.map(rotate90);
  }
  return variants;
}

function canonicalSignature(cells) {
  return uniqueOrientations(cells)
    .map((variant) => variant.map(([x, y]) => `${x}:${y}`).join("|"))
    .sort()[0];
}

function buildPreview(cells) {
  const normalized = normalizeCells(cells);
  const width = Math.max(...normalized.map(([x]) => x)) + 1;
  const height = Math.max(...normalized.map(([, y]) => y)) + 1;
  return { cells: normalized, width, height };
}

const seenCatalogShapes = new Map();
const BASE_PIECE_LOOKUP = new Map(BASE_PIECES.map((piece) => [piece.id, piece]));

export const PIECES = BASE_PIECES.map((piece) => {
  const preview = buildPreview(piece.cells);
  const key = canonicalSignature(piece.cells);
  if (seenCatalogShapes.has(key)) {
    throw new Error(`Duplicate base Blokus shape detected: ${piece.id} duplicates ${seenCatalogShapes.get(key)}`);
  }
  seenCatalogShapes.set(key, piece.id);
  return {
    id: piece.id,
    label: piece.label,
    cells: preview.cells,
    previewWidth: preview.width,
    previewHeight: preview.height
  };
});

export const ORIENTATIONS = Object.fromEntries(
  PIECES.map((piece) => [piece.id, uniqueOrientations(piece.cells)])
);

export const PIECE_CELL_COUNTS = Object.fromEntries(
  PIECES.map((piece) => [piece.id, piece.cells.length])
);

export const ALL_PIECE_IDS = PIECES.map((piece) => piece.id);

function transformCells(cells, rotation, flipped) {
  let current = cells.map((cell) => [...cell]);
  if (flipped) {
    current = current.map(flipX);
  }
  for (let index = 0; index < rotation; index += 1) {
    current = current.map(rotate90);
  }
  return normalizeCells(current);
}

export function resolvePieceTransform(pieceId, rotation = 0, flipped = false) {
  const piece = BASE_PIECE_LOOKUP.get(pieceId);
  if (!piece) {
    return { cells: [], orientationIndex: 0 };
  }
  const normalizedRotation = ((rotation % 4) + 4) % 4;
  const cells = transformCells(piece.cells, normalizedRotation, flipped);
  const transformedSignature = signature(cells);
  const orientationIndex = (ORIENTATIONS[pieceId] || []).findIndex((variant) => signature(variant) === transformedSignature);
  return {
    cells,
    orientationIndex: orientationIndex >= 0 ? orientationIndex : 0
  };
}
