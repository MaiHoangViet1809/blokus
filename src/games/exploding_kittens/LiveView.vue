<script setup>
import { computed, onMounted, ref, watch } from "vue";
import CardPile from "../../platform/client/components/CardPile.vue";
import CardTableSurface from "../../platform/client/components/CardTableSurface.vue";
import PlayingCard from "../../platform/client/components/PlayingCard.vue";
import { cardArt } from "./card_art.js";
import { actionLabel, cardMeta, cardSigil, formatEkTimestamp, handCountText } from "./shared.js";

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
const reactionStack = computed(() => props.gameView?.reactionStack || []);
const reactionSummary = computed(() => props.gameView?.reactionSummary || { confirmed: 0, total: 0 });
const players = computed(() => props.gameView?.players || []);
const activeTurnPlayer = computed(() => players.value[props.gameView?.turnIndex || 0] || null);
const me = computed(() => props.gameView?.me || null);
const viewerPlayer = computed(() => players.value.find((player) => player.profileId === props.interactiveProfileId) || null);
const isSpectator = computed(() => !viewerPlayer.value || viewerPlayer.value.endState !== "active");
const discardPile = computed(() => props.gameView?.discardPile || []);
const discardPreview = computed(() => discardPile.value.slice(-4).reverse());
const hand = computed(() => me.value?.hand || []);
const stash = computed(() => me.value?.stash || []);
const availableActions = computed(() => props.gameView?.availableActions || []);
const drawAction = computed(() => availableActions.value.find((action) => action.type === "draw_card") || null);
const tableActions = computed(() => availableActions.value.filter((action) => action.type !== "draw_card"));
const recentEvents = computed(() => replayFrames.value.slice(-16).reverse());
const handCards = computed(() => [...hand.value]
  .map((cardId, index) => ({
    cardId,
    index,
    meta: cardMeta(cardId)
  }))
  .sort((left, right) => left.meta.label.localeCompare(right.meta.label) || left.index - right.index));
const stashCards = computed(() => [...stash.value]
  .map((cardId, index) => ({
    cardId,
    index,
    meta: cardMeta(cardId)
  }))
  .sort((left, right) => left.meta.label.localeCompare(right.meta.label) || left.index - right.index));
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

      <section class="ek-arena">
        <section v-if="reactionStack.length" class="ek-reaction-stack">
          <div class="ek-column-head">
            <strong>Effect Stack</strong>
            <span class="muted">{{ reactionSummary.confirmed }}/{{ reactionSummary.total }} confirmed</span>
          </div>
          <div class="ek-stack-track">
            <article
              v-for="entry in reactionStack"
              :key="entry.id"
              class="ek-stack-card"
              :data-kind="entry.type"
            >
              <strong>{{ entry.label }}</strong>
              <span class="muted">{{ entry.actorName }}</span>
            </article>
          </div>
        </section>

        <CardTableSurface
          eyebrow="shared card table"
          :title="prompt?.label || statusText"
          :subtitle="`Draw pile ${gameView.drawPileCount} · ${activeTurnPlayer?.name || 'Waiting'} to act`"
        >
          <template #head-extra>
            <span class="phase-pill">{{ drawAction ? "Draw live" : room.phase }}</span>
          </template>

          <div class="ek-table-layout">
            <CardPile
              title="Draw pile"
              :count="gameView.drawPileCount"
              accent="warning"
              sigil="DRAW"
              hint="Click to draw when legal"
              :interactive="Boolean(drawAction)"
              @activate="emitAction(drawAction)"
            />

            <section class="ek-table-center">
              <div class="ek-table-status">
                <strong>{{ prompt?.label || statusText }}</strong>
                <span class="muted">
                  {{ activeTurnPlayer?.name || "Waiting" }} · {{ spectatorCount }} spectators · {{ replayFrames.length }} public events
                </span>
              </div>

              <div v-if="tableActions.length" class="ek-table-actions">
                <button
                  v-for="(action, index) in tableActions"
                  :key="actionKey(action, index)"
                  class="ek-action-btn"
                  type="button"
                  @click="emitAction(action)"
                >
                  {{ actionLabel(action) }}
                </button>
              </div>
              <p v-else class="muted">No table action available right now.</p>
            </section>

            <CardPile
              title="Discard pile"
              :art="discardPile.length ? cardArt(discardPile[discardPile.length - 1]) : null"
              :count="discardPile.length"
              :top-title="discardPile.length ? cardMeta(discardPile[discardPile.length - 1]).label : 'Discard pile'"
              :top-subtitle="discardPile.length ? 'Top discard' : 'No discard yet'"
              :top-eyebrow="discardPile.length ? cardMeta(discardPile[discardPile.length - 1]).kind : 'Discard'"
              :sigil="discardPile.length ? cardSigil(discardPile[discardPile.length - 1]) : 'DISC'"
              :accent="discardPile.length ? cardMeta(discardPile[discardPile.length - 1]).accent : 'neutral'"
              :face-down="false"
            >
              <div v-if="discardPreview.length" class="ek-mini-card-row">
                <PlayingCard
                  v-for="(cardId, index) in discardPreview"
                  :key="`${cardId}-${index}`"
                  :art="cardArt(cardId)"
                  :title="cardMeta(cardId).label"
                  :subtitle="cardMeta(cardId).kind"
                  :accent="cardMeta(cardId).accent"
                  :sigil="cardSigil(cardId)"
                  size="mini"
                />
              </div>
            </CardPile>
          </div>
        </CardTableSurface>

        <div class="ek-bottom-tray">
          <section class="panel ek-tray-card ek-hand-tray">
            <div class="ek-column-head">
              <strong>{{ isSpectator ? "Spectator View" : "Your Hand" }}</strong>
              <span class="muted">{{ handCountText(hand.length) }}</span>
            </div>

            <div v-if="!isSpectator" class="ek-hand-row panel-scroll">
              <PlayingCard
                v-for="entry in handCards"
                :key="`${entry.cardId}-${entry.index}`"
                :art="cardArt(entry.cardId)"
                :title="entry.meta.label"
                :subtitle="entry.meta.kind"
                :detail="entry.cardId"
                :accent="entry.meta.accent"
                :sigil="cardSigil(entry.cardId)"
                size="hand"
              />
            </div>
            <p v-else class="muted">Spectators only see the public table and player hand counts.</p>

            <div v-if="stashCards.length" class="stack stack-tight">
              <div class="ek-column-head">
                <strong>Tower Stash</strong>
                <span class="muted">{{ handCountText(stash.length) }}</span>
              </div>
              <div class="ek-mini-card-row">
                <PlayingCard
                  v-for="entry in stashCards"
                  :key="`${entry.cardId}-${entry.index}`"
                  :art="cardArt(entry.cardId)"
                  :title="entry.meta.label"
                  :subtitle="entry.meta.kind"
                  :accent="entry.meta.accent"
                  :sigil="cardSigil(entry.cardId)"
                  size="mini"
                />
              </div>
            </div>
          </section>

          <section class="panel ek-tray-card ek-feed-tray">
            <div class="ek-column-head">
              <strong>Recent Actions</strong>
              <span class="muted">{{ timelineLoading ? "Syncing…" : `${replayFrames.length} events` }}</span>
            </div>
            <div v-if="recentEvents.length" class="ek-event-list panel-scroll">
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
        </div>
      </section>
    </div>
  </article>
</template>
