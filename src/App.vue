<script setup>
import { computed, onMounted } from "vue";
import { RouterLink, RouterView } from "vue-router";
import { useAppStore } from "./stores/app";

const store = useAppStore();

const profileName = computed(() => store.activeProfile?.name || "No profile");
const connectionStatus = computed(() => (store.connected ? "Realtime connected" : "Realtime offline"));

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
        <span class="muted">Profile-driven rooms, match routes, and replay under one platform shell.</span>
      </div>
      <div class="status-strip">
        <span class="status-pill">{{ profileName }}</span>
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
