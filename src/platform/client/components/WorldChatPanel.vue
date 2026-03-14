<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useAppStore } from "../store";

const COMPOSER_EMOJIS = ["🙂", "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "🤔", "😮", "😢", "😭", "😡", "🤯", "😴", "👍", "👎", "👏", "🙏", "🔥", "🎉", "💯", "❤️", "💔"];
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡"];
const CHAT_MESSAGE_MAX_LENGTH = 1000;

const store = useAppStore();
const draftMessage = ref("");
const messagesRef = ref(null);
const panelRef = ref(null);
const composerInputRef = ref(null);
const reactionPickerRef = ref(null);
const emojiPickerOpen = ref(false);
const activeReactionMessageId = ref("");
const activeMoreMessageId = ref("");
const selectionStart = ref(0);
const selectionEnd = ref(0);
const quotedComposerMessage = ref(null);
const activeReactionPickerStyle = ref({});
const shouldStickToBottom = ref(true);
const pendingOwnScrollToBottom = ref(false);
const reactionAnchorRefs = new Map();
const QUOTE_PREVIEW_MAX = 96;
const PASSIVE_HUD_MESSAGE_LIMIT = 6;
const BOTTOM_FOLLOW_THRESHOLD = 28;

const canRender = computed(() => !!store.activeProfile);
const isInteractive = computed(() => store.worldChatOpen);
const messages = computed(() => store.worldChatMessages || []);
const renderedMessages = computed(() => messages.value.map((message) => ({
  ...message,
  parsedContent: parseQuotedMessage(message.message),
  reactionOverview: reactionSummary(message)
})));
const displayedMessages = computed(() => (
  isInteractive.value ? renderedMessages.value : renderedMessages.value.slice(-PASSIVE_HUD_MESSAGE_LIMIT)
));
const activeReactionMessage = computed(() => renderedMessages.value.find((message) => message.id === activeReactionMessageId.value) || null);
const composerMaxLength = computed(() => {
  const quoteHeader = buildQuoteHeader(quotedComposerMessage.value);
  if (!quoteHeader) return CHAT_MESSAGE_MAX_LENGTH;
  return Math.max(0, CHAT_MESSAGE_MAX_LENGTH - quoteHeader.length - 2);
});

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
  activeReactionPickerStyle.value = {};
}

function panelIsNearBottom() {
  const panel = messagesRef.value;
  if (!panel) return true;
  return (panel.scrollHeight - panel.clientHeight - panel.scrollTop) <= BOTTOM_FOLLOW_THRESHOLD;
}

function syncStickToBottom() {
  shouldStickToBottom.value = panelIsNearBottom();
}

function scrollToBottom(force = false) {
  nextTick(() => {
    const panel = messagesRef.value;
    if (!panel) return;
    if (!force && !shouldStickToBottom.value) return;
    panel.scrollTop = panel.scrollHeight;
    shouldStickToBottom.value = true;
  });
}

async function sendMessage() {
  const message = composeOutgoingMessage();
  if (!message || message.length > CHAT_MESSAGE_MAX_LENGTH) return;
  pendingOwnScrollToBottom.value = true;
  shouldStickToBottom.value = true;
  await store.sendWorldChat(message);
  draftMessage.value = "";
  quotedComposerMessage.value = null;
  selectionStart.value = 0;
  selectionEnd.value = 0;
  closeTransientMenus();
  scrollToBottom(true);
}

function insertEmoji(emoji) {
  const start = selectionStart.value ?? draftMessage.value.length;
  const end = selectionEnd.value ?? start;
  const nextDraft = `${draftMessage.value.slice(0, start)}${emoji}${draftMessage.value.slice(end)}`;
  if (nextDraft.length > composerMaxLength.value) return;
  draftMessage.value = nextDraft;
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
    nextTick(() => {
      updateReactionPickerPosition();
    });
    return;
  }
  activeReactionPickerStyle.value = {};
}

async function reactToMessage(messageId, emoji) {
  await store.reactToWorldChat(messageId, emoji);
  activeReactionMessageId.value = "";
}

function toggleMoreMenu(messageId) {
  activeMoreMessageId.value = activeMoreMessageId.value === messageId ? "" : messageId;
  if (activeMoreMessageId.value) {
    emojiPickerOpen.value = false;
    activeReactionMessageId.value = "";
  }
}

function parseQuotedMessage(rawMessage) {
  const normalized = String(rawMessage || "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const quoteLines = [];
  let index = 0;
  while (index < lines.length && lines[index].startsWith("> ")) {
    quoteLines.push(lines[index].slice(2));
    index += 1;
  }
  if (!quoteLines.length) {
    return {
      quoteAuthor: "",
      quoteText: "",
      bodyText: normalized
    };
  }
  while (index < lines.length && !lines[index].trim()) {
    index += 1;
  }
  const bodyText = lines.slice(index).join("\n").trim();
  if (quoteLines.length === 1) {
    return {
      quoteAuthor: "",
      quoteText: quoteLines[0].trim(),
      bodyText
    };
  }
  return {
    quoteAuthor: quoteLines[0].trim(),
    quoteText: quoteLines.slice(1).join("\n").trim(),
    bodyText
  };
}

function quotePreviewText(message) {
  const parsed = parseQuotedMessage(message?.message);
  const source = parsed.bodyText || parsed.quoteText || String(message?.message || "");
  const condensed = source.replace(/\s+/g, " ").trim();
  if (!condensed) return "";
  if (condensed.length <= QUOTE_PREVIEW_MAX) return condensed;
  return `${condensed.slice(0, QUOTE_PREVIEW_MAX - 3).trimEnd()}...`;
}

function reactionSummary(message) {
  const reactions = Array.isArray(message?.reactions) ? message.reactions : [];
  if (!reactions.length) return null;
  return {
    emojis: reactions.slice(0, 2).map((reaction) => reaction.emoji),
    count: reactions.reduce((total, reaction) => total + Number(reaction.count || 0), 0),
    reactedByMe: reactions.some((reaction) => reaction.reactedByMe)
  };
}

function setReactionAnchorRef(messageId, element) {
  if (element) {
    reactionAnchorRefs.set(messageId, element);
    return;
  }
  reactionAnchorRefs.delete(messageId);
}

function updateReactionPickerPosition() {
  const panel = panelRef.value;
  const anchor = reactionAnchorRefs.get(activeReactionMessageId.value);
  const picker = reactionPickerRef.value;
  if (!panel || !anchor || !picker) return;
  const panelRect = panel.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const pickerWidth = picker.offsetWidth || 320;
  const pickerHeight = picker.offsetHeight || 76;
  const anchorCenter = anchorRect.left - panelRect.left + (anchorRect.width / 2);
  const horizontalPadding = 12;
  let left = anchorCenter - (pickerWidth / 2);
  const maxLeft = panelRect.width - pickerWidth - horizontalPadding;
  left = Math.max(horizontalPadding, Math.min(left, maxLeft));
  let top = anchorRect.top - panelRect.top - pickerHeight - 12;
  if (top < 12) {
    top = anchorRect.bottom - panelRect.top + 12;
  }
  const tailLeft = Math.max(26, Math.min(anchorCenter - left, pickerWidth - 26));
  activeReactionPickerStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    "--reaction-picker-tail-left": `${tailLeft}px`
  };
}

function insertQuotedMessage(message) {
  const preview = quotePreviewText(message);
  if (!preview) return;
  const nextQuote = {
    author: String(message.profileName || "Unknown").trim() || "Unknown",
    text: preview
  };
  quotedComposerMessage.value = nextQuote;
  const maxBodyLength = Math.max(0, CHAT_MESSAGE_MAX_LENGTH - buildQuoteHeader(nextQuote).length - 2);
  if (draftMessage.value.length > maxBodyLength) {
    draftMessage.value = draftMessage.value.slice(0, maxBodyLength);
  }
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

function buildQuoteHeader(quotePayload) {
  if (!quotePayload) return "";
  const author = String(quotePayload.author || "Unknown").trim() || "Unknown";
  const text = String(quotePayload.text || "").trim();
  if (!text) return "";
  return `> ${author}\n> ${text}`;
}

function composeOutgoingMessage() {
  const body = draftMessage.value.trim();
  const quoteHeader = buildQuoteHeader(quotedComposerMessage.value);
  if (!quoteHeader && !body) return "";
  if (!quoteHeader) return body;
  if (!body) return quoteHeader;
  return `${quoteHeader}\n\n${body}`;
}

function clearQuotedComposerMessage() {
  quotedComposerMessage.value = null;
  nextTick(() => {
    composerInputRef.value?.focus();
    captureSelection();
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
    if (isInteractive.value) {
      store.closeWorldChat();
      return;
    }
    closeTransientMenus();
  }
}

function handleMessagesViewportMutation() {
  if (activeReactionMessageId.value || activeMoreMessageId.value) {
    activeReactionMessageId.value = "";
    activeMoreMessageId.value = "";
    activeReactionPickerStyle.value = {};
  }
}

function handleMessagesScroll() {
  handleMessagesViewportMutation();
  if (!isInteractive.value) return;
  syncStickToBottom();
}

function reactionPeopleLabel(reaction) {
  const reactors = Array.isArray(reaction?.reactors) ? reaction.reactors : [];
  if (!reactors.length) return "";
  return reactors.map((reactor) => reactor.reactedByMe ? "You" : reactor.profileName).join(", ");
}

onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  window.addEventListener("resize", handleMessagesViewportMutation);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
  window.removeEventListener("resize", handleMessagesViewportMutation);
});

watch(() => isInteractive.value, (open) => {
  if (open) {
    shouldStickToBottom.value = true;
    scrollToBottom(true);
    nextTick(() => {
      composerInputRef.value?.focus();
      captureSelection();
    });
    return;
  }
  closeTransientMenus();
});

watch(() => messages.value.length, () => {
  if (!isInteractive.value) return;
  if (pendingOwnScrollToBottom.value || shouldStickToBottom.value) {
    scrollToBottom(true);
  }
  pendingOwnScrollToBottom.value = false;
});

watch(() => activeReactionMessageId.value, (messageId) => {
  if (!messageId) {
    activeReactionPickerStyle.value = {};
    return;
  }
  nextTick(() => {
    updateReactionPickerPosition();
  });
});
</script>

<template>
  <section
    v-if="canRender"
    ref="panelRef"
    class="room-chat-panel world-chat-panel panel"
    :class="{ 'room-chat-panel--passive': !isInteractive }"
  >
    <header v-if="isInteractive" class="room-chat-panel__header">
      <div>
        <strong>World chat</strong>
        <p class="muted">Global lobby thread</p>
      </div>
      <button
        class="secondary room-chat-panel__close"
        type="button"
        aria-label="Close world chat"
        @click="store.closeWorldChat()"
      >
        ×
      </button>
    </header>

    <div ref="messagesRef" class="room-chat-panel__messages" @scroll="handleMessagesScroll">
      <article
        v-for="message in displayedMessages"
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
            <div class="room-chat-message__balloon-shell">
              <div class="room-chat-message__bubble">
                <div v-if="message.parsedContent.quoteText" class="room-chat-message__quote-block">
                  <strong v-if="message.parsedContent.quoteAuthor" class="room-chat-message__quote-author">
                    {{ message.parsedContent.quoteAuthor }}
                  </strong>
                  <div class="room-chat-message__quote-text">{{ message.parsedContent.quoteText }}</div>
                </div>
                <div v-if="message.parsedContent.bodyText" class="room-chat-message__bubble-text">
                  {{ message.parsedContent.bodyText }}
                </div>
              </div>
              <button
                :ref="(element) => setReactionAnchorRef(message.id, element)"
                class="secondary room-chat-message__reaction-anchor"
                :class="{
                  'room-chat-message__reaction-anchor--summary': !!message.reactionOverview,
                  'room-chat-message__reaction-anchor--mine': message.reactionOverview?.reactedByMe
                }"
                type="button"
                :aria-label="message.reactionOverview ? 'View reactions' : 'React to message'"
                @click="toggleReactionPicker(message.id)"
              >
                <template v-if="message.reactionOverview">
                  <span class="room-chat-message__reaction-anchor-emojis">
                    <span v-for="emoji in message.reactionOverview.emojis" :key="`${message.id}-${emoji}`">{{ emoji }}</span>
                  </span>
                  <span class="room-chat-message__reaction-anchor-count">{{ message.reactionOverview.count }}</span>
                </template>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9.75 21H6.5A2.5 2.5 0 0 1 4 18.5v-6A2.5 2.5 0 0 1 6.5 10h3.25v11ZM19.27 10.24c.45.55.73 1.3.73 2.11v.15c0 .76-.2 1.5-.58 2.16l-2.2 3.82A3 3 0 0 1 14.61 20H11.25V10.66l2.7-5.07a1.74 1.74 0 0 1 3.25.82c0 .16-.02.32-.07.48L16.4 10h1.36c.6 0 1.16.27 1.51.74Z" />
                </svg>
              </button>
            </div>
            <div v-if="isInteractive" class="room-chat-message__trail-actions">
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
            <div v-if="activeMoreMessageId === message.id" class="room-chat-message__more-menu">
              <button class="secondary room-chat-message__more-menu-item" type="button" disabled>
                More actions POC
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>

    <div v-if="isInteractive && activeReactionMessageId" class="room-chat-panel__overlay">
      <div ref="reactionPickerRef" class="room-chat-message__reaction-picker" :style="activeReactionPickerStyle">
        <div class="room-chat-message__reaction-picker-row">
          <button
            v-for="emoji in REACTION_EMOJIS"
            :key="`${activeReactionMessageId}-${emoji}`"
            class="room-chat-message__reaction-option"
            type="button"
            @click="reactToMessage(activeReactionMessageId, emoji)"
          >
            {{ emoji }}
          </button>
        </div>
        <div v-if="activeReactionMessage?.reactions?.length" class="room-chat-message__reaction-details">
          <div
            v-for="reaction in activeReactionMessage.reactions"
            :key="`${activeReactionMessage.id}-${reaction.emoji}-details`"
            class="room-chat-message__reaction-detail-row"
          >
            <span class="room-chat-message__reaction-detail-emoji">{{ reaction.emoji }}</span>
            <span class="room-chat-message__reaction-detail-people">{{ reactionPeopleLabel(reaction) }}</span>
          </div>
        </div>
        <p v-else class="room-chat-message__reaction-empty">No reactions yet</p>
      </div>
    </div>

    <footer v-if="isInteractive" class="room-chat-panel__composer">
      <div class="room-chat-panel__composer-main">
        <div v-if="quotedComposerMessage" class="room-chat-panel__composer-quote">
          <div class="room-chat-panel__composer-quote-body">
            <strong class="room-chat-panel__composer-quote-author">{{ quotedComposerMessage.author }}</strong>
            <p class="room-chat-panel__composer-quote-text">{{ quotedComposerMessage.text }}</p>
          </div>
          <button
            class="secondary room-chat-panel__composer-quote-clear"
            type="button"
            aria-label="Remove quote"
            @click="clearQuotedComposerMessage()"
          >
            ×
          </button>
        </div>
        <div class="room-chat-panel__composer-row">
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
          <textarea
            ref="composerInputRef"
            v-model="draftMessage"
            :maxlength="composerMaxLength || undefined"
            rows="1"
            placeholder="Write to world chat..."
            @click="captureSelection"
            @focus="captureSelection"
            @input="captureSelection"
            @keydown="handleComposerKeydown"
            @keyup="captureSelection"
            @select="captureSelection"
          />
        </div>
      </div>
      <button type="button" @click="sendMessage">Send</button>
    </footer>
  </section>
</template>
