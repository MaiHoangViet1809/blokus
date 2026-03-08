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
const stagingTable = computed(() => {
  if (store.room?.phase !== "PREPARE" || !store.gameView) return null;
  return gameClient.value.buildStagingTableModel?.(store.gameView, store.session?.profileId || "") || null;
});
const canLaunch = computed(() =>
  !!store.gameView
  && store.gameView.players.length >= 2
  && store.gameView.players.every((player) => player.isReady)
);

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

            <aside class="staging-side stack">
              <section class="room-subsection stack">
                <div class="section-head">
                  <h3>Launch Control</h3>
                  <span class="phase-pill">{{ store.gameView.players.length }}/{{ store.gameView.maxPlayers }}</span>
                </div>
                <p class="muted">Room staging is platform-owned. Game-specific setup stays in the extra columns.</p>
                <p class="muted">
                  {{ canLaunch ? "Room is ready to launch." : "Need 2+ ready players with valid game setup." }}
                </p>
                <button v-if="isHost" :disabled="!canLaunch" @click="startRoom">Start match</button>
                <p v-else class="muted">Only the host can start the match.</p>
              </section>

              <section class="room-subsection stack">
                <div class="section-head">
                  <h3>Spectators</h3>
                  <span class="phase-pill">{{ store.gameView.spectators.length }}</span>
                </div>
                <div class="panel-scroll list">
                  <template v-if="store.gameView.spectators.length">
                    <div v-for="member in store.gameView.spectators" :key="member.profileId" class="list-row static">
                      <span>{{ member.name }}</span>
                      <strong>{{ member.connectionState }}</strong>
                    </div>
                  </template>
                  <p v-else class="muted">No spectators in this room.</p>
                </div>
              </section>
            </aside>
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
  </section>

  <section v-else class="panel">
    <p class="muted">Loading room…</p>
  </section>
</template>
