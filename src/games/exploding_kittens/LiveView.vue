<script setup>
const props = defineProps({
  gameView: { type: Object, default: null }
});
</script>

<template>
  <section class="ek-live-shell panel-fill">
    <div class="section-head">
      <div>
        <p class="eyebrow">exploding_kittens</p>
        <h2>{{ props.gameView?.modeLabel || "Exploding Kittens" }}</h2>
        <p class="muted">{{ props.gameView?.statusText || "Server actions are being wired in." }}</p>
      </div>
      <span class="phase-pill">{{ props.gameView?.status || "starting" }}</span>
    </div>

    <div class="ek-live-grid">
      <article class="room-subsection stack">
        <h3>Players</h3>
        <div class="list">
          <div
            v-for="player in props.gameView?.players || []"
            :key="player.profileId"
            class="list-row static"
          >
            <span>{{ player.name }}<strong v-if="player.isMe"> (You)</strong></span>
            <strong>{{ player.handCount }} cards</strong>
          </div>
        </div>
      </article>

      <article class="room-subsection stack">
        <h3>Public State</h3>
        <p class="muted">Draw pile: {{ props.gameView?.drawPileCount || 0 }}</p>
        <p class="muted">Prompt: {{ props.gameView?.prompt?.label || "None" }}</p>
      </article>

      <article class="room-subsection stack">
        <h3>Your Hand</h3>
        <p class="muted">
          Private cards stay hidden until the EK command engine is wired.
        </p>
      </article>
    </div>
  </section>
</template>
