<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useAppStore } from "../store";

const COMPOSER_EMOJIS = ["🙂", "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "🤔", "😮", "😢", "😭", "😡", "🤯", "😴", "👍", "👎", "👏", "🙏", "🔥", "🎉", "💯", "❤️", "💔"];
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

const store = useAppStore();
const draftMessage = ref("");
const messagesRef = ref(null);
const panelRef = ref(null);
const composerInputRef = ref(null);
const emojiPickerOpen = ref(false);
const activeReactionMessageId = ref("");
const selectionStart = ref(0);
const selectionEnd = ref(0);

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

function captureSelection() {
  const input = composerInputRef.value;
  if (!input) return;
  selectionStart.value = input.selectionStart ?? draftMessage.value.length;
  selectionEnd.value = input.selectionEnd ?? selectionStart.value;
}

function closeTransientMenus() {
  emojiPickerOpen.value = false;
  activeReactionMessageId.value = "";
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
  selectionStart.value = 0;
  selectionEnd.value = 0;
  closeTransientMenus();
  scrollToBottom();
}

function insertEmoji(emoji) {
  const start = selectionStart.value ?? draftMessage.value.length;
  const end = selectionEnd.value ?? start;
  draftMessage.value = `${draftMessage.value.slice(0, start)}${emoji}${draftMessage.value.slice(end)}`;
  emojiPickerOpen.value = false;
  nextTick(() => {
    const input = composerInputRef.value;
    if (!input) return;
    const caret = start + emoji.length;
    input.focus();
    input.setSelectionRange(caret, caret);
    selectionStart.value = caret;
    selectionEnd.value = caret;
  });
}

function toggleEmojiPicker() {
  emojiPickerOpen.value = !emojiPickerOpen.value;
  if (emojiPickerOpen.value) {
    activeReactionMessageId.value = "";
  }
}

function toggleReactionPicker(messageId) {
  activeReactionMessageId.value = activeReactionMessageId.value === messageId ? "" : messageId;
  if (activeReactionMessageId.value) {
    emojiPickerOpen.value = false;
  }
}

async function reactToMessage(messageId, emoji) {
  await store.reactToWorldChat(messageId, emoji);
  activeReactionMessageId.value = "";
}

function handleComposerKeydown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage().catch(() => {});
  }
}

function handleDocumentPointerDown(event) {
  if (!panelRef.value?.contains(event.target)) {
    closeTransientMenus();
  }
}

onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
});

watch(() => store.worldChatOpen, (open) => {
  if (open) {
    scrollToBottom();
    nextTick(() => {
      composerInputRef.value?.focus();
      captureSelection();
    });
    return;
  }
  closeTransientMenus();
});

watch(() => messages.value.length, () => {
  if (store.worldChatOpen) {
    scrollToBottom();
  }
});
</script>

<template>
  <section v-if="canRender && store.worldChatOpen" ref="panelRef" class="room-chat-panel world-chat-panel panel">
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
          <div class="room-chat-message__bubble-wrap">
            <div class="room-chat-message__bubble">{{ message.message }}</div>
            <button
              class="secondary room-chat-message__react-toggle"
              type="button"
              aria-label="React to message"
              @click="toggleReactionPicker(message.id)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 21c-4.971 0-9-3.813-9-8.5S7.029 4 12 4s9 3.813 9 8.5c0 4.687-4.029 8.5-9 8.5Zm0-11.75a1 1 0 0 0-1 1v3.75a1 1 0 0 0 .553.894l2.5 1.25a1 1 0 1 0 .894-1.788L13 13.691V10.25a1 1 0 0 0-1-1Z" />
                <path d="m12 8.4l-.952-.97a2.55 2.55 0 0 0-3.652 0 2.66 2.66 0 0 0 0 3.72L12 15.8l4.604-4.65a2.66 2.66 0 0 0 0-3.72 2.55 2.55 0 0 0-3.652 0L12 8.4Z" />
              </svg>
            </button>
            <div v-if="activeReactionMessageId === message.id" class="room-chat-message__reaction-picker">
              <button
                v-for="emoji in REACTION_EMOJIS"
                :key="`${message.id}-${emoji}`"
                class="room-chat-message__reaction-option"
                type="button"
                @click="reactToMessage(message.id, emoji)"
              >
                {{ emoji }}
              </button>
            </div>
            <div v-if="message.reactions?.length" class="room-chat-message__reactions">
              <button
                v-for="reaction in message.reactions"
                :key="`${message.id}-${reaction.emoji}`"
                class="room-chat-message__reaction-chip"
                :class="{ 'room-chat-message__reaction-chip--mine': reaction.reactedByMe }"
                type="button"
                @click="reactToMessage(message.id, reaction.emoji)"
              >
                <span>{{ reaction.emoji }}</span>
                <span>{{ reaction.count }}</span>
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>

    <footer class="room-chat-panel__composer">
      <div class="room-chat-panel__composer-main">
        <div class="room-chat-panel__emoji-shell">
          <button class="secondary room-chat-panel__emoji-toggle" type="button" @click="toggleEmojiPicker()">🙂</button>
          <div v-if="emojiPickerOpen" class="room-chat-panel__emoji-picker">
            <button
              v-for="emoji in COMPOSER_EMOJIS"
              :key="emoji"
              class="room-chat-panel__emoji-option"
              type="button"
              @click="insertEmoji(emoji)"
            >
              {{ emoji }}
            </button>
          </div>
        </div>
        <input
          ref="composerInputRef"
          v-model="draftMessage"
          maxlength="1000"
          placeholder="Write to world chat..."
          @click="captureSelection"
          @focus="captureSelection"
          @keydown="handleComposerKeydown"
          @keyup="captureSelection"
          @select="captureSelection"
        />
      </div>
      <button type="button" @click="sendMessage">Send</button>
    </footer>
  </section>
</template>
