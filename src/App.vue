<script setup>
import { computed, onMounted } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { useAppStore } from "./stores/app";

const store = useAppStore();
const route = useRoute();
const router = useRouter();

const profileName = computed(() => store.activeProfile?.name || "No profile");
const connectionStatus = computed(() => (store.connected ? "Realtime connected" : "Realtime offline"));
const currentMember = computed(() => store.currentMember);
const isLiveRoom = computed(() => route.path.startsWith("/rooms/") && ["STARTING", "IN_GAME", "SUSPENDED"].includes(store.room?.phase || ""));
const liveTurnName = computed(() => {
  if (!store.match) return "Waiting";
  return store.match.players[store.match.turnIndex]?.name || "Waiting";
});
const liveHeaderSummary = computed(() => {
  if (!isLiveRoom.value || !store.room) return "";
  return `${store.room.code} / ${store.room.title}`;
});

async function leaveLiveRoom() {
  await store.leaveRoom();
  await router.push("/");
}

onMounted(() => {
  if (!store.hydrationDone) {
    store.bootstrap().catch((error) => {
      store.error = error.message;
    });
  }
});
</script>

<template>
  <div class="shell">
    <header class="topbar" :class="{ 'topbar--live': isLiveRoom }">
      <RouterLink class="brand" to="/">Blokus Control Room</RouterLink>
      <div v-if="isLiveRoom" class="topbar-center">
        <strong>{{ liveHeaderSummary }}</strong>
        <span class="muted">Turn: {{ liveTurnName }}</span>
        <span class="muted">Phase: {{ store.room?.phase }}</span>
      </div>
      <div class="status-strip">
        <span v-if="isLiveRoom" class="status-pill">{{ currentMember?.role || "Spectator" }}</span>
        <span class="status-pill">{{ profileName }}</span>
        <span class="status-pill">{{ connectionStatus }}</span>
        <button v-if="isLiveRoom" class="secondary topbar-leave" @click="leaveLiveRoom">Leave</button>
      </div>
    </header>

    <main class="page">
      <p v-if="store.error" class="app-error">{{ store.error }}</p>
      <section class="page-view">
        <RouterView />
      </section>
    </main>
  </div>
</template>
