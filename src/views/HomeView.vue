<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useAppStore } from "../stores/app";

const router = useRouter();
const store = useAppStore();

const newProfileName = ref("");
const newRoomTitle = ref("");
const roomCode = ref("");
const isPublic = ref(true);
const activeTab = ref("lobby");
const statsTab = ref("leaderboard");

const canCreateRoom = computed(() => !!store.activeProfile);

async function openRecentMatch(match) {
  await router.push({
    path: `/rooms/${match.roomCode}`,
    query: { matchId: match.id }
  });
}

async function submitProfile() {
  if (!newProfileName.value.trim()) return;
  const profile = await store.createProfile(newProfileName.value.trim());
  await store.selectProfile(profile.id);
  newProfileName.value = "";
}

async function useProfile(profileId) {
  await store.selectProfile(profileId);
}

async function createRoom() {
  if (!newRoomTitle.value.trim()) return;
  const room = await store.createRoom(newRoomTitle.value.trim(), isPublic.value);
  newRoomTitle.value = "";
  await router.push(`/rooms/${room.code}`);
}

async function joinRoom(code) {
  await store.joinRoom(code);
  await router.push(`/rooms/${code}`);
}

async function watchRoom(code) {
  await store.watchRoom(code);
  await router.push(`/rooms/${code}`);
}
</script>

<template>
  <section class="route-shell home-view">
    <nav class="segmented-control" aria-label="Home views">
      <button
        class="segment-button"
        :class="{ active: activeTab === 'lobby' }"
        @click="activeTab = 'lobby'"
      >
        Lobby
      </button>
      <button
        class="segment-button"
        :class="{ active: activeTab === 'stats' }"
        @click="activeTab = 'stats'"
      >
        Stats
      </button>
    </nav>

    <section v-if="activeTab === 'lobby'" class="home-workspace">
      <article class="panel home-setup-panel">
        <div class="section-head">
          <div>
            <h2>Lobby Setup</h2>
            <p class="muted">Pick a device profile, then create or join a room.</p>
          </div>
          <span class="phase-pill">{{ store.activeProfile?.name || "No active profile" }}</span>
        </div>

        <div class="home-setup-grid">
          <section class="stack home-subsection">
            <h3>Profiles</h3>
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
          </section>

          <section class="stack home-subsection">
            <h3>Create Room</h3>
            <input v-model="newRoomTitle" maxlength="32" placeholder="Room title" :disabled="!canCreateRoom" />
            <label class="toggle-row">
              <input v-model="isPublic" type="checkbox" :disabled="!canCreateRoom" />
              <span>Visible in public lobby</span>
            </label>
            <button :disabled="!canCreateRoom" @click="createRoom">Create room</button>
          </section>

          <section class="stack home-subsection">
            <h3>Join by Code</h3>
            <div class="inline-form">
              <input v-model="roomCode" maxlength="8" placeholder="Room code" />
              <button :disabled="!canCreateRoom || !roomCode.trim()" @click="joinRoom(roomCode.trim().toUpperCase())">Join</button>
            </div>
          </section>
        </div>
      </article>

      <article class="panel home-rooms-panel">
        <div class="section-head">
          <div>
            <h2>Public Rooms</h2>
            <p class="muted">{{ store.rooms.length }} rooms visible right now.</p>
          </div>
          <button class="secondary" @click="store.fetchRooms">Refresh</button>
        </div>

        <div v-if="store.rooms.length" class="panel-scroll room-grid">
          <article v-for="room in store.rooms" :key="room.code" class="room-card">
            <div class="room-card-top">
              <div>
                <p class="eyebrow">{{ room.code }}</p>
                <h3>{{ room.title }}</h3>
              </div>
              <span class="phase-pill">{{ room.phase }}</span>
            </div>
            <p class="muted">Host: {{ room.hostName || "Unknown" }}</p>
            <p class="muted">{{ room.playerCount }} players · {{ room.spectatorCount }} spectators</p>
            <div class="action-row">
              <button :disabled="!canCreateRoom" @click="joinRoom(room.code)">Join seat</button>
              <button class="secondary" :disabled="!canCreateRoom" @click="watchRoom(room.code)">Watch</button>
            </div>
          </article>
        </div>
        <p v-else class="muted">No public rooms right now.</p>
      </article>
    </section>

    <section v-else class="panel stats-panel">
      <div class="section-head">
        <div>
          <h2>Stats Desk</h2>
          <p class="muted">Review winners and reopen finished matches without leaving the fixed layout.</p>
        </div>
        <nav class="segmented-control segmented-control--inline" aria-label="Stats views">
          <button
            class="segment-button"
            :class="{ active: statsTab === 'leaderboard' }"
            @click="statsTab = 'leaderboard'"
          >
            Leaderboard
          </button>
          <button
            class="segment-button"
            :class="{ active: statsTab === 'recent' }"
            @click="statsTab = 'recent'"
          >
            Recent
          </button>
        </nav>
      </div>

      <div v-if="statsTab === 'leaderboard'" class="stack panel-fill">
        <div class="section-head">
          <h3>Leaderboard</h3>
          <button class="secondary" @click="store.fetchLeaderboard">Refresh</button>
        </div>
        <div v-if="store.leaderboard.length" class="panel-scroll list">
          <div v-for="entry in store.leaderboard" :key="entry.profileId" class="list-row static">
            <span>#{{ entry.rank }} · {{ entry.name }}</span>
            <strong>{{ entry.wins }} wins / {{ entry.matchesPlayed }} matches</strong>
          </div>
        </div>
        <p v-else class="muted">No finished matches yet.</p>
      </div>

      <div v-else class="stack panel-fill">
        <div class="section-head">
          <h3>Recent Matches</h3>
          <button class="secondary" @click="store.fetchRecentMatches">Refresh</button>
        </div>
        <div v-if="store.recentMatches.length" class="panel-scroll list">
          <button
            v-for="match in store.recentMatches"
            :key="match.id"
            class="list-row"
            @click="openRecentMatch(match)"
          >
            <span>{{ match.roomTitle }} · {{ match.roomCode }} · {{ match.winnerName || "No winner" }}</span>
            <strong>{{ match.moveCount }} moves</strong>
          </button>
        </div>
        <p v-else class="muted">Replay history will appear here after matches finish.</p>
      </div>
    </section>
  </section>
</template>
