<script setup>
import { computed } from "vue";

const props = defineProps({
  title: { type: String, default: "Card" },
  subtitle: { type: String, default: "" },
  eyebrow: { type: String, default: "" },
  detail: { type: String, default: "" },
  accent: { type: String, default: "neutral" },
  sigil: { type: String, default: "" },
  badge: { type: String, default: "" },
  faceDown: { type: Boolean, default: false },
  size: { type: String, default: "md" }
});

const fallbackSigil = computed(() => props.title
  .split(/\s+/)
  .filter(Boolean)
  .map((part) => part[0])
  .join("")
  .slice(0, 4)
  .toUpperCase() || "CARD");

const displaySigil = computed(() => props.sigil || fallbackSigil.value);
</script>

<template>
  <article
    class="playing-card"
    :class="[`playing-card--${size}`, { 'playing-card--facedown': faceDown }]"
    :data-accent="accent"
  >
    <div v-if="faceDown" class="playing-card__back">
      <span class="playing-card__sigil">{{ displaySigil }}</span>
      <span class="playing-card__backmark">DECK</span>
    </div>
    <template v-else>
      <header class="playing-card__head">
        <span class="playing-card__sigil">{{ displaySigil }}</span>
        <span v-if="badge" class="playing-card__badge">{{ badge }}</span>
      </header>
      <div class="playing-card__body">
        <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
        <strong>{{ title }}</strong>
        <span v-if="subtitle" class="muted">{{ subtitle }}</span>
      </div>
      <footer v-if="detail" class="playing-card__foot">
        <span>{{ detail }}</span>
      </footer>
    </template>
  </article>
</template>
