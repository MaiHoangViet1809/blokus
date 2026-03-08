<script setup>
import { computed } from "vue";
import { getGameClient } from "../games/clientRegistry";

const props = defineProps({
  replay: { type: Object, default: null }
});

const replayComponent = computed(() => getGameClient(props.replay?.gameType || "blokus").replayComponent);
</script>

<template>
  <component :is="replayComponent" v-if="replay" :replay="replay" />
</template>
