<script setup>
import { computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { getGameClient } from "../games/clientRegistry";
import { useAppStore } from "../stores/app";

const props = defineProps({
  roomCode: { type: String, required: true }
});

const router = useRouter();
const store = useAppStore();

const normalizedRoomCode = computed(() => String(props.roomCode || "").toUpperCase());
const isHost = computed(() => store.room?.hostProfileId === store.session?.profileId);
const currentMember = computed(() => store.currentMember);
const isPreparePhase = computed(() => ["PREPARE", "ABANDONED", "FINISHED"].includes(store.room?.phase || ""));
const gameClient = computed(() => getGameClient(store.room?.gameType || "blokus"));
const setupComponent = computed(() => gameClient.value.setupComponent);
const roomHistory = computed(() => store.room?.history || []);

async function hydrateRoom() {
  if (!store.hydrationDone) {
    await store.bootstrap();
  }
  await store.fetchRoom(normalizedRoomCode.value);
  store.ensureSocket();
}

async function leaveRoom() {
  await store.leaveRoom();
  await router.push("/");
}

async function claimSeat() {
  await store.joinRoom(normalizedRoomCode.value);
}

async function chooseColor(colorIndex) {
  await store.emit("room:update-config", {
    roomCode: store.room?.code,
    patch: { type: "set_color", colorIndex }
  });
}

async function setReady(ready) {
  await store.setReady(ready);
}

async function startRoom() {
  const response = await store.startRoom();
  const matchId = response.match?.id || store.room?.currentMatchId;
  if (matchId) {
    await router.push(`/matches/${matchId}`);
  }
}

async function openReplay(matchId) {
  if (!matchId) return;
  await router.push(`/matches/${matchId}/replay`);
}

watch(
  () => [store.room?.phase, store.room?.currentMatchId],
  async ([phase, currentMatchId]) => {
    if (!currentMatchId) return;
    if (["STARTING", "IN_GAME", "SUSPENDED"].includes(phase || "")) {
      await router.replace(`/matches/${currentMatchId}`);
    }
  },
  { immediate: false }
);

onMounted(async () => {
  await hydrateRoom();
  if (!isPreparePhase.value && store.room?.currentMatchId) {
    await router.replace(`/matches/${store.room.currentMatchId}`);
  }
});
</script>

<template>
  <section v-if="store.room" class="route-shell room-view room-view--staging">
    <header class="room-header panel">
      <div>
        <p class="eyebrow">{{ store.room.code }}</p>
        <h1>{{ store.room.title }}</h1>
        <p class="muted">Game: {{ store.room.gameType }} · Phase: {{ store.room.phase }} · Host: {{ store.room.hostName }}</p>
      </div>
      <div class="action-row">
        <span class="phase-pill">{{ currentMember?.role || "Spectator" }}</span>
        <button class="secondary" @click="leaveRoom">Leave</button>
        <button v-if="isHost && store.room.phase === 'FINISHED'" @click="store.rematch">Rematch lobby</button>
      </div>
    </header>

    <section class="room-staging-layout">
      <section class="room-primary">
        <component
          :is="setupComponent"
          v-if="store.room.phase === 'PREPARE' && store.gameView"
          :room="store.room"
          :game-view="store.gameView"
          :session-profile-id="store.session?.profileId || ''"
          :current-member="currentMember"
          :is-host="isHost"
          @claim-seat="claimSeat"
          @choose-color="chooseColor"
          @set-ready="setReady"
          @start-room="startRoom"
        />

        <article v-else class="panel panel-fill">
          <div class="section-head">
            <div>
              <h2>{{ store.room.phase === "FINISHED" ? "Room Ready For Rematch" : "Room State" }}</h2>
              <p class="muted">This route is for staging and room lifecycle only. Live play and replay open on match routes.</p>
            </div>
            <span class="phase-pill">{{ store.room.phase }}</span>
          </div>

          <div class="room-state-grid">
            <article class="room-subsection stack">
              <h3>Members</h3>
              <div class="panel-scroll list">
                <div v-for="member in store.room.members" :key="member.id" class="list-row static">
                  <span>{{ member.name }}</span>
                  <strong>{{ member.role }} · {{ member.connectionState }}</strong>
                </div>
              </div>
            </article>

            <article class="room-subsection stack">
              <h3>Latest Match</h3>
              <p class="muted">Current match: {{ store.room.currentMatchId || "None" }}</p>
              <p class="muted">Status: {{ store.room.currentMatchStatus || "No active match" }}</p>
              <div class="action-row">
                <button
                  v-if="store.room.currentMatchId"
                  class="secondary"
                  @click="router.push(`/matches/${store.room.currentMatchId}`)"
                >
                  Open match
                </button>
                <button
                  v-if="store.room.currentMatchId"
                  class="secondary"
                  @click="openReplay(store.room.currentMatchId)"
                >
                  Replay
                </button>
              </div>
            </article>
          </div>
        </article>
      </section>

      <aside class="panel room-history-panel">
        <div class="section-head">
          <div>
            <h2>Recent Room Matches</h2>
            <p class="muted">{{ roomHistory.length }} finished matches</p>
          </div>
        </div>

        <div v-if="roomHistory.length" class="panel-scroll list">
          <button
            v-for="historyMatch in roomHistory"
            :key="historyMatch.id"
            class="list-row"
            @click="openReplay(historyMatch.id)"
          >
            <span>{{ historyMatch.winnerName || "No winner" }} · {{ historyMatch.finishedAt || historyMatch.createdAt }}</span>
            <strong>{{ historyMatch.moveCount }} moves</strong>
          </button>
        </div>
        <p v-else class="muted">Finished matches from this room will appear here.</p>
      </aside>
    </section>
  </section>

  <section v-else class="panel">
    <p class="muted">Loading room…</p>
  </section>
</template>
