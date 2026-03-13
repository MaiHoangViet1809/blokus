<script setup>
import { computed, ref, watch } from "vue";
import GameBoard from "./GameBoard.vue";
import { PIECES, PLAYER_COLORS, resolvePieceTransform } from "./shared.js";

const DEFAULT_PIECE_ID = PIECES[0]?.id || "mono";
const PIECE_TRANSFORM_STORAGE_PREFIX = "blokus-live-piece-transforms";

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

const selectedPieceId = ref(DEFAULT_PIECE_ID);
const pieceTransforms = ref({});

const currentPlayer = computed(() =>
  props.gameView?.players?.find((player) => player.profileId === props.interactiveProfileId) || null
);
const currentTurnPlayer = computed(() => props.gameView?.players?.[props.gameView?.turnIndex] || null);
const activeRackPlayer = computed(() => currentPlayer.value || currentTurnPlayer.value || null);
const colorPalette = computed(() => props.gameView?.colors || PLAYER_COLORS);
const activeColorMeta = computed(() => colorPalette.value[activeRackPlayer.value?.colorIndex || 0] || colorPalette.value[0] || PLAYER_COLORS[0]);
const availablePieceIds = computed(() => new Set(activeRackPlayer.value?.remainingPieces || []));
const pieceTransformStorageKey = computed(() => {
  if (!props.match?.id || !props.interactiveProfileId || !currentPlayer.value) return "";
  return `${PIECE_TRANSFORM_STORAGE_PREFIX}:${props.match.id}:${props.interactiveProfileId}`;
});
const visiblePieces = computed(() => PIECES.map((piece) => {
  const transformed = resolvePieceTransform(piece.id, pieceRotation(piece.id), pieceFlipped(piece.id));
  const maxX = Math.max(...transformed.cells.map(([x]) => x), 0);
  const maxY = Math.max(...transformed.cells.map(([, y]) => y), 0);
  return {
    ...piece,
    previewCells: transformed.cells,
    previewWidth: maxX + 1,
    previewHeight: maxY + 1,
    used: !availablePieceIds.value.has(piece.id)
  };
}));
const selectedRotation = computed(() => pieceRotation(selectedPieceId.value));
const selectedFlipped = computed(() => pieceFlipped(selectedPieceId.value));
const canTransform = computed(() =>
  !!currentPlayer.value
  && availablePieceIds.value.has(selectedPieceId.value)
);
const scoreboard = computed(() =>
  [...(props.gameView?.players || [])]
    .sort((left, right) => {
      if (left.remainingCells !== right.remainingCells) {
        return left.remainingCells - right.remainingCells;
      }
      return left.seatIndex - right.seatIndex;
    })
    .map((player, index) => {
      const rank = index + 1;
      return {
        ...player,
        rank,
        colorMeta: colorMeta(player.colorIndex),
        isActive: player.profileId === currentTurnPlayer.value?.profileId,
        isViewer: player.profileId === currentPlayer.value?.profileId,
        statusLabel: playerStatusLabel(player, rank),
        stateLabel: playerStateLabel(player.endState)
      };
    })
);

function colorMeta(colorIndex) {
  return colorPalette.value[colorIndex ?? 0] || colorPalette.value[0] || PLAYER_COLORS[0];
}

function normalizeRotation(value) {
  const numeric = Math.trunc(Number(value));
  if (!Number.isFinite(numeric)) return 0;
  return ((numeric % 4) + 4) % 4;
}

function playerStateLabel(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Waiting";
  return normalized
    .toLowerCase()
    .split("_")
    .map((segment) => segment ? `${segment[0].toUpperCase()}${segment.slice(1)}` : "")
    .join(" ");
}

function playerStatusLabel(player, rank) {
  if (player.disconnected) return "Offline";
  if (props.room.phase === "ABANDONED") return "Abandoned";
  if (props.room.phase === "SUSPENDED") return "Suspended";
  if (props.room.phase === "STARTING") return "Starting";
  if (props.room.phase === "IN_GAME" && player.profileId === currentTurnPlayer.value?.profileId) return "To move";
  if (props.room.phase === "FINISHED") return rank === 1 ? "Finished #1" : "Finished";
  if (player.endState && player.endState !== "ACTIVE") return playerStateLabel(player.endState);
  return "Waiting";
}

function readStoredPieceTransforms(storageKey) {
  if (!storageKey) return {};
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      PIECES.flatMap((piece) => {
        const entry = parsed[piece.id];
        if (!entry || typeof entry !== "object") return [];
        return [[piece.id, {
          rotation: normalizeRotation(entry.rotation),
          flipped: !!entry.flipped
        }]];
      })
    );
  } catch {
    return {};
  }
}

function pieceRotation(pieceId) {
  return pieceTransforms.value[pieceId]?.rotation || 0;
}

function pieceFlipped(pieceId) {
  return !!pieceTransforms.value[pieceId]?.flipped;
}

function writePieceTransform(pieceId, nextRotation, nextFlipped) {
  pieceTransforms.value = {
    ...pieceTransforms.value,
    [pieceId]: {
      rotation: normalizeRotation(nextRotation),
      flipped: !!nextFlipped
    }
  };
}

function choosePiece(pieceId) {
  selectedPieceId.value = pieceId;
}

function rotate() {
  if (!canTransform.value) return;
  writePieceTransform(selectedPieceId.value, selectedRotation.value + 1, selectedFlipped.value);
}

function flip() {
  if (!canTransform.value) return;
  writePieceTransform(selectedPieceId.value, selectedRotation.value, !selectedFlipped.value);
}

watch(pieceTransformStorageKey, (storageKey) => {
  pieceTransforms.value = readStoredPieceTransforms(storageKey);
}, { immediate: true });

watch([pieceTransforms, pieceTransformStorageKey], ([transforms, storageKey]) => {
  if (!storageKey) return;
  localStorage.setItem(storageKey, JSON.stringify(transforms));
}, { deep: true });

watch(availablePieceIds, (pieces) => {
  if (!pieces.has(selectedPieceId.value)) {
    const nextPiece = PIECES.find((piece) => pieces.has(piece.id));
    selectedPieceId.value = nextPiece?.id || DEFAULT_PIECE_ID;
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
          <div class="stack stack-tight">
            <strong>Scoreboard</strong>
            <span class="muted">Host {{ room.hostName }} · {{ spectatorCount }} spectators</span>
          </div>
          <span class="muted">Lowest cells leads</span>
        </div>
        <div class="mini-scoreboard__list">
          <div
            v-for="player in scoreboard"
            :key="player.profileId"
            class="mini-scoreboard__card"
            :class="{
              'mini-scoreboard__card--active': player.isActive,
              'mini-scoreboard__card--viewer': player.isViewer
            }"
            :style="{ '--player-color': colorMeta(player.colorIndex).fill }"
          >
            <div class="mini-scoreboard__card-head">
              <div class="stack stack-tight">
                <div class="mini-scoreboard__card-title">
                  <span class="mini-scoreboard__rank">#{{ player.rank }}</span>
                  <strong>{{ player.name }}</strong>
                </div>
                <span class="muted">{{ player.colorMeta.name }}</span>
              </div>
              <span class="phase-pill">{{ player.statusLabel }}</span>
            </div>
            <div class="mini-scoreboard__card-meta mini-scoreboard__card-meta--compact">
              <span><span class="muted">Cells</span> <strong>{{ player.remainingCells }}</strong></span>
              <span><span class="muted">Pieces</span> <strong>{{ player.remainingPieces?.length || 0 }}</strong></span>
              <span><span class="muted">Win rate</span> <strong>{{ player.overallRecord?.winRate || 0 }}%</strong></span>
              <span><span class="muted">State</span> <strong>{{ player.stateLabel }}</strong></span>
            </div>
          </div>
        </div>
      </div>

      <GameBoard
        class="board-stage"
        :room="room"
        :match="gameView"
        :current-profile-id="interactiveProfileId"
        :selected-piece-id="selectedPieceId"
        :rotation="selectedRotation"
        :flipped="selectedFlipped"
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
  </article>
</template>
