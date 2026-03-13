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

const canRender = computed(() => !!store.roomChatRoomCode && !!store.currentMember);
const roomCode = computed(() => store.roomChatRoomCode || store.room?.code || "");
const messages = computed(() => store.roomChatMessages || []);

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
  await store.sendRoomChat(message);
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
  await store.reactToRoomChat(messageId, emoji);
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

watch(() => store.roomChatOpen, (open) => {
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
  if (store.roomChatOpen) {
    scrollToBottom();
  }
});
</script>

<template>
  <section v-if="canRender && store.roomChatOpen" ref="panelRef" class="room-chat-panel panel">
    <header class="room-chat-panel__header">
      <div>
        <strong>Room chat</strong>
        <p class="muted">Room {{ roomCode }}</p>
      </div>
      <button class="secondary room-chat-panel__close" type="button" @click="store.closeRoomChat()">Close</button>
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
          <div class="room-chat-message__action-row">
            <button
              class="secondary room-chat-message__react-toggle"
              type="button"
              @click="toggleReactionPicker(message.id)"
            >
              React
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
          placeholder="Write a message..."
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
