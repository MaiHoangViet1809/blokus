<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { listGameClients } from "../registry";
import { useAppStore } from "../store";

const route = useRoute();
const router = useRouter();
const store = useAppStore();

const newProfileName = ref("");
const roomCode = ref("");
const games = listGameClients();

const selectedGameType = computed({
  get() {
    const requested = String(route.query.game || store.activeGameType || "blokus");
    return games.some((game) => game.gameType === requested) ? requested : "blokus";
  },
  set(value) {
    const normalized = games.some((game) => game.gameType === value) ? value : "blokus";
    store.setActiveGameType(normalized);
    router.replace({
      path: "/",
      query: normalized === "blokus" ? {} : { game: normalized }
    });
  }
});

const selectedGame = computed(() => games.find((game) => game.gameType === selectedGameType.value) || games[0]);
const canUseRooms = computed(() => !!store.activeProfile);
const filteredRooms = computed(() =>
  store.rooms.filter((room) => room.gameType === selectedGameType.value)
);

watch(selectedGameType, (gameType) => {
  store.setActiveGameType(gameType);
}, { immediate: true });

watch(selectedGameType, async () => {
  if (!store.hydrationDone) return;
  await refreshRooms();
});

async function submitProfile() {
  if (!newProfileName.value.trim()) return;
  const profile = await store.createProfile(newProfileName.value.trim());
  await store.selectProfile(profile.id);
  newProfileName.value = "";
}

async function useProfile(profileId) {
  await store.selectProfile(profileId);
}

async function refreshRooms() {
  await store.fetchRooms(selectedGameType.value);
}

async function openGameLobby() {
  await router.push(`/games/${selectedGameType.value}`);
}

async function joinByCode() {
  const code = roomCode.value.trim().toUpperCase();
  if (!code) return;
  const response = await store.watchRoom(code);
  roomCode.value = "";
  if (response.match?.id && ["STARTING", "IN_GAME", "SUSPENDED"].includes(response.room?.phase || "")) {
    await router.push(`/matches/${response.match.id}`);
    return;
  }
  await router.push(`/rooms/${code}`);
}

async function openRoom(room) {
  await store.watchRoom(room.code);
  if (room.currentMatchId && ["STARTING", "IN_GAME", "SUSPENDED"].includes(room.phase)) {
    await router.push(`/matches/${room.currentMatchId}`);
    return;
  }
  await router.push(`/rooms/${room.code}`);
}

onMounted(async () => {
  if (!store.hydrationDone) {
    await store.bootstrap();
  }
  await refreshRooms();
});
</script>

<template>
  <section class="route-shell platform-lobby-view">
    <section class="platform-lobby-grid">
      <article class="panel platform-profiles-panel">
        <div class="section-head">
          <div>
            <h2>Profiles</h2>
            <p class="muted">Use a saved device profile before joining or hosting rooms.</p>
          </div>
          <span class="phase-pill">{{ store.activeProfile?.name || "No active profile" }}</span>
        </div>

        <div class="inline-form">
          <input v-model="newProfileName" maxlength="24" placeholder="Create profile name" />
          <button @click="submitProfile">Create</button>
        </div>

        <div v-if="store.profiles.length" class="panel-scroll list">
          <button
            v-for="profile in store.profiles"
            :key="profile.id"
            class="list-row"
            @click="useProfile(profile.id)"
          >
            <span>{{ profile.name }}</span>
            <strong>{{ store.activeProfile?.id === profile.id ? "Active" : "Use" }}</strong>
          </button>
        </div>
        <p v-else class="muted">No profiles on this device yet.</p>
      </article>

      <article class="panel platform-game-panel">
        <div class="section-head">
          <div>
            <h2>Game Type</h2>
            <p class="muted">Choose one game context before browsing rooms or creating a new lobby.</p>
          </div>
          <button class="secondary" :disabled="!canUseRooms" @click="openGameLobby">Create room</button>
        </div>

        <div class="game-selector-list">
          <button
            v-for="game in games"
            :key="game.gameType"
            class="game-selector-card"
            :class="{ active: selectedGameType === game.gameType }"
            @click="selectedGameType = game.gameType"
          >
            <span class="eyebrow">{{ game.gameType }}</span>
            <strong>{{ game.title }}</strong>
            <span class="muted">{{ game.description }}</span>
          </button>
        </div>

        <div class="platform-join-inline">
          <div class="stack-tight">
            <strong>{{ selectedGame.title }}</strong>
            <span class="muted">Filter is active. Only {{ selectedGame.title }} rooms are shown in the table.</span>
          </div>
          <div class="inline-form">
            <input v-model="roomCode" maxlength="8" placeholder="Join by room code" />
            <button :disabled="!canUseRooms || !roomCode.trim()" @click="joinByCode">Join</button>
          </div>
        </div>
      </article>
    </section>

    <article class="panel platform-room-table-panel">
      <div class="section-head">
        <div>
          <h2>{{ selectedGame.title }} Rooms</h2>
          <p class="muted">{{ filteredRooms.length }} rooms visible for the selected game.</p>
        </div>
        <button class="secondary" @click="refreshRooms">Refresh</button>
      </div>

      <div v-if="filteredRooms.length" class="panel-scroll room-table-wrap">
        <table class="room-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Title</th>
              <th>Game</th>
              <th>Mode</th>
              <th>Phase</th>
              <th>Seats</th>
              <th>Host</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="room in filteredRooms" :key="room.code">
              <td><strong>{{ room.code }}</strong></td>
              <td>{{ room.title }}</td>
              <td>{{ room.gameType }}</td>
              <td>{{ room.modeLabel || room.config?.modeLabel || "Default" }}</td>
              <td><span class="phase-pill">{{ room.phase }}</span></td>
              <td>{{ room.playerCount }}/{{ room.capacity || 4 }}</td>
              <td>{{ room.hostName || "Unknown" }}</td>
              <td>
                <div class="room-table-actions">
                  <button :disabled="!canUseRooms" @click="openRoom(room)">Join</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="muted">No public rooms for {{ selectedGame.title }} right now.</p>
    </article>
  </section>
</template>
