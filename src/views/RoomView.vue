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

async function placeMove(move) {
  await store.placeMove(move);
}

async function leaveRoom() {
  await store.leaveRoom();
  await router.push("/");
}

async function openReplay(matchId) {
  if (!matchId) return;
  await store.fetchReplay(matchId);
  await router.replace({
    path: `/rooms/${roomCode.value}`,
    query: { matchId }
  });
}

watch(selectedReplayId, async (matchId) => {
  if (matchId) {
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
    await store.fetchReplay(selectedReplayId.value);
  } else if (store.room?.phase === "FINISHED" && store.room?.currentMatchId) {
    await store.fetchReplay(store.room.currentMatchId);
  }
});
</script>

<template>
  <section v-if="store.room" class="room-shell">
    <div class="room-header panel">
      <div>
        <p class="eyebrow">{{ store.room.code }}</p>
        <h1>{{ store.room.title }}</h1>
        <p class="muted">Phase: {{ store.room.phase }} · Host: {{ store.room.hostName }}</p>
      </div>
      <div class="action-row">
        <button class="secondary" @click="leaveRoom">Leave</button>
        <button v-if="isHost && store.room.phase === 'FINISHED'" @click="store.rematch">Rematch lobby</button>
      </div>
    </div>

    <section v-if="store.room.phase === 'LOBBY'" class="grid-layout">
      <article class="panel">
        <div class="section-head">
          <h2>Players</h2>
          <button
            v-if="currentMember?.role === 'player'"
            class="secondary"
            @click="store.setReady(!currentMember.isReady)"
          >
            {{ currentMember?.isReady ? "Unready" : "Ready" }}
          </button>
        </div>
        <div class="list">
          <div v-for="member in store.room.members.filter((m) => m.role === 'player')" :key="member.id" class="list-row static">
            <span>P{{ member.seatIndex + 1 }} · {{ member.name }}</span>
            <strong>{{ member.isReady ? "Ready" : member.connectionState }}</strong>
          </div>
        </div>
      </article>

      <article class="panel">
        <h2>Spectators</h2>
        <div class="list">
          <div v-for="member in store.room.members.filter((m) => m.role === 'spectator')" :key="member.id" class="list-row static">
            <span>{{ member.name }}</span>
            <strong>{{ member.connectionState }}</strong>
          </div>
        </div>
      </article>

      <article class="panel">
        <h2>Room Controls</h2>
        <div class="stack">
          <p class="muted">Share room code <strong>{{ store.room.code }}</strong> to let others join directly.</p>
          <button v-if="isHost" @click="store.startRoom">Start match</button>
        </div>
      </article>
    </section>

    <section v-else-if="store.match" class="panel">
      <div class="section-head">
        <h2>{{ store.room.phase === "FINISHED" ? "Match Summary" : "Active Match" }}</h2>
        <p class="muted">
          Turn:
          {{
            store.room.phase === "FINISHED"
              ? "Finished"
              : store.match.players[store.match.turnIndex]?.name || "Waiting"
          }}
        </p>
      </div>

      <GameBoard
        :room="store.room"
        :match="store.match"
        :current-profile-id="store.session?.profileId || ''"
        @place="placeMove"
        @pass="store.passTurn"
      />

      <div class="score-strip">
        <div v-for="player in store.match.players" :key="player.profileId" class="score-card">
          <h3>{{ player.name }}</h3>
          <p class="muted">Pieces left: {{ player.remainingCount }}</p>
          <p class="muted">State: {{ player.endState }}</p>
        </div>
      </div>
    </section>

    <section v-if="store.room.history?.length" class="panel">
      <div class="section-head">
        <h2>Match History</h2>
        <p class="muted">{{ store.room.history.length }} finished matches</p>
      </div>
      <div class="list">
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
    </section>

    <ReplayPanel :replay="store.replay" />
  </section>

  <section v-else class="panel">
    <p class="muted">Loading room…</p>
  </section>
</template>
