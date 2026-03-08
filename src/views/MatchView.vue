<script setup>
import { computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { getGameClient } from "../games/clientRegistry";
import { useAppStore } from "../stores/app";

const props = defineProps({
  matchId: { type: String, required: true }
});

const router = useRouter();
const store = useAppStore();

const gameClient = computed(() => getGameClient(store.match?.gameType || store.room?.gameType || "blokus"));
const liveComponent = computed(() => gameClient.value.liveComponent);
const interactiveProfileId = computed(() =>
  ["STARTING", "IN_GAME"].includes(store.room?.phase || "") ? (store.session?.profileId || "") : ""
);
const spectatorCount = computed(() => store.room?.members?.filter((member) => member.role === "spectator").length || 0);
const governance = computed(() => store.match?.governance || {
  endVotes: [],
  rematchVotes: [],
  endVoteEligibleCount: 0,
  rematchVoteEligibleCount: 0
});
const canGovern = computed(() => store.currentMember?.role === "player");
const hasEndVote = computed(() => governance.value.endVotes.includes(store.session?.profileId));
const hasRematchVote = computed(() => governance.value.rematchVotes.includes(store.session?.profileId));
const canVoteEnd = computed(() => ["STARTING", "IN_GAME", "SUSPENDED"].includes(store.room?.phase || ""));
const canVoteRematch = computed(() => store.room?.phase === "FINISHED");
const canSurrender = computed(() => ["STARTING", "IN_GAME", "SUSPENDED"].includes(store.room?.phase || ""));
const reconnectStatus = computed(() => {
  if (!store.room) return "No room";
  if (store.room.phase === "SUSPENDED") {
    return store.room.resumeDeadlineAt
      ? `Suspended · resume before ${new Date(store.room.resumeDeadlineAt).toLocaleTimeString()}`
      : "Suspended";
  }
  return store.connected ? "Live connection healthy" : "Realtime reconnecting";
});

async function hydrateMatch() {
  if (!store.hydrationDone) {
    await store.bootstrap();
  }
  await store.fetchMatch(props.matchId);
  store.ensureSocket();
}

async function leaveRoom() {
  await store.leaveRoom();
  await router.push("/");
}

async function placeMove(move) {
  await store.placeMove(move);
}

async function surrenderMatch() {
  await store.governMatch("surrender");
}

async function voteEndMatch() {
  await store.governMatch("vote_end_match");
}

async function voteRematch() {
  await store.governMatch("vote_rematch");
}

watch(() => store.room?.phase, async (phase) => {
  if (!phase || !store.room?.code) return;
  if (phase === "PREPARE") {
    await router.replace(`/rooms/${store.room.code}`);
  }
}, { immediate: false });

onMounted(async () => {
  await hydrateMatch();
});
</script>

<template>
  <section v-if="store.room && store.match && store.gameView" class="route-shell match-view">
    <header class="panel match-header">
      <div>
        <p class="eyebrow">{{ store.room.gameType }}</p>
        <h1>{{ store.room.title }}</h1>
        <p class="muted">Room {{ store.room.code }} · Turn {{ store.match.activePlayerName || "Waiting" }} · Phase {{ store.room.phase }}</p>
      </div>
      <div class="action-row">
        <button class="secondary" @click="router.push(`/rooms/${store.room.code}`)">Room staging</button>
        <button class="secondary" @click="router.push(`/matches/${store.match.id}/replay`)">Replay</button>
        <button @click="leaveRoom">Leave</button>
      </div>
    </header>

    <section class="panel governance-bar">
      <div class="governance-copy">
        <strong>Match controls</strong>
        <span class="muted">{{ reconnectStatus }}</span>
        <span class="muted">End votes {{ governance.endVotes.length }}/{{ governance.endVoteEligibleCount }}</span>
        <span v-if="canVoteRematch" class="muted">Rematch votes {{ governance.rematchVotes.length }}/{{ governance.rematchVoteEligibleCount }}</span>
      </div>
      <div class="action-row">
        <button v-if="canGovern && canSurrender" class="secondary" @click="surrenderMatch">Surrender</button>
        <button v-if="canGovern && canVoteEnd" class="secondary" @click="voteEndMatch">
          {{ hasEndVote ? "Retract End Vote" : "Vote End Match" }}
        </button>
        <button v-if="canGovern && canVoteRematch" @click="voteRematch">
          {{ hasRematchVote ? "Retract Rematch Vote" : "Vote Rematch" }}
        </button>
      </div>
    </section>

    <component
      :is="liveComponent"
      :room="store.room"
      :match="store.match"
      :game-view="store.gameView"
      :interactive-profile-id="interactiveProfileId"
      :spectator-count="spectatorCount"
      @place="placeMove"
    />
  </section>

  <section v-else class="panel">
    <p class="muted">Loading match…</p>
  </section>
</template>
