<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { BOARD_SIZE, COLORS, ORIENTATIONS, PIECES } from "../lib/pieces";

const props = defineProps({
  room: { type: Object, required: true },
  match: { type: Object, default: null },
  currentProfileId: { type: String, default: "" }
});

const emit = defineEmits(["place", "pass"]);

const canvasRef = ref(null);
const selectedPieceId = ref("mono");
const orientationIndex = ref(0);
const hoverCell = ref({ x: -1, y: -1 });

const currentPlayer = computed(() => {
  if (!props.match) return null;
  return props.match.players.find((player) => player.profileId === props.currentProfileId) || null;
});

const isMyTurn = computed(() => {
  if (!props.match || !currentPlayer.value) return false;
  return props.match.players[props.match.turnIndex]?.profileId === props.currentProfileId;
});

const availablePieces = computed(() => new Set(currentPlayer.value?.remainingPieces || []));

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
  if (isMyTurn.value && hoverCell.value.x >= 0 && availablePieces.value.has(selectedPieceId.value)) {
    const piece = ORIENTATIONS[selectedPieceId.value]?.[orientationIndex.value] || [];
    const color = COLORS[(currentPlayer.value?.colorIndex || 0) + 1];
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
}

function rotate() {
  const count = ORIENTATIONS[selectedPieceId.value]?.length || 1;
  orientationIndex.value = (orientationIndex.value + 1) % count;
}

function place() {
  if (!isMyTurn.value || hoverCell.value.x < 0) return;
  emit("place", {
    pieceId: selectedPieceId.value,
    orientationIndex: orientationIndex.value,
    x: hoverCell.value.x,
    y: hoverCell.value.y
  });
}

watch(() => [props.match, selectedPieceId.value, orientationIndex.value, hoverCell.value.x, hoverCell.value.y], draw, { deep: true });
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
      <div class="board-toolbar">
        <button class="secondary" :disabled="!isMyTurn" @click="rotate">Rotate</button>
        <button class="secondary" :disabled="!isMyTurn" @click="$emit('pass')">Pass</button>
      </div>
    </div>

    <div class="rack-panel">
      <h3>Pieces</h3>
      <div class="piece-grid">
        <button
          v-for="piece in PIECES"
          :key="piece.id"
          class="piece-chip"
          :class="{ active: piece.id === selectedPieceId, used: !availablePieces.has(piece.id) }"
          @click="selectedPieceId = piece.id; orientationIndex = 0"
        >
          {{ piece.id }}
        </button>
      </div>
    </div>
  </div>
</template>
