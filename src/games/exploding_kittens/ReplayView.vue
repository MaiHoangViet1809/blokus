<script setup>
import { computed, ref, watch } from "vue";
import CardPile from "../../platform/client/components/CardPile.vue";
import CardTableSurface from "../../platform/client/components/CardTableSurface.vue";
import PlayingCard from "../../platform/client/components/PlayingCard.vue";
import { cardArt } from "./card_art.js";
import { cardMeta, cardSigil, formatEkTimestamp, handCountText } from "./shared.js";

const props = defineProps({
  replay: { type: Object, default: null }
});

const selectedStep = ref(0);

const frames = computed(() => props.replay?.frames || []);
const selectedFrame = computed(() => frames.value[selectedStep.value] || null);
const publicState = computed(() => selectedFrame.value?.payload?.publicState || null);
const discardPreview = computed(() => (publicState.value?.discardPile || []).slice(-4).reverse());

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

          <CardTableSurface
            eyebrow="shared card table"
            :title="publicState.prompt?.label || selectedFrame.label"
            :subtitle="`Draw pile ${publicState.drawPileCount} · turn ${publicState.turnIndex + 1 || 1}`"
          >
            <div class="ek-table-layout">
              <CardPile
                title="Draw pile"
                :count="publicState.drawPileCount"
                accent="warning"
                sigil="DRAW"
                hint="Replay snapshot"
              />

              <section class="ek-table-center">
                <div class="ek-table-status">
                  <strong>{{ publicState.prompt?.label || selectedFrame.label }}</strong>
                  <span class="muted">{{ selectedFrame.actorName || "System" }} · public replay snapshot</span>
                </div>
              </section>

              <CardPile
                title="Discard pile"
                :art="publicState.discardPile?.length ? cardArt(publicState.discardPile[publicState.discardPile.length - 1]) : null"
                :count="publicState.discardPile?.length || 0"
                :top-title="publicState.discardPile?.length ? cardMeta(publicState.discardPile[publicState.discardPile.length - 1]).label : 'Discard pile'"
                :top-subtitle="publicState.discardPile?.length ? 'Top discard' : 'No discard yet'"
                :top-eyebrow="publicState.discardPile?.length ? cardMeta(publicState.discardPile[publicState.discardPile.length - 1]).kind : 'Discard'"
                :sigil="publicState.discardPile?.length ? cardSigil(publicState.discardPile[publicState.discardPile.length - 1]) : 'DISC'"
                :accent="publicState.discardPile?.length ? cardMeta(publicState.discardPile[publicState.discardPile.length - 1]).accent : 'neutral'"
                :face-down="false"
              >
                <div v-if="discardPreview.length" class="ek-mini-card-row">
                  <PlayingCard
                    v-for="(cardId, index) in discardPreview"
                    :key="`${cardId}-${index}`"
                    :art="cardArt(cardId)"
                    :title="cardMeta(cardId).label"
                    :subtitle="cardMeta(cardId).kind"
                    :accent="cardMeta(cardId).accent"
                    :sigil="cardSigil(cardId)"
                    size="mini"
                  />
                </div>
              </CardPile>
            </div>
          </CardTableSurface>

          <section class="ek-replay-bottom">
            <section class="panel ek-tray-card ek-feed-tray">
              <div class="ek-column-head">
                <strong>Players</strong>
                <span class="muted">{{ publicState.players?.length || 0 }} active slots</span>
              </div>
              <div class="ek-player-list">
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
              </div>
            </section>

            <section v-if="publicState.prompt?.label" class="panel ek-tray-card ek-feed-tray">
              <div class="ek-column-head">
                <strong>Public Prompt</strong>
                <span class="muted">Snapshot note</span>
              </div>
              <div class="ek-table-status">
                <strong>{{ publicState.prompt.label }}</strong>
              </div>
            </section>
          </section>
        </div>
        <p v-else class="muted">No frame selected.</p>
      </section>
    </div>
  </section>
</template>
