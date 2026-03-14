<script setup>
import { computed } from "vue";

const props = defineProps({
  title: { type: String, default: "Card" },
  subtitle: { type: String, default: "" },
  eyebrow: { type: String, default: "" },
  detail: { type: String, default: "" },
  art: { type: Object, default: null },
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
const resolvedTitle = computed(() => props.art?.titleLine || props.title);
const resolvedSubtitle = computed(() => props.art?.tagLine || props.subtitle);
const resolvedEyebrow = computed(() => props.eyebrow || props.art?.familyLabel || "");
const resolvedDetail = computed(() => props.detail || props.art?.artCode || "");
const resolvedAccent = computed(() => props.art?.frameVariant || props.accent);
const imageSource = computed(() => props.art?.assetUrl || props.art?.assetPath || "");
const artPlaceholder = computed(() => props.art?.promptTitle || resolvedTitle.value);
</script>

<template>
  <article
    class="playing-card"
    :class="[`playing-card--${size}`, { 'playing-card--facedown': faceDown }]"
    :data-accent="resolvedAccent"
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
      <div class="playing-card__main">
        <div class="playing-card__illustration">
          <img
            v-if="imageSource"
            class="playing-card__image"
            :src="imageSource"
            :alt="resolvedTitle"
          >
          <div v-else class="playing-card__art-placeholder">
            <span class="playing-card__art-family">{{ resolvedEyebrow || "Illustration asset" }}</span>
            <strong>{{ artPlaceholder }}</strong>
          </div>
        </div>
        <div class="playing-card__body">
          <span v-if="resolvedEyebrow" class="eyebrow">{{ resolvedEyebrow }}</span>
          <strong>{{ resolvedTitle }}</strong>
          <span v-if="resolvedSubtitle" class="muted">{{ resolvedSubtitle }}</span>
        </div>
      </div>
      <footer v-if="resolvedDetail" class="playing-card__foot">
        <span>{{ resolvedDetail }}</span>
      </footer>
    </template>
  </article>
</template>
