<script setup>
import { computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import GameBoard from "../components/GameBoard.vue";
import ReplayPanel from "../components/ReplayPanel.vue";
import { useAppStore } from "../stores/app";

const route = useRoute();
const router = useRouter();
const store = useAppStore();

const roomCode = computed(() => String(route.params.roomCode || "").toUpperCase());
const isHost = computed(() => store.room?.hostProfileId === store.session?.profileId);
const currentMember = computed(() => store.currentMember);
const selectedReplayId = computed(() => String(route.query.matchId || ""));
const isLiveMatchPhase = computed(() => store.room?.phase === "IN_GAME");
const activePane = computed({
  get() {
    const queryPane = String(route.query.pane || "");
    if (["room", "history", "replay"].includes(queryPane)) {
      return queryPane;
    }
    return selectedReplayId.value ? "replay" : "room";
  },
  set(value) {
    router.replace({
      path: `/rooms/${roomCode.value}`,
      query: {
        ...route.query,
        pane: value === "room" ? undefined : value
      }
    });
  }
});
const playerMembers = computed(() => store.room?.members.filter((member) => member.role === "player") || []);
const spectatorMembers = computed(() => store.room?.members.filter((member) => member.role === "spectator") || []);
const roomPaneLabel = computed(() => isLiveMatchPhase.value ? "Match" : "Room");
const showSidePanel = computed(() => {
  if (!store.room) return false;
  if (store.room.phase !== "IN_GAME") return true;
  return activePane.value !== "room";
});
const currentTurnName = computed(() => {
  if (!store.match || store.room?.phase === "FINISHED") return "Finished";
  return store.match.players[store.match.turnIndex]?.name || "Waiting";
});

async function placeMove(move) {
  await store.placeMove(move);
}

async function leaveRoom() {
  await store.leaveRoom();
  await router.push("/");
}

async function openReplay(matchId) {
  if (!matchId) return;
  activePane.value = "replay";
  await store.fetchReplay(matchId);
  await router.replace({
    path: `/rooms/${roomCode.value}`,
    query: { ...route.query, matchId, pane: "replay" }
  });
}

watch(selectedReplayId, async (matchId) => {
  if (matchId) {
    activePane.value = "replay";
    await store.fetchReplay(matchId);
  }
}, { immediate: false });

onMounted(async () => {
  if (!store.hydrationDone) {
    await store.bootstrap();
  }
  await store.fetchRoom(roomCode.value);
  store.ensureSocket();
  if (selectedReplayId.value) {
    activePane.value = "replay";
    await store.fetchReplay(selectedReplayId.value);
  } else if (store.room?.phase === "FINISHED" && store.room?.currentMatchId) {
    await store.fetchReplay(store.room.currentMatchId);
  }
});
</script>

<template>
  <section
    v-if="store.room"
    class="route-shell room-view"
    :data-active-pane="activePane"
    :data-room-phase="store.room.phase"
    :data-side-panel-open="showSidePanel ? 'true' : 'false'"
  >
    <header class="room-header panel">
      <div>
        <p class="eyebrow">{{ store.room.code }}</p>
        <h1>{{ store.room.title }}</h1>
        <p class="muted">Phase: {{ store.room.phase }} · Host: {{ store.room.hostName }}</p>
      </div>
      <div class="action-row">
        <span class="phase-pill">{{ currentMember?.role || "Spectator" }}</span>
        <button class="secondary" @click="leaveRoom">Leave</button>
        <button v-if="isHost && store.room.phase === 'FINISHED'" @click="store.rematch">Rematch lobby</button>
      </div>
    </header>

    <nav class="segmented-control" aria-label="Room panels">
      <button class="segment-button" :class="{ active: activePane === 'room' }" @click="activePane = 'room'">{{ roomPaneLabel }}</button>
      <button class="segment-button" :class="{ active: activePane === 'history' }" @click="activePane = 'history'">History</button>
      <button class="segment-button" :class="{ active: activePane === 'replay' }" @click="activePane = 'replay'">Replay</button>
    </nav>

    <section class="room-workspace" :class="store.room.phase === 'LOBBY' ? 'room-workspace--lobby' : 'room-workspace--match'">
      <section class="room-primary">
        <article v-if="store.room.phase === 'LOBBY'" class="panel lobby-panel">
          <div class="section-head">
            <div>
              <h2>Room Setup</h2>
              <p class="muted">Seat players, confirm readiness, then launch from the host seat.</p>
            </div>
            <button
              v-if="currentMember?.role === 'player'"
              class="secondary"
              @click="store.setReady(!currentMember.isReady)"
            >
              {{ currentMember?.isReady ? "Unready" : "Ready" }}
            </button>
          </div>

          <div class="lobby-grid">
            <section class="stack room-subsection">
              <div class="section-head">
                <h3>Players</h3>
                <span class="phase-pill">{{ playerMembers.length }}/4 seated</span>
              </div>
              <div class="panel-scroll list">
                <div v-for="member in playerMembers" :key="member.id" class="list-row static">
                  <span>P{{ member.seatIndex + 1 }} · {{ member.name }}</span>
                  <strong>{{ member.isReady ? "Ready" : member.connectionState }}</strong>
                </div>
              </div>
            </section>

            <section class="stack room-subsection">
              <div class="section-head">
                <h3>Spectators</h3>
                <span class="phase-pill">{{ spectatorMembers.length }}</span>
              </div>
              <div class="panel-scroll list">
                <template v-if="spectatorMembers.length">
                  <div v-for="member in spectatorMembers" :key="member.id" class="list-row static">
                    <span>{{ member.name }}</span>
                    <strong>{{ member.connectionState }}</strong>
                  </div>
                </template>
                <p v-else class="muted">No spectators in this room.</p>
              </div>
            </section>

            <section class="stack room-subsection">
              <div class="section-head">
                <h3>Controls</h3>
                <span class="phase-pill">{{ store.room.phase }}</span>
              </div>
              <div class="stack">
                <p class="muted">Share room code <strong>{{ store.room.code }}</strong> to let others join directly.</p>
                <button v-if="isHost" @click="store.startRoom">Start match</button>
                <p v-else class="muted">Only the host can start the match.</p>
              </div>
            </section>
          </div>
        </article>

        <article v-else-if="store.match" class="panel gameplay-panel">
          <div class="section-head">
            <div>
              <h2>{{ store.room.phase === "FINISHED" ? "Match Summary" : "Active Match" }}</h2>
              <p class="muted">Turn: {{ currentTurnName }}</p>
            </div>
            <span class="phase-pill">{{ store.room.phase }}</span>
          </div>

          <GameBoard
            :room="store.room"
            :match="store.match"
            :current-profile-id="store.session?.profileId || ''"
            @place="placeMove"
            @pass="store.passTurn"
          />

          <div class="score-strip score-strip--compact">
            <div v-for="player in store.match.players" :key="player.profileId" class="score-card">
              <h3>{{ player.name }}</h3>
              <p class="muted">Pieces left: {{ player.remainingCount }}</p>
              <p class="muted">State: {{ player.endState }}</p>
            </div>
          </div>
        </article>

        <article v-else class="panel panel-fill">
          <p class="muted">Loading room state…</p>
        </article>
      </section>

      <aside v-if="showSidePanel" class="panel room-side-panel">
        <template v-if="activePane === 'room'">
          <div class="stack panel-fill">
            <div class="section-head">
              <div>
                <h2>Room Details</h2>
                <p class="muted">Room code {{ store.room.code }} · {{ store.room.phase }}</p>
              </div>
              <span class="phase-pill">{{ currentMember?.role || "viewer" }}</span>
            </div>

            <div class="panel-scroll stack">
              <div class="stack">
                <h3>Players</h3>
                <div class="list">
                  <div v-for="member in playerMembers" :key="member.id" class="list-row static">
                    <span>{{ member.name }}</span>
                    <strong>{{ member.isReady ? "Ready" : member.connectionState }}</strong>
                  </div>
                </div>
              </div>

              <div class="stack">
                <h3>Spectators</h3>
                <div class="list">
                  <template v-if="spectatorMembers.length">
                    <div v-for="member in spectatorMembers" :key="member.id" class="list-row static">
                      <span>{{ member.name }}</span>
                      <strong>{{ member.connectionState }}</strong>
                    </div>
                  </template>
                  <p v-else class="muted">No spectators connected.</p>
                </div>
              </div>

              <div class="stack">
                <h3>Actions</h3>
                <button
                  v-if="currentMember?.role === 'player' && store.room.phase === 'LOBBY'"
                  class="secondary"
                  @click="store.setReady(!currentMember.isReady)"
                >
                  {{ currentMember?.isReady ? "Unready" : "Ready" }}
                </button>
                <button v-if="isHost && store.room.phase === 'LOBBY'" @click="store.startRoom">Start match</button>
                <button v-if="isHost && store.room.phase === 'FINISHED'" @click="store.rematch">Rematch lobby</button>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="activePane === 'history'">
          <div class="stack panel-fill">
            <div class="section-head">
              <h2>Match History</h2>
              <p class="muted">{{ store.room.history?.length || 0 }} finished matches</p>
            </div>
            <div v-if="store.room.history?.length" class="panel-scroll list">
              <button
                v-for="historyMatch in store.room.history"
                :key="historyMatch.id"
                class="list-row"
                @click="openReplay(historyMatch.id)"
              >
                <span>{{ historyMatch.winnerName || "No winner" }} · {{ historyMatch.finishedAt || historyMatch.createdAt }}</span>
                <strong>{{ historyMatch.moveCount }} moves</strong>
              </button>
            </div>
            <p v-else class="muted">Finished matches will appear here.</p>
          </div>
        </template>

        <ReplayPanel v-else :replay="store.replay" class="room-replay-panel" />
        <p v-if="activePane === 'replay' && !store.replay" class="muted">Pick a finished match to inspect its replay.</p>
      </aside>
    </section>

    <footer class="panel room-footer">
      <div class="guide-strip">
        <span class="phase-pill">Guide</span>
        <p class="muted">Pick a piece from the rack, right-click the board or use Rotate, click to place, and use Pass when no legal move remains.</p>
      </div>
    </footer>
  </section>

  <section v-else class="panel">
    <p class="muted">Loading room…</p>
  </section>
</template>
