<script setup>
import { computed } from "vue";
import GameBoard from "../../components/GameBoard.vue";
import { PLAYER_COLORS } from "../../lib/pieces";

const props = defineProps({
  room: { type: Object, required: true },
  match: { type: Object, required: true },
  gameView: { type: Object, required: true },
  interactiveProfileId: { type: String, default: "" },
  spectatorCount: { type: Number, default: 0 }
});

const emit = defineEmits(["place"]);

const currentTurnName = computed(() => {
  if (!props.gameView) return "Waiting";
  return props.gameView.players?.[props.gameView.turnIndex]?.name || props.match.activePlayerName || "Waiting";
});

const matchHeading = computed(() => {
  if (props.room.phase === "FINISHED") return "Match Summary";
  if (props.room.phase === "ABANDONED") return "Abandoned Match";
  if (props.room.phase === "SUSPENDED") return "Suspended Match";
  if (props.room.phase === "STARTING") return "Starting Match";
  return "Active Match";
});

function colorMeta(colorIndex) {
  return PLAYER_COLORS[colorIndex ?? 0] || PLAYER_COLORS[0];
}
</script>

<template>
  <article class="panel gameplay-panel">
    <div class="section-head">
      <div>
        <h2>{{ matchHeading }}</h2>
        <p v-if="room.phase !== 'IN_GAME'" class="muted">Turn: {{ currentTurnName }}</p>
      </div>
      <span v-if="room.phase !== 'IN_GAME'" class="phase-pill">{{ room.phase }}</span>
    </div>

    <GameBoard
      :room="room"
      :match="gameView"
      :current-profile-id="interactiveProfileId"
      @place="emit('place', $event)"
    />

    <div class="player-strip" :class="{ 'player-strip--compact': ['STARTING', 'IN_GAME', 'SUSPENDED'].includes(room.phase) }">
      <div
        v-for="player in gameView.players"
        :key="player.profileId"
        class="player-strip-item"
        :class="{ active: player.profileId === gameView.players[gameView.turnIndex]?.profileId }"
        :style="{ '--player-color': colorMeta(player.colorIndex).fill }"
      >
        <strong>{{ player.name }}</strong>
        <span class="muted">{{ colorMeta(player.colorIndex).name }}</span>
        <span class="muted">{{ player.remainingCount }}</span>
        <span class="muted">{{ player.endState }}</span>
      </div>
      <div class="player-strip-item player-strip-item--meta">
        <strong>Host</strong>
        <span class="muted">{{ room.hostName }}</span>
      </div>
      <div class="player-strip-item player-strip-item--meta">
        <strong>Spectators</strong>
        <span class="muted">{{ spectatorCount }}</span>
      </div>
    </div>
  </article>
</template>
