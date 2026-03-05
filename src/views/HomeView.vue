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
  <section class="hero-panel">
    <div class="hero-copy">
      <p class="eyebrow">Durable sessions. Explicit room phases. Server-authoritative game state.</p>
      <h1>Run private Blokus matches without losing the room when the browser blinks.</h1>
      <p class="lede">
        Pick a saved profile on this device, browse active public rooms, or create a fresh room with a generated code.
      </p>
    </div>
  </section>

  <section class="grid-layout">
    <article class="panel">
      <h2>Profiles</h2>
      <div class="stack">
        <div class="inline-form">
          <input v-model="newProfileName" maxlength="24" placeholder="Create profile name" />
          <button @click="submitProfile">Create</button>
        </div>
        <div v-if="store.profiles.length" class="list">
          <button
            v-for="profile in store.profiles"
            :key="profile.id"
            class="list-row"
            @click="useProfile(profile.id)"
          >
            <span>{{ profile.name }}</span>
            <strong v-if="store.activeProfile?.id === profile.id">Active</strong>
          </button>
        </div>
        <p v-else class="muted">No profiles on this device yet.</p>
      </div>
    </article>

    <article class="panel">
      <h2>Create Room</h2>
      <div class="stack">
        <input v-model="newRoomTitle" maxlength="32" placeholder="Room title" :disabled="!canCreateRoom" />
        <label class="toggle-row">
          <input v-model="isPublic" type="checkbox" :disabled="!canCreateRoom" />
          <span>Visible in public lobby</span>
        </label>
        <button :disabled="!canCreateRoom" @click="createRoom">Create room</button>
      </div>
    </article>

    <article class="panel">
      <h2>Join by Code</h2>
      <div class="stack">
        <div class="inline-form">
          <input v-model="roomCode" maxlength="8" placeholder="Room code" />
          <button :disabled="!canCreateRoom || !roomCode.trim()" @click="joinRoom(roomCode.trim().toUpperCase())">Join</button>
        </div>
      </div>
    </article>
  </section>

  <section class="panel">
    <div class="section-head">
      <h2>Public Rooms</h2>
      <button class="secondary" @click="store.fetchRooms">Refresh</button>
    </div>
    <div v-if="store.rooms.length" class="room-grid">
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
  </section>

  <section class="grid-layout">
    <article class="panel">
      <div class="section-head">
        <h2>Leaderboard</h2>
        <button class="secondary" @click="store.fetchLeaderboard">Refresh</button>
      </div>
      <div v-if="store.leaderboard.length" class="list">
        <div v-for="entry in store.leaderboard" :key="entry.profileId" class="list-row static">
          <span>#{{ entry.rank }} · {{ entry.name }}</span>
          <strong>{{ entry.wins }} wins / {{ entry.matchesPlayed }} matches</strong>
        </div>
      </div>
      <p v-else class="muted">No finished matches yet.</p>
    </article>

    <article class="panel" style="grid-column: span 2;">
      <div class="section-head">
        <h2>Recent Matches</h2>
        <button class="secondary" @click="store.fetchRecentMatches">Refresh</button>
      </div>
      <div v-if="store.recentMatches.length" class="list">
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
    </article>
  </section>
</template>
