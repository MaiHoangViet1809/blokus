<script setup>
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { getGameClient } from "../games/clientRegistry";
import { useAppStore } from "../stores/app";

const props = defineProps({
  matchId: { type: String, required: true }
});

const router = useRouter();
const store = useAppStore();

const gameClient = computed(() => getGameClient(store.replay?.gameType || "blokus"));
const replayComponent = computed(() => gameClient.value.replayComponent);

onMounted(async () => {
  if (!store.hydrationDone) {
    await store.bootstrap();
  }
  await store.fetchReplay(props.matchId);
});
</script>

<template>
  <section v-if="store.replay" class="route-shell match-replay-view">
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
  </section>

  <section v-else class="panel">
    <p class="muted">Loading replay…</p>
  </section>
</template>
