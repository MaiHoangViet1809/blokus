import {
  CHESS_GAME_TYPE,
  CHESS_RULESETS,
  PIECE_VALUES,
  SIDE_OPTIONS,
  buildChessConfig,
  initialPieceCounts,
  makeInitialBoard,
  oppositeColor,
  pieceColor,
  pieceType,
  sideMeta,
  squareName
} from "./shared.js";

export { CHESS_GAME_TYPE };

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function createInitialState() {
  return {
    board: makeInitialBoard(),
    castling: {
      whiteKingSide: true,
      whiteQueenSide: true,
      blackKingSide: true,
      blackQueenSide: true
    },
    enPassant: null,
    lastMove: null,
    halfmoveClock: 0,
    fullmoveNumber: 1
  };
}

function parseState(boardJson) {
  const state = parseJson(boardJson, createInitialState());
  return {
    board: Array.isArray(state.board) ? state.board : makeInitialBoard(),
    castling: {
      whiteKingSide: state.castling?.whiteKingSide !== false,
      whiteQueenSide: state.castling?.whiteQueenSide !== false,
      blackKingSide: state.castling?.blackKingSide !== false,
      blackQueenSide: state.castling?.blackQueenSide !== false
    },
    enPassant: state.enPassant || null,
    lastMove: state.lastMove || null,
    halfmoveClock: Number.isInteger(state.halfmoveClock) ? state.halfmoveClock : 0,
    fullmoveNumber: Number.isInteger(state.fullmoveNumber) ? state.fullmoveNumber : 1
  };
}

function serializeState(state) {
  return JSON.stringify(state);
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < 8 && y < 8;
}

function colorFromIndex(colorIndex) {
  return colorIndex === 0 ? "w" : "b";
}

function colorIndexFromCode(color) {
  return color === "w" ? 0 : 1;
}

function playerSideLabel(colorIndex) {
  return sideMeta(colorIndex).name;
}

function normalizeSetupMember(member) {
  const meta = sideMeta(member.chosen_color_index ?? member.seat_index ?? 0);
  return {
    profileId: member.profile_id,
    name: member.name,
    seatIndex: member.seat_index,
    colorIndex: member.chosen_color_index ?? member.seat_index ?? 0,
    colorName: meta.name,
    colorFill: meta.fill,
    sideLabel: meta.name,
    sideNote: meta.turnNote,
    isReady: !!member.is_ready,
    isHost: !!member.isHost,
    connectionState: member.connection_state
  };
}

function projectMatchPlayers(players) {
  return players.map((player) => {
    const meta = sideMeta(player.color_index);
    return {
      profileId: player.profile_id,
      name: player.name,
      colorIndex: player.color_index,
      colorName: meta.name,
      colorFill: meta.fill,
      textFill: meta.textFill,
      sideLabel: meta.name,
      seatIndex: player.seat_index,
      disconnected: !!player.disconnected,
      endState: player.end_state,
      score: player.score
    };
  });
}

function boardMaterial(board) {
  const counts = initialPieceCounts();
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const piece = board[y][x];
      if (!piece) continue;
      const color = pieceColor(piece);
      const type = pieceType(piece);
      counts[color][type] -= 1;
    }
  }
  return counts;
}

function capturedPieces(board) {
  const missing = boardMaterial(board);
  return {
    white: Object.entries(missing.b).flatMap(([type, count]) => Array.from({ length: count }, () => `b${type}`)),
    black: Object.entries(missing.w).flatMap(([type, count]) => Array.from({ length: count }, () => `w${type}`))
  };
}

function scoreBoard(board) {
  let white = 0;
  let black = 0;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const piece = board[y][x];
      if (!piece) continue;
      const value = PIECE_VALUES[pieceType(piece)] || 0;
      if (pieceColor(piece) === "w") white += value;
      else black += value;
    }
  }
  return { white, black };
}

function findKing(board, color) {
  const target = `${color}k`;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      if (board[y][x] === target) return [x, y];
    }
  }
  return null;
}

function isSquareAttacked(board, x, y, byColor) {
  const pawnDirection = byColor === "w" ? -1 : 1;
  for (const dx of [-1, 1]) {
    const px = x - dx;
    const py = y - pawnDirection;
    if (inBounds(px, py) && board[py][px] === `${byColor}p`) return true;
  }

  const knightOffsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  for (const [dx, dy] of knightOffsets) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(nx, ny) && board[ny][nx] === `${byColor}n`) return true;
  }

  const bishopDirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const [dx, dy] of bishopDirs) {
    let nx = x + dx;
    let ny = y + dy;
    while (inBounds(nx, ny)) {
      const piece = board[ny][nx];
      if (piece) {
        if (pieceColor(piece) === byColor && ["b", "q"].includes(pieceType(piece))) return true;
        break;
      }
      nx += dx;
      ny += dy;
    }
  }

  const rookDirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of rookDirs) {
    let nx = x + dx;
    let ny = y + dy;
    while (inBounds(nx, ny)) {
      const piece = board[ny][nx];
      if (piece) {
        if (pieceColor(piece) === byColor && ["r", "q"].includes(pieceType(piece))) return true;
        break;
      }
      nx += dx;
      ny += dy;
    }
  }

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (inBounds(nx, ny) && board[ny][nx] === `${byColor}k`) return true;
    }
  }

  return false;
}

function isInCheck(state, color) {
  const king = findKing(state.board, color);
  if (!king) return false;
  return isSquareAttacked(state.board, king[0], king[1], oppositeColor(color));
}

function promotePieceCode(color, promotion) {
  const normalized = String(promotion || "").toLowerCase();
  const nextType = ["q", "r", "b", "n"].includes(normalized[0]) ? normalized[0] : null;
  if (!nextType) return null;
  return `${color}${nextType}`;
}

function pushSlidingMoves(board, x, y, color, directions, moves) {
  for (const [dx, dy] of directions) {
    let nx = x + dx;
    let ny = y + dy;
    while (inBounds(nx, ny)) {
      const target = board[ny][nx];
      if (!target) {
        moves.push({ fromX: x, fromY: y, toX: nx, toY: ny, piece: board[y][x] });
      } else {
        if (pieceColor(target) !== color) {
          moves.push({ fromX: x, fromY: y, toX: nx, toY: ny, piece: board[y][x], capture: target });
        }
        break;
      }
      nx += dx;
      ny += dy;
    }
  }
}

function pseudoMovesForPiece(state, x, y) {
  const piece = state.board[y][x];
  if (!piece) return [];
  const color = pieceColor(piece);
  const type = pieceType(piece);
  const moves = [];

  if (type === "p") {
    const direction = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    const promotionRow = color === "w" ? 0 : 7;
    const oneStepY = y + direction;
    if (inBounds(x, oneStepY) && !state.board[oneStepY][x]) {
      moves.push({
        fromX: x,
        fromY: y,
        toX: x,
        toY: oneStepY,
        piece,
        promotionRequired: oneStepY === promotionRow
      });
      const twoStepY = y + (direction * 2);
      if (y === startRow && inBounds(x, twoStepY) && !state.board[twoStepY][x]) {
        moves.push({
          fromX: x,
          fromY: y,
          toX: x,
          toY: twoStepY,
          piece,
          doubleStep: true
        });
      }
    }
    for (const dx of [-1, 1]) {
      const nx = x + dx;
      const ny = y + direction;
      if (!inBounds(nx, ny)) continue;
      const target = state.board[ny][nx];
      if (target && pieceColor(target) !== color) {
        moves.push({
          fromX: x,
          fromY: y,
          toX: nx,
          toY: ny,
          piece,
          capture: target,
          promotionRequired: ny === promotionRow
        });
      } else if (state.enPassant && state.enPassant.x === nx && state.enPassant.y === ny) {
        moves.push({
          fromX: x,
          fromY: y,
          toX: nx,
          toY: ny,
          piece,
          enPassant: true,
          capture: `${oppositeColor(color)}p`
        });
      }
    }
    return moves;
  }

  if (type === "n") {
    const offsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dx, dy] of offsets) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const target = state.board[ny][nx];
      if (!target || pieceColor(target) !== color) {
        moves.push({ fromX: x, fromY: y, toX: nx, toY: ny, piece, capture: target || null });
      }
    }
    return moves;
  }

  if (type === "b") {
    pushSlidingMoves(state.board, x, y, color, [[1, 1], [1, -1], [-1, 1], [-1, -1]], moves);
    return moves;
  }

  if (type === "r") {
    pushSlidingMoves(state.board, x, y, color, [[1, 0], [-1, 0], [0, 1], [0, -1]], moves);
    return moves;
  }

  if (type === "q") {
    pushSlidingMoves(state.board, x, y, color, [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]], moves);
    return moves;
  }

  if (type === "k") {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const target = state.board[ny][nx];
        if (!target || pieceColor(target) !== color) {
          moves.push({ fromX: x, fromY: y, toX: nx, toY: ny, piece, capture: target || null });
        }
      }
    }

    const homeRank = color === "w" ? 7 : 0;
    const inHomeSquare = x === 4 && y === homeRank;
    if (!inHomeSquare || isInCheck(state, color)) return moves;

    if ((color === "w" ? state.castling.whiteKingSide : state.castling.blackKingSide)
      && !state.board[homeRank][5]
      && !state.board[homeRank][6]
      && state.board[homeRank][7] === `${color}r`
      && !isSquareAttacked(state.board, 5, homeRank, oppositeColor(color))
      && !isSquareAttacked(state.board, 6, homeRank, oppositeColor(color))) {
      moves.push({
        fromX: 4,
        fromY: homeRank,
        toX: 6,
        toY: homeRank,
        piece,
        castle: "king"
      });
    }

    if ((color === "w" ? state.castling.whiteQueenSide : state.castling.blackQueenSide)
      && !state.board[homeRank][1]
      && !state.board[homeRank][2]
      && !state.board[homeRank][3]
      && state.board[homeRank][0] === `${color}r`
      && !isSquareAttacked(state.board, 3, homeRank, oppositeColor(color))
      && !isSquareAttacked(state.board, 2, homeRank, oppositeColor(color))) {
      moves.push({
        fromX: 4,
        fromY: homeRank,
        toX: 2,
        toY: homeRank,
        piece,
        castle: "queen"
      });
    }
  }

  return moves;
}

function applyMove(state, move, promotion = "queen") {
  const nextState = {
    ...state,
    board: cloneBoard(state.board),
    castling: { ...state.castling },
    enPassant: null,
    lastMove: null
  };
  const movingPiece = nextState.board[move.fromY][move.fromX];
  const movingColor = pieceColor(movingPiece);
  const targetPiece = nextState.board[move.toY][move.toX];
  nextState.board[move.fromY][move.fromX] = null;

  if (move.enPassant) {
    const capturedY = move.toY + (movingColor === "w" ? 1 : -1);
    nextState.board[capturedY][move.toX] = null;
  }

  if (move.castle === "king") {
    nextState.board[move.toY][move.toX] = movingPiece;
    nextState.board[move.toY][5] = `${movingColor}r`;
    nextState.board[move.toY][7] = null;
  } else if (move.castle === "queen") {
    nextState.board[move.toY][move.toX] = movingPiece;
    nextState.board[move.toY][3] = `${movingColor}r`;
    nextState.board[move.toY][0] = null;
  } else {
    const promotionCode = move.promotionRequired ? promotePieceCode(movingColor, promotion) : null;
    nextState.board[move.toY][move.toX] = promotionCode || movingPiece;
  }

  if (pieceType(movingPiece) === "k") {
    if (movingColor === "w") {
      nextState.castling.whiteKingSide = false;
      nextState.castling.whiteQueenSide = false;
    } else {
      nextState.castling.blackKingSide = false;
      nextState.castling.blackQueenSide = false;
    }
  }

  if (pieceType(movingPiece) === "r") {
    if (movingColor === "w" && move.fromY === 7 && move.fromX === 0) nextState.castling.whiteQueenSide = false;
    if (movingColor === "w" && move.fromY === 7 && move.fromX === 7) nextState.castling.whiteKingSide = false;
    if (movingColor === "b" && move.fromY === 0 && move.fromX === 0) nextState.castling.blackQueenSide = false;
    if (movingColor === "b" && move.fromY === 0 && move.fromX === 7) nextState.castling.blackKingSide = false;
  }

  const capturedPiece = targetPiece || (move.enPassant ? `${oppositeColor(movingColor)}p` : null);
  if (capturedPiece === "wr" && move.toY === 7 && move.toX === 0) nextState.castling.whiteQueenSide = false;
  if (capturedPiece === "wr" && move.toY === 7 && move.toX === 7) nextState.castling.whiteKingSide = false;
  if (capturedPiece === "br" && move.toY === 0 && move.toX === 0) nextState.castling.blackQueenSide = false;
  if (capturedPiece === "br" && move.toY === 0 && move.toX === 7) nextState.castling.blackKingSide = false;

  if (pieceType(movingPiece) === "p" && move.doubleStep) {
    nextState.enPassant = {
      x: move.fromX,
      y: (move.fromY + move.toY) / 2
    };
  }

  const moveLabel = move.castle
    ? (move.castle === "king" ? "O-O" : "O-O-O")
    : `${squareName(move.fromX, move.fromY)}${capturedPiece ? "x" : "-"}${squareName(move.toX, move.toY)}${move.promotionRequired ? `=${(promotion || "q").toUpperCase()[0]}` : ""}`;

  nextState.lastMove = {
    from: { x: move.fromX, y: move.fromY },
    to: { x: move.toX, y: move.toY },
    piece: movingPiece,
    capture: capturedPiece,
    castle: move.castle || null,
    promotion: move.promotionRequired ? (promotion || "queen") : null,
    label: moveLabel
  };
  nextState.halfmoveClock = pieceType(movingPiece) === "p" || capturedPiece ? 0 : state.halfmoveClock + 1;
  nextState.fullmoveNumber = movingColor === "b" ? state.fullmoveNumber + 1 : state.fullmoveNumber;
  return nextState;
}

function legalMovesFromSquare(state, x, y) {
  const piece = state.board[y][x];
  if (!piece) return [];
  const color = pieceColor(piece);
  const pseudoMoves = pseudoMovesForPiece(state, x, y);
  return pseudoMoves.filter((move) => !isInCheck(applyMove(state, move), color));
}

function legalMovesByColor(state, color) {
  const result = {};
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const piece = state.board[y][x];
      if (!piece || pieceColor(piece) !== color) continue;
      const legalMoves = legalMovesFromSquare(state, x, y);
      if (legalMoves.length) {
        result[`${x},${y}`] = legalMoves;
      }
    }
  }
  return result;
}

function insufficientMaterial(board) {
  const nonKings = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const piece = board[y][x];
      if (!piece || pieceType(piece) === "k") continue;
      nonKings.push({ piece, x, y, color: pieceColor(piece), type: pieceType(piece) });
    }
  }
  if (nonKings.length === 0) return true;
  if (nonKings.length === 1) return ["b", "n"].includes(nonKings[0].type);
  if (nonKings.some((entry) => ["p", "q", "r"].includes(entry.type))) return false;
  if (nonKings.length === 2) {
    const [a, b] = nonKings;
    if (a.color !== b.color) return true;
    if (a.type === "n" && b.type === "n") return true;
    if (a.type === "b" && b.type === "n") return false;
    if (a.type === "n" && b.type === "b") return false;
    if (a.type === "b" && b.type === "b") return false;
  }
  return false;
}

function materialScores(board) {
  const totals = scoreBoard(board);
  return {
    white: totals.white - totals.black,
    black: totals.black - totals.white
  };
}

function resolveOutcome(state, nextColor, players) {
  const nextMoves = legalMovesByColor(state, nextColor);
  const nextHasMoves = Object.keys(nextMoves).length > 0;
  const nextInCheck = isInCheck(state, nextColor);

  if (!nextHasMoves) {
    if (nextInCheck) {
      const winnerColorIndex = colorIndexFromCode(oppositeColor(nextColor));
      const winner = players.find((player) => player.color_index === winnerColorIndex) || null;
      return {
        finished: true,
        status: "finished",
        winnerProfileId: winner?.profile_id || null,
        termination: "checkmate"
      };
    }
    return {
      finished: true,
      status: "finished",
      winnerProfileId: null,
      termination: "stalemate"
    };
  }

  if (insufficientMaterial(state.board)) {
    return {
      finished: true,
      status: "finished",
      winnerProfileId: null,
      termination: "insufficient_material"
    };
  }

  return {
    finished: false,
    status: "active",
    winnerProfileId: null,
    termination: nextInCheck ? "check" : "active"
  };
}

function applyPlayerScores(players, board, outcome) {
  const material = materialScores(board);
  return players.map((player) => {
    const color = colorFromIndex(player.color_index);
    let endState = player.end_state === "abandoned" ? "abandoned" : "active";
    let score = material[color === "w" ? "white" : "black"];
    if (outcome.finished) {
      if (outcome.winnerProfileId && player.profile_id === outcome.winnerProfileId) {
        endState = "winner";
        score += 100;
      } else if (outcome.winnerProfileId) {
        endState = "checkmated";
        score -= 100;
      } else {
        endState = "draw";
      }
    }
    return {
      ...player,
      score,
      end_state: endState
    };
  });
}

function normalizeCommandPayload(payload = {}) {
  const from = Array.isArray(payload.from) ? { x: payload.from[0], y: payload.from[1] } : payload.from;
  const to = Array.isArray(payload.to) ? { x: payload.to[0], y: payload.to[1] } : payload.to;
  return {
    fromX: Number(payload.fromX ?? from?.x),
    fromY: Number(payload.fromY ?? from?.y),
    toX: Number(payload.toX ?? to?.x),
    toY: Number(payload.toY ?? to?.y),
    promotion: payload.promotion || null
  };
}

function replayFrameLabel(payload) {
  if (payload.termination === "checkmate") {
    return `${payload.playerName} delivered checkmate`;
  }
  if (payload.termination === "stalemate") {
    return `${payload.playerName} forced stalemate`;
  }
  if (payload.termination === "insufficient_material") {
    return `${payload.playerName} reached insufficient material`;
  }
  return payload.label || "Move";
}

function buildReplay(room, match, players, moves) {
  const winner = players.find((player) => player.profile_id === match.winner_profile_id);
  const frames = [{
    step: 0,
    eventType: "initial",
    label: "Initial position",
    actorName: null,
    board: makeInitialBoard(),
    payload: {}
  }];

  let step = 0;
  for (const move of moves) {
    if (move.eventType !== "move_made") continue;
    step += 1;
    frames.push({
      step,
      eventType: move.eventType,
      label: replayFrameLabel(move.payload),
      actorName: move.playerName,
      board: move.payload.afterBoard,
      payload: move.payload
    });
  }

  return {
    gameType: CHESS_GAME_TYPE,
    ruleset: "standard_2p",
    modeLabel: CHESS_RULESETS.standard_2p.modeLabel,
    boardSize: 8,
    id: match.id,
    roomCode: room.code,
    roomTitle: room.title,
    status: match.status,
    winnerProfileId: match.winner_profile_id,
    winnerName: winner?.name || null,
    createdAt: match.created_at,
    finishedAt: match.finished_at,
    moveCount: frames.length - 1,
    players: players.map((player) => ({
      profileId: player.profile_id,
      name: player.name,
      colorIndex: player.color_index,
      score: player.score,
      endState: player.end_state
    })),
    frames
  };
}

function sideSummary(colorIndex) {
  const meta = sideMeta(colorIndex);
  return {
    colorIndex,
    name: meta.name,
    fill: meta.fill,
    textFill: meta.textFill,
    turnNote: meta.turnNote
  };
}

export function createChessDriver() {
  return {
    gameType: CHESS_GAME_TYPE,
    buildRoomConfig(config = {}) {
      return buildChessConfig(config);
    },
    validateRoomSetup(_room, members) {
      const players = members.filter((member) => member.role === "player");
      if (players.length !== 2) throw new Error("Chess requires exactly two players.");
      if (!players.every((player) => player.is_ready)) throw new Error("Both seated players must be ready.");
      const assignedSides = players.map((player) => player.chosen_color_index);
      if (assignedSides.some((colorIndex) => !Number.isInteger(colorIndex) || colorIndex < 0 || colorIndex > 1)) {
        throw new Error("Chess seats must be White and Black.");
      }
      if (new Set(assignedSides).size !== 2) {
        throw new Error("Chess requires one White seat and one Black seat.");
      }
    },
    projectRoomSetup(room, members, viewerProfileId) {
      const config = buildChessConfig(parseJson(room.config_json, {}));
      const players = members.filter((member) => member.role === "player");
      const spectators = members.filter((member) => member.role === "spectator");
      return {
        gameType: CHESS_GAME_TYPE,
        ruleset: config.ruleset,
        modeLabel: config.modeLabel,
        mode: "setup",
        roomCode: room.code,
        boardSize: config.boardSize,
        maxPlayers: config.maxPlayers,
        viewerProfileId,
        players: players.map(normalizeSetupMember),
        spectators: spectators.map((member) => ({
          profileId: member.profile_id,
          name: member.name,
          connectionState: member.connection_state
        })),
        colors: SIDE_OPTIONS
      };
    },
    createMatch(room, members, makeId, nowIso) {
      const config = buildChessConfig(parseJson(room.config_json, {}));
      const players = members
        .filter((member) => member.role === "player")
        .sort((left, right) => left.seat_index - right.seat_index);
      const initialState = createInitialState();
      return {
        match: {
          id: makeId("match"),
          roomId: room.id,
          status: "starting",
          turnIndex: 0,
          boardJson: serializeState(initialState),
          winnerProfileId: null,
          createdAt: nowIso(),
          finishedAt: null,
          firstCommittedAt: null
        },
        matchPlayers: players.map((player) => ({
          id: makeId("match_player"),
          profile_id: player.profile_id,
          seatIndex: player.seat_index,
          colorIndex: player.chosen_color_index,
          hasMoved: 0,
          passed: 0,
          disconnected: 0,
          remainingPiecesJson: JSON.stringify([]),
          score: 0,
          endState: "active"
        })),
        events: [{
          profileId: room.host_profile_id,
          eventType: "match_started",
          payload: { roomCode: room.code, ruleset: config.ruleset }
        }]
      };
    },
    projectMatch(_room, match, players, viewerProfileId) {
      const state = parseState(match.board_json);
      const currentPlayer = players[match.turn_index];
      const currentColor = colorFromIndex(currentPlayer?.color_index ?? 0);
      const viewer = players.find((player) => player.profile_id === viewerProfileId) || null;
      const legalMap = viewer && viewer.profile_id === currentPlayer?.profile_id
        ? legalMovesByColor(state, currentColor)
        : {};
      return {
        gameType: CHESS_GAME_TYPE,
        ruleset: "standard_2p",
        modeLabel: CHESS_RULESETS.standard_2p.modeLabel,
        mode: "match",
        boardSize: 8,
        board: state.board,
        players: projectMatchPlayers(players),
        turnIndex: match.turn_index,
        viewerProfileId,
        activeColorIndex: currentPlayer?.color_index ?? 0,
        legalMovesByFrom: Object.fromEntries(
          Object.entries(legalMap).map(([key, moves]) => [key, moves.map((move) => ({
            x: move.toX,
            y: move.toY,
            capture: !!move.capture,
            castle: move.castle || null,
            promotionRequired: !!move.promotionRequired
          }))])
        ),
        lastMove: state.lastMove,
        capturedPieces: capturedPieces(state.board),
        checkState: isInCheck(state, currentColor) ? currentColor : null,
        guide: "Select one of your pieces, then choose a destination square. Promotions require an explicit piece choice.",
        colors: SIDE_OPTIONS.map((entry) => sideSummary(entry.colorIndex))
      };
    },
    buildReplay(room, match, players, moves) {
      return buildReplay(room, match, players, moves);
    },
    handleCommand(room, match, players, profileId, command, nowIso) {
      if (command?.commandType !== "place_piece") {
        throw new Error("Unsupported command for Chess.");
      }

      const currentPlayer = players[match.turn_index];
      if (!currentPlayer || currentPlayer.profile_id !== profileId) {
        throw new Error("Not your turn.");
      }

      const payload = normalizeCommandPayload(command.commandPayload);
      if (![payload.fromX, payload.fromY, payload.toX, payload.toY].every(Number.isInteger)) {
        throw new Error("Invalid move coordinates.");
      }

      const state = parseState(match.board_json);
      const currentColor = colorFromIndex(currentPlayer.color_index);
      const key = `${payload.fromX},${payload.fromY}`;
      const legalMoves = legalMovesByColor(state, currentColor)[key] || [];
      const move = legalMoves.find((entry) => entry.toX === payload.toX && entry.toY === payload.toY);
      if (!move) throw new Error("Illegal chess move.");
      if (move.promotionRequired && !promotePieceCode(currentColor, payload.promotion)) {
        throw new Error("Choose a promotion piece.");
      }

      const nextState = applyMove(state, move, payload.promotion);
      const nextColor = oppositeColor(currentColor);
      const nextTurnIndex = players.findIndex((player) => player.color_index === colorIndexFromCode(nextColor));
      const outcome = resolveOutcome(nextState, nextColor, players);
      const nextPlayers = applyPlayerScores(players.map((player) => ({
        ...player,
        hasMoved: player.profile_id === profileId ? 1 : player.hasMoved,
        passed: 0,
        disconnected: player.profile_id === profileId ? 0 : player.disconnected
      })), nextState.board, outcome);

      const movePayload = {
        from: { x: move.fromX, y: move.fromY },
        to: { x: move.toX, y: move.toY },
        label: nextState.lastMove?.label || `${squareName(move.fromX, move.fromY)}-${squareName(move.toX, move.toY)}`,
        castle: move.castle || null,
        capture: !!(move.capture || move.enPassant),
        promotion: move.promotionRequired ? (payload.promotion || "queen") : null,
        termination: outcome.termination,
        afterBoard: nextState.board.map((row) => [...row]),
        playerName: currentPlayer.name
      };

      const events = [{
        profileId,
        eventType: "move_made",
        payload: movePayload
      }];
      if (outcome.finished) {
        events.push({
          profileId: outcome.winnerProfileId,
          eventType: "match_finished",
          payload: {
            winnerProfileId: outcome.winnerProfileId,
            termination: outcome.termination
          }
        });
      }

      return {
        boardJson: serializeState(nextState),
        turnIndex: outcome.finished ? (nextTurnIndex >= 0 ? nextTurnIndex : match.turn_index) : nextTurnIndex,
        firstCommittedAt: match.first_committed_at || nowIso(),
        status: outcome.finished ? "finished" : "active",
        winnerProfileId: outcome.winnerProfileId,
        finishedAt: outcome.finished ? nowIso() : null,
        players: nextPlayers,
        events
      };
    },
    onReconnect(match, players, profileId, recordEvent) {
      const nextPlayers = players.map((player) => player.profile_id === profileId
        ? { ...player, disconnected: 0 }
        : { ...player });
      recordEvent?.(profileId, "player_reconnected", {});
      return {
        players: nextPlayers,
        status: match.status === "suspended" ? "active" : match.status
      };
    },
    onDisconnect(match, players, profileId, recordEvent) {
      const nextPlayers = players.map((player) => player.profile_id === profileId
        ? { ...player, disconnected: 1 }
        : { ...player });
      recordEvent?.(profileId, "player_disconnected", {});
      return {
        players: nextPlayers,
        status: "suspended"
      };
    },
    onReclaimExpired(_room, match, players, profileId, nowIso, recordEvent) {
      const opponent = players.find((player) => player.profile_id !== profileId) || null;
      const nextPlayers = players.map((player) => {
        if (player.profile_id === profileId) {
          return {
            ...player,
            disconnected: 1,
            end_state: "abandoned",
            score: -100
          };
        }
        if (player.profile_id === opponent?.profile_id) {
          return {
            ...player,
            end_state: "winner",
            score: 100
          };
        }
        return player;
      });
      recordEvent?.(profileId, "player_reclaim_expired", {});
      recordEvent?.(opponent?.profile_id || null, "match_finished", {
        winnerProfileId: opponent?.profile_id || null,
        termination: "abandonment"
      });
      return {
        players: nextPlayers,
        turnIndex: match.turn_index,
        status: "finished",
        winnerProfileId: opponent?.profile_id || null,
        finishedAt: nowIso()
      };
    }
  };
}
