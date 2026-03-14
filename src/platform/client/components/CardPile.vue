<script setup>
import { computed } from "vue";
import PlayingCard from "./PlayingCard.vue";

const props = defineProps({
  title: { type: String, required: true },
  count: { type: Number, default: 0 },
  accent: { type: String, default: "neutral" },
  topTitle: { type: String, default: "" },
  topSubtitle: { type: String, default: "" },
  topEyebrow: { type: String, default: "" },
  sigil: { type: String, default: "" },
  hint: { type: String, default: "" },
  faceDown: { type: Boolean, default: true },
  interactive: { type: Boolean, default: false }
});

const emit = defineEmits(["activate"]);

const displayTitle = computed(() => (props.faceDown ? props.title : (props.topTitle || props.title)));
const displaySubtitle = computed(() => (props.faceDown ? props.hint : props.topSubtitle));
const displayEyebrow = computed(() => (props.faceDown ? "Draw" : props.topEyebrow));

function activate() {
  if (props.interactive) {
    emit("activate");
  }
}
</script>

<template>
  <component
    :is="interactive ? 'button' : 'article'"
    class="card-pile"
    :class="{ 'card-pile--interactive': interactive }"
    :data-accent="accent"
    :type="interactive ? 'button' : undefined"
    @click="activate"
  >
    <div class="card-pile__stack">
      <span class="card-pile__shadow card-pile__shadow--one" />
      <span class="card-pile__shadow card-pile__shadow--two" />
      <PlayingCard
        class="card-pile__card"
        :title="displayTitle"
        :subtitle="displaySubtitle"
        :eyebrow="displayEyebrow"
        :accent="accent"
        :sigil="sigil"
        :face-down="faceDown"
        size="pile"
      />
      <span class="card-pile__count">{{ count }}</span>
    </div>
    <div class="card-pile__meta">
      <strong>{{ title }}</strong>
      <span class="muted">{{ count }} cards</span>
    </div>
    <div v-if="$slots.default" class="card-pile__preview">
      <slot />
    </div>
  </component>
</template>
