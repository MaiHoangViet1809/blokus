<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { buildMoveRowsFromFrames, FILE_LABELS, pieceSvgAsset, RANK_LABELS } from "./shared.js";

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
const replayFrames = ref([]);
const boardShellRef = ref(null);
const boardRanksRef = ref(null);
const boardFilesRef = ref(null);
const boardSide = ref(0);
let boardResizeObserver = null;

const currentTurnPlayer = computed(() => props.gameView.players?.[props.gameView.turnIndex] || null);
const activeViewer = computed(() => props.gameView.players?.find((player) => player.profileId === props.interactiveProfileId) || null);
const viewerCanMove = computed(() => activeViewer.value?.profileId === currentTurnPlayer.value?.profileId);
const isBlackPerspective = computed(() => activeViewer.value?.colorIndex === 1);
const displayFiles = computed(() => isBlackPerspective.value ? [...FILE_LABELS].reverse() : FILE_LABELS);
const displayRanks = computed(() => isBlackPerspective.value ? [...RANK_LABELS].reverse() : RANK_LABELS);
const boardSquares = computed(() =>
  Array.from({ length: 8 }, (_, displayY) =>
    Array.from({ length: 8 }, (_, displayX) => {
      const x = isBlackPerspective.value ? 7 - displayX : displayX;
      const y = isBlackPerspective.value ? 7 - displayY : displayY;
      return {
        x,
        y,
        displayX,
        displayY,
        piece: props.gameView.board?.[y]?.[x] || null
      };
    })
  ).flat()
);
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
const moveRows = computed(() => buildMoveRowsFromFrames(replayFrames.value));
const latestMoveStep = computed(() => replayFrames.value.at(-1)?.step || null);
const currentSideCard = computed(() => sideSummary.value.find((player) => player.profileId === currentTurnPlayer.value?.profileId) || null);
const boardFrameStyle = computed(() => boardSide.value ? { width: `${boardSide.value}px` } : {});
const boardStyle = computed(() => boardSide.value ? { width: `${boardSide.value}px`, height: `${boardSide.value}px` } : {});
const boardFilesStyle = computed(() => boardSide.value ? { width: `${boardSide.value}px` } : {});
const boardRanksStyle = computed(() => boardSide.value ? { height: `${boardSide.value}px` } : {});

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

async function loadMoveHistory() {
  if (!props.match?.id) {
    replayFrames.value = [];
    return;
  }
  const response = await fetch(`/api/matches/${props.match.id}`);
  if (!response.ok) return;
  const data = await response.json();
  replayFrames.value = data?.replay?.frames || [];
}

function syncBoardSide() {
  const shell = boardShellRef.value;
  const ranks = boardRanksRef.value;
  const files = boardFilesRef.value;
  if (!shell || !ranks || !files) return;
  const shellStyle = window.getComputedStyle(shell);
  const columnGap = Number.parseFloat(shellStyle.columnGap || shellStyle.gap || "0") || 0;
  const frame = shell.querySelector(".chess-board-frame");
  const frameStyle = frame ? window.getComputedStyle(frame) : null;
  const rowGap = frameStyle ? (Number.parseFloat(frameStyle.rowGap || frameStyle.gap || "0") || 0) : 0;
  const availableWidth = shell.clientWidth - ranks.clientWidth - columnGap;
  const availableHeight = shell.clientHeight - files.clientHeight - rowGap;
  boardSide.value = Math.max(0, Math.floor(Math.min(availableWidth, availableHeight)));
}

function bindBoardResize() {
  if (!boardShellRef.value || !boardRanksRef.value || !boardFilesRef.value) return;
  boardResizeObserver?.disconnect();
  boardResizeObserver = new ResizeObserver(() => {
    syncBoardSide();
  });
  boardResizeObserver.observe(boardShellRef.value);
  boardResizeObserver.observe(boardRanksRef.value);
  boardResizeObserver.observe(boardFilesRef.value);
  syncBoardSide();
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

watch(() => props.match?.moveCount, () => {
  loadMoveHistory().catch(() => {});
});

watch(() => props.match?.id, () => {
  loadMoveHistory().catch(() => {});
}, { immediate: true });

onMounted(() => {
  loadMoveHistory().catch(() => {});
  bindBoardResize();
});

onBeforeUnmount(() => {
  boardResizeObserver?.disconnect();
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
        <div class="chess-side-identity">
          <div
            v-for="player in sideSummary"
            :key="player.profileId"
            class="chess-side-card"
            :class="{ 'chess-side-card--active': player.profileId === currentTurnPlayer?.profileId }"
            :style="{ '--player-color': player.colorFill, '--player-text': player.textFill || '#fff' }"
          >
            <div class="chess-side-card__head">
              <strong>{{ player.name }}</strong>
              <span class="phase-pill">{{ player.sideLabel }}</span>
            </div>
            <div class="chess-side-card__meta">
              <span>{{ player.endState }}</span>
              <span>{{ player.score }}</span>
            </div>
          </div>
        </div>

        <div class="chess-status-copy">
          <p class="chess-turn-line">
            <strong>{{ currentSideCard?.name || currentTurnPlayer?.name || "Waiting" }}</strong>
            <span>{{ currentTurnPlayer?.sideLabel || "" }} to move</span>
          </p>
          <p class="muted">Last move: {{ gameView.lastMove?.label || "Opening" }}</p>
          <p class="muted" v-if="gameView.checkState">Check on {{ gameView.checkState === 'w' ? 'White' : 'Black' }}</p>
          <p class="muted">Spectators: {{ spectatorCount }}</p>
        </div>
      </section>

      <section class="panel board-panel chess-board-panel">
        <div ref="boardShellRef" class="chess-board-shell">
          <div ref="boardRanksRef" class="chess-ranks" :style="boardRanksStyle">
            <span v-for="rank in displayRanks" :key="`rank-${rank}`" class="chess-rank-marker">{{ rank }}</span>
          </div>
          <div class="chess-board-frame" :style="boardFrameStyle">
            <div class="chess-board" :style="boardStyle">
              <button
                v-for="square in boardSquares"
                :key="`${square.displayX}-${square.displayY}`"
                class="chess-square"
                :class="{
                  'chess-square--light': (square.x + square.y) % 2 === 0,
                  'chess-square--dark': (square.x + square.y) % 2 === 1,
                  'chess-square--selected': sameSquare(selectedSquare, square),
                  'chess-square--target': selectedTargetMap.has(`${square.x},${square.y}`),
                  'chess-square--last': gameView.lastMove && (sameSquare(gameView.lastMove.from, square) || sameSquare(gameView.lastMove.to, square)),
                  'chess-square--last-destination': gameView.lastMove && sameSquare(gameView.lastMove.to, square)
                }"
                :title="labelForSquare(square.x, square.y)"
                type="button"
                @click="selectOrMove(square.x, square.y)"
              >
                <span
                  v-if="square.piece"
                  class="chess-piece"
                  :class="{
                    'chess-piece--black': square.piece[0] === 'b',
                    'chess-piece--white': square.piece[0] === 'w',
                    'chess-piece--arrived': gameView.lastMove && sameSquare(gameView.lastMove.to, square)
                  }">
                  <img class="chess-piece__img" :src="pieceSvgAsset(square.piece)" alt="" decoding="async">
                </span>
              </button>
            </div>
            <div ref="boardFilesRef" class="chess-files" :style="boardFilesStyle">
              <span v-for="file in displayFiles" :key="`file-${file}`" class="chess-file-marker">{{ file.toUpperCase() }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="panel chess-side-panel">
        <div class="board-rack-head">
          <h3>Moves</h3>
          <span class="phase-pill">{{ moveRows.length }} turns</span>
        </div>
        <div class="chess-move-list">
          <div v-for="row in moveRows" :key="`move-row-${row.moveNumber}`" class="chess-move-row">
            <span class="chess-move-number">{{ row.moveNumber }}.</span>
            <span v-if="row.white" class="chess-move-chip" :class="{ active: row.white.frameStep === latestMoveStep }">
              {{ row.white.label }}
            </span>
            <span v-if="row.black" class="chess-move-chip" :class="{ active: row.black.frameStep === latestMoveStep }">
              {{ row.black.label }}
            </span>
          </div>
        </div>

        <div v-if="pendingPromotion" class="chess-promotion chess-promotion--rail">
          <span class="muted">Choose promotion</span>
          <div class="chess-promotion-grid">
            <button class="secondary" @click="submitPromotion('queen')">Queen</button>
            <button class="secondary" @click="submitPromotion('rook')">Rook</button>
            <button class="secondary" @click="submitPromotion('bishop')">Bishop</button>
            <button class="secondary" @click="submitPromotion('knight')">Knight</button>
          </div>
        </div>

        <div class="chess-captures-block">
          <div class="board-rack-head">
            <h3>Captured</h3>
            <span class="muted">{{ gameView.lastMove?.label || "Opening" }}</span>
          </div>
          <div v-for="player in sideSummary" :key="`${player.profileId}-captures`" class="chess-capture-group">
            <strong>{{ player.name }}</strong>
            <div class="chess-capture-list">
              <span
                v-for="(piece, index) in player.captured"
                :key="`${player.profileId}-${piece}-${index}`"
                class="chess-piece chess-piece--capture">
                <img class="chess-piece__img" :src="pieceSvgAsset(piece)" alt="" decoding="async">
              </span>
              <span v-if="!player.captured.length" class="muted">None</span>
            </div>
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
