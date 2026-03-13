<script setup>
import { computed, ref, watch } from "vue";
import { cardMeta, formatEkTimestamp, handCountText } from "./shared.js";

const props = defineProps({
  replay: { type: Object, default: null }
});

const selectedStep = ref(0);

const frames = computed(() => props.replay?.frames || []);
const selectedFrame = computed(() => frames.value[selectedStep.value] || null);
const publicState = computed(() => selectedFrame.value?.payload?.publicState || null);
const discardPreview = computed(() => (publicState.value?.discardPile || []).slice(-8).reverse());

watch(frames, (nextFrames) => {
  selectedStep.value = nextFrames.length ? nextFrames.length - 1 : 0;
}, { immediate: true });
</script>

<template>
  <section class="ek-replay-shell panel-fill">
    <div class="section-head">
      <div>
        <p class="eyebrow">exploding_kittens replay</p>
        <h2>{{ replay?.modeLabel || "Exploding Kittens" }}</h2>
        <p class="muted">Public event history for the selected room.</p>
      </div>
      <span class="phase-pill">{{ replay?.status || "finished" }}</span>
    </div>

    <div class="replay-layout ek-replay-layout">
      <aside class="panel ek-replay-timeline panel-scroll">
        <div class="ek-column-head">
          <strong>Timeline</strong>
          <span class="muted">{{ frames.length }} steps</span>
        </div>
        <div v-if="frames.length" class="ek-event-list">
          <button
            v-for="(frame, index) in frames"
            :key="frame.step"
            class="ek-event-row ek-event-row--button"
            :class="{ 'ek-event-row--active': index === selectedStep }"
            type="button"
            @click="selectedStep = index"
          >
            <div class="stack stack-tight">
              <strong>{{ frame.label }}</strong>
              <span class="muted">{{ frame.actorName || "System" }}</span>
            </div>
            <span class="muted">#{{ frame.step }}</span>
          </button>
        </div>
        <p v-else class="muted">No replay frames recorded.</p>
      </aside>

      <section class="panel ek-replay-state">
        <div v-if="selectedFrame && publicState" class="stack">
          <div class="section-head">
            <div>
              <h3>{{ selectedFrame.label }}</h3>
              <p class="muted">{{ selectedFrame.actorName || "System" }} · {{ formatEkTimestamp(selectedFrame.createdAt || selectedFrame.payload?.createdAt) || `Step ${selectedFrame.step}` }}</p>
            </div>
            <span class="phase-pill">Step {{ selectedFrame.step }}</span>
          </div>

          <div class="ek-public-piles">
            <article class="ek-pile-card">
              <span class="eyebrow">Draw pile</span>
              <strong>{{ publicState.drawPileCount }}</strong>
              <span class="muted">cards remaining</span>
            </article>

            <article class="ek-pile-card ek-pile-card--discard">
              <span class="eyebrow">Discard</span>
              <div v-if="discardPreview.length" class="ek-card-chip-list">
                <span
                  v-for="(cardId, index) in discardPreview"
                  :key="`${cardId}-${index}`"
                  class="ek-card-chip"
                  :data-accent="cardMeta(cardId).accent"
                >
                  {{ cardMeta(cardId).label }}
                </span>
              </div>
              <span v-else class="muted">No discard yet</span>
            </article>
          </div>

          <section class="ek-player-list">
            <article
              v-for="player in publicState.players || []"
              :key="player.profileId"
              class="ek-player-card"
              :class="{ 'ek-player-card--turn': player.profileId === (publicState.players?.[publicState.turnIndex || 0]?.profileId || '') }"
            >
              <div class="ek-player-card__head">
                <strong>{{ player.name }}</strong>
                <span class="phase-pill">Seat {{ player.seatIndex + 1 }}</span>
              </div>
              <div class="ek-player-card__meta">
                <span>{{ handCountText(player.handCount) }}</span>
                <span>{{ player.endState }}</span>
              </div>
            </article>
          </section>

          <div v-if="publicState.prompt?.label" class="ek-status-banner">
            <strong>{{ publicState.prompt.label }}</strong>
          </div>
        </div>
        <p v-else class="muted">No frame selected.</p>
      </section>
    </div>
  </section>
</template>
