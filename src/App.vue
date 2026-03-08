<script setup>
import { computed, onMounted } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useAppStore } from "./stores/app";

const store = useAppStore();
const route = useRoute();

const profileName = computed(() => store.activeProfile?.name || "No profile");
const connectionStatus = computed(() => (store.connected ? "Realtime connected" : "Realtime offline"));
const isRoomRoute = computed(() => route.path.startsWith("/rooms/") && !!store.room);
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
        <span v-else class="muted">Profile-driven rooms, match routes, and replay under one platform shell.</span>
      </div>
      <div class="status-strip">
        <span class="status-pill">{{ profileName }}</span>
        <span v-if="isRoomRoute" class="status-pill">{{ roomRole }}</span>
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
