import express from "express";
import http from "http";
import { Server } from "socket.io";
import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = join(__dirname, "data");
const dbPath = join(dataDir, "blokus.sqlite");
const distDir = join(__dirname, "dist");

mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  create table if not exists profiles (
    id text primary key,
    device_token text not null,
    name text not null,
    created_at text not null
  );

  create table if not exists sessions (
    id text primary key,
    token text not null unique,
    profile_id text not null,
    room_code text,
    created_at text not null,
    last_seen_at text not null
  );

  create table if not exists rooms (
    id text primary key,
    code text not null unique,
    title text not null,
    is_public integer not null,
    host_profile_id text,
    phase text not null,
    created_at text not null,
    archived_at text
  );

  create table if not exists room_members (
    id text primary key,
    room_id text not null,
    profile_id text not null,
    role text not null,
    seat_index integer,
    is_ready integer not null,
    connection_state text not null,
    disconnected_at text,
    joined_at text not null,
    unique(room_id, profile_id)
  );

  create table if not exists matches (
    id text primary key,
    room_id text not null,
    status text not null,
    turn_index integer not null,
    board_json text not null,
    winner_profile_id text,
    created_at text not null,
    finished_at text
  );

  create table if not exists match_players (
    id text primary key,
    match_id text not null,
    profile_id text not null,
    seat_index integer not null,
    color_index integer not null,
    has_moved integer not null,
    passed integer not null,
    disconnected integer not null,
    remaining_pieces_json text not null,
    score integer not null,
    end_state text not null,
    unique(match_id, profile_id)
  );

  create table if not exists moves (
    id text primary key,
    match_id text not null,
    move_index integer not null,
    profile_id text,
    event_type text not null,
    payload_json text not null,
    created_at text not null
  );
`);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());

const BOARD_SIZE = 20;
const MAX_PLAYERS = 4;
const GRACE_MS = 60_000;
const ROOM_PHASES = {
  LOBBY: "LOBBY",
  STARTING: "STARTING",
  IN_GAME: "IN_GAME",
  FINISHED: "FINISHED",
  ARCHIVED: "ARCHIVED"
};
const PLAYER_START_CORNERS = [
  [0, 0],
  [BOARD_SIZE - 1, 0],
  [BOARD_SIZE - 1, BOARD_SIZE - 1],
  [0, BOARD_SIZE - 1]
];

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

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function makeToken() {
  return randomBytes(24).toString("hex");
}

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

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

function cellsSignature(cells) {
  return normalizeCells(cells).map(([x, y]) => `${x}:${y}`).join("|");
}

function generateUniqueOrientations(baseCells) {
  const variants = [];
  const seen = new Set();
  let current = baseCells.map((cell) => [...cell]);
  for (let i = 0; i < 4; i += 1) {
    const sig = cellsSignature(current);
    if (!seen.has(sig)) {
      seen.add(sig);
      variants.push(normalizeCells(current));
    }
    current = current.map(rotate90);
  }
  current = baseCells.map(flipX);
  for (let i = 0; i < 4; i += 1) {
    const sig = cellsSignature(current);
    if (!seen.has(sig)) {
      seen.add(sig);
      variants.push(normalizeCells(current));
    }
    current = current.map(rotate90);
  }
  return variants;
}

const PIECE_ORIENTATIONS = Object.fromEntries(
  PIECES.map((piece) => [piece.id, generateUniqueOrientations(piece.cells)])
);
const PIECE_CELL_COUNTS = Object.fromEntries(PIECES.map((piece) => [piece.id, piece.cells.length]));
const ALL_PIECE_IDS = PIECES.map((piece) => piece.id);

function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
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
  const [cx, cy] = PLAYER_START_CORNERS[colorIndex];
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

function serializeBoard(board) {
  return JSON.stringify(board);
}

function parseBoard(boardJson) {
  return parseJson(boardJson, emptyBoard());
}

function totalRemainingCells(remainingPieces) {
  return remainingPieces.reduce((sum, pieceId) => sum + (PIECE_CELL_COUNTS[pieceId] || 0), 0);
}

function getDeviceToken(value) {
  return typeof value === "string" && value.trim() ? value.trim() : makeToken();
}

function sessionFromToken(token) {
  if (!token) return null;
  const row = db.prepare(`
    select sessions.*, profiles.name as profile_name
    from sessions
    join profiles on profiles.id = sessions.profile_id
    where sessions.token = ?
  `).get(token);
  if (!row) return null;
  db.prepare("update sessions set last_seen_at = ? where id = ?").run(nowIso(), row.id);
  return row;
}

function listProfilesForDevice(deviceToken) {
  return db.prepare(`
    select id, name, created_at
    from profiles
    where device_token = ?
    order by created_at asc
  `).all(deviceToken);
}

function getRoomByCode(roomCode) {
  if (!roomCode) return null;
  return db.prepare("select * from rooms where code = ?").get(String(roomCode).toUpperCase()) || null;
}

function getRoomMembers(roomId) {
  return db.prepare(`
    select room_members.*, profiles.name
    from room_members
    join profiles on profiles.id = room_members.profile_id
    where room_members.room_id = ?
    order by
      case when room_members.role = 'player' then 0 else 1 end,
      coalesce(room_members.seat_index, 99),
      room_members.joined_at asc
  `).all(roomId);
}

function getLatestMatch(roomId) {
  return db.prepare(`
    select *
    from matches
    where room_id = ?
    order by created_at desc
    limit 1
  `).get(roomId) || null;
}

function getActiveMatch(roomId) {
  return db.prepare(`
    select *
    from matches
    where room_id = ? and status = 'active'
    order by created_at desc
    limit 1
  `).get(roomId) || null;
}

function getMatchById(matchId) {
  return db.prepare("select * from matches where id = ?").get(matchId) || null;
}

function getMovesForMatch(matchId) {
  return db.prepare(`
    select moves.*, profiles.name
    from moves
    left join profiles on profiles.id = moves.profile_id
    where moves.match_id = ?
    order by moves.move_index asc
  `).all(matchId).map((row) => ({
    id: row.id,
    moveIndex: row.move_index,
    profileId: row.profile_id,
    playerName: row.name || null,
    eventType: row.event_type,
    payload: parseJson(row.payload_json, {}),
    createdAt: row.created_at
  }));
}

function getOrderedMatchPlayers(matchId) {
  return db.prepare(`
    select match_players.*, profiles.name
    from match_players
    join profiles on profiles.id = match_players.profile_id
    where match_players.match_id = ?
    order by match_players.seat_index asc
  `).all(matchId).map((row) => ({
    ...row,
    profileId: row.profile_id,
    seatIndex: row.seat_index,
    colorIndex: row.color_index,
    hasMoved: !!row.has_moved,
    passed: !!row.passed,
    disconnected: !!row.disconnected,
    remainingPieces: parseJson(row.remaining_pieces_json, []),
    endState: row.end_state
  }));
}

function moveCount(matchId) {
  return db.prepare("select count(*) as count from moves where match_id = ?").get(matchId).count;
}

function clearSessionRoomForProfile(profileId, roomCode) {
  db.prepare("update sessions set room_code = null where profile_id = ? and room_code = ?").run(profileId, roomCode);
}

function normalizeLobbySeats(roomId) {
  const players = db.prepare(`
    select id
    from room_members
    where room_id = ? and role = 'player'
    order by joined_at asc
  `).all(roomId);
  players.forEach((player, index) => {
    db.prepare("update room_members set seat_index = ? where id = ?").run(index, player.id);
  });
}

function transferHost(room) {
  const members = getRoomMembers(room.id);
  if (members.length === 0) {
    db.prepare("update rooms set host_profile_id = null where id = ?").run(room.id);
    return;
  }
  const current = members.find((member) => member.profile_id === room.host_profile_id);
  if (current && current.connection_state === "online") return;
  const replacement = members.find((member) => member.connection_state === "online") || members[0];
  db.prepare("update rooms set host_profile_id = ? where id = ?").run(replacement.profile_id, room.id);
}

function archiveIfEmpty(room) {
  const count = db.prepare("select count(*) as count from room_members where room_id = ?").get(room.id).count;
  if (count > 0) return false;
  db.prepare("update rooms set phase = ?, archived_at = ? where id = ?").run(ROOM_PHASES.ARCHIVED, nowIso(), room.id);
  db.prepare("update sessions set room_code = null where room_code = ?").run(room.code);
  return true;
}

function appendMove(matchId, profileId, eventType, payload) {
  db.prepare(`
    insert into moves (id, match_id, move_index, profile_id, event_type, payload_json, created_at)
    values (?, ?, ?, ?, ?, ?, ?)
  `).run(
    makeId("move"),
    matchId,
    moveCount(matchId),
    profileId || null,
    eventType,
    JSON.stringify(payload),
    nowIso()
  );
}

function cleanupExpiredMembers(roomId) {
  const room = db.prepare("select * from rooms where id = ?").get(roomId);
  if (!room || room.phase === ROOM_PHASES.ARCHIVED) return;
  const cutoff = Date.now() - GRACE_MS;
  const members = getRoomMembers(roomId);
  const activeMatch = getActiveMatch(roomId);
  for (const member of members) {
    if (member.connection_state !== "offline" || !member.disconnected_at) continue;
    if (Date.parse(member.disconnected_at) >= cutoff) continue;
    if (room.phase === ROOM_PHASES.IN_GAME && member.role === "player" && activeMatch) {
      db.prepare(`
        update room_members
        set role = 'spectator', seat_index = null, is_ready = 0
        where id = ?
      `).run(member.id);
      db.prepare(`
        update match_players
        set passed = 1, disconnected = 1, end_state = 'abandoned'
        where match_id = ? and profile_id = ?
      `).run(activeMatch.id, member.profile_id);
    } else {
      db.prepare("delete from room_members where id = ?").run(member.id);
      clearSessionRoomForProfile(member.profile_id, room.code);
    }
  }
  if (room.phase !== ROOM_PHASES.IN_GAME) {
    normalizeLobbySeats(room.id);
  }
  transferHost(room);
  archiveIfEmpty(room);
}

function buildRoomSummary(room) {
  cleanupExpiredMembers(room.id);
  const freshRoom = db.prepare("select * from rooms where id = ?").get(room.id);
  if (!freshRoom || freshRoom.phase === ROOM_PHASES.ARCHIVED) return null;
  const members = getRoomMembers(freshRoom.id);
  const host = members.find((member) => member.profile_id === freshRoom.host_profile_id);
  return {
    code: freshRoom.code,
    title: freshRoom.title,
    phase: freshRoom.phase,
    isPublic: !!freshRoom.is_public,
    hostProfileId: freshRoom.host_profile_id,
    hostName: host?.name || null,
    playerCount: members.filter((member) => member.role === "player").length,
    spectatorCount: members.filter((member) => member.role === "spectator").length
  };
}

function buildRoomSnapshot(roomCode) {
  const room = getRoomByCode(roomCode);
  if (!room) return null;
  if (room.phase !== ROOM_PHASES.ARCHIVED) {
    cleanupExpiredMembers(room.id);
  }
  const freshRoom = getRoomByCode(roomCode);
  if (!freshRoom) return null;
  const members = getRoomMembers(freshRoom.id);
  const host = members.find((member) => member.profile_id === freshRoom.host_profile_id);
  return {
    code: freshRoom.code,
    title: freshRoom.title,
    phase: freshRoom.phase,
    isPublic: !!freshRoom.is_public,
    hostProfileId: freshRoom.host_profile_id,
    hostName: host?.name || null,
    currentMatchId: getLatestMatch(freshRoom.id)?.id || null,
    history: buildRoomHistory(freshRoom.id),
    members: members.map((member) => ({
      id: member.id,
      profileId: member.profile_id,
      name: member.name,
      role: member.role,
      seatIndex: member.seat_index,
      isReady: !!member.is_ready,
      connectionState: member.connection_state,
      isHost: member.profile_id === freshRoom.host_profile_id
    }))
  };
}

function buildMatchSnapshot(roomCode) {
  const room = getRoomByCode(roomCode);
  if (!room) return null;
  const match = getLatestMatch(room.id);
  if (!match) return null;
  const players = getOrderedMatchPlayers(match.id);
  const winner = players.find((player) => player.profile_id === match.winner_profile_id);
  return {
    id: match.id,
    roomCode,
    status: match.status,
    turnIndex: match.turn_index,
    board: parseBoard(match.board_json),
    winnerProfileId: match.winner_profile_id,
    winnerName: winner?.name || null,
    createdAt: match.created_at,
    finishedAt: match.finished_at,
    moveCount: moveCount(match.id),
    players: players.map((player) => ({
      profileId: player.profile_id,
      name: player.name,
      colorIndex: player.color_index,
      seatIndex: player.seat_index,
      hasMoved: player.hasMoved,
      passed: player.passed,
      disconnected: player.disconnected,
      remainingCount: player.remainingPieces.length,
      remainingPieces: player.remainingPieces,
      endState: player.end_state,
      score: player.score
    }))
  };
}

function buildFinishedMatchSummary(match, room) {
  const players = getOrderedMatchPlayers(match.id);
  const winner = players.find((player) => player.profile_id === match.winner_profile_id);
  return {
    id: match.id,
    roomCode: room.code,
    roomTitle: room.title,
    winnerProfileId: match.winner_profile_id,
    winnerName: winner?.name || null,
    createdAt: match.created_at,
    finishedAt: match.finished_at,
    moveCount: moveCount(match.id),
    players: players.map((player) => ({
      profileId: player.profile_id,
      name: player.name,
      score: player.score,
      endState: player.endState
    }))
  };
}

function buildRoomHistory(roomId) {
  const room = db.prepare("select * from rooms where id = ?").get(roomId);
  if (!room) return [];
  return db.prepare(`
    select *
    from matches
    where room_id = ? and status = 'finished'
    order by finished_at desc, created_at desc
    limit 12
  `).all(roomId).map((match) => buildFinishedMatchSummary(match, room));
}

function buildReplaySnapshot(matchId) {
  const match = getMatchById(matchId);
  if (!match) return null;
  const room = db.prepare("select * from rooms where id = ?").get(match.room_id);
  if (!room) return null;
  const players = getOrderedMatchPlayers(match.id);
  const winner = players.find((player) => player.profile_id === match.winner_profile_id);
  const moves = getMovesForMatch(match.id);
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
            ? `${move.playerName || "Player"} passed`
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
    id: match.id,
    roomCode: room.code,
    roomTitle: room.title,
    status: match.status,
    winnerProfileId: match.winner_profile_id,
    winnerName: winner?.name || null,
    createdAt: match.created_at,
    finishedAt: match.finished_at,
    moveCount: moveCount(match.id),
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

function buildLeaderboard() {
  const rows = db.prepare(`
    select
      profiles.id as profile_id,
      profiles.name as name,
      count(match_players.id) as matches_played,
      sum(case when matches.winner_profile_id = profiles.id then 1 else 0 end) as wins,
      sum(match_players.score) as total_score,
      max(case when matches.winner_profile_id = profiles.id then matches.finished_at else null end) as last_win_at
    from profiles
    join match_players on match_players.profile_id = profiles.id
    join matches on matches.id = match_players.match_id
    where matches.status = 'finished'
    group by profiles.id, profiles.name
    order by wins desc, total_score desc, matches_played desc, last_win_at desc, profiles.name asc
    limit 12
  `).all();
  return rows.map((row, index) => ({
    rank: index + 1,
    profileId: row.profile_id,
    name: row.name,
    wins: row.wins,
    matchesPlayed: row.matches_played,
    totalScore: row.total_score || 0,
    lastWinAt: row.last_win_at || null
  }));
}

function buildRecentFinishedMatches(limit = 12) {
  return db.prepare(`
    select matches.*, rooms.code as room_code, rooms.title as room_title
    from matches
    join rooms on rooms.id = matches.room_id
    where matches.status = 'finished'
    order by matches.finished_at desc, matches.created_at desc
    limit ?
  `).all(limit).map((match) => buildFinishedMatchSummary(match, {
    code: match.room_code,
    title: match.room_title
  }));
}

function listPublicRooms() {
  return db.prepare(`
    select *
    from rooms
    where is_public = 1 and phase != ?
    order by created_at desc
  `).all(ROOM_PHASES.ARCHIVED).map(buildRoomSummary).filter(Boolean);
}

function ensureRoomCodeUnique() {
  let code = makeRoomCode();
  while (getRoomByCode(code)) {
    code = makeRoomCode();
  }
  return code;
}

function ensureProfileBelongsToDevice(profileId, deviceToken) {
  return db.prepare("select * from profiles where id = ? and device_token = ?").get(profileId, deviceToken) || null;
}

function createOrReuseSession(profileId, existingToken) {
  const now = nowIso();
  const existing = existingToken ? sessionFromToken(existingToken) : null;
  if (existing) {
    db.prepare(`
      update sessions
      set profile_id = ?, room_code = ?, last_seen_at = ?
      where id = ?
    `).run(profileId, existing.profile_id === profileId ? existing.room_code : null, now, existing.id);
    return sessionFromToken(existingToken);
  }
  const token = makeToken();
  const sessionId = makeId("session");
  db.prepare(`
    insert into sessions (id, token, profile_id, room_code, created_at, last_seen_at)
    values (?, ?, ?, null, ?, ?)
  `).run(sessionId, token, profileId, now, now);
  return sessionFromToken(token);
}

function sessionPayload(session) {
  if (!session) return null;
  return {
    id: session.id,
    profileId: session.profile_id,
    profileName: session.profile_name,
    roomCode: session.room_code || null
  };
}

function resolveViewer(req) {
  const deviceToken = getDeviceToken(req.header("x-device-token"));
  const session = sessionFromToken(req.header("x-session-token"));
  return { deviceToken, session };
}

function setMemberOnline(roomCode, profileId) {
  const room = getRoomByCode(roomCode);
  if (!room) return;
  db.prepare(`
    update room_members
    set connection_state = 'online', disconnected_at = null
    where room_id = ? and profile_id = ?
  `).run(room.id, profileId);
  transferHost(room);
}

function removeMembership(roomCode, profileId, explicitLeave) {
  const room = getRoomByCode(roomCode);
  if (!room) return;
  const member = db.prepare(`
    select *
    from room_members
    where room_id = ? and profile_id = ?
  `).get(room.id, profileId);
  if (!member) return;
  if (room.phase === ROOM_PHASES.IN_GAME && member.role === "player") {
    db.prepare("delete from room_members where id = ?").run(member.id);
    const match = getActiveMatch(room.id);
    if (match) {
      db.prepare(`
        update match_players
        set passed = 1, disconnected = 1, end_state = 'abandoned'
        where match_id = ? and profile_id = ?
      `).run(match.id, profileId);
    }
  } else {
    db.prepare("delete from room_members where id = ?").run(member.id);
    normalizeLobbySeats(room.id);
  }
  clearSessionRoomForProfile(profileId, roomCode);
  transferHost(room);
  if (!archiveIfEmpty(room)) {
    if (room.phase === ROOM_PHASES.IN_GAME) {
      syncMatchTurn(room.id);
    } else if (explicitLeave && room.phase === ROOM_PHASES.FINISHED) {
      db.prepare("update rooms set phase = ? where id = ?").run(ROOM_PHASES.LOBBY, room.id);
    }
  }
}

function joinRoomAs(session, roomCode, role, socket) {
  const room = getRoomByCode(roomCode);
  if (!room || room.phase === ROOM_PHASES.ARCHIVED) {
    throw new Error("Room does not exist.");
  }
  cleanupExpiredMembers(room.id);
  const freshRoom = getRoomByCode(roomCode);
  if (session.room_code && session.room_code !== roomCode) {
    removeMembership(session.room_code, session.profile_id, false);
    socket.leave(session.room_code);
  }
  let member = db.prepare(`
    select *
    from room_members
    where room_id = ? and profile_id = ?
  `).get(freshRoom.id, session.profile_id);
  if (member) {
    if (role === "player" && freshRoom.phase !== ROOM_PHASES.LOBBY && member.role !== "player") {
      throw new Error("You can only spectate once a match has started.");
    }
    if (role === "player" && member.role === "spectator") {
      const seatCount = db.prepare(`
        select count(*) as count
        from room_members
        where room_id = ? and role = 'player'
      `).get(freshRoom.id).count;
      if (seatCount >= MAX_PLAYERS) throw new Error("No player seats available.");
      db.prepare(`
        update room_members
        set role = 'player', seat_index = ?, connection_state = 'online', disconnected_at = null
        where id = ?
      `).run(seatCount, member.id);
      member = db.prepare("select * from room_members where id = ?").get(member.id);
    } else {
      db.prepare(`
        update room_members
        set connection_state = 'online', disconnected_at = null
        where id = ?
      `).run(member.id);
    }
  } else {
    let seatIndex = null;
    if (role === "player") {
      if (freshRoom.phase !== ROOM_PHASES.LOBBY) {
        throw new Error("Player seats are only available before the match starts.");
      }
      const seatCount = db.prepare(`
        select count(*) as count
        from room_members
        where room_id = ? and role = 'player'
      `).get(freshRoom.id).count;
      if (seatCount >= MAX_PLAYERS) throw new Error("No player seats available.");
      seatIndex = seatCount;
    }
    db.prepare(`
      insert into room_members (
        id, room_id, profile_id, role, seat_index, is_ready, connection_state, disconnected_at, joined_at
      ) values (?, ?, ?, ?, ?, 0, 'online', null, ?)
    `).run(makeId("member"), freshRoom.id, session.profile_id, role, seatIndex, nowIso());
  }
  db.prepare("update sessions set room_code = ?, last_seen_at = ? where id = ?").run(roomCode, nowIso(), session.id);
  socket.join(roomCode);
  transferHost(freshRoom);
  return buildRoomSnapshot(roomCode);
}

function createRoomForSession(session, title, isPublic, socket) {
  if (session.room_code) {
    removeMembership(session.room_code, session.profile_id, true);
    socket.leave(session.room_code);
  }
  const roomId = makeId("room");
  const roomCode = ensureRoomCodeUnique();
  const timestamp = nowIso();
  db.prepare(`
    insert into rooms (id, code, title, is_public, host_profile_id, phase, created_at, archived_at)
    values (?, ?, ?, ?, ?, ?, ?, null)
  `).run(roomId, roomCode, title, isPublic ? 1 : 0, session.profile_id, ROOM_PHASES.LOBBY, timestamp);
  db.prepare(`
    insert into room_members (
      id, room_id, profile_id, role, seat_index, is_ready, connection_state, disconnected_at, joined_at
    ) values (?, ?, ?, 'player', 0, 0, 'online', null, ?)
  `).run(makeId("member"), roomId, session.profile_id, timestamp);
  db.prepare("update sessions set room_code = ? where id = ?").run(roomCode, session.id);
  socket.join(roomCode);
  return buildRoomSnapshot(roomCode);
}

function startMatch(roomCode, profileId) {
  const room = getRoomByCode(roomCode);
  if (!room) throw new Error("Room not found.");
  if (room.host_profile_id !== profileId) throw new Error("Only the host can start the match.");
  if (room.phase !== ROOM_PHASES.LOBBY) throw new Error("Room is not in lobby phase.");
  const players = getRoomMembers(room.id).filter((member) => member.role === "player");
  if (players.length < 2) throw new Error("Need at least two players.");
  if (!players.every((player) => player.is_ready)) throw new Error("All seated players must be ready.");
  const matchId = makeId("match");
  db.prepare("update rooms set phase = ? where id = ?").run(ROOM_PHASES.STARTING, room.id);
  db.prepare(`
    insert into matches (id, room_id, status, turn_index, board_json, winner_profile_id, created_at, finished_at)
    values (?, ?, 'active', 0, ?, null, ?, null)
  `).run(matchId, room.id, serializeBoard(emptyBoard()), nowIso());
  players.forEach((player, index) => {
    db.prepare(`
      insert into match_players (
        id, match_id, profile_id, seat_index, color_index, has_moved, passed, disconnected, remaining_pieces_json, score, end_state
      ) values (?, ?, ?, ?, ?, 0, 0, 0, ?, 0, 'active')
    `).run(
      makeId("match_player"),
      matchId,
      player.profile_id,
      player.seat_index ?? index,
      player.seat_index ?? index,
      JSON.stringify(ALL_PIECE_IDS),
    );
  });
  appendMove(matchId, profileId, "match_started", { roomCode });
  db.prepare("update rooms set phase = ? where id = ?").run(ROOM_PHASES.IN_GAME, room.id);
  return buildMatchSnapshot(roomCode);
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

function finishMatch(roomId) {
  const room = db.prepare("select * from rooms where id = ?").get(roomId);
  const match = getActiveMatch(roomId);
  if (!room || !match) return null;
  const players = getOrderedMatchPlayers(match.id);
  const scores = players.map((player) => ({
    profileId: player.profile_id,
    remainingCells: totalRemainingCells(player.remainingPieces)
  }));
  const winner = scores.sort((a, b) => a.remainingCells - b.remainingCells)[0] || null;
  players.forEach((player) => {
    const remainingCells = totalRemainingCells(player.remainingPieces);
    const endState = player.profile_id === winner?.profileId ? "winner" : player.end_state === "abandoned" ? "abandoned" : "finished";
    db.prepare(`
      update match_players
      set score = ?, end_state = ?
      where id = ?
    `).run(-remainingCells, endState, player.id);
  });
  db.prepare(`
    update matches
    set status = 'finished', winner_profile_id = ?, finished_at = ?
    where id = ?
  `).run(winner?.profileId || null, nowIso(), match.id);
  db.prepare("update rooms set phase = ? where id = ?").run(ROOM_PHASES.FINISHED, roomId);
  appendMove(match.id, winner?.profileId || null, "match_finished", { winnerProfileId: winner?.profileId || null });
  return buildMatchSnapshot(room.code);
}

function syncMatchTurn(roomId) {
  const room = db.prepare("select * from rooms where id = ?").get(roomId);
  const match = getActiveMatch(roomId);
  if (!room || !match) return null;
  const board = parseBoard(match.board_json);
  let players = getOrderedMatchPlayers(match.id);
  for (const player of players) {
    if (player.end_state === "abandoned") continue;
    if (player.remainingPieces.length === 0) {
      db.prepare(`
        update match_players
        set passed = 1, end_state = 'out'
        where id = ?
      `).run(player.id);
      continue;
    }
    if (!hasAnyLegalMove(board, player)) {
      db.prepare(`
        update match_players
        set passed = 1, end_state = case when end_state = 'abandoned' then 'abandoned' else 'blocked' end
        where id = ?
      `).run(player.id);
    } else if (player.end_state !== "abandoned") {
      db.prepare(`
        update match_players
        set passed = 0, end_state = 'active'
        where id = ?
      `).run(player.id);
    }
  }
  players = getOrderedMatchPlayers(match.id);
  const candidates = players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => player.end_state === "active" && !player.passed);
  if (candidates.length === 0) {
    return finishMatch(roomId);
  }
  let nextTurn = candidates[0].index;
  for (let offset = 1; offset <= players.length; offset += 1) {
    const idx = (match.turn_index + offset) % players.length;
    const candidate = candidates.find((entry) => entry.index === idx);
    if (candidate) {
      nextTurn = candidate.index;
      break;
    }
  }
  db.prepare("update matches set turn_index = ? where id = ?").run(nextTurn, match.id);
  return buildMatchSnapshot(room.code);
}

function placeMove(roomCode, profileId, move) {
  const room = getRoomByCode(roomCode);
  if (!room || room.phase !== ROOM_PHASES.IN_GAME) throw new Error("Game is not active.");
  const match = getActiveMatch(room.id);
  if (!match) throw new Error("No active match.");
  const players = getOrderedMatchPlayers(match.id);
  const currentPlayer = players[match.turn_index];
  if (!currentPlayer || currentPlayer.profile_id !== profileId) throw new Error("Not your turn.");
  const board = parseBoard(match.board_json);
  const playerState = {
    colorIndex: currentPlayer.color_index,
    hasMoved: currentPlayer.hasMoved,
    remainingPieces: currentPlayer.remainingPieces
  };
  const verdict = isLegalPlacement(board, playerState, move);
  if (!verdict.ok) throw new Error(verdict.reason);
  placeCells(board, verdict.cells, currentPlayer.color_index + 1);
  const remainingPieces = currentPlayer.remainingPieces.filter((pieceId) => pieceId !== move.pieceId);
  db.prepare(`
    update match_players
    set has_moved = 1, passed = 0, disconnected = 0, remaining_pieces_json = ?, end_state = 'active'
    where id = ?
  `).run(JSON.stringify(remainingPieces), currentPlayer.id);
  db.prepare("update matches set board_json = ? where id = ?").run(serializeBoard(board), match.id);
  appendMove(match.id, profileId, "piece_placed", move);
  return syncMatchTurn(room.id);
}

function passTurn(roomCode, profileId) {
  const room = getRoomByCode(roomCode);
  if (!room || room.phase !== ROOM_PHASES.IN_GAME) throw new Error("Game is not active.");
  const match = getActiveMatch(room.id);
  const players = getOrderedMatchPlayers(match.id);
  const currentPlayer = players[match.turn_index];
  if (!currentPlayer || currentPlayer.profile_id !== profileId) throw new Error("Not your turn.");
  const board = parseBoard(match.board_json);
  if (hasAnyLegalMove(board, currentPlayer)) {
    throw new Error("You still have a legal move and cannot pass.");
  }
  db.prepare(`
    update match_players
    set passed = 1, end_state = 'blocked'
    where id = ?
  `).run(currentPlayer.id);
  appendMove(match.id, profileId, "turn_passed", {});
  return syncMatchTurn(room.id);
}

function rematchRoom(roomCode, profileId) {
  const room = getRoomByCode(roomCode);
  if (!room) throw new Error("Room not found.");
  if (room.host_profile_id !== profileId) throw new Error("Only the host can reset for a rematch.");
  if (room.phase !== ROOM_PHASES.FINISHED) throw new Error("Room is not ready for rematch.");
  db.prepare("update rooms set phase = ? where id = ?").run(ROOM_PHASES.LOBBY, room.id);
  db.prepare(`
    update room_members
    set is_ready = 0
    where room_id = ? and role = 'player'
  `).run(room.id);
  normalizeLobbySeats(room.id);
  return buildRoomSnapshot(roomCode);
}

function roomAndMatchPayload(roomCode) {
  return {
    room: buildRoomSnapshot(roomCode),
    match: buildMatchSnapshot(roomCode),
    rooms: listPublicRooms()
  };
}

function emitRoomState(roomCode) {
  const room = buildRoomSnapshot(roomCode);
  if (!room) return;
  io.emit("state:room", room);
  io.to(roomCode).emit("state:room", room);
  const match = buildMatchSnapshot(roomCode);
  if (match) {
    io.to(roomCode).emit("state:match", match);
  }
}

function requireSession(socket) {
  if (!socket.data.session) {
    throw new Error("Select a profile before using realtime commands.");
  }
  const freshSession = sessionFromToken(socket.data.session.token);
  if (!freshSession) throw new Error("Session expired.");
  socket.data.session = freshSession;
  return freshSession;
}

function ackHandler(ack, handler) {
  try {
    const payload = handler();
    ack?.({ ok: true, ...payload });
  } catch (error) {
    console.error(error);
    ack?.({ ok: false, message: error.message || "Command failed." });
  }
}

app.get("/api/bootstrap", (req, res) => {
  const { deviceToken, session } = resolveViewer(req);
  let activeSession = session;
  if (activeSession?.room_code) {
    const room = getRoomByCode(activeSession.room_code);
    if (room) {
      cleanupExpiredMembers(room.id);
      if (!buildRoomSnapshot(activeSession.room_code)) {
        db.prepare("update sessions set room_code = null where id = ?").run(activeSession.id);
        activeSession = sessionFromToken(activeSession.token);
      }
    } else {
      db.prepare("update sessions set room_code = null where id = ?").run(activeSession.id);
      activeSession = sessionFromToken(activeSession.token);
    }
  }
  res.json({
    deviceToken,
    sessionToken: activeSession?.token || "",
    session: sessionPayload(activeSession),
    profiles: listProfilesForDevice(deviceToken),
    rooms: listPublicRooms(),
    leaderboard: buildLeaderboard(),
    recentMatches: buildRecentFinishedMatches(),
    room: activeSession?.room_code ? buildRoomSnapshot(activeSession.room_code) : null,
    match: activeSession?.room_code ? buildMatchSnapshot(activeSession.room_code) : null
  });
});

app.get("/api/rooms", (req, res) => {
  res.json({ deviceToken: getDeviceToken(req.header("x-device-token")), rooms: listPublicRooms() });
});

app.get("/api/leaderboard", (req, res) => {
  res.json({
    deviceToken: getDeviceToken(req.header("x-device-token")),
    leaderboard: buildLeaderboard()
  });
});

app.get("/api/matches/recent", (req, res) => {
  res.json({
    deviceToken: getDeviceToken(req.header("x-device-token")),
    matches: buildRecentFinishedMatches()
  });
});

app.get("/api/matches/:matchId", (req, res) => {
  const replay = buildReplaySnapshot(String(req.params.matchId || ""));
  if (!replay) {
    res.status(404).json({ message: "Match not found." });
    return;
  }
  res.json({
    deviceToken: getDeviceToken(req.header("x-device-token")),
    replay
  });
});

app.get("/api/rooms/:roomCode", (req, res) => {
  const roomCode = String(req.params.roomCode || "").toUpperCase();
  const room = buildRoomSnapshot(roomCode);
  if (!room) {
    res.status(404).json({ message: "Room not found." });
    return;
  }
  res.json({
    deviceToken: getDeviceToken(req.header("x-device-token")),
    room,
    match: buildMatchSnapshot(roomCode)
  });
});

app.post("/api/profiles", (req, res) => {
  const deviceToken = getDeviceToken(req.header("x-device-token") || req.body.deviceToken);
  const name = String(req.body?.name || "").trim().slice(0, 24);
  if (!name) {
    res.status(400).json({ message: "Profile name is required." });
    return;
  }
  db.prepare(`
    insert into profiles (id, device_token, name, created_at)
    values (?, ?, ?, ?)
  `).run(makeId("profile"), deviceToken, name, nowIso());
  res.json({
    deviceToken,
    profile: listProfilesForDevice(deviceToken).at(-1),
    profiles: listProfilesForDevice(deviceToken)
  });
});

app.post("/api/session/select-profile", (req, res) => {
  const deviceToken = getDeviceToken(req.header("x-device-token") || req.body.deviceToken);
  const profileId = String(req.body?.profileId || "");
  const profile = ensureProfileBelongsToDevice(profileId, deviceToken);
  if (!profile) {
    res.status(404).json({ message: "Profile not found on this device." });
    return;
  }
  const session = createOrReuseSession(profileId, req.header("x-session-token"));
  res.json({
    deviceToken,
    sessionToken: session.token,
    session: sessionPayload(session),
    profiles: listProfilesForDevice(deviceToken),
    rooms: listPublicRooms(),
    room: session.room_code ? buildRoomSnapshot(session.room_code) : null,
    match: session.room_code ? buildMatchSnapshot(session.room_code) : null
  });
});

io.use((socket, next) => {
  const session = sessionFromToken(socket.handshake.auth?.sessionToken);
  socket.data.deviceToken = getDeviceToken(socket.handshake.auth?.deviceToken);
  socket.data.session = session;
  next();
});

io.on("connection", (socket) => {
  if (socket.data.session?.room_code) {
    socket.join(socket.data.session.room_code);
    setMemberOnline(socket.data.session.room_code, socket.data.session.profile_id);
    emitRoomState(socket.data.session.room_code);
  }

  socket.on("session:resume", () => {
    const session = socket.data.session;
    if (!session?.room_code) return;
    setMemberOnline(session.room_code, session.profile_id);
    socket.join(session.room_code);
    emitRoomState(session.room_code);
  });

  socket.on("room:create", ({ title, isPublic }, ack) => {
    ackHandler(ack, () => {
      const session = requireSession(socket);
      const room = createRoomForSession(session, String(title || "").trim().slice(0, 32) || "Untitled Room", !!isPublic, socket);
      socket.data.session = sessionFromToken(session.token);
      emitRoomState(room.code);
      return roomAndMatchPayload(room.code);
    });
  });

  socket.on("room:join", ({ roomCode }, ack) => {
    ackHandler(ack, () => {
      const session = requireSession(socket);
      const room = joinRoomAs(session, String(roomCode || "").toUpperCase(), "player", socket);
      socket.data.session = sessionFromToken(session.token);
      emitRoomState(room.code);
      return roomAndMatchPayload(room.code);
    });
  });

  socket.on("room:watch", ({ roomCode }, ack) => {
    ackHandler(ack, () => {
      const session = requireSession(socket);
      const room = joinRoomAs(session, String(roomCode || "").toUpperCase(), "spectator", socket);
      socket.data.session = sessionFromToken(session.token);
      emitRoomState(room.code);
      return roomAndMatchPayload(room.code);
    });
  });

  socket.on("room:leave", ({ roomCode }, ack) => {
    ackHandler(ack, () => {
      const session = requireSession(socket);
      const targetCode = String(roomCode || session.room_code || "").toUpperCase();
      if (!targetCode) throw new Error("No room to leave.");
      removeMembership(targetCode, session.profile_id, true);
      socket.leave(targetCode);
      db.prepare("update sessions set room_code = null where id = ?").run(session.id);
      socket.data.session = sessionFromToken(session.token);
      emitRoomState(targetCode);
      return { rooms: listPublicRooms(), room: null, match: null };
    });
  });

  socket.on("room:set-ready", ({ roomCode, ready }, ack) => {
    ackHandler(ack, () => {
      const session = requireSession(socket);
      const room = getRoomByCode(roomCode);
      if (!room || room.phase !== ROOM_PHASES.LOBBY) throw new Error("Room is not in lobby phase.");
      db.prepare(`
        update room_members
        set is_ready = ?
        where room_id = ? and profile_id = ? and role = 'player'
      `).run(ready ? 1 : 0, room.id, session.profile_id);
      emitRoomState(roomCode);
      return roomAndMatchPayload(roomCode);
    });
  });

  socket.on("room:start", ({ roomCode }, ack) => {
    ackHandler(ack, () => {
      const session = requireSession(socket);
      const match = startMatch(roomCode, session.profile_id);
      emitRoomState(roomCode);
      return { ...roomAndMatchPayload(roomCode), match };
    });
  });

  socket.on("match:place", ({ roomCode, move }, ack) => {
    ackHandler(ack, () => {
      const session = requireSession(socket);
      const match = placeMove(roomCode, session.profile_id, move);
      emitRoomState(roomCode);
      return { ...roomAndMatchPayload(roomCode), match };
    });
  });

  socket.on("match:pass", ({ roomCode }, ack) => {
    ackHandler(ack, () => {
      const session = requireSession(socket);
      const match = passTurn(roomCode, session.profile_id);
      emitRoomState(roomCode);
      return { ...roomAndMatchPayload(roomCode), match };
    });
  });

  socket.on("match:rematch", ({ roomCode }, ack) => {
    ackHandler(ack, () => {
      const session = requireSession(socket);
      const room = rematchRoom(roomCode, session.profile_id);
      emitRoomState(roomCode);
      return { ...roomAndMatchPayload(roomCode), room, match: null };
    });
  });

  socket.on("disconnect", () => {
    const session = socket.data.session;
    if (!session?.room_code) return;
    const room = getRoomByCode(session.room_code);
    if (!room) return;
    db.prepare(`
      update room_members
      set connection_state = 'offline', disconnected_at = ?
      where room_id = ? and profile_id = ?
    `).run(nowIso(), room.id, session.profile_id);
    transferHost(room);
    emitRoomState(room.code);
  });
});

if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
      next();
      return;
    }
    res.sendFile(join(distDir, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.type("text/plain").send("Frontend build not found. Run `npm run build` or `npm run dev`.");
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Blokus durable server running on http://localhost:${PORT}`);
});
