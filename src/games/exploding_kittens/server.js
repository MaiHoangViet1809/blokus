import { buildEkRoomConfig, EXPLODING_KITTENS_GAME_TYPE, resolveEkRuleset } from "./shared.js";

export { EXPLODING_KITTENS_GAME_TYPE };

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function createInitialState(roomConfig) {
  return {
    ruleset: roomConfig.ruleset,
    statusText: "Waiting for the first EK action implementation.",
    turnIndex: 0,
    playersAlive: roomConfig.maxPlayers,
    drawPileCount: 0,
    discardPile: [],
    prompt: {
      type: "not_ready",
      label: "Exploding Kittens v1 implementation is being wired in."
    }
  };
}

function buildSetupPlayer(member) {
  return {
    profileId: member.profile_id,
    name: member.name,
    seatIndex: member.seat_index,
    isReady: !!member.is_ready,
    isHost: !!member.isHost,
    connectionState: member.connection_state
  };
}

function projectSetup(room, members, viewerProfileId) {
  const roomConfig = buildEkRoomConfig(parseJson(room.config_json, {}));
  const players = members
    .filter((member) => member.role === "player")
    .sort((a, b) => a.seat_index - b.seat_index)
    .map(buildSetupPlayer);
  return {
    gameType: EXPLODING_KITTENS_GAME_TYPE,
    ruleset: roomConfig.ruleset,
    modeLabel: roomConfig.modeLabel,
    minPlayers: roomConfig.minPlayers,
    maxPlayers: roomConfig.maxPlayers,
    viewerProfileId,
    players
  };
}

export function createExplodingKittensDriver() {
  return {
    buildRoomConfig(config = {}) {
      return buildEkRoomConfig(config);
    },
    validateRoomSetup(_room, members, roomConfig) {
      const seatedPlayers = members.filter((member) => member.role === "player");
      if (seatedPlayers.length < roomConfig.minPlayers) {
        throw new Error(`Need at least ${roomConfig.minPlayers} players for ${roomConfig.modeLabel}.`);
      }
      if (seatedPlayers.length > roomConfig.maxPlayers) {
        throw new Error(`${roomConfig.modeLabel} supports at most ${roomConfig.maxPlayers} players.`);
      }
    },
    projectRoomSetup(room, members, viewerProfileId) {
      return projectSetup(room, members, viewerProfileId);
    },
    applyRoomPatch() {
      throw new Error("Exploding Kittens does not use room setup patches in v1.");
    },
    createMatch(room, members, makeId) {
      const roomConfig = buildEkRoomConfig(parseJson(room.config_json, {}));
      const players = members
        .filter((member) => member.role === "player")
        .sort((a, b) => a.seat_index - b.seat_index);
      const state = createInitialState(roomConfig);
      return {
        matchId: makeId("match"),
        boardJson: JSON.stringify(state),
        governanceJson: JSON.stringify({ endVotes: [], rematchVotes: [] }),
        turnIndex: 0,
        status: "starting",
        winnerProfileId: null,
        finishedAt: null,
        firstCommittedAt: null,
        matchPlayers: players.map((player) => ({
          id: makeId("match_player"),
          profile_id: player.profile_id,
          seatIndex: player.seat_index,
          colorIndex: player.seat_index,
          remainingPiecesJson: JSON.stringify([])
        })),
        events: [
          {
            profileId: null,
            eventType: "match_started",
            payload: { ruleset: roomConfig.ruleset }
          }
        ]
      };
    },
    projectMatch(room, match, players, viewerProfileId) {
      const state = parseJson(match.board_json, createInitialState(buildEkRoomConfig(parseJson(room.config_json, {}))));
      return {
        gameType: EXPLODING_KITTENS_GAME_TYPE,
        ruleset: state.ruleset,
        modeLabel: buildEkRoomConfig(parseJson(room.config_json, {})).modeLabel,
        viewerProfileId,
        status: match.status,
        turnIndex: state.turnIndex,
        statusText: state.statusText,
        drawPileCount: state.drawPileCount,
        discardPile: state.discardPile,
        prompt: state.prompt,
        players: players.map((player) => ({
          profileId: player.profile_id,
          name: player.name,
          seatIndex: player.seat_index,
          handCount: Array.isArray(player.remainingPieces) ? player.remainingPieces.length : 0,
          isMe: player.profile_id === viewerProfileId,
          disconnected: !!player.disconnected,
          endState: player.end_state
        })),
        me: players.find((player) => player.profile_id === viewerProfileId)
          ? {
              hand: []
            }
          : null,
        availableActions: []
      };
    },
    buildReplay(room, match, players, moves) {
      return {
        gameType: EXPLODING_KITTENS_GAME_TYPE,
        ruleset: resolveEkRuleset(parseJson(room.config_json, {})).ruleset,
        modeLabel: buildEkRoomConfig(parseJson(room.config_json, {})).modeLabel,
        id: match.id,
        roomCode: room.code,
        roomTitle: room.title,
        status: match.status,
        winnerProfileId: match.winner_profile_id,
        winnerName: players.find((player) => player.profile_id === match.winner_profile_id)?.name || null,
        createdAt: match.created_at,
        finishedAt: match.finished_at,
        moveCount: moves.length,
        frames: moves.map((move, index) => ({
          step: index + 1,
          eventType: move.eventType,
          label: move.eventType,
          actorName: move.playerName,
          payload: move.payload
        }))
      };
    },
    handleCommand() {
      throw new Error("Exploding Kittens v1 server actions are not wired yet.");
    },
    onReconnect(match, players) {
      return { status: match.status, players };
    },
    onDisconnect(match, players) {
      return { status: match.status, players };
    },
    onReclaimExpired(_room, match, players) {
      return { status: match.status, players };
    }
  };
}
