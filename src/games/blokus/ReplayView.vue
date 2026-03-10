<script setup>
import { computed, ref, watch } from "vue";
import { COLORS } from "./shared.js";

const props = defineProps({
  replay: { type: Object, default: null }
});

const currentStep = ref(0);
const maxStep = computed(() => Math.max(0, (props.replay?.frames?.length || 1) - 1));
const frame = computed(() => props.replay?.frames?.[currentStep.value] || null);

watch(() => props.replay?.id, () => {
  currentStep.value = 0;
});
</script>

<template>
  <section v-if="replay" class="panel">
    <div class="section-head">
      <div>
        <h2>Replay</h2>
        <p class="muted">{{ replay.roomTitle }} · {{ replay.finishedAt || replay.createdAt }}</p>
      </div>
      <p class="muted">Winner: {{ replay.winnerName || "None" }}</p>
    </div>

    <div class="replay-layout">
      <div class="replay-board">
        <div
          v-for="(row, rowIndex) in frame?.board || []"
          :key="`row-${rowIndex}`"
          class="replay-row"
          :style="{ '--replay-cols': replay.boardSize || frame?.board?.[0]?.length || 20 }"
        >
          <span
            v-for="(cell, cellIndex) in row"
            :key="`cell-${rowIndex}-${cellIndex}`"
            class="replay-cell"
            :style="{ backgroundColor: COLORS[cell] || COLORS[0] }"
          />
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
            <p class="muted">Score: {{ player.score }}</p>
            <p class="muted">State: {{ player.endState }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
