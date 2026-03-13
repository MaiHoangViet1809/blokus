<script setup>
const props = defineProps({
  replay: { type: Object, default: null }
});
</script>

<template>
  <section class="ek-replay-shell panel-fill">
    <div class="section-head">
      <div>
        <p class="eyebrow">exploding_kittens replay</p>
        <h2>{{ props.replay?.modeLabel || "Exploding Kittens" }}</h2>
        <p class="muted">Public event history for the selected room.</p>
      </div>
    </div>

    <div class="list panel-scroll">
      <div
        v-for="frame in props.replay?.frames || []"
        :key="frame.step"
        class="list-row static"
      >
        <span>{{ frame.actorName || "System" }} · {{ frame.label }}</span>
        <strong>#{{ frame.step }}</strong>
      </div>
    </div>
  </section>
</template>
