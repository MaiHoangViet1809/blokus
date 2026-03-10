<script setup>
import { computed, ref, watch } from "vue";
import GameBoard from "../../components/GameBoard.vue";
import { PIECES, PLAYER_COLORS, resolvePieceTransform } from "../../lib/pieces";

const props = defineProps({
  room: { type: Object, required: true },
  match: { type: Object, required: true },
  gameView: { type: Object, required: true },
  interactiveProfileId: { type: String, default: "" },
  spectatorCount: { type: Number, default: 0 }
});

const emit = defineEmits(["place"]);

const currentTurnName = computed(() => {
  if (!props.gameView) return "Waiting";
  return props.gameView.players?.[props.gameView.turnIndex]?.name || props.match.activePlayerName || "Waiting";
});

const matchHeading = computed(() => {
  if (props.room.phase === "FINISHED") return "Match Summary";
  if (props.room.phase === "ABANDONED") return "Abandoned Match";
  if (props.room.phase === "SUSPENDED") return "Suspended Match";
  if (props.room.phase === "STARTING") return "Starting Match";
  return "Active Match";
});

const scoreboard = computed(() =>
  [...(props.gameView?.players || [])]
    .sort((left, right) => {
      if (left.remainingCells !== right.remainingCells) {
        return left.remainingCells - right.remainingCells;
      }
      return left.seatIndex - right.seatIndex;
    })
    .map((player, index) => ({
      ...player,
      rank: index + 1
    }))
);

const selectedPieceId = ref("mono");
const rotation = ref(0);
const flipped = ref(false);

const currentPlayer = computed(() =>
  props.gameView?.players?.find((player) => player.profileId === props.interactiveProfileId) || null
);
const currentTurnPlayer = computed(() => props.gameView?.players?.[props.gameView?.turnIndex] || null);
const activeRackPlayer = computed(() => currentPlayer.value || currentTurnPlayer.value || null);
const colorPalette = computed(() => props.gameView?.colors || PLAYER_COLORS);
const activeColorMeta = computed(() => colorPalette.value[activeRackPlayer.value?.colorIndex || 0] || colorPalette.value[0] || PLAYER_COLORS[0]);
const availablePieceIds = computed(() => new Set(activeRackPlayer.value?.remainingPieces || []));
const visiblePieces = computed(() => PIECES.map((piece) => ({
  ...piece,
  previewCells: piece.cells,
  previewWidth: piece.previewWidth,
  previewHeight: piece.previewHeight,
  used: !availablePieceIds.value.has(piece.id)
})).map((piece) => {
  if (piece.id !== selectedPieceId.value) return piece;
  const transformed = resolvePieceTransform(piece.id, rotation.value, flipped.value);
  const maxX = Math.max(...transformed.cells.map(([x]) => x), 0);
  const maxY = Math.max(...transformed.cells.map(([, y]) => y), 0);
  return {
    ...piece,
    previewCells: transformed.cells,
    previewWidth: maxX + 1,
    previewHeight: maxY + 1
  };
}));
const canTransform = computed(() =>
  !!props.interactiveProfileId
  && props.gameView?.players?.[props.gameView.turnIndex]?.profileId === props.interactiveProfileId
);

function colorMeta(colorIndex) {
  return colorPalette.value[colorIndex ?? 0] || colorPalette.value[0] || PLAYER_COLORS[0];
}

function choosePiece(pieceId) {
  selectedPieceId.value = pieceId;
  rotation.value = 0;
  flipped.value = false;
}

function rotate() {
  rotation.value = (rotation.value + 1) % 4;
}

function flip() {
  flipped.value = !flipped.value;
}

watch(availablePieceIds, (pieces) => {
  if (!pieces.has(selectedPieceId.value)) {
    const nextPiece = PIECES.find((piece) => pieces.has(piece.id));
    selectedPieceId.value = nextPiece?.id || PIECES[0].id;
    rotation.value = 0;
    flipped.value = false;
  }
});
</script>

<template>
  <article class="panel gameplay-panel">
    <div class="section-head">
      <div>
        <h2>{{ matchHeading }}</h2>
        <p v-if="room.phase !== 'IN_GAME'" class="muted">Turn: {{ currentTurnName }}</p>
      </div>
      <span v-if="room.phase !== 'IN_GAME'" class="phase-pill">{{ room.phase }}</span>
    </div>

    <div class="match-main-row">
      <div class="mini-scoreboard panel">
        <div class="mini-scoreboard__head">
          <strong>Scoreboard</strong>
          <span class="muted">Lowest cells leads</span>
        </div>
        <div class="mini-scoreboard__list">
          <div
            v-for="player in scoreboard"
            :key="player.profileId"
            class="mini-scoreboard__row"
            :style="{ '--player-color': colorMeta(player.colorIndex).fill }"
          >
            <span class="mini-scoreboard__rank">#{{ player.rank }}</span>
            <strong>{{ player.name }}</strong>
            <span class="muted">{{ colorMeta(player.colorIndex).name }}</span>
            <span class="mini-scoreboard__value">{{ player.remainingCells }} cells</span>
          </div>
        </div>
      </div>

      <GameBoard
        class="board-stage"
        :room="room"
        :match="gameView"
        :current-profile-id="interactiveProfileId"
        :selected-piece-id="selectedPieceId"
        :rotation="rotation"
        :flipped="flipped"
        @place="emit('place', $event)"
        @rotate="rotate"
      />

      <div class="rack-panel panel">
        <div class="board-rack-head">
          <h3>Pieces</h3>
          <span class="phase-pill">{{ activeRackPlayer?.remainingPieces?.length || 0 }} left</span>
        </div>
        <div class="piece-grid">
          <button
            v-for="piece in visiblePieces"
            :key="piece.id"
            class="piece-chip"
            :class="{ active: piece.id === selectedPieceId, used: piece.used }"
            :disabled="piece.used"
            :aria-label="piece.label"
            :style="{ '--piece-color': activeColorMeta.fill }"
            @click="choosePiece(piece.id)"
          >
            <span
              class="piece-preview"
              :style="{ '--piece-cols': piece.previewWidth, '--piece-rows': piece.previewHeight }"
              aria-hidden="true"
            >
              <span
                v-for="(cell, index) in piece.previewCells"
                :key="`${piece.id}-${index}`"
                class="piece-preview-cell"
                :style="{ gridColumn: `${cell[0] + 1}`, gridRow: `${cell[1] + 1}` }"
              />
            </span>
          </button>
        </div>
        <div class="rack-actions">
          <button class="secondary" :disabled="!canTransform" @click="rotate">Rotate</button>
          <button class="secondary" :disabled="!canTransform" @click="flip">Flip</button>
        </div>
      </div>
    </div>

    <div class="player-strip" :class="{ 'player-strip--compact': ['STARTING', 'IN_GAME', 'SUSPENDED'].includes(room.phase) }">
      <div
        v-for="player in gameView.players"
        :key="player.profileId"
        class="player-strip-item"
        :class="{ active: player.profileId === gameView.players[gameView.turnIndex]?.profileId }"
        :style="{ '--player-color': colorMeta(player.colorIndex).fill }"
      >
        <strong>{{ player.name }}</strong>
        <span class="muted">{{ colorMeta(player.colorIndex).name }}</span>
        <span class="muted">{{ player.remainingCells }} cells</span>
        <span class="muted">{{ player.endState }}</span>
      </div>
      <div class="player-strip-item player-strip-item--meta">
        <strong>Host</strong>
        <span class="muted">{{ room.hostName }}</span>
      </div>
      <div class="player-strip-item player-strip-item--meta">
        <strong>Spectators</strong>
        <span class="muted">{{ spectatorCount }}</span>
      </div>
    </div>
  </article>
</template>
