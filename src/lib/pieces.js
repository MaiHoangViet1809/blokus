export const BOARD_SIZE = 20;

export const COLORS = {
  0: "rgba(0, 0, 0, 0)",
  1: "#5aa9ff",
  2: "#ff4d4d",
  3: "#2ed573",
  4: "#ffa502"
};

export const PIECES = [
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

function normalizeCells(cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells
    .map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
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

export const ORIENTATIONS = Object.fromEntries(
  PIECES.map((piece) => [piece.id, uniqueOrientations(piece.cells)])
);
