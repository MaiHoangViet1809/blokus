<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { BOARD_SIZE, COLORS, PLAYER_COLORS, buildStartCorners, resolvePieceTransform } from "./shared.js";

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
const boardSize = computed(() => props.match?.boardSize || BOARD_SIZE);
const boardColors = computed(() => props.match?.colors || PLAYER_COLORS);
const startCorners = computed(() => props.match?.startCorners || buildStartCorners(boardSize.value));
const activeColorMeta = computed(() => boardColors.value[activeRackPlayer.value?.colorIndex || 0] || boardColors.value[0] || PLAYER_COLORS[0]);
const activePieceTransform = computed(() => resolvePieceTransform(props.selectedPieceId, props.rotation, props.flipped));
const lastPlacedPiece = computed(() => props.match?.lastPlacedPiece || null);

function clampCell(value) {
  return Math.max(0, Math.min(boardSize.value - 1, value));
}

function pointerToCell(event) {
  const canvas = canvasRef.value;
  const rect = canvas.getBoundingClientRect();
  return {
    x: clampCell(Math.floor(((event.clientX - rect.left) / rect.width) * boardSize.value)),
    y: clampCell(Math.floor(((event.clientY - rect.top) / rect.height) * boardSize.value))
  };
}

function draw() {
  const canvas = canvasRef.value;
  if (!canvas || boardSide.value <= 0) return;
  const ctx = canvas.getContext("2d");
  const size = boardSize.value;
  const cellSize = canvas.width / size;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const board = props.match?.board || Array.from({ length: size }, () => Array(size).fill(0));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      ctx.fillStyle = COLORS[board[y][x]] || COLORS[0];
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }
  for (const player of props.match?.players || []) {
    const colorMeta = boardColors.value[player.colorIndex];
    if (!colorMeta) continue;
    const [cornerX, cornerY] = startCorners.value[player.colorIndex];
    ctx.save();
    ctx.fillStyle = `${colorMeta.fill}99`;
    ctx.fillRect(cornerX * cellSize, cornerY * cellSize, cellSize, cellSize);
    ctx.strokeStyle = `${colorMeta.fill}dd`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cornerX * cellSize + 1, cornerY * cellSize + 1, cellSize - 2, cellSize - 2);
    ctx.restore();
  }
  if (lastPlacedPiece.value?.cells?.length) {
    const highlightMeta = boardColors.value[lastPlacedPiece.value.colorIndex] || activeColorMeta.value;
    const inset = Math.max(2, cellSize * 0.08);
    ctx.save();
    for (const [x, y] of lastPlacedPiece.value.cells) {
      ctx.fillStyle = `${highlightMeta.fill}33`;
      ctx.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
      ctx.strokeStyle = "rgba(255,255,255,0.88)";
      ctx.lineWidth = Math.max(2, cellSize * 0.08);
      ctx.strokeRect(x * cellSize + inset, y * cellSize + inset, cellSize - inset * 2, cellSize - inset * 2);
      ctx.strokeStyle = highlightMeta.fill;
      ctx.lineWidth = Math.max(1.25, cellSize * 0.045);
      ctx.strokeRect(x * cellSize + inset * 1.9, y * cellSize + inset * 1.9, cellSize - inset * 3.8, cellSize - inset * 3.8);
    }
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
      if (x >= 0 && y >= 0 && x < size && y < size) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
    ctx.globalAlpha = 1;
  }
  if (highlightedCornerPlayer.value && !highlightedCornerPlayer.value.hasMoved) {
    const [cornerX, cornerY] = startCorners.value[highlightedCornerPlayer.value.colorIndex];
    ctx.save();
    ctx.strokeStyle = boardColors.value[highlightedCornerPlayer.value.colorIndex]?.fill || activeColorMeta.value.fill;
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
