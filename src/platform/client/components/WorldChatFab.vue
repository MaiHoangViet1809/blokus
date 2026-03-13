<script setup>
import { computed } from "vue";
import { useAppStore } from "../store";

const store = useAppStore();

const canRender = computed(() => !!store.activeProfile && !store.worldChatOpen);
</script>

<template>
  <button v-if="canRender" class="room-chat-fab world-chat-fab" type="button" @click="store.openWorldChat()">
    <span class="room-chat-fab__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="img">
        <path
          d="M12 4C7.03 4 3 7.36 3 11.5c0 2.11 1.06 4.01 2.76 5.37L5 20l3.61-1.98c1.03.32 2.16.48 3.39.48 4.97 0 9-3.36 9-7.5S16.97 4 12 4Z"
          fill="currentColor"
        />
      </svg>
    </span>
    <span v-if="store.worldChatUnreadCount" class="room-chat-fab__badge">{{ store.worldChatUnreadCount }}</span>
  </button>
</template>
