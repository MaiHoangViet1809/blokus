<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useAppStore } from "./platform/client/store";

const store = useAppStore();
const route = useRoute();
const settingsMenuOpen = ref(false);
const settingsShellRef = ref(null);
const shellStyle = computed(() => ({
  "--passive-chat-opacity": String(store.uiSettings?.passiveChatOpacity || 0.2)
}));

const profileName = computed(() => store.activeProfile?.name || "No profile");
const connectionStatus = computed(() => (store.connected ? "Realtime connected" : "Realtime offline"));
const passiveChatOpacityPercent = computed(() => Math.round((store.uiSettings?.passiveChatOpacity || 0.2) * 100));
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

function closeSettingsMenu() {
  settingsMenuOpen.value = false;
}

function toggleSettingsMenu() {
  settingsMenuOpen.value = !settingsMenuOpen.value;
}

function handleDocumentPointerDown(event) {
  if (!settingsShellRef.value?.contains(event.target)) {
    closeSettingsMenu();
  }
}

onMounted(() => {
  if (!store.hydrationDone) {
    store.bootstrap().catch((error) => {
      store.error = error.message;
    });
  }
  document.addEventListener("pointerdown", handleDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
});

watch(() => route.fullPath, () => {
  closeSettingsMenu();
});
</script>

<template>
  <div class="shell" :style="shellStyle">
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
        <div ref="settingsShellRef" class="app-settings-shell">
          <button
            class="secondary app-settings-toggle"
            type="button"
            aria-label="Open app settings"
            @click="toggleSettingsMenu()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10.2 3.37c.26-1.16 1.94-1.16 2.2 0l.18.79a1.8 1.8 0 0 0 2.47 1.25l.73-.35c1.05-.5 2.24.68 1.74 1.73l-.35.74a1.8 1.8 0 0 0 1.25 2.47l.79.18c1.16.26 1.16 1.94 0 2.2l-.79.18a1.8 1.8 0 0 0-1.25 2.47l.35.73c.5 1.05-.69 2.24-1.74 1.74l-.73-.35a1.8 1.8 0 0 0-2.47 1.25l-.18.79c-.26 1.16-1.94 1.16-2.2 0l-.18-.79a1.8 1.8 0 0 0-2.47-1.25l-.74.35c-1.05.5-2.23-.69-1.73-1.74l.35-.73a1.8 1.8 0 0 0-1.25-2.47l-.79-.18c-1.16-.26-1.16-1.94 0-2.2l.79-.18A1.8 1.8 0 0 0 6.83 8.27l-.35-.74c-.5-1.05.68-2.23 1.73-1.73l.74.35a1.8 1.8 0 0 0 2.47-1.25l.18-.79ZM11.3 9.2a2.8 2.8 0 1 0 1.4 5.23a2.8 2.8 0 0 0-1.4-5.23Z" />
            </svg>
          </button>
          <div v-if="settingsMenuOpen" class="app-settings-menu panel">
            <div class="app-settings-menu__header">
              <strong>App settings</strong>
            </div>
            <label class="app-settings-menu__field">
              <span>Passive chat opacity</span>
              <span class="app-settings-menu__value">{{ passiveChatOpacityPercent }}%</span>
            </label>
            <input
              class="app-settings-menu__slider"
              type="range"
              min="10"
              max="60"
              step="5"
              :value="passiveChatOpacityPercent"
              @input="store.setPassiveChatOpacity(Number($event.target.value) / 100)"
            />
            <p class="muted app-settings-menu__hint">Affects chat when it is visible but not active/open.</p>
          </div>
        </div>
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
