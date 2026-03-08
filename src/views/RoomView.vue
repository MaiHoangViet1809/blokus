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
const roomHistory = computed(() => store.room?.history || []);
const spectatorMembers = computed(() => store.room?.members.filter((member) => member.role === "spectator") || []);
const stagingTable = computed(() => {
  if (store.room?.phase !== "PREPARE" || !store.gameView) return null;
  return gameClient.value.buildStagingTableModel?.(store.gameView, store.session?.profileId || "") || null;
});
const canLaunch = computed(() =>
  !!store.gameView
  && store.gameView.players.length >= 2
  && store.gameView.players.every((player) => player.isReady)
);
const canToggleReady = computed(() => store.room?.phase === "PREPARE" && currentMember.value?.role === "player");
const currentReadyLabel = computed(() => currentMember.value?.isReady ? "Unready" : "Ready");
const spectatorSummaryLabel = computed(() => `Spectators: ${spectatorMembers.value.length}`);

function formatLastOnline(member) {
  if (member.connectionState === "online") return "Online now";
  if (!member.disconnectedAt) return "Unknown";
  return new Date(member.disconnectedAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

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
      <div class="room-header-copy">
        <p class="eyebrow">{{ store.room.code }}</p>
        <h1>{{ store.room.title }}</h1>
        <p class="muted">Game: {{ store.room.gameType }} · Phase: {{ store.room.phase }} · Host: {{ store.room.hostName }}</p>
      </div>
      <div class="room-header-controls">
        <span class="phase-pill">{{ currentMember?.role || "Spectator" }}</span>
        <span class="phase-pill">{{ store.room.phase }}</span>
        <button v-if="canToggleReady" class="secondary" @click="setReady(!currentMember.isReady)">{{ currentReadyLabel }}</button>
        <button v-if="isHost && store.room.phase === 'PREPARE'" :disabled="!canLaunch" @click="startRoom">Start</button>
        <button class="secondary" @click="leaveRoom">Leave</button>
        <button v-if="isHost && store.room.phase === 'FINISHED'" @click="store.rematch">Rematch lobby</button>
      </div>
    </header>

    <section class="room-staging-layout">
      <section class="room-primary">
        <article v-if="store.room.phase === 'PREPARE' && store.gameView && stagingTable" class="panel lobby-panel">
          <div class="section-head">
            <div>
              <h2>Match Staging</h2>
              <p class="muted">Use the universal staging table to claim slots, configure setup fields, and launch the room.</p>
            </div>
            <span class="phase-pill">{{ store.room.code }}</span>
          </div>

          <div class="staging-shell">
            <section class="room-subsection staging-table-shell">
              <div class="panel-scroll room-table-wrap">
                <table class="room-table staging-table">
                  <thead>
                    <tr>
                      <th>Slot</th>
                      <th>Player</th>
                      <th>Control</th>
                      <th>Ready</th>
                      <th>Status</th>
                      <th v-for="column in stagingTable.extraColumns" :key="column.key">{{ column.label }}</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in stagingTable.rows" :key="row.seatIndex">
                      <td><strong>{{ row.slotLabel }}</strong></td>
                      <td>
                        <div class="staging-player-cell">
                          <strong>{{ row.playerLabel }}</strong>
                          <span v-if="row.player?.isHost" class="phase-pill">Host</span>
                        </div>
                      </td>
                      <td>{{ row.controlLabel }}</td>
                      <td>{{ row.readyLabel }}</td>
                      <td>{{ row.statusLabel }}</td>
                      <td>
                        <div v-if="row.colorCell.type === 'picker'" class="staging-color-picker">
                          <button
                            v-for="option in row.colorCell.options"
                            :key="option.colorIndex"
                            class="color-picker-chip"
                            :class="{ active: row.colorCell.selectedColorIndex === option.colorIndex, blocked: option.blocked }"
                            :style="{ '--seat-color': option.fill }"
                            :disabled="option.disabled"
                            @click="chooseColor(option.colorIndex)"
                          >
                            <span class="seat-color-dot" :style="{ '--seat-color': option.fill }" />
                            <span>{{ option.name }}</span>
                          </button>
                        </div>
                        <span v-else class="muted">{{ row.colorCell.text }}</span>
                      </td>
                      <td>{{ row.cornerCell.text }}</td>
                      <td>
                        <div class="room-table-actions">
                          <button v-if="row.canClaimSeat && currentMember?.role !== 'player'" class="secondary" @click="claimSeat">Take seat</button>
                          <button v-else-if="row.canToggleReady" class="secondary" @click="setReady(!row.player.isReady)">
                            {{ row.player.isReady ? "Unready" : "Ready" }}
                          </button>
                          <span v-else class="muted">Waiting</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </article>

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

    <section class="panel spectator-strip-panel">
      <div class="spectator-strip">
        <div class="spectator-strip-copy">
          <strong>{{ spectatorSummaryLabel }}</strong>
          <span class="muted">Hover the button to inspect spectator presence.</span>
        </div>
        <div class="spectator-hover">
          <button class="secondary" :disabled="!spectatorMembers.length">View spectators</button>
          <div class="spectator-hover-card">
            <template v-if="spectatorMembers.length">
              <div v-for="member in spectatorMembers" :key="member.id" class="spectator-hover-row">
                <span>{{ member.name }}</span>
                <span class="muted">{{ member.connectionState }}</span>
                <span class="muted">{{ formatLastOnline(member) }}</span>
              </div>
            </template>
            <p v-else class="muted">No spectators in this room.</p>
          </div>
        </div>
      </div>
    </section>
  </section>

  <section v-else class="panel">
    <p class="muted">Loading room…</p>
  </section>
</template>
