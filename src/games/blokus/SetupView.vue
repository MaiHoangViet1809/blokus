<script setup>
defineProps({
  room: { type: Object, required: true },
  gameView: { type: Object, required: true },
  sessionProfileId: { type: String, default: "" },
  currentMember: { type: Object, default: null },
  isHost: { type: Boolean, default: false }
});

const emit = defineEmits(["claim-seat", "choose-color", "set-ready", "start-room"]);

function colorTakenByOther(member, colorIndex, players) {
  return players.some((entry) => entry.profileId !== member?.profileId && entry.colorIndex === colorIndex);
}

function slotAt(players, seatIndex) {
  return players.find((member) => member.seatIndex === seatIndex) || null;
}
</script>

<template>
  <article class="panel lobby-panel">
    <div class="section-head">
      <div>
        <h2>Match Staging</h2>
        <p class="muted">Choose a seat, claim a unique color, ready your slot, and launch from the host seat.</p>
      </div>
      <span class="phase-pill">{{ room.code }}</span>
    </div>

    <div class="staging-shell">
      <section class="slot-grid">
        <article
          v-for="seatIndex in gameView.maxPlayers"
          :key="`slot-${seatIndex - 1}`"
          class="slot-card"
          :class="{ 'slot-card--empty': !slotAt(gameView.players, seatIndex - 1), 'slot-card--ready': slotAt(gameView.players, seatIndex - 1)?.isReady }"
        >
          <div class="section-head">
            <div>
              <p class="eyebrow">Seat {{ seatIndex }}</p>
              <h3>{{ slotAt(gameView.players, seatIndex - 1)?.name || "Open Slot" }}</h3>
            </div>
            <span class="phase-pill">
              {{ slotAt(gameView.players, seatIndex - 1) ? (slotAt(gameView.players, seatIndex - 1).isReady ? "Ready" : slotAt(gameView.players, seatIndex - 1).connectionState) : "Open" }}
            </span>
          </div>

          <template v-if="slotAt(gameView.players, seatIndex - 1)">
            <div class="seat-player-label">
              <span class="seat-color-dot" :style="{ '--seat-color': slotAt(gameView.players, seatIndex - 1).colorFill }" />
              <strong>{{ slotAt(gameView.players, seatIndex - 1).colorName }}</strong>
              <span class="muted">{{ slotAt(gameView.players, seatIndex - 1).cornerLabel }}</span>
              <span v-if="slotAt(gameView.players, seatIndex - 1).isHost" class="phase-pill">Host</span>
            </div>

            <div class="color-picker">
              <button
                v-for="entry in gameView.colors"
                :key="entry.colorIndex"
                class="color-picker-chip"
                :class="{
                  active: slotAt(gameView.players, seatIndex - 1).colorIndex === entry.colorIndex,
                  blocked: colorTakenByOther(slotAt(gameView.players, seatIndex - 1), entry.colorIndex, gameView.players)
                }"
                :style="{ '--seat-color': entry.fill }"
                :disabled="slotAt(gameView.players, seatIndex - 1).profileId !== sessionProfileId || colorTakenByOther(slotAt(gameView.players, seatIndex - 1), entry.colorIndex, gameView.players)"
                @click="emit('choose-color', entry.colorIndex)"
              >
                <span class="seat-color-dot" :style="{ '--seat-color': entry.fill }" />
                <span>{{ entry.name }}</span>
              </button>
            </div>

            <div class="action-row">
              <button
                v-if="slotAt(gameView.players, seatIndex - 1).profileId === sessionProfileId"
                class="secondary"
                @click="emit('set-ready', !slotAt(gameView.players, seatIndex - 1).isReady)"
              >
                {{ slotAt(gameView.players, seatIndex - 1).isReady ? "Unready" : "Ready" }}
              </button>
              <p v-else class="muted">Waiting on this player.</p>
            </div>
          </template>

          <template v-else>
            <p class="muted">Open player slot. Claim it to join the launch lineup.</p>
            <button
              v-if="currentMember?.role !== 'player'"
              class="secondary"
              @click="emit('claim-seat')"
            >
              Take seat
            </button>
          </template>
        </article>
      </section>

      <aside class="staging-side stack">
        <section class="room-subsection stack">
          <div class="section-head">
            <h3>Launch Control</h3>
            <span class="phase-pill">{{ gameView.players.length }}/{{ gameView.maxPlayers }}</span>
          </div>
          <p class="muted">Share room code <strong>{{ room.code }}</strong> and make sure each seated player has a unique color before launch.</p>
          <p class="muted">
            {{ gameView.players.length >= 2 && gameView.players.every((player) => player.isReady) ? "Room is ready to launch." : "Need 2+ ready players with unique colors." }}
          </p>
          <button v-if="isHost" :disabled="!(gameView.players.length >= 2 && gameView.players.every((player) => player.isReady))" @click="emit('start-room')">Start match</button>
          <p v-else class="muted">Only the host can start the match.</p>
        </section>

        <section class="room-subsection stack">
          <div class="section-head">
            <h3>Spectators</h3>
            <span class="phase-pill">{{ gameView.spectators.length }}</span>
          </div>
          <div class="panel-scroll list">
            <template v-if="gameView.spectators.length">
              <div v-for="member in gameView.spectators" :key="member.profileId" class="list-row static">
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
</template>
