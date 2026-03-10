<script setup>
import { computed, ref, watch } from "vue";
import { FILE_LABELS, PIECE_GLYPHS, RANK_LABELS } from "./shared.js";

const props = defineProps({
  replay: { type: Object, default: null }
});

const currentStep = ref(0);
const maxStep = computed(() => Math.max(0, (props.replay?.frames?.length || 1) - 1));
const frame = computed(() => props.replay?.frames?.[currentStep.value] || null);
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
      <div class="chess-board-shell chess-board-shell--replay">
        <div class="chess-ranks">
          <span v-for="rank in RANK_LABELS" :key="`replay-rank-${rank}`" class="chess-rank-marker">{{ rank }}</span>
        </div>
        <div class="chess-board-frame">
          <div class="chess-board chess-board--replay">
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
                }"
              >
                {{ PIECE_GLYPHS[square.piece] }}
              </span>
            </button>
          </div>
          <div class="chess-files">
            <span v-for="file in FILE_LABELS" :key="`replay-file-${file}`" class="chess-file-marker">{{ file.toUpperCase() }}</span>
          </div>
        </div>
      </div>

      <div class="stack">
        <p class="muted">Step {{ currentStep }} / {{ maxStep }}</p>
        <h3>{{ frame?.label || "Replay frame" }}</h3>
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
        <div class="score-strip">
          <div v-for="player in replay.players" :key="player.profileId" class="score-card">
            <h3>{{ player.name }}</h3>
            <p class="muted">{{ player.colorIndex === 0 ? "White" : "Black" }}</p>
            <p class="muted">Score: {{ player.score }}</p>
            <p class="muted">State: {{ player.endState }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
