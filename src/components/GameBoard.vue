<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { BOARD_SIZE, COLORS, PLAYER_COLORS, START_CORNERS, resolvePieceTransform } from "../lib/pieces";

const props = defineProps({
  room: { type: Object, required: true },
  match: { type: Object, default: null },
  currentProfileId: { type: String, default: "" },
  selectedPieceId: { type: String, default: "mono" },
  rotation: { type: Number, default: 0 },
  flipped: { type: Boolean, default: false }
});

const emit = defineEmits(["place", "rotate"]);

const boardPanelRef = ref(null);
const canvasRef = ref(null);
const hoverCell = ref({ x: -1, y: -1 });
const boardSide = ref(0);
let resizeObserver = null;

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
const activePieceTransform = computed(() => resolvePieceTransform(props.selectedPieceId, props.rotation, props.flipped));

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
  if (!canvas || boardSide.value <= 0) return;
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
  for (const player of props.match?.players || []) {
    const colorMeta = PLAYER_COLORS[player.colorIndex];
    if (!colorMeta) continue;
    const [cornerX, cornerY] = START_CORNERS[player.colorIndex];
    ctx.save();
    ctx.fillStyle = `${colorMeta.fill}99`;
    ctx.fillRect(cornerX * cellSize, cornerY * cellSize, cellSize, cellSize);
    ctx.strokeStyle = `${colorMeta.fill}dd`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cornerX * cellSize + 1, cornerY * cellSize + 1, cellSize - 2, cellSize - 2);
    ctx.restore();
  }
  if (isMyTurn.value && hoverCell.value.x >= 0 && availablePieces.value.has(props.selectedPieceId)) {
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

function resizeBoard() {
  const panel = boardPanelRef.value;
  const canvas = canvasRef.value;
  if (!panel || !canvas) return;
  const nextSide = Math.max(0, Math.floor(Math.min(panel.clientWidth, panel.clientHeight)));
  if (!nextSide) return;
  if (canvas.width !== nextSide || canvas.height !== nextSide) {
    canvas.width = nextSide;
    canvas.height = nextSide;
  }
  boardSide.value = nextSide;
  draw();
}

function place() {
  if (!isMyTurn.value || hoverCell.value.x < 0) return;
  emit("place", {
    pieceId: props.selectedPieceId,
    orientationIndex: activePieceTransform.value.orientationIndex,
    x: hoverCell.value.x,
    y: hoverCell.value.y
  });
}

watch(() => [
  props.match,
  props.selectedPieceId,
  props.rotation,
  props.flipped,
  hoverCell.value.x,
  hoverCell.value.y
], draw, { deep: true });
onMounted(() => {
  resizeBoard();
  resizeObserver = new ResizeObserver(() => resizeBoard());
  if (boardPanelRef.value) {
    resizeObserver.observe(boardPanelRef.value);
  }
  draw();
});
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});
</script>

<template>
  <div ref="boardPanelRef" class="board-panel">
    <canvas
      ref="canvasRef"
      class="board-canvas"
      :style="{ width: `${boardSide}px`, height: `${boardSide}px` }"
      @mousemove="hoverCell = pointerToCell($event)"
      @mouseleave="hoverCell = { x: -1, y: -1 }"
      @click="place"
      @contextmenu.prevent="emit('rotate')"
    />
  </div>
</template>
