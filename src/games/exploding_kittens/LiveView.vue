<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { actionLabel, cardMeta, formatEkTimestamp, handCountText } from "./shared.js";

const props = defineProps({
  room: { type: Object, required: true },
  match: { type: Object, required: true },
  gameView: { type: Object, required: true },
  interactiveProfileId: { type: String, default: "" },
  spectatorCount: { type: Number, default: 0 }
});

const emit = defineEmits(["place"]);

const replayFrames = ref([]);
const timelineLoading = ref(false);

const statusText = computed(() => props.gameView?.statusText || "Waiting for the next action.");
const prompt = computed(() => props.gameView?.prompt || null);
const players = computed(() => props.gameView?.players || []);
const activeTurnPlayer = computed(() => players.value[props.gameView?.turnIndex || 0] || null);
const me = computed(() => props.gameView?.me || null);
const viewerPlayer = computed(() => players.value.find((player) => player.profileId === props.interactiveProfileId) || null);
const isSpectator = computed(() => !viewerPlayer.value || viewerPlayer.value.endState !== "active");
const discardPile = computed(() => props.gameView?.discardPile || []);
const discardPreview = computed(() => discardPile.value.slice(-8).reverse());
const hand = computed(() => me.value?.hand || []);
const stash = computed(() => me.value?.stash || []);
const handGroups = computed(() => {
  const counts = new Map();
  for (const cardId of hand.value) {
    counts.set(cardId, (counts.get(cardId) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([cardId, count]) => ({
      cardId,
      count,
      meta: cardMeta(cardId)
    }))
    .sort((left, right) => left.meta.label.localeCompare(right.meta.label));
});
const availableActions = computed(() => props.gameView?.availableActions || []);
const recentEvents = computed(() => replayFrames.value.slice(-16).reverse());
const statusPlayers = computed(() => {
  const turnProfileId = activeTurnPlayer.value?.profileId || "";
  return [...players.value]
    .sort((left, right) => {
      if (left.profileId === turnProfileId) return -1;
      if (right.profileId === turnProfileId) return 1;
      return left.seatIndex - right.seatIndex;
    })
    .map((player) => ({
      ...player,
      statusLabel: player.endState === "active"
        ? (player.profileId === turnProfileId ? "Taking turn" : "Waiting")
        : player.endState,
      extras: [
        player.stashCount ? `stash ${player.stashCount}` : "",
        player.armedBarking ? `barking ${player.armedBarking}` : ""
      ].filter(Boolean)
    }));
});

function actionKey(action, index) {
  return `${action.type}:${action.label}:${JSON.stringify(action.commandPayload || {})}:${index}`;
}

function emitAction(action) {
  emit("place", {
    commandType: action.type,
    commandPayload: action.commandPayload || {}
  });
}

async function loadTimeline() {
  if (!props.match?.id) {
    replayFrames.value = [];
    return;
  }
  timelineLoading.value = true;
  try {
    const response = await fetch(`/api/matches/${props.match.id}`, { credentials: "same-origin" });
    if (!response.ok) return;
    const data = await response.json();
    replayFrames.value = data?.replay?.frames || [];
  } finally {
    timelineLoading.value = false;
  }
}

watch(() => props.match?.id, () => {
  loadTimeline().catch(() => {});
}, { immediate: true });

watch(() => props.match?.moveCount, () => {
  loadTimeline().catch(() => {});
});

onMounted(() => {
  loadTimeline().catch(() => {});
});
</script>

<template>
  <article class="panel gameplay-panel ek-live-panel">
    <div class="section-head">
      <div>
        <h2>{{ gameView.modeLabel || "Exploding Kittens" }}</h2>
        <p class="muted">{{ statusText }}</p>
      </div>
      <span class="phase-pill">{{ room.phase }}</span>
    </div>

    <div class="match-main-row ek-live-grid">
      <section class="panel ek-column ek-status-column">
        <div class="ek-column-head">
          <strong>Players</strong>
          <span class="muted">{{ spectatorCount }} spectators</span>
        </div>
        <div class="ek-player-list panel-scroll">
          <article
            v-for="player in statusPlayers"
            :key="player.profileId"
            class="ek-player-card"
            :class="{
              'ek-player-card--turn': player.profileId === activeTurnPlayer?.profileId,
              'ek-player-card--me': player.profileId === interactiveProfileId,
              'ek-player-card--out': player.endState !== 'active'
            }"
          >
            <div class="ek-player-card__head">
              <strong>{{ player.name }}</strong>
              <span class="phase-pill">Seat {{ player.seatIndex + 1 }}</span>
            </div>
            <div class="ek-player-card__meta">
              <span>{{ handCountText(player.handCount) }}</span>
              <span>{{ player.statusLabel }}</span>
            </div>
            <div v-if="player.extras.length" class="ek-player-card__meta ek-player-card__meta--extras">
              <span v-for="extra in player.extras" :key="extra">{{ extra }}</span>
            </div>
          </article>
        </div>
      </section>

      <section class="panel ek-column ek-table-column">
        <div class="ek-status-banner">
          <strong>{{ prompt?.label || statusText }}</strong>
          <span class="muted">
            Draw pile {{ gameView.drawPileCount }} · {{ activeTurnPlayer?.name || "Waiting" }} to act
          </span>
        </div>

        <div class="ek-public-piles">
          <article class="ek-pile-card">
            <span class="eyebrow">Draw pile</span>
            <strong>{{ gameView.drawPileCount }}</strong>
            <span class="muted">cards remaining</span>
          </article>

          <article class="ek-pile-card ek-pile-card--discard">
            <span class="eyebrow">Discard</span>
            <div v-if="discardPreview.length" class="ek-card-chip-list">
              <span
                v-for="(cardId, index) in discardPreview"
                :key="`${cardId}-${index}`"
                class="ek-card-chip"
                :data-accent="cardMeta(cardId).accent"
              >
                {{ cardMeta(cardId).label }}
              </span>
            </div>
            <span v-else class="muted">No discard yet</span>
          </article>
        </div>

        <section class="ek-timeline panel-scroll">
          <div class="ek-column-head">
            <strong>Recent Actions</strong>
            <span class="muted">{{ timelineLoading ? "Syncing…" : `${replayFrames.length} events` }}</span>
          </div>
          <div v-if="recentEvents.length" class="ek-event-list">
            <article v-for="frame in recentEvents" :key="frame.step" class="ek-event-row">
              <div class="stack stack-tight">
                <strong>{{ frame.label }}</strong>
                <span class="muted">{{ frame.actorName || "System" }}</span>
              </div>
              <span class="muted">{{ formatEkTimestamp(frame.payload?.createdAt || frame.createdAt) || `#${frame.step}` }}</span>
            </article>
          </div>
          <p v-else class="muted">No public events yet.</p>
        </section>
      </section>

      <section class="panel ek-column ek-hand-column">
        <div class="ek-column-head">
          <strong>{{ isSpectator ? "Public Actions" : "Your Hand" }}</strong>
          <span class="muted">{{ handCountText(hand.length) }}</span>
        </div>

        <div v-if="!isSpectator" class="ek-hand-grid panel-scroll">
          <article
            v-if="stash.length"
            class="ek-hand-card ek-hand-card--stash"
            data-accent="success"
          >
            <div class="stack stack-tight">
              <strong>Tower Stash</strong>
              <span class="muted">{{ handCountText(stash.length) }}</span>
            </div>
            <div class="ek-card-chip-list">
              <span
                v-for="(cardId, index) in stash"
                :key="`${cardId}-${index}`"
                class="ek-card-chip"
                :data-accent="cardMeta(cardId).accent"
              >
                {{ cardMeta(cardId).label }}
              </span>
            </div>
          </article>
          <article
            v-for="entry in handGroups"
            :key="entry.cardId"
            class="ek-hand-card"
            :data-accent="entry.meta.accent"
          >
            <div class="stack stack-tight">
              <strong>{{ entry.meta.label }}</strong>
              <span class="muted">{{ entry.meta.kind }}</span>
            </div>
            <span class="phase-pill">x{{ entry.count }}</span>
          </article>
        </div>
        <p v-else class="muted">Spectators only see public state and player hand counts.</p>

        <section class="ek-actions">
          <div class="ek-column-head">
            <strong>Available Actions</strong>
            <span class="muted">{{ availableActions.length }}</span>
          </div>
          <div v-if="availableActions.length" class="ek-action-list panel-scroll">
            <button
              v-for="(action, index) in availableActions"
              :key="actionKey(action, index)"
              class="ek-action-btn"
              type="button"
              @click="emitAction(action)"
            >
              {{ actionLabel(action) }}
            </button>
          </div>
          <p v-else class="muted">No action available from this view right now.</p>
        </section>
      </section>
    </div>
  </article>
</template>
