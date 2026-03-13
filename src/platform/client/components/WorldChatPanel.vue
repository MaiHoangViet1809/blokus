<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { useAppStore } from "../store";

const store = useAppStore();
const draftMessage = ref("");
const messagesRef = ref(null);

const canRender = computed(() => !!store.activeProfile);
const messages = computed(() => store.worldChatMessages || []);

function messageInitial(name) {
  return String(name || "?").trim().charAt(0).toUpperCase() || "?";
}

function isMine(message) {
  return message.profileId === store.session?.profileId;
}

function formatTimestamp(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function scrollToBottom() {
  nextTick(() => {
    const panel = messagesRef.value;
    if (!panel) return;
    panel.scrollTop = panel.scrollHeight;
  });
}

async function sendMessage() {
  const message = draftMessage.value.trim();
  if (!message) return;
  await store.sendWorldChat(message);
  draftMessage.value = "";
  scrollToBottom();
}

function handleComposerKeydown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage().catch(() => {});
  }
}

watch(() => store.worldChatOpen, (open) => {
  if (open) {
    scrollToBottom();
  }
});

watch(() => messages.value.length, () => {
  if (store.worldChatOpen) {
    scrollToBottom();
  }
});
</script>

<template>
  <section v-if="canRender && store.worldChatOpen" class="room-chat-panel world-chat-panel panel">
    <header class="room-chat-panel__header">
      <div>
        <strong>World chat</strong>
        <p class="muted">Global lobby thread</p>
      </div>
      <button class="secondary room-chat-panel__close" type="button" @click="store.closeWorldChat()">Close</button>
    </header>

    <div ref="messagesRef" class="room-chat-panel__messages">
      <article
        v-for="message in messages"
        :key="message.id"
        class="room-chat-message"
        :class="{ 'room-chat-message--mine': isMine(message) }"
      >
        <div v-if="!isMine(message)" class="room-chat-message__avatar">{{ messageInitial(message.profileName) }}</div>
        <div class="room-chat-message__body">
          <div class="room-chat-message__meta">
            <strong>{{ message.profileName }}</strong>
            <span>{{ formatTimestamp(message.createdAt) }}</span>
          </div>
          <div class="room-chat-message__bubble">{{ message.message }}</div>
        </div>
      </article>
    </div>

    <footer class="room-chat-panel__composer">
      <input
        v-model="draftMessage"
        maxlength="1000"
        placeholder="Write to world chat..."
        @keydown="handleComposerKeydown"
      />
      <button type="button" @click="sendMessage">Send</button>
    </footer>
  </section>
</template>
