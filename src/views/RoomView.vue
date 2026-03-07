<script setup>
import { computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import GameBoard from "../components/GameBoard.vue";
import ReplayPanel from "../components/ReplayPanel.vue";
import { PLAYER_COLORS } from "../lib/pieces";
import { useAppStore } from "../stores/app";

const route = useRoute();
const router = useRouter();
const store = useAppStore();

const roomCode = computed(() => String(route.params.roomCode || "").toUpperCase());
const isHost = computed(() => store.room?.hostProfileId === store.session?.profileId);
const currentMember = computed(() => store.currentMember);
const selectedReplayId = computed(() => String(route.query.matchId || ""));
const isPreparePhase = computed(() => store.room?.phase === "PREPARE");
const isLiveMatchPhase = computed(() => ["STARTING", "IN_GAME", "SUSPENDED"].includes(store.room?.phase || ""));
const interactiveProfileId = computed(() => ["STARTING", "IN_GAME"].includes(store.room?.phase || "") ? (store.session?.profileId || "") : "");
const showReplayWorkspace = computed(() => !isLiveMatchPhase.value && ["history", "replay"].includes(activePane.value));
const activePane = computed({
  get() {
    if (isLiveMatchPhase.value) {
      return "room";
    }
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
  return showReplayWorkspace.value;
});
const currentTurnName = computed(() => {
  if (!store.match || ["FINISHED", "ABANDONED"].includes(store.room?.phase || "")) return "Finished";
  if (store.room?.phase === "SUSPENDED") return "Suspended";
  if (store.room?.phase === "STARTING") return "Opening turn";
  return store.match.players[store.match.turnIndex]?.name || "Waiting";
});
const matchHeading = computed(() => {
  if (store.room?.phase === "FINISHED") return "Match Summary";
  if (store.room?.phase === "ABANDONED") return "Abandoned Match";
  if (store.room?.phase === "SUSPENDED") return "Suspended Match";
  if (store.room?.phase === "STARTING") return "Starting Match";
  return "Active Match";
});
const phaseMessage = computed(() => {
  if (!store.room) return "";
  if (store.room.phase === "STARTING") return "The room has provisioned a match and will roll back to prepare if everyone leaves before the first committed turn.";
  if (store.room.phase === "SUSPENDED") return store.room.resumeDeadlineAt
    ? `All seated players are away. Reconnect before ${new Date(store.room.resumeDeadlineAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} to resume this match.`
    : "All seated players are away. Reconnect to resume this match.";
  if (store.room.phase === "ABANDONED") return "This match was abandoned. The room will reset to prepare on the next fresh join.";
  return "";
});

function seatColorMeta(seatIndex) {
  return PLAYER_COLORS[seatIndex ?? 0] || PLAYER_COLORS[0];
}

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
    if (isLiveMatchPhase.value) {
      await router.replace({ path: `/rooms/${roomCode.value}` });
      return;
    }
    activePane.value = "replay";
    await store.fetchReplay(selectedReplayId.value);
  } else if (["FINISHED", "ABANDONED"].includes(store.room?.phase || "") && store.room?.currentMatchId) {
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
    <header v-if="!isLiveMatchPhase" class="room-header panel">
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

    <nav v-if="!isLiveMatchPhase" class="segmented-control" aria-label="Room panels">
      <button class="segment-button" :class="{ active: activePane === 'room' }" @click="activePane = 'room'">{{ roomPaneLabel }}</button>
      <button class="segment-button" :class="{ active: activePane === 'history' }" @click="activePane = 'history'">History</button>
      <button class="segment-button" :class="{ active: activePane === 'replay' }" @click="activePane = 'replay'">Replay</button>
    </nav>

    <section class="room-workspace" :class="isPreparePhase ? 'room-workspace--lobby' : 'room-workspace--match'">
      <section class="room-primary">
        <article v-if="isPreparePhase" class="panel lobby-panel">
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
                  <span class="seat-player-label">
                    <span class="seat-color-dot" :style="{ '--seat-color': seatColorMeta(member.seatIndex).fill }" />
                    P{{ member.seatIndex + 1 }} · {{ seatColorMeta(member.seatIndex).name }} · {{ seatColorMeta(member.seatIndex).cornerLabel }} · {{ member.name }}
                  </span>
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
              <h2>{{ matchHeading }}</h2>
              <p v-if="!isLiveMatchPhase" class="muted">Turn: {{ currentTurnName }}</p>
            </div>
            <span v-if="!isLiveMatchPhase" class="phase-pill">{{ store.room.phase }}</span>
          </div>

          <p v-if="phaseMessage" class="muted">{{ phaseMessage }}</p>

          <GameBoard
            :room="store.room"
            :match="store.match"
            :current-profile-id="interactiveProfileId"
            @place="placeMove"
          />

          <div class="player-strip" :class="{ 'player-strip--compact': isLiveMatchPhase }">
            <div
              v-for="player in store.match.players"
              :key="player.profileId"
              class="player-strip-item"
              :class="{ active: player.profileId === store.match.players[store.match.turnIndex]?.profileId }"
              :style="{ '--player-color': seatColorMeta(player.colorIndex).fill }"
            >
              <strong>{{ player.name }}</strong>
              <span class="muted">{{ seatColorMeta(player.colorIndex).name }}</span>
              <span class="muted">{{ player.remainingCount }}</span>
              <span class="muted">{{ player.endState }}</span>
            </div>
            <div class="player-strip-item player-strip-item--meta">
              <strong>Host</strong>
              <span class="muted">{{ store.room.hostName }}</span>
            </div>
            <div class="player-strip-item player-strip-item--meta">
              <strong>Spectators</strong>
              <span class="muted">{{ spectatorMembers.length }}</span>
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
                  v-if="currentMember?.role === 'player' && store.room.phase === 'PREPARE'"
                  class="secondary"
                  @click="store.setReady(!currentMember.isReady)"
                >
                  {{ currentMember?.isReady ? "Unready" : "Ready" }}
                </button>
                <button v-if="isHost && store.room.phase === 'PREPARE'" @click="store.startRoom">Start match</button>
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
        <p class="muted">Match your color to its starting corner, use Rotate or Flip to orient the piece, and click the board to place. Blocked turns now auto-pass.</p>
      </div>
    </footer>
  </section>

  <section v-else class="panel">
    <p class="muted">Loading room…</p>
  </section>
</template>
