<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { buildMoveRowsFromFrames, FILE_LABELS, pieceSvgAsset, RANK_LABELS } from "./shared.js";

const props = defineProps({
  replay: { type: Object, default: null }
});

const currentStep = ref(0);
const boardShellRef = ref(null);
const boardRanksRef = ref(null);
const boardFilesRef = ref(null);
const boardSide = ref(0);
let boardResizeObserver = null;

const maxStep = computed(() => Math.max(0, (props.replay?.frames?.length || 1) - 1));
const frame = computed(() => props.replay?.frames?.[currentStep.value] || null);
const moveRows = computed(() => buildMoveRowsFromFrames(props.replay?.frames || []));
const boardFrameStyle = computed(() => boardSide.value ? { width: `${boardSide.value}px` } : {});
const boardStyle = computed(() => boardSide.value ? { width: `${boardSide.value}px`, height: `${boardSide.value}px` } : {});
const boardFilesStyle = computed(() => boardSide.value ? { width: `${boardSide.value}px` } : {});
const boardRanksStyle = computed(() => boardSide.value ? { height: `${boardSide.value}px` } : {});
const replaySquares = computed(() =>
  Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 8 }, (_, x) => ({
      x,
      y,
      piece: frame.value?.board?.[y]?.[x] || null
    }))
  ).flat()
);

watch(() => props.replay?.id, () => {
  currentStep.value = 0;
});

function jumpToStep(step) {
  currentStep.value = Math.max(0, Math.min(maxStep.value, step));
}

function syncBoardSide() {
  const shell = boardShellRef.value;
  const ranks = boardRanksRef.value;
  const files = boardFilesRef.value;
  if (!shell || !ranks || !files) return;
  const shellStyle = window.getComputedStyle(shell);
  const columnGap = Number.parseFloat(shellStyle.columnGap || shellStyle.gap || "0") || 0;
  const frameNode = shell.querySelector(".chess-board-frame");
  const frameStyle = frameNode ? window.getComputedStyle(frameNode) : null;
  const rowGap = frameStyle ? (Number.parseFloat(frameStyle.rowGap || frameStyle.gap || "0") || 0) : 0;
  const availableWidth = shell.clientWidth - ranks.clientWidth - columnGap;
  const availableHeight = shell.clientHeight - files.clientHeight - rowGap;
  boardSide.value = Math.max(0, Math.floor(Math.min(availableWidth, availableHeight)));
}

function bindBoardResize() {
  if (!boardShellRef.value || !boardRanksRef.value || !boardFilesRef.value) return;
  boardResizeObserver?.disconnect();
  boardResizeObserver = new ResizeObserver(() => {
    syncBoardSide();
  });
  boardResizeObserver.observe(boardShellRef.value);
  boardResizeObserver.observe(boardRanksRef.value);
  boardResizeObserver.observe(boardFilesRef.value);
  syncBoardSide();
}

onMounted(() => {
  bindBoardResize();
});

onBeforeUnmount(() => {
  boardResizeObserver?.disconnect();
});
</script>

<template>
  <section v-if="replay" class="panel chess-replay-panel">
    <div class="section-head">
      <div>
        <h2>Replay</h2>
        <p class="muted">{{ replay.roomTitle }} · {{ replay.finishedAt || replay.createdAt }}</p>
      </div>
      <p class="muted">Winner: {{ replay.winnerName || "Draw" }}</p>
    </div>

    <div class="chess-replay-layout">
      <section class="panel chess-status-panel chess-status-panel--replay">
        <div class="chess-side-identity">
          <div
            v-for="player in replay.players"
            :key="player.profileId"
            class="chess-side-card"
            :class="{ 'chess-side-card--active': frame?.activeColorIndex === player.colorIndex }"
            :style="{ '--player-color': player.colorFill, '--player-text': player.textFill || '#fff' }"
          >
            <div class="chess-side-card__head">
              <strong>{{ player.name }}</strong>
              <span class="phase-pill">{{ player.colorIndex === 0 ? "White" : "Black" }}</span>
            </div>
            <div class="chess-side-card__meta">
              <span>{{ player.endState }}</span>
              <span>{{ player.score }}</span>
            </div>
          </div>
        </div>

        <div class="chess-status-copy">
          <p class="chess-turn-line">
            <strong>{{ frame?.label || "Opening position" }}</strong>
            <span>Step {{ currentStep }} / {{ maxStep }}</span>
          </p>
          <p class="muted">Move list synced to replay frame.</p>
        </div>
      </section>

      <section class="panel board-panel chess-board-panel">
        <div ref="boardShellRef" class="chess-board-shell">
          <div ref="boardRanksRef" class="chess-ranks" :style="boardRanksStyle">
            <span v-for="rank in RANK_LABELS" :key="`replay-rank-${rank}`" class="chess-rank-marker">{{ rank }}</span>
          </div>
          <div class="chess-board-frame" :style="boardFrameStyle">
            <div class="chess-board chess-board--replay" :style="boardStyle">
              <button
                v-for="square in replaySquares"
                :key="`replay-${square.x}-${square.y}`"
                class="chess-square"
                :class="{
                  'chess-square--light': (square.x + square.y) % 2 === 0,
                  'chess-square--dark': (square.x + square.y) % 2 === 1,
                  'chess-square--last': frame?.payload && ((frame.payload.from?.x === square.x && frame.payload.from?.y === square.y) || (frame.payload.to?.x === square.x && frame.payload.to?.y === square.y)),
                  'chess-square--last-destination': frame?.payload && frame.payload.to?.x === square.x && frame.payload.to?.y === square.y
                }"
                type="button"
                disabled
              >
                <span
                  v-if="square.piece"
                  class="chess-piece"
                  :class="{
                    'chess-piece--black': square.piece[0] === 'b',
                    'chess-piece--white': square.piece[0] === 'w',
                    'chess-piece--arrived': frame?.payload && frame.payload.to?.x === square.x && frame.payload.to?.y === square.y
                  }">
                  <img class="chess-piece__img" :src="pieceSvgAsset(square.piece)" alt="" decoding="async">
                </span>
              </button>
            </div>
            <div ref="boardFilesRef" class="chess-files" :style="boardFilesStyle">
              <span v-for="file in FILE_LABELS" :key="`replay-file-${file}`" class="chess-file-marker">{{ file.toUpperCase() }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="panel chess-side-panel">
        <div class="board-rack-head">
          <h3>Moves</h3>
          <span class="phase-pill">{{ moveRows.length }} turns</span>
        </div>
        <div class="chess-move-list">
          <div v-for="row in moveRows" :key="`replay-move-row-${row.moveNumber}`" class="chess-move-row">
            <span class="chess-move-number">{{ row.moveNumber }}.</span>
            <button
              v-if="row.white"
              type="button"
              class="chess-move-chip"
              :class="{ active: row.white.frameStep === currentStep }"
              @click="jumpToStep(row.white.frameStep)"
            >
              {{ row.white.label }}
            </button>
            <button
              v-if="row.black"
              type="button"
              class="chess-move-chip"
              :class="{ active: row.black.frameStep === currentStep }"
              @click="jumpToStep(row.black.frameStep)"
            >
              {{ row.black.label }}
            </button>
          </div>
        </div>

        <div class="chess-replay-controls">
          <div class="action-row">
            <button class="secondary" :disabled="currentStep === 0" @click="currentStep -= 1">Prev</button>
            <button class="secondary" :disabled="currentStep >= maxStep" @click="currentStep += 1">Next</button>
          </div>
          <input
            v-model.number="currentStep"
            type="range"
            min="0"
            :max="maxStep"
          />
        </div>
      </section>
    </div>
  </section>
</template>
