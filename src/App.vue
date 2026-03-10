<script setup>
import { computed, onMounted } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useAppStore } from "./platform/client/store";

const store = useAppStore();
const route = useRoute();

const profileName = computed(() => store.activeProfile?.name || "No profile");
const connectionStatus = computed(() => (store.connected ? "Realtime connected" : "Realtime offline"));
const isRoomRoute = computed(() => route.path.startsWith("/rooms/") && !!store.room);
const isMatchRoute = computed(() => route.path.startsWith("/matches/") && (!!store.match || !!store.replay));
const roomHeaderContext = computed(() => {
  if (!isRoomRoute.value || !store.room) return "";
  return `${store.room.gameType} · ${store.room.phase} · ${store.room.code}`;
});
const roomSecondaryContext = computed(() => {
  if (!isRoomRoute.value || !store.room) return "";
  return `${store.room.title} · Host ${store.room.hostName || "Unknown"}`;
});
const roomRole = computed(() => {
  if (!isRoomRoute.value) return "";
  return store.currentMember?.role || "spectator";
});
const matchHeaderContext = computed(() => {
  if (!isMatchRoute.value) return "";
  if (store.replay) {
    return `${store.replay.gameType} · Replay · ${store.replay.roomCode || store.replay.id}`;
  }
  if (!store.match) return "";
  return `${store.match.gameType} · ${store.match.phase || store.match.status} · ${store.match.roomCode}`;
});
const matchSecondaryContext = computed(() => {
  if (!isMatchRoute.value) return "";
  if (store.replay) {
    return `${store.replay.roomTitle} · Match ${store.replay.id}`;
  }
  if (!store.match) return "";
  return `${store.room?.title || store.match.roomCode} · Turn ${store.match.activePlayerName || "Waiting"}`;
});
const matchRole = computed(() => {
  if (!isMatchRoute.value) return "";
  return store.currentMember?.role || "spectator";
});

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
    <header class="topbar">
      <RouterLink class="brand" to="/">Board Game Platform</RouterLink>
      <div class="topbar-center">
        <template v-if="isRoomRoute">
          <strong>{{ roomHeaderContext }}</strong>
          <span class="muted">{{ roomSecondaryContext }}</span>
        </template>
        <template v-else-if="isMatchRoute">
          <strong>{{ matchHeaderContext }}</strong>
          <span class="muted">{{ matchSecondaryContext }}</span>
        </template>
        <span v-else class="muted">Profile-driven rooms, match routes, and replay under one platform shell.</span>
      </div>
      <div class="status-strip">
        <span class="status-pill">{{ profileName }}</span>
        <span v-if="isRoomRoute" class="status-pill">{{ roomRole }}</span>
        <span v-else-if="isMatchRoute" class="status-pill">{{ matchRole }}</span>
        <span class="status-pill">{{ connectionStatus }}</span>
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
