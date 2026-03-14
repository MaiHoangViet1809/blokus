<script setup>
defineProps({
  eyebrow: { type: String, default: "" },
  title: { type: String, default: "" },
  subtitle: { type: String, default: "" }
});
</script>

<template>
  <section class="card-table-surface">
    <header v-if="eyebrow || title || subtitle" class="card-table-surface__head">
      <div class="stack stack-tight">
        <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
        <strong v-if="title">{{ title }}</strong>
        <span v-if="subtitle" class="muted">{{ subtitle }}</span>
      </div>
      <slot name="head-extra" />
    </header>
    <div class="card-table-surface__body">
      <slot />
    </div>
  </section>
</template>
