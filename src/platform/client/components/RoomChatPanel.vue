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
const activeMoreMessageId = ref("");
const selectionStart = ref(0);
const selectionEnd = ref(0);
const QUOTE_PREVIEW_MAX = 96;

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
  activeMoreMessageId.value = "";
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
    activeMoreMessageId.value = "";
  }
}

async function reactToMessage(messageId, emoji) {
  await store.reactToRoomChat(messageId, emoji);
  activeReactionMessageId.value = "";
}

function toggleMoreMenu(messageId) {
  activeMoreMessageId.value = activeMoreMessageId.value === messageId ? "" : messageId;
  if (activeMoreMessageId.value) {
    emojiPickerOpen.value = false;
    activeReactionMessageId.value = "";
  }
}

function quotePreviewText(message) {
  const condensed = String(message?.message || "").replace(/\s+/g, " ").trim();
  if (!condensed) return "";
  if (condensed.length <= QUOTE_PREVIEW_MAX) return condensed;
  return `${condensed.slice(0, QUOTE_PREVIEW_MAX - 3).trimEnd()}...`;
}

function insertQuotedMessage(message) {
  const preview = quotePreviewText(message);
  if (!preview) return;
  const quoteLine = `> ${String(message.profileName || "Unknown")}: ${preview}`;
  const before = draftMessage.value && !draftMessage.value.endsWith("\n") ? "\n" : "";
  draftMessage.value = `${draftMessage.value}${before}${quoteLine}\n`;
  closeTransientMenus();
  nextTick(() => {
    const input = composerInputRef.value;
    if (!input) return;
    const caret = draftMessage.value.length;
    input.focus();
    input.setSelectionRange(caret, caret);
    selectionStart.value = caret;
    selectionEnd.value = caret;
  });
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
          <div class="room-chat-message__bubble-wrap">
            <div class="room-chat-message__action-rail">
              <button
                class="secondary room-chat-message__action-btn"
                type="button"
                aria-label="Quote message"
                @click="insertQuotedMessage(message)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10.5 7H7.75A2.75 2.75 0 0 0 5 9.75v2.5A2.75 2.75 0 0 0 7.75 15h1.06A4.5 4.5 0 0 1 5 19.25a.75.75 0 0 0 .25 1.47a6 6 0 0 0 6-6V9.75A2.75 2.75 0 0 0 8.5 7Zm7.75 0H15.5a2.75 2.75 0 0 0-2.75 2.75v2.5A2.75 2.75 0 0 0 15.5 15h1.06a4.5 4.5 0 0 1-3.81 4.25a.75.75 0 0 0 .25 1.47a6 6 0 0 0 6-6V9.75A2.75 2.75 0 0 0 18.25 7Z" />
                </svg>
              </button>
              <button
                class="secondary room-chat-message__action-btn room-chat-message__action-btn--like"
                type="button"
                aria-label="React to message"
                @click="toggleReactionPicker(message.id)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9.75 21H6.5A2.5 2.5 0 0 1 4 18.5v-6A2.5 2.5 0 0 1 6.5 10h3.25v11ZM19.27 10.24c.45.55.73 1.3.73 2.11v.15c0 .76-.2 1.5-.58 2.16l-2.2 3.82A3 3 0 0 1 14.61 20H11.25V10.66l2.7-5.07a1.74 1.74 0 0 1 3.25.82c0 .16-.02.32-.07.48L16.4 10h1.36c.6 0 1.16.27 1.51.74Z" />
                </svg>
              </button>
              <button
                class="secondary room-chat-message__action-btn"
                type="button"
                aria-label="More message actions"
                @click="toggleMoreMenu(message.id)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6.75 12a1.75 1.75 0 1 1-3.5 0a1.75 1.75 0 0 1 3.5 0Zm7 0a1.75 1.75 0 1 1-3.5 0a1.75 1.75 0 0 1 3.5 0Zm7 0a1.75 1.75 0 1 1-3.5 0a1.75 1.75 0 0 1 3.5 0Z" />
                </svg>
              </button>
            </div>
            <div class="room-chat-message__bubble">{{ message.message }}</div>
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
            <div v-if="activeMoreMessageId === message.id" class="room-chat-message__more-menu">
              <button class="secondary room-chat-message__more-menu-item" type="button" disabled>
                More actions POC
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
