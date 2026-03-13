<script setup>
import { computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import RoomChatFab from "../components/RoomChatFab.vue";
import RoomChatPanel from "../components/RoomChatPanel.vue";
import { useViewportFit } from "../composables/useViewportFit";
import { getGameClient } from "../registry";
import { useAppStore } from "../store";

const props = defineProps({
  matchId: { type: String, required: true }
});

const router = useRouter();
const store = useAppStore();
const { viewportRef, contentRef, stageStyle, scheduleMeasure } = useViewportFit();

const gameClient = computed(() => getGameClient(store.match?.gameType || store.room?.gameType || "blokus"));
const liveComponent = computed(() => gameClient.value.liveComponent);
const hasLivePayload = computed(() => Boolean(store.room && store.match && store.gameView));
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
const canOpenRoom = computed(() => Boolean(store.room?.code));
const canOpenReplay = computed(() => Boolean(store.match?.id));
const currentTurnName = computed(() => store.match?.activePlayerName || "Waiting");
const reconnectStatus = computed(() => {
  if (!store.room) return "No room";
  if (store.room.phase === "SUSPENDED") {
    return store.room.resumeDeadlineAt
      ? `Suspended · resume before ${new Date(store.room.resumeDeadlineAt).toLocaleTimeString()}`
      : "Suspended";
  }
  return store.connected ? "Live connection healthy" : "Realtime reconnecting";
});
const stateTitle = computed(() => {
  if (hasLivePayload.value) return "";
  if (!store.room) return "Match unavailable";
  if (store.room.phase === "PREPARE") return "Returning to room staging";
  if (store.room.phase === "FINISHED") return "Match finished";
  if (store.currentMember?.role === "spectator") return "Viewing as spectator";
  if (store.room.phase === "ABANDONED") return "Match abandoned";
  return "Match state is updating";
});
const stateDescription = computed(() => {
  if (hasLivePayload.value) return "";
  if (!store.room) return "This match could not be restored. You can return to the room or exit to the lobby.";
  if (store.room.phase === "PREPARE") return "The room has reset to staging. You can head back to the room and start again.";
  if (store.room.phase === "FINISHED") {
    return canGovern.value
      ? "The match has ended. Wait for rematch votes or return to the room staging screen."
      : "The match has ended. You are no longer a voting player, but you can still return to the room or exit to the lobby.";
  }
  if (store.currentMember?.role === "spectator") {
    return "You are currently watching this room as a spectator. Match governance controls are limited until you take a seat in staging again.";
  }
  if (store.room.phase === "ABANDONED") return "This match no longer has enough active players. Return to the room to reset or exit to the lobby.";
  return "Realtime state is still syncing. Navigation remains available while the match payload catches up.";
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

async function backToRoom() {
  if (!store.room?.code) return;
  await router.push(`/rooms/${store.room.code}`);
}

async function openReplay() {
  if (!store.match?.id) return;
  await router.push(`/matches/${store.match.id}/replay`);
}

watch(() => store.room?.phase, async (phase) => {
  if (!phase || !store.room?.code) return;
  if (phase === "PREPARE") {
    await router.replace(`/rooms/${store.room.code}`);
  }
}, { immediate: false });

onMounted(async () => {
  await hydrateMatch();
  scheduleMeasure();
});
</script>

<template>
  <section class="route-shell match-view viewport-fit-route">
    <div ref="viewportRef" class="route-fit-shell">
      <div class="route-fit-stage" :style="stageStyle">
        <div ref="contentRef" class="route-fit-content match-view-content">
          <header class="panel match-header">
            <div>
              <p class="eyebrow">{{ store.room?.gameType || "match" }}</p>
              <h1>{{ store.room?.title || "Match" }}</h1>
              <p class="muted">
                <template v-if="store.room">
                  Room {{ store.room.code }} · Turn {{ currentTurnName }} · Phase {{ store.room.phase }}
                </template>
                <template v-else>
                  Match {{ props.matchId }} · Restoring route state
                </template>
              </p>
            </div>
            <div class="action-row">
              <button v-if="canOpenRoom" class="secondary" @click="backToRoom">Back to room</button>
              <button v-if="canOpenReplay" class="secondary" @click="openReplay">Replay</button>
              <button class="danger" @click="leaveRoom">Exit to lobby</button>
            </div>
          </header>

          <section v-if="store.room && store.match" class="panel governance-bar">
            <div class="governance-copy">
              <strong>Match controls</strong>
              <span class="muted">{{ reconnectStatus }}</span>
              <span class="muted">End votes {{ governance.endVotes.length }}/{{ governance.endVoteEligibleCount }}</span>
              <span v-if="canVoteRematch" class="muted">Rematch votes {{ governance.rematchVotes.length }}/{{ governance.rematchVoteEligibleCount }}</span>
              <span v-if="!canGovern" class="muted">You are currently viewing this room without governance voting rights.</span>
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
            v-if="hasLivePayload"
            :room="store.room"
            :match="store.match"
            :game-view="store.gameView"
            :interactive-profile-id="interactiveProfileId"
            :spectator-count="spectatorCount"
            @place="placeMove"
          />
          <section v-else class="panel match-state-panel">
            <div class="match-state-panel__copy">
              <p class="eyebrow">Match state</p>
              <h2>{{ stateTitle }}</h2>
              <p class="muted">{{ stateDescription }}</p>
            </div>
            <div class="action-row">
              <button v-if="canOpenRoom" class="secondary" @click="backToRoom">Back to room</button>
              <button class="danger" @click="leaveRoom">Exit to lobby</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  </section>

  <RoomChatFab />
  <RoomChatPanel />
</template>
