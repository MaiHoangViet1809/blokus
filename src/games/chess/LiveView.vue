<script setup>
import { computed, ref, watch } from "vue";
import { FILE_LABELS, PIECE_GLYPHS, RANK_LABELS } from "./shared.js";

const props = defineProps({
  room: { type: Object, required: true },
  match: { type: Object, required: true },
  gameView: { type: Object, required: true },
  interactiveProfileId: { type: String, default: "" },
  spectatorCount: { type: Number, default: 0 }
});

const emit = defineEmits(["place"]);

const selectedSquare = ref(null);
const pendingPromotion = ref(null);
const boardSquares = computed(() =>
  (props.gameView.board || []).flatMap((row, y) =>
    row.map((piece, x) => ({ x, y, piece }))
  )
);

const currentTurnPlayer = computed(() => props.gameView.players?.[props.gameView.turnIndex] || null);
const activeViewer = computed(() => props.gameView.players?.find((player) => player.profileId === props.interactiveProfileId) || null);
const viewerCanMove = computed(() => activeViewer.value?.profileId === currentTurnPlayer.value?.profileId);
const legalMovesByFrom = computed(() => props.gameView.legalMovesByFrom || {});
const selectedKey = computed(() => selectedSquare.value ? `${selectedSquare.value.x},${selectedSquare.value.y}` : "");
const selectedTargets = computed(() => legalMovesByFrom.value[selectedKey.value] || []);
const selectedTargetMap = computed(() => new Map(selectedTargets.value.map((move) => [`${move.x},${move.y}`, move])));
const statusText = computed(() => {
  if (props.room.phase === "FINISHED") {
    return props.match.winnerName ? `Winner: ${props.match.winnerName}` : "Draw";
  }
  if (props.room.phase === "SUSPENDED") return "Match suspended";
  return `${currentTurnPlayer.value?.name || "Waiting"} to move`;
});
const sideSummary = computed(() =>
  props.gameView.players.map((player) => ({
    ...player,
    captured: props.gameView.capturedPieces?.[player.colorIndex === 0 ? "black" : "white"] || []
  }))
);

function sameSquare(left, right) {
  return !!left && !!right && left.x === right.x && left.y === right.y;
}

function pieceAt(x, y) {
  return props.gameView.board?.[y]?.[x] || null;
}

function ownerAt(x, y) {
  const piece = pieceAt(x, y);
  if (!piece) return null;
  return piece[0] === "w" ? 0 : 1;
}

function labelForSquare(x, y) {
  return `${FILE_LABELS[x]}${RANK_LABELS[y]}`;
}

function selectOrMove(x, y) {
  if (!viewerCanMove.value) return;
  const piece = pieceAt(x, y);
  const selectedMove = selectedTargetMap.value.get(`${x},${y}`);
  if (selectedMove && selectedSquare.value) {
    if (selectedMove.promotionRequired) {
      pendingPromotion.value = {
        from: { ...selectedSquare.value },
        to: { x, y }
      };
      return;
    }
    emit("place", {
      from: { ...selectedSquare.value },
      to: { x, y }
    });
    selectedSquare.value = null;
    return;
  }

  if (!piece) {
    selectedSquare.value = null;
    return;
  }

  const sideIndex = ownerAt(x, y);
  const key = `${x},${y}`;
  if (sideIndex === currentTurnPlayer.value?.colorIndex && legalMovesByFrom.value[key]?.length) {
    selectedSquare.value = { x, y };
  } else {
    selectedSquare.value = null;
  }
}

function submitPromotion(type) {
  if (!pendingPromotion.value) return;
  emit("place", {
    from: pendingPromotion.value.from,
    to: pendingPromotion.value.to,
    promotion: type
  });
  selectedSquare.value = null;
  pendingPromotion.value = null;
}

watch(() => props.gameView.lastMove, () => {
  pendingPromotion.value = null;
  if (!viewerCanMove.value) {
    selectedSquare.value = null;
  }
});
</script>

<template>
  <article class="panel gameplay-panel chess-live-panel">
    <div class="section-head">
      <div>
        <h2>Active Match</h2>
        <p class="muted">{{ statusText }}</p>
      </div>
      <span class="phase-pill">{{ room.phase }}</span>
    </div>

    <div class="match-main-row chess-match-row">
      <section class="panel chess-status-panel">
        <div class="mini-scoreboard__head">
          <strong>Match Status</strong>
          <span class="muted">{{ currentTurnPlayer?.sideLabel }}</span>
        </div>
        <div class="chess-status-copy">
          <p class="muted">Last move: {{ gameView.lastMove?.label || "Opening" }}</p>
          <p class="muted" v-if="gameView.checkState">Check on {{ gameView.checkState === 'w' ? 'White' : 'Black' }}</p>
          <p class="muted">Spectators: {{ spectatorCount }}</p>
        </div>

        <div class="mini-scoreboard__list">
          <div
            v-for="player in sideSummary"
            :key="player.profileId"
            class="mini-scoreboard__row"
            :style="{ '--player-color': player.colorFill }"
          >
            <span class="mini-scoreboard__rank">{{ player.sideLabel }}</span>
            <strong>{{ player.name }}</strong>
            <span class="muted">{{ player.endState }}</span>
            <span class="mini-scoreboard__value">{{ player.score }}</span>
          </div>
        </div>
      </section>

      <section class="panel board-panel chess-board-panel">
        <div class="chess-board">
          <button
            v-for="square in boardSquares"
            :key="`${square.x}-${square.y}`"
            class="chess-square"
            :class="{
              'chess-square--light': (square.x + square.y) % 2 === 0,
              'chess-square--dark': (square.x + square.y) % 2 === 1,
              'chess-square--selected': sameSquare(selectedSquare, square),
              'chess-square--target': selectedTargetMap.has(`${square.x},${square.y}`),
              'chess-square--last': gameView.lastMove && (sameSquare(gameView.lastMove.from, square) || sameSquare(gameView.lastMove.to, square))
            }"
            :title="labelForSquare(square.x, square.y)"
            type="button"
            @click="selectOrMove(square.x, square.y)"
          >
            <span v-if="square.y === 7" class="chess-file-label">{{ FILE_LABELS[square.x] }}</span>
            <span v-if="square.x === 0" class="chess-rank-label">{{ RANK_LABELS[square.y] }}</span>
            <span
              v-if="square.piece"
              class="chess-piece"
              :class="{ 'chess-piece--black': square.piece[0] === 'b', 'chess-piece--white': square.piece[0] === 'w' }"
            >
              {{ PIECE_GLYPHS[square.piece] }}
            </span>
          </button>
        </div>

        <div v-if="pendingPromotion" class="chess-promotion">
          <span class="muted">Choose promotion</span>
          <div class="action-row">
            <button class="secondary" @click="submitPromotion('queen')">Queen</button>
            <button class="secondary" @click="submitPromotion('rook')">Rook</button>
            <button class="secondary" @click="submitPromotion('bishop')">Bishop</button>
            <button class="secondary" @click="submitPromotion('knight')">Knight</button>
          </div>
        </div>
      </section>

      <section class="panel chess-capture-panel">
        <div class="board-rack-head">
          <h3>Captured Pieces</h3>
          <span class="phase-pill">{{ gameView.lastMove?.label || "Opening" }}</span>
        </div>
        <div v-for="player in sideSummary" :key="`${player.profileId}-captures`" class="chess-capture-group">
          <strong>{{ player.name }}</strong>
          <div class="chess-capture-list">
            <span v-for="(piece, index) in player.captured" :key="`${player.profileId}-${piece}-${index}`" class="chess-piece chess-piece--capture">
              {{ PIECE_GLYPHS[piece] }}
            </span>
            <span v-if="!player.captured.length" class="muted">None</span>
          </div>
        </div>
      </section>
    </div>

    <div class="player-strip">
      <div
        v-for="player in gameView.players"
        :key="player.profileId"
        class="player-strip-item"
        :class="{ active: player.profileId === currentTurnPlayer?.profileId }"
        :style="{ '--player-color': player.colorFill }"
      >
        <strong>{{ player.name }}</strong>
        <span class="muted">{{ player.sideLabel }}</span>
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
