<script setup>
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useViewportFit } from "../composables/useViewportFit";
import { getGameClient } from "../registry";
import { useAppStore } from "../store";

const props = defineProps({
  matchId: { type: String, required: true }
});

const router = useRouter();
const store = useAppStore();
const { viewportRef, contentRef, stageStyle, scheduleMeasure } = useViewportFit();

const gameClient = computed(() => getGameClient(store.replay?.gameType || "blokus"));
const replayComponent = computed(() => gameClient.value.replayComponent);

onMounted(async () => {
  if (!store.hydrationDone) {
    await store.bootstrap();
  }
  await store.fetchReplay(props.matchId);
  scheduleMeasure();
});
</script>

<template>
  <section v-if="store.replay" class="route-shell match-replay-view viewport-fit-route">
    <div ref="viewportRef" class="route-fit-shell">
      <div class="route-fit-stage" :style="stageStyle">
        <div ref="contentRef" class="route-fit-content match-replay-content">
          <header class="panel match-header">
            <div>
              <p class="eyebrow">{{ store.replay.gameType }}</p>
              <h1>{{ store.replay.roomTitle }}</h1>
              <p class="muted">Replay for match {{ store.replay.id }}</p>
            </div>
            <div class="action-row">
              <button class="secondary" @click="router.push(`/matches/${store.replay.id}`)">Live route</button>
              <button class="secondary" @click="router.push(store.replay.roomCode ? `/rooms/${store.replay.roomCode}` : '/')">Room staging</button>
            </div>
          </header>

          <component :is="replayComponent" :replay="store.replay" />
        </div>
      </div>
    </div>
  </section>

  <section v-else class="panel">
    <p class="muted">Loading replay…</p>
  </section>
</template>
