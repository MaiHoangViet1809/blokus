<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { getGameClient } from "../games/clientRegistry";
import { useAppStore } from "../stores/app";

const props = defineProps({
  gameType: { type: String, default: "blokus" }
});

const router = useRouter();
const store = useAppStore();

const roomTitle = ref("");
const isPublic = ref(true);
const game = computed(() => getGameClient(props.gameType));
const selectedRuleset = ref(game.value.modes?.[0]?.ruleset || "classic_4p");
const canCreateRoom = computed(() => !!store.activeProfile);
const createConfig = computed(() => game.value.modes?.length ? { ruleset: selectedRuleset.value } : {});

async function createRoom() {
  if (!roomTitle.value.trim()) return;
  const room = await store.createRoom(
    roomTitle.value.trim(),
    isPublic.value,
    props.gameType,
    createConfig.value
  );
  roomTitle.value = "";
  await router.push(`/rooms/${room.code}`);
}
</script>

<template>
  <section class="route-shell game-lobby-view">
    <article class="panel game-lobby-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">{{ props.gameType }}</p>
          <h1>{{ game.title }}</h1>
          <p class="muted">{{ game.description }}</p>
        </div>
        <button class="secondary" @click="router.push('/')">Back to lobby</button>
      </div>

      <section class="game-create-shell">
        <article class="room-subsection stack">
          <div class="section-head">
            <div>
              <h2>Create {{ game.title }} Room</h2>
              <p class="muted">This page is game-specific. Staging and live play happen after the room exists.</p>
            </div>
            <span class="phase-pill">{{ store.activeProfile?.name || "No active profile" }}</span>
          </div>

          <input v-model="roomTitle" maxlength="32" placeholder="Room title" :disabled="!canCreateRoom" />
          <div v-if="game.modes?.length" class="game-mode-list">
            <button
              v-for="mode in game.modes"
              :key="mode.ruleset"
              class="game-mode-card"
              :class="{ active: selectedRuleset === mode.ruleset }"
              type="button"
              @click="selectedRuleset = mode.ruleset"
            >
              <strong>{{ mode.label }}</strong>
              <span class="muted">{{ mode.description }}</span>
            </button>
          </div>
          <label class="toggle-row">
            <input v-model="isPublic" type="checkbox" :disabled="!canCreateRoom" />
            <span>Visible in the public {{ game.title }} table</span>
          </label>
          <div class="action-row">
            <button :disabled="!canCreateRoom || !roomTitle.trim()" @click="createRoom">Create room</button>
            <span class="muted">Room staging opens at `/rooms/:roomCode` after creation.</span>
          </div>
        </article>
      </section>
    </article>
  </section>
</template>
