import {
  ALL_PIECE_IDS,
  BOARD_SIZE,
  ORIENTATIONS as PIECE_ORIENTATIONS,
  PIECE_CELL_COUNTS,
  PLAYER_COLORS,
  START_CORNERS
} from "../../lib/pieces.js";

export const BLOKUS_GAME_TYPE = "blokus";
export const BLOKUS_MAX_PLAYERS = 4;

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

function serializeBoard(board) {
  return JSON.stringify(board);
}

function parseBoard(boardJson) {
  return parseJson(boardJson, emptyBoard());
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE;
}

function buildAbsCells(pieceId, orientationIndex, anchorX, anchorY) {
  const orientation = PIECE_ORIENTATIONS[pieceId]?.[orientationIndex];
  if (!orientation) return null;
  return orientation.map(([dx, dy]) => [anchorX + dx, anchorY + dy]);
}

function wouldOverlap(board, cellsAbs) {
  return cellsAbs.some(([x, y]) => board[y][x] !== 0);
}

function touchesEdgeSameColor(board, cellsAbs, colorValue) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [x, y] of cellsAbs) {
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (inBounds(nx, ny) && board[ny][nx] === colorValue) return true;
    }
  }
  return false;
}

function touchesCornerSameColor(board, cellsAbs, colorValue) {
  const diagonals = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const [x, y] of cellsAbs) {
    for (const [dx, dy] of diagonals) {
      const nx = x + dx;
      const ny = y + dy;
      if (inBounds(nx, ny) && board[ny][nx] === colorValue) return true;
    }
  }
  return false;
}

function coversStartCorner(cellsAbs, colorIndex) {
  const [cx, cy] = START_CORNERS[colorIndex];
  return cellsAbs.some(([x, y]) => x === cx && y === cy);
}

function isLegalPlacement(board, player, move) {
  if (!player.remainingPieces.includes(move.pieceId)) {
    return { ok: false, reason: "Piece already used." };
  }
  const abs = buildAbsCells(move.pieceId, move.orientationIndex, move.x, move.y);
  if (!abs) return { ok: false, reason: "Invalid piece or orientation." };
  for (const [x, y] of abs) {
    if (!inBounds(x, y)) return { ok: false, reason: "Out of bounds." };
  }
  if (wouldOverlap(board, abs)) return { ok: false, reason: "Overlap." };
  const colorValue = player.colorIndex + 1;
  if (!player.hasMoved) {
    if (!coversStartCorner(abs, player.colorIndex)) {
      return { ok: false, reason: "First move must cover your starting corner." };
    }
    return { ok: true, cells: abs };
  }
  if (touchesEdgeSameColor(board, abs, colorValue)) {
    return { ok: false, reason: "Cannot touch your own pieces by edge." };
  }
  if (!touchesCornerSameColor(board, abs, colorValue)) {
    return { ok: false, reason: "Must touch your own pieces by corner." };
  }
  return { ok: true, cells: abs };
}

function placeCells(board, cellsAbs, colorValue) {
  for (const [x, y] of cellsAbs) {
    board[y][x] = colorValue;
  }
}

function totalRemainingCells(remainingPieces) {
  return remainingPieces.reduce((sum, pieceId) => sum + (PIECE_CELL_COUNTS[pieceId] || 0), 0);
}

function hasAnyLegalMove(board, player) {
  for (const pieceId of player.remainingPieces) {
    const orientations = PIECE_ORIENTATIONS[pieceId] || [];
    for (let orientationIndex = 0; orientationIndex < orientations.length; orientationIndex += 1) {
      for (let y = 0; y < BOARD_SIZE; y += 1) {
        for (let x = 0; x < BOARD_SIZE; x += 1) {
          const verdict = isLegalPlacement(board, player, { pieceId, orientationIndex, x, y });
          if (verdict.ok) return true;
        }
      }
    }
  }
  return false;
}

function colorMeta(colorIndex) {
  return PLAYER_COLORS[colorIndex ?? 0] || PLAYER_COLORS[0];
}

function normalizeSetupMember(member) {
  return {
    profileId: member.profile_id,
    name: member.name,
    seatIndex: member.seat_index,
    colorIndex: member.chosen_color_index,
    colorName: colorMeta(member.chosen_color_index).name,
    colorFill: colorMeta(member.chosen_color_index).fill,
    cornerLabel: colorMeta(member.chosen_color_index).cornerLabel,
    isReady: !!member.is_ready,
    isHost: !!member.isHost,
    connectionState: member.connection_state
  };
}

function projectMatchPlayers(players) {
  return players.map((player) => ({
    profileId: player.profile_id,
    name: player.name,
    colorIndex: player.color_index,
    seatIndex: player.seat_index,
    hasMoved: !!player.hasMoved,
    passed: !!player.passed,
    disconnected: !!player.disconnected,
    remainingCount: player.remainingPieces.length,
    remainingCells: totalRemainingCells(player.remainingPieces),
    remainingPieces: player.remainingPieces,
    endState: player.end_state,
    score: player.score
  }));
}

function projectReplay(room, match, players, moves) {
  const winner = players.find((player) => player.profile_id === match.winner_profile_id);
  const board = emptyBoard();
  const frames = [{
    step: 0,
    eventType: "initial",
    label: "Start of match",
    actorName: null,
    board: emptyBoard(),
    payload: {}
  }];
  let step = 0;
  for (const move of moves) {
    if (move.eventType === "piece_placed") {
      const cells = buildAbsCells(
        move.payload.pieceId,
        move.payload.orientationIndex,
        move.payload.x,
        move.payload.y
      );
      const player = players.find((entry) => entry.profile_id === move.profileId);
      if (cells && player) {
        placeCells(board, cells, player.colorIndex + 1);
      }
    }
    step += 1;
    frames.push({
      step,
      eventType: move.eventType,
      label:
        move.eventType === "match_started"
          ? "Match started"
          : move.eventType === "turn_passed"
            ? move.payload?.automatic
              ? `${move.playerName || "Player"} auto-passed`
              : `${move.playerName || "Player"} passed`
            : move.eventType === "piece_placed"
              ? `${move.playerName || "Player"} placed ${move.payload.pieceId}`
              : move.eventType === "match_finished"
                ? `Match finished${winner?.name ? `, winner: ${winner.name}` : ""}`
                : move.eventType,
      actorName: move.playerName,
      board: board.map((row) => [...row]),
      payload: move.payload
    });
  }
  return {
    gameType: BLOKUS_GAME_TYPE,
    id: match.id,
    roomCode: room.code,
    roomTitle: room.title,
    status: match.status,
    winnerProfileId: match.winner_profile_id,
    winnerName: winner?.name || null,
    createdAt: match.created_at,
    finishedAt: match.finished_at,
    moveCount: moves.length,
    players: players.map((player) => ({
      profileId: player.profile_id,
      name: player.name,
      colorIndex: player.colorIndex,
      score: player.score,
      endState: player.endState
    })),
    frames
  };
}

function finalizeMatch(players) {
  const scores = players.map((player) => ({
    profileId: player.profile_id,
    remainingCells: totalRemainingCells(player.remainingPieces)
  }));
  const winner = scores.sort((a, b) => a.remainingCells - b.remainingCells)[0] || null;
  const nextPlayers = players.map((player) => {
    const remainingCells = totalRemainingCells(player.remainingPieces);
    return {
      ...player,
      score: -remainingCells,
      end_state: player.profile_id === winner?.profileId
        ? "winner"
        : player.end_state === "abandoned"
          ? "abandoned"
          : "finished"
    };
  });
  return {
    players: nextPlayers,
    winnerProfileId: winner?.profileId || null
  };
}

function resolveTurn(board, players, currentTurnIndex, recordEvent) {
  let nextPlayers = players.map((player) => ({ ...player }));
  for (const player of nextPlayers) {
    if (player.end_state === "abandoned") continue;
    if (player.remainingPieces.length === 0) {
      player.passed = 1;
      player.end_state = "out";
      continue;
    }
    if (!hasAnyLegalMove(board, player)) {
      if (!player.passed && player.end_state !== "abandoned") {
        recordEvent(player.profile_id, "turn_passed", {
          automatic: true,
          reason: "no_legal_move"
        });
      }
      player.passed = 1;
      player.end_state = player.end_state === "abandoned" ? "abandoned" : "blocked";
    } else if (player.end_state !== "abandoned") {
      player.passed = 0;
      player.end_state = "active";
    }
  }
  const candidates = nextPlayers
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => player.end_state === "active" && !player.passed);
  if (candidates.length === 0) {
    const finished = finalizeMatch(nextPlayers);
    return {
      players: finished.players,
      turnIndex: currentTurnIndex,
      finished: true,
      winnerProfileId: finished.winnerProfileId
    };
  }
  let nextTurnIndex = candidates[0].index;
  for (let offset = 1; offset <= nextPlayers.length; offset += 1) {
    const idx = (currentTurnIndex + offset) % nextPlayers.length;
    const candidate = candidates.find((entry) => entry.index === idx);
    if (candidate) {
      nextTurnIndex = candidate.index;
      break;
    }
  }
  return {
    players: nextPlayers,
    turnIndex: nextTurnIndex,
    finished: false,
    winnerProfileId: null
  };
}

export function createBlokusDriver() {
  return {
    gameType: BLOKUS_GAME_TYPE,
    buildRoomConfig() {
      return {
        maxPlayers: BLOKUS_MAX_PLAYERS
      };
    },
    validateRoomSetup(_room, members) {
      const players = members.filter((member) => member.role === "player");
      if (players.length < 2) throw new Error("Need at least two players.");
      if (!players.every((player) => player.is_ready)) throw new Error("All seated players must be ready.");
      if (!players.every((player) => Number.isInteger(player.chosen_color_index))) {
        throw new Error("All seated players must choose a color.");
      }
      if (new Set(players.map((player) => player.chosen_color_index)).size !== players.length) {
        throw new Error("Each seated player must have a unique color.");
      }
    },
    projectRoomSetup(room, members, viewerProfileId) {
      const players = members.filter((member) => member.role === "player");
      const spectators = members.filter((member) => member.role === "spectator");
      return {
        gameType: BLOKUS_GAME_TYPE,
        mode: "setup",
        roomCode: room.code,
        maxPlayers: BLOKUS_MAX_PLAYERS,
        viewerProfileId,
        players: players.map(normalizeSetupMember),
        spectators: spectators.map((member) => ({
          profileId: member.profile_id,
          name: member.name,
          connectionState: member.connection_state
        })),
        colors: PLAYER_COLORS
      };
    },
    createMatch(room, members, makeId, nowIso) {
      const players = members.filter((member) => member.role === "player");
      return {
        match: {
          id: makeId("match"),
          roomId: room.id,
          status: "starting",
          turnIndex: 0,
          boardJson: serializeBoard(emptyBoard()),
          winnerProfileId: null,
          createdAt: nowIso(),
          finishedAt: null,
          firstCommittedAt: null
        },
        matchPlayers: players.map((player, index) => ({
          id: makeId("match_player"),
          profile_id: player.profile_id,
          seatIndex: player.seat_index ?? index,
          colorIndex: player.chosen_color_index,
          hasMoved: 0,
          passed: 0,
          disconnected: 0,
          remainingPiecesJson: JSON.stringify(ALL_PIECE_IDS),
          score: 0,
          endState: "active"
        })),
        events: [{
          profileId: room.host_profile_id,
          eventType: "match_started",
          payload: { roomCode: room.code }
        }]
      };
    },
    projectMatch(room, match, players, viewerProfileId) {
      const projectedPlayers = projectMatchPlayers(players);
      return {
        gameType: BLOKUS_GAME_TYPE,
        mode: "match",
        boardSize: BOARD_SIZE,
        board: parseBoard(match.board_json),
        players: projectedPlayers,
        turnIndex: match.turn_index,
        viewerProfileId,
        supports: {
          flip: true,
          autoPass: true
        },
        colors: PLAYER_COLORS,
        startCorners: START_CORNERS,
        guide: "Match your color to its starting corner, use Rotate or Flip to orient the piece, and click the board to place. Blocked turns auto-pass."
      };
    },
    buildReplay(room, match, players, moves) {
      return projectReplay(room, match, players, moves);
    },
    buildMatchParticipants(players) {
      return players.map((player) => ({
        profileId: player.profile_id,
        name: player.name,
        seatIndex: player.seat_index,
        disconnected: !!player.disconnected,
        endState: player.end_state,
        score: player.score
      }));
    },
    handleCommand(room, match, players, profileId, command, nowIso) {
      const commandType = command?.commandType;
      const payload = command?.commandPayload || {};
      if (commandType !== "place_piece") {
        throw new Error("Unsupported command for Blokus.");
      }
      const currentPlayer = players[match.turn_index];
      if (!currentPlayer || currentPlayer.profile_id !== profileId) throw new Error("Not your turn.");
      const board = parseBoard(match.board_json);
      const verdict = isLegalPlacement(board, {
        colorIndex: currentPlayer.color_index,
        hasMoved: currentPlayer.hasMoved,
        remainingPieces: currentPlayer.remainingPieces
      }, payload);
      if (!verdict.ok) throw new Error(verdict.reason);
      const nextBoard = board.map((row) => [...row]);
      placeCells(nextBoard, verdict.cells, currentPlayer.color_index + 1);
      const nextPlayers = players.map((player) => player.id === currentPlayer.id
        ? {
          ...player,
          hasMoved: 1,
          passed: 0,
          disconnected: 0,
          end_state: "active",
          remainingPieces: player.remainingPieces.filter((pieceId) => pieceId !== payload.pieceId)
        }
        : { ...player });
      const events = [{
        profileId,
        eventType: "piece_placed",
        payload
      }];
      const resolved = resolveTurn(nextBoard, nextPlayers, match.turn_index, (eventProfileId, eventType, eventPayload) => {
        events.push({
          profileId: eventProfileId,
          eventType,
          payload: eventPayload
        });
      });
      if (resolved.finished) {
        events.push({
          profileId: resolved.winnerProfileId,
          eventType: "match_finished",
          payload: { winnerProfileId: resolved.winnerProfileId }
        });
      }
      return {
        boardJson: serializeBoard(nextBoard),
        turnIndex: resolved.turnIndex,
        firstCommittedAt: match.first_committed_at || nowIso(),
        status: resolved.finished ? "finished" : "active",
        winnerProfileId: resolved.winnerProfileId,
        finishedAt: resolved.finished ? nowIso() : null,
        players: resolved.players,
        events
      };
    },
    onReconnect(match, players, profileId, recordEvent) {
      const nextPlayers = players.map((player) => player.profile_id === profileId
        ? { ...player, disconnected: 0, end_state: player.end_state === "abandoned" ? "abandoned" : player.end_state }
        : { ...player });
      if (recordEvent) {
        recordEvent(profileId, "player_reconnected", {});
      }
      return {
        players: nextPlayers,
        status: match.status === "suspended" ? "active" : match.status
      };
    },
    onDisconnect(match, players, profileId, recordEvent) {
      const nextPlayers = players.map((player) => player.profile_id === profileId
        ? { ...player, disconnected: 1 }
        : { ...player });
      if (recordEvent) {
        recordEvent(profileId, "player_disconnected", {});
      }
      return {
        players: nextPlayers,
        status: "suspended"
      };
    },
    onReclaimExpired(match, players, profileId, nowIso, recordEvent) {
      const board = parseBoard(match.board_json);
      const nextPlayers = players.map((player) => player.profile_id === profileId
        ? { ...player, passed: 1, disconnected: 1, end_state: "abandoned" }
        : { ...player });
      if (recordEvent) {
        recordEvent(profileId, "player_reclaim_expired", {});
      }
      const resolved = resolveTurn(board, nextPlayers, match.turn_index, (eventProfileId, eventType, eventPayload) => {
        if (recordEvent) recordEvent(eventProfileId, eventType, eventPayload);
      });
      return {
        players: resolved.players,
        turnIndex: resolved.turnIndex,
        status: resolved.finished ? "finished" : "active",
        winnerProfileId: resolved.winnerProfileId,
        finishedAt: resolved.finished ? nowIso() : null
      };
    }
  };
}
