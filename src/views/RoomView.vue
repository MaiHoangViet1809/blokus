<script setup>
import { computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import ReplayPanel from "../components/ReplayPanel.vue";
import { getGameClient } from "../games/clientRegistry";
import { useAppStore } from "../stores/app";

const route = useRoute();
const router = useRouter();
const store = useAppStore();

const roomCode = computed(() => String(route.params.roomCode || "").toUpperCase());
const replayMatchId = computed(() => String(route.params.matchId || route.query.matchId || ""));
const isHost = computed(() => store.room?.hostProfileId === store.session?.profileId);
const currentMember = computed(() => store.currentMember);
const spectatorMembers = computed(() => store.room?.members.filter((member) => member.role === "spectator") || []);
const isPreparePhase = computed(() => store.room?.phase === "PREPARE");
const isLiveMatchPhase = computed(() => ["STARTING", "IN_GAME", "SUSPENDED"].includes(store.room?.phase || ""));
const interactiveProfileId = computed(() => ["STARTING", "IN_GAME"].includes(store.room?.phase || "") ? (store.session?.profileId || "") : "");
const activeSection = computed(() => {
  if (isLiveMatchPhase.value) return "room";
  if (route.name === "room-history") return "history";
  if (route.name === "room-replay" || route.query.pane === "replay" || replayMatchId.value) return "replay";
  return "room";
});
const gameClient = computed(() => getGameClient(store.room?.gameType || store.replay?.gameType || "blokus"));
const setupComponent = computed(() => gameClient.value.setupComponent);
const liveComponent = computed(() => gameClient.value.liveComponent);
const roomPaneLabel = computed(() => isLiveMatchPhase.value ? "Match" : "Room");
const currentTurnName = computed(() => store.match?.activePlayerName || "Waiting");
const phaseMessage = computed(() => {
  if (!store.room) return "";
  if (store.room.phase === "STARTING") return "The room has provisioned a match and will roll back to prepare if everyone leaves before the first committed turn.";
  if (store.room.phase === "SUSPENDED") return store.room.resumeDeadlineAt
    ? `A player disconnected. Rejoin before ${new Date(store.room.resumeDeadlineAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} to resume the match.`
    : "A player disconnected. Rejoin to resume the match.";
  if (store.room.phase === "ABANDONED") return "This match was abandoned. The room will reset to prepare on the next fresh join.";
  return "";
});
const guideText = computed(() => store.gameView?.guide || "Use the room shell to manage setup, gameplay, and replay for this game.");

async function leaveRoom() {
  await store.leaveRoom();
  await router.push("/");
}

async function openRoomSection(section) {
  if (section === "history") {
    await router.push({ name: "room-history", params: { roomCode: roomCode.value } });
    return;
  }
  await router.push({ name: "room", params: { roomCode: roomCode.value } });
}

async function openReplay(matchId) {
  if (!matchId) return;
  await store.fetchReplay(matchId);
  await router.push({ name: "room-replay", params: { roomCode: roomCode.value, matchId } });
}

async function claimSeat() {
  await store.joinRoom(roomCode.value);
}

async function chooseColor(colorIndex) {
  await store.emit("room:update-config", {
    roomCode: store.room?.code,
    patch: {
      type: "set_color",
      colorIndex
    }
  });
}

async function setReady(ready) {
  await store.setReady(ready);
}

async function startRoom() {
  await store.startRoom();
}

async function placeMove(move) {
  await store.placeMove(move);
}

async function hydrateRoom() {
  if (!store.hydrationDone) {
    await store.bootstrap();
  }
  await store.fetchRoom(roomCode.value);
  store.ensureSocket();
}

watch(replayMatchId, async (matchId) => {
  if (!matchId) return;
  await store.fetchReplay(matchId);
}, { immediate: false });

onMounted(async () => {
  await hydrateRoom();
  if (route.query.pane === "replay" && route.query.matchId) {
    await router.replace({
      name: "room-replay",
      params: { roomCode: roomCode.value, matchId: String(route.query.matchId) }
    });
    return;
  }
  if (activeSection.value === "replay" && replayMatchId.value) {
    await store.fetchReplay(replayMatchId.value);
  }
});
</script>

<template>
  <section
    v-if="store.room"
    class="route-shell room-view"
    :data-active-pane="activeSection"
    :data-room-phase="store.room.phase"
    :data-side-panel-open="activeSection !== 'room' ? 'true' : 'false'"
  >
    <header v-if="!isLiveMatchPhase" class="room-header panel">
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

    <nav v-if="!isLiveMatchPhase" class="segmented-control" aria-label="Room panels">
      <button class="segment-button" :class="{ active: activeSection === 'room' }" @click="openRoomSection('room')">{{ roomPaneLabel }}</button>
      <button class="segment-button" :class="{ active: activeSection === 'history' }" @click="openRoomSection('history')">History</button>
      <button
        class="segment-button"
        :class="{ active: activeSection === 'replay' }"
        :disabled="!replayMatchId && !store.replay"
        @click="openReplay(replayMatchId || store.room.currentMatchId)"
      >
        Replay
      </button>
    </nav>

    <section class="room-workspace" :class="isPreparePhase ? 'room-workspace--lobby' : 'room-workspace--match'">
      <section class="room-primary">
        <component
          :is="setupComponent"
          v-if="isPreparePhase && store.gameView"
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

        <component
          :is="liveComponent"
          v-else-if="activeSection === 'room' && store.match && store.gameView"
          :room="store.room"
          :match="store.match"
          :game-view="store.gameView"
          :interactive-profile-id="interactiveProfileId"
          :spectator-count="spectatorMembers.length"
          @place="placeMove"
        />

        <article v-else-if="activeSection === 'history'" class="panel panel-fill">
          <div class="section-head">
            <div>
              <h2>Match History</h2>
              <p class="muted">{{ store.room.history?.length || 0 }} finished matches</p>
            </div>
          </div>
          <div v-if="store.room.history?.length" class="panel-scroll list">
            <button
              v-for="historyMatch in store.room.history"
              :key="historyMatch.id"
              class="list-row"
              @click="openReplay(historyMatch.id)"
            >
              <span>{{ historyMatch.gameType }} · {{ historyMatch.winnerName || "No winner" }} · {{ historyMatch.finishedAt || historyMatch.createdAt }}</span>
              <strong>{{ historyMatch.moveCount }} moves</strong>
            </button>
          </div>
          <p v-else class="muted">Finished matches will appear here.</p>
        </article>

        <ReplayPanel v-else-if="activeSection === 'replay'" :replay="store.replay" class="room-replay-panel" />

        <article v-else class="panel panel-fill">
          <p class="muted">Loading room state…</p>
        </article>
      </section>
    </section>

    <p v-if="phaseMessage" class="muted">{{ phaseMessage }}</p>

    <footer class="panel room-footer">
      <div class="guide-strip">
        <span class="phase-pill">Guide</span>
        <p class="muted">{{ guideText }}</p>
      </div>
    </footer>
  </section>

  <section v-else class="panel">
    <p class="muted">Loading room…</p>
  </section>
</template>
