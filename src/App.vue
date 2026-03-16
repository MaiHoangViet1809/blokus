<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Teleport } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useAppStore } from "./platform/client/store";

const store = useAppStore();
const route = useRoute();
const settingsMenuOpen = ref(false);
const settingsButtonRef = ref(null);
const settingsPopupRef = ref(null);
const settingsMenuStyle = ref({});
const shellStyle = computed(() => ({
  "--passive-chat-opacity": String(store.uiSettings?.passiveChatOpacity ?? 0.1)
}));

const profileName = computed(() => store.activeProfile?.name || "No profile");
const connectionStatus = computed(() => (store.connected ? "Connected" : "Offline"));
const passiveChatOpacityPercent = computed(() => Math.round((store.uiSettings?.passiveChatOpacity ?? 0.1) * 100));
const isHomeRoute = computed(() => route.path === "/");
const isRoomRoute = computed(() => route.path.startsWith("/rooms/") && !!store.room);
const isMatchRoute = computed(() => route.path.startsWith("/matches/") && (!!store.match || !!store.replay));
const homePresenceLabel = computed(() =>
  `Online: ${store.presence.profiledOnlineCount} profiled / ${store.presence.totalOnlineCount} total`
);
const roomRole = computed(() => {
  if (!isRoomRoute.value) return "";
  return store.currentMember?.role || "spectator";
});
const formattedRoomRole = computed(() => roomRole.value ? `Role: ${capitalizeLabel(roomRole.value)}` : "");
const matchRole = computed(() => {
  if (!isMatchRoute.value) return "";
  return store.currentMember?.role || "spectator";
});
const formattedMatchRole = computed(() => matchRole.value ? `Role: ${capitalizeLabel(matchRole.value)}` : "");
const topbarCenterFields = computed(() => {
  if (isRoomRoute.value && store.room) {
    return [
      `Game: ${titleCaseLabel(store.room.gameType)}`,
      `Status: ${phaseLabel(store.room.phase)}`,
      `Room ID: ${store.room.code}`,
      `Room Name: ${store.room.title}`,
      `Host: ${store.room.hostName || "Unknown"}`
    ];
  }
  if (isMatchRoute.value) {
    if (store.replay) {
      return [
        `Game: ${titleCaseLabel(store.replay.gameType)}`,
        "Status: Replay",
        `Room ID: ${store.replay.roomCode || store.replay.id}`,
        `Room Name: ${store.replay.roomTitle || "Unknown"}`,
        `Replay ID: ${store.replay.id}`
      ];
    }
    if (store.match) {
      return [
        `Game: ${titleCaseLabel(store.match.gameType)}`,
        `Status: ${phaseLabel(store.room?.phase || store.match.phase || store.match.status)}`,
        `Room ID: ${store.match.roomCode}`,
        `Room Name: ${store.room?.title || store.match.roomCode}`,
        `Turn: ${store.match.activePlayerName || "Waiting"}`
      ];
    }
  }
  return [];
});

function capitalizeLabel(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized[0].toUpperCase() + normalized.slice(1);
}

function titleCaseLabel(value) {
  const normalized = String(value || "").trim().replaceAll("_", " ");
  if (!normalized) return "";
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((segment) => `${segment[0].toUpperCase()}${segment.slice(1).toLowerCase()}`)
    .join(" ");
}

function phaseLabel(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "IN_GAME") return "In-progress";
  if (normalized === "STARTING") return "Starting";
  if (normalized === "SUSPENDED") return "Suspended";
  if (normalized === "FINISHED") return "Finished";
  if (normalized === "ABANDONED") return "Abandoned";
  return titleCaseLabel(value);
}

function closeSettingsMenu() {
  settingsMenuOpen.value = false;
}

function toggleSettingsMenu() {
  settingsMenuOpen.value = !settingsMenuOpen.value;
  if (settingsMenuOpen.value) {
    updateSettingsMenuPosition();
  }
}

function updateSettingsMenuPosition() {
  const trigger = settingsButtonRef.value;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const popupWidth = Math.min(320, viewportWidth - 24);
  const left = Math.max(12, Math.min(rect.right - popupWidth, viewportWidth - popupWidth - 12));
  settingsMenuStyle.value = {
    top: `${rect.bottom + 12}px`,
    left: `${left}px`,
    width: `${popupWidth}px`
  };
}

function handleDocumentPointerDown(event) {
  if (
    settingsButtonRef.value?.contains(event.target)
    || settingsPopupRef.value?.contains(event.target)
  ) {
    return;
  }
  closeSettingsMenu();
}

function handleWindowResize() {
  if (!settingsMenuOpen.value) {
    closeSettingsMenu();
    return;
  }
  updateSettingsMenuPosition();
}

onMounted(() => {
  if (!store.hydrationDone) {
    store.bootstrap().catch((error) => {
      store.error = error.message;
    });
  }
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  window.addEventListener("resize", handleWindowResize);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
  window.removeEventListener("resize", handleWindowResize);
});

watch(() => route.fullPath, () => {
  closeSettingsMenu();
});

watch(() => settingsMenuOpen.value, (open) => {
  if (!open) {
    settingsMenuStyle.value = {};
    return;
  }
  updateSettingsMenuPosition();
});
</script>

<template>
  <div class="shell" :style="shellStyle">
    <header class="topbar">
      <RouterLink class="brand" to="/">Board Game Platform</RouterLink>
      <div class="topbar-center">
        <template v-if="topbarCenterFields.length">
          <span
            v-for="field in topbarCenterFields"
            :key="field"
            class="topbar-context-field"
          >
            {{ field }}
          </span>
        </template>
        <span v-else class="muted">Profile-driven rooms, match routes, and replay under one platform shell.</span>
      </div>
      <div class="status-strip">
        <span v-if="isHomeRoute" class="status-pill status-pill--presence">{{ homePresenceLabel }}</span>
        <span class="status-pill">User: {{ profileName }}</span>
        <span class="status-pill">Status: {{ connectionStatus }}</span>
        <span v-if="isRoomRoute" class="status-pill">{{ formattedRoomRole }}</span>
        <span v-else-if="isMatchRoute" class="status-pill">{{ formattedMatchRole }}</span>
        <button
          ref="settingsButtonRef"
          class="secondary app-settings-toggle"
          type="button"
          aria-label="Open app settings"
          @click="toggleSettingsMenu()"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10.2 3.37c.26-1.16 1.94-1.16 2.2 0l.18.79a1.8 1.8 0 0 0 2.47 1.25l.73-.35c1.05-.5 2.24.68 1.74 1.73l-.35.74a1.8 1.8 0 0 0 1.25 2.47l.79.18c1.16.26 1.16 1.94 0 2.2l-.79.18a1.8 1.8 0 0 0-1.25 2.47l.35.73c.5 1.05-.69 2.24-1.74 1.74l-.73-.35a1.8 1.8 0 0 0-2.47 1.25l-.18.79c-.26 1.16-1.94 1.16-2.2 0l-.18-.79a1.8 1.8 0 0 0-2.47-1.25l-.74.35c-1.05.5-2.23-.69-1.73-1.74l.35-.73a1.8 1.8 0 0 0-1.25-2.47l-.79-.18c-1.16-.26-1.16-1.94 0-2.2l.79-.18A1.8 1.8 0 0 0 6.83 8.27l-.35-.74c-.5-1.05.68-2.23 1.73-1.73l.74.35a1.8 1.8 0 0 0 2.47-1.25l.18-.79ZM11.3 9.2a2.8 2.8 0 1 0 1.4 5.23a2.8 2.8 0 0 0-1.4-5.23Z" />
          </svg>
        </button>
      </div>
    </header>

    <main class="page">
      <p v-if="store.error" class="app-error">{{ store.error }}</p>
      <section class="page-view">
        <RouterView />
      </section>
    </main>
  </div>
  <Teleport to="body">
    <div
      v-if="settingsMenuOpen"
      ref="settingsPopupRef"
      class="app-settings-window panel"
      :style="settingsMenuStyle"
    >
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
        min="0"
        max="30"
        step="5"
        :value="passiveChatOpacityPercent"
        @input="store.setPassiveChatOpacity(Number($event.target.value) / 100)"
      />
      <p class="muted app-settings-menu__hint">Controls passive HUD tint only when chat is visible but not active.</p>
    </div>
  </Teleport>
</template>
