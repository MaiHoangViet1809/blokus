<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { BOARD_SIZE, COLORS, PIECES, PLAYER_COLORS, START_CORNERS, resolvePieceTransform } from "../lib/pieces";

const props = defineProps({
  room: { type: Object, required: true },
  match: { type: Object, default: null },
  currentProfileId: { type: String, default: "" }
});

const emit = defineEmits(["place"]);

const canvasRef = ref(null);
const selectedPieceId = ref("mono");
const rotation = ref(0);
const flipped = ref(false);
const hoverCell = ref({ x: -1, y: -1 });

const currentPlayer = computed(() => {
  if (!props.match) return null;
  return props.match.players.find((player) => player.profileId === props.currentProfileId) || null;
});

const isMyTurn = computed(() => {
  if (!props.match || !currentPlayer.value) return false;
  return props.match.players[props.match.turnIndex]?.profileId === props.currentProfileId;
});

const currentTurnPlayer = computed(() => {
  if (!props.match) return null;
  return props.match.players[props.match.turnIndex] || null;
});
const activeRackPlayer = computed(() => currentPlayer.value || currentTurnPlayer.value || null);
const highlightedCornerPlayer = computed(() => currentTurnPlayer.value || currentPlayer.value || null);
const availablePieces = computed(() => new Set(activeRackPlayer.value?.remainingPieces || []));
const activeColorMeta = computed(() => PLAYER_COLORS[activeRackPlayer.value?.colorIndex || 0] || PLAYER_COLORS[0]);
const activePieceTransform = computed(() => resolvePieceTransform(selectedPieceId.value, rotation.value, flipped.value));
const visiblePieces = computed(() => PIECES.map((piece) => ({
  ...piece,
  used: !availablePieces.value.has(piece.id)
})));

function clampCell(value) {
  return Math.max(0, Math.min(BOARD_SIZE - 1, value));
}

function pointerToCell(event) {
  const canvas = canvasRef.value;
  const rect = canvas.getBoundingClientRect();
  return {
    x: clampCell(Math.floor(((event.clientX - rect.left) / rect.width) * BOARD_SIZE)),
    y: clampCell(Math.floor(((event.clientY - rect.top) / rect.height) * BOARD_SIZE))
  };
}

function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const cellSize = canvas.width / BOARD_SIZE;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const board = props.match?.board || Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      ctx.fillStyle = COLORS[board[y][x]] || COLORS[0];
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }
  for (const colorMeta of PLAYER_COLORS) {
    const [cornerX, cornerY] = START_CORNERS[colorMeta.colorIndex];
    ctx.save();
    ctx.strokeStyle = `${colorMeta.fill}aa`;
    ctx.lineWidth = 2;
    ctx.strokeRect(cornerX * cellSize + 2, cornerY * cellSize + 2, cellSize - 4, cellSize - 4);
    ctx.restore();
  }
  if (isMyTurn.value && hoverCell.value.x >= 0 && availablePieces.value.has(selectedPieceId.value)) {
    const piece = activePieceTransform.value.cells;
    const color = activeColorMeta.value.fill;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = color;
    for (const [dx, dy] of piece) {
      const x = hoverCell.value.x + dx;
      const y = hoverCell.value.y + dy;
      if (x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
    ctx.globalAlpha = 1;
  }
  if (highlightedCornerPlayer.value && !highlightedCornerPlayer.value.hasMoved) {
    const [cornerX, cornerY] = START_CORNERS[highlightedCornerPlayer.value.colorIndex];
    ctx.save();
    ctx.strokeStyle = PLAYER_COLORS[highlightedCornerPlayer.value.colorIndex]?.fill || activeColorMeta.value.fill;
    ctx.lineWidth = 4;
    ctx.strokeRect(cornerX * cellSize + 1, cornerY * cellSize + 1, cellSize - 2, cellSize - 2);
    ctx.restore();
  }
}

function rotate() {
  rotation.value = (rotation.value + 1) % 4;
}

function flip() {
  flipped.value = !flipped.value;
}

function place() {
  if (!isMyTurn.value || hoverCell.value.x < 0) return;
  emit("place", {
    pieceId: selectedPieceId.value,
    orientationIndex: activePieceTransform.value.orientationIndex,
    x: hoverCell.value.x,
    y: hoverCell.value.y
  });
}

watch(() => [
  props.match,
  selectedPieceId.value,
  rotation.value,
  flipped.value,
  hoverCell.value.x,
  hoverCell.value.y
], draw, { deep: true });
watch(availablePieces, (pieces) => {
  if (!pieces.has(selectedPieceId.value)) {
    const nextPiece = PIECES.find((piece) => pieces.has(piece.id));
    selectedPieceId.value = nextPiece?.id || PIECES[0].id;
    rotation.value = 0;
    flipped.value = false;
  }
});
onMounted(draw);
</script>

<template>
  <div class="board-layout">
    <div class="board-panel">
      <canvas
        ref="canvasRef"
        width="640"
        height="640"
        class="board-canvas"
        @mousemove="hoverCell = pointerToCell($event)"
        @mouseleave="hoverCell = { x: -1, y: -1 }"
        @click="place"
        @contextmenu.prevent="rotate"
      />
    </div>

    <div class="rack-panel">
      <div class="board-rack-head">
        <div class="stack stack-tight">
          <h3>{{ activeColorMeta.name }} pieces</h3>
          <p class="muted">Start: {{ activeColorMeta.cornerLabel }}</p>
        </div>
        <span class="phase-pill">{{ activeRackPlayer?.remainingPieces?.length || 0 }} left</span>
      </div>
      <div class="piece-grid">
        <button
          v-for="piece in visiblePieces"
          :key="piece.id"
          class="piece-chip"
          :class="{ active: piece.id === selectedPieceId, used: piece.used }"
          :disabled="piece.used"
          :style="{ '--piece-color': activeColorMeta.fill }"
          @click="selectedPieceId = piece.id; rotation = 0; flipped = false"
        >
          <span
            class="piece-preview"
            :style="{ '--piece-cols': piece.previewWidth, '--piece-rows': piece.previewHeight }"
            aria-hidden="true"
          >
            <span
              v-for="(cell, index) in piece.cells"
              :key="`${piece.id}-${index}`"
              class="piece-preview-cell"
              :style="{ gridColumn: `${cell[0] + 1}`, gridRow: `${cell[1] + 1}` }"
            />
          </span>
          <span class="piece-label">{{ piece.label }}</span>
        </button>
      </div>
      <div class="rack-actions">
        <button class="secondary" :disabled="!isMyTurn" @click="rotate">Rotate</button>
        <button class="secondary" :disabled="!isMyTurn" @click="flip">Flip</button>
      </div>
    </div>
  </div>
</template>
