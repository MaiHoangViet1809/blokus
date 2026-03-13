# SOW_0011_chat_emoji_picker_and_message_reactions

- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Add emoji insertion in chat composers and Facebook/Zalo-style message reactions for both room chat and world chat.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/RoomChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/WorldChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/store.js`
  - `/Users/maihoangviet/Projects/blokus/src/platform/server/index.js`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
- **Why**:
  - Current chat supports only plain text send/receive.
  - Users want faster emotional expression in chat without typing emoji manually.
  - Message reactions provide lower-friction feedback than reply spam and match the expected behavior from common chat products.
- **As-Is Diagram (ASCII)**:
```text
Room Chat / World Chat

Composer:
  [ text input........................ ] [Send]

Message:
  Avatar  Name  Time
          [ plain text bubble ]

Server:
  room_messages / world_messages
    - id
    - profile_id
    - profile_name
    - message
    - created_at

Realtime:
  room:chat:send  -> state:room-chat:message
  world:chat:send -> state:world-chat:message

Missing:
  - emoji picker
  - per-message reaction state
  - reaction persistence
  - reaction realtime updates
```
- **To-Be Diagram (ASCII)**:
```text
Room Chat / World Chat

Composer:
  [🙂] [ text input.................... ] [Send]
   |
   +-> emoji tray inserts unicode emoji at caret position

Message:
  Avatar  Name  Time               [React]
          [ plain text bubble ]
          [👍 3] [❤️ 1] [😂 2]

React flow:
  tap React or reaction chip
    -> choose one reaction from fixed palette
    -> selecting same reaction removes it
    -> selecting another reaction replaces prior user reaction

Server:
  messages table remains source of text
  reaction tables persist per-user per-message reaction

Realtime:
  room:chat:react  -> state:room-chat:reaction
  world:chat:react -> state:world-chat:reaction

Init payload:
  each message includes aggregated reactions for rendering
```
- **Deliverables**:
  - add a fixed emoji picker button to both chat composers that inserts native unicode emoji into the current draft text
  - add per-message reaction UI to both room chat and world chat with a fixed palette such as `👍`, `❤️`, `😂`, `😮`, `😢`, `😡`
  - persist one active reaction per user per message, with toggle-off on repeat tap and replace-on-new-choice behavior
  - include aggregated reaction data in chat init payloads and realtime reaction updates
  - add server-side persistence for room-message reactions and world-message reactions
  - keep room chat and world chat behavior visually and functionally aligned
  - use minimal shared client code only where it removes duplication across both chat panels
- **Done Criteria**:
  - a user can open the emoji tray in room chat and world chat and insert emoji into the composer without browser zoom or manual copy/paste
  - sending a message with inserted emoji persists and renders correctly after refresh/reconnect
  - a user can react to an existing message with one reaction from the allowed palette
  - reacting again with the same icon removes the reaction
  - reacting with a different icon replaces the prior reaction from that same user
  - reaction counts update in realtime for other connected clients in the same channel
  - world chat reactions are visible to all connected profiled users
  - room chat reactions are visible only to room members/spectators in that room
  - `npm run build` passes
- **Out-of-Scope**:
  - stickers, GIFs, image upload, or file attachments
  - custom emoji uploads or sprite-based emoji systems
  - threaded replies, edit/delete message, pinning, quoting, or mentions
  - push notifications or unread-count changes based on reactions
  - reaction history popovers listing every reactor by name
- **Proposed-By**: Codex GPT-5
- **plan**: chat-rich-messaging-v1
- **Cautions / Risks**:
  - current chat payloads are text-only, so both init and incremental socket payloads need schema changes without breaking existing bootstrap/resume flows
  - reactions should be modeled separately from message text to avoid brittle JSON blobs inside message rows
  - the UI needs to stay compact inside the existing floating chat panel footprint on short laptop screens
  - unicode emoji rendering depends on system fonts, so the design should rely on native emoji characters rather than custom assets in this first pass
  - message reaction ownership rules must stay simple; this SoW assumes one active reaction per user per message

## Extension: Replace Textual React Trigger with Compact Icon Helper
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Replace the textual `React` trigger in chat messages with a compact icon-only helper affordance.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/RoomChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/WorldChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0011_chat_emoji_picker_and_message_reactions.md`
- **Why**: The textual `React` button reads too heavy inside compact chat bubbles. The action should feel like a lightweight helper icon similar to familiar messaging apps.
- **Deliverables**:
  - replace the text label with a small icon-only trigger for the reaction picker
  - keep the button accessible via `aria-label`
  - preserve existing picker behavior and message reaction data flow
- **Done Criteria**:
  - no visible `React` text remains in room/world chat message actions
  - the reaction picker still opens from a compact icon helper
  - `npm run build` passes

## Extension: Align Chat Reaction Placement with Zalo-Style Bubble Affordances
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Reposition the chat reaction helper, reaction picker, and reaction chips so they anchor around the message bubble like Zalo.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/RoomChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/WorldChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0011_chat_emoji_picker_and_message_reactions.md`
- **Why**: The current helper icon and reaction row still read like separate controls below the message. The desired feel is the Zalo pattern: helper icon hugging the bubble edge, picker floating above the bubble, and reaction chips docking on the bubble corner.
- **Deliverables**:
  - anchor the reaction trigger to the edge of each message bubble instead of rendering it as a row below
  - restyle the reaction picker into a rounded floating tray above the bubble
  - dock aggregated reaction chips onto the lower bubble edge in a Zalo-like placement
  - keep mirrored positioning for own-message vs other-message bubbles
- **Done Criteria**:
  - helper icon sits at the bubble edge instead of as a separate text/action row
  - reaction tray opens above the bubble with a floating rounded appearance
  - aggregated reaction chips appear attached to the bubble corner
  - `npm run build` passes

## Extension: Add Zalo-Style Quote and POC More Actions Beside Like
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Refine the message action cluster to use a small thumb-like reaction trigger, add a double-quote mention action, and add a POC three-dots menu trigger.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/RoomChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/WorldChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0011_chat_emoji_picker_and_message_reactions.md`
- **Why**: The current reaction helper still does not match the Zalo-style action cluster the product needs. The bubble should expose a small thumb-like react action plus quote and more affordances grouped near the bubble edge.
- **Deliverables**:
  - replace the current reaction helper icon with a compact thumb-like icon
  - add a double-quote icon that inserts quoted text into the composer input
  - add a three-dots icon with a minimal POC popup or stub state only
  - keep all three actions grouped near the trailing edge of the bubble
  - keep quote insertion client-only with no server/schema changes
- **Done Criteria**:
  - the visible action cluster includes quote, like, and more icons
  - clicking quote inserts a deterministic plain-text quote snippet into composer
  - the like icon still opens the existing reaction tray
  - the three-dots icon renders and opens a minimal POC affordance without detailed actions
  - `npm run build` passes

## Extension: Keep Chat Messages Bottom-Anchored and Move Action Cluster Below the Bubble
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Correct the chat layout so sparse message lists stay bottom-aligned and the per-message action cluster sits below the bubble instead of above it.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0011_chat_emoji_picker_and_message_reactions.md`
- **Why**: The current action cluster placement makes new messages read as if they appear at the top of the chat item, and sparse chats visually stack from the top of the panel instead of building upward from the bottom like common messengers.
- **Deliverables**:
  - bottom-anchor the chat message list when there are only a few messages
  - move the quote/like/more action cluster from above the bubble to below it
  - keep the reaction chip and picker behavior intact after the repositioning
- **Done Criteria**:
  - new/sparse messages sit visually at the bottom of the panel
  - action icons render below the bubble instead of above it
  - `npm run build` passes

## Extension: Mirror Message Actions by Bubble Side and Float the Reaction Tray
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Rework the chat message action UX so quote/more actions mirror by bubble ownership, the reaction affordance sits on the balloon border, and the reaction tray floats outside the clipped message viewport.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/RoomChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/WorldChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0011_chat_emoji_picker_and_message_reactions.md`
- **Why**:
  - quote and more icons should live on the trailing side of the bubble, not in a generic row below it
  - the reaction affordance should attach to the latter half of the balloon border and be replaced by the rendered reaction chip once reactions exist
  - the floating reaction tray should not be clipped by the scrollable chat viewport
- **Deliverables**:
  - mirror quote and more actions by ownership so they sit after other users' bubbles and before the current user's bubbles
  - move the reaction button onto the bubble border and replace it with a compact aggregated reaction chip in the same anchor slot after reactions exist
  - render the reaction tray in a panel-level floating overlay so it escapes message viewport clipping
  - preserve bottom-anchored sparse-chat behavior
- **Done Criteria**:
  - quote and more actions mirror correctly for own vs other messages
  - the reaction button/chip sits on the bubble edge instead of in a row below the bubble
  - the reaction tray no longer clips inside the message scroll viewport
  - `npm run build` passes

## Extension: Refine Reaction Anchor Scale, Reveal Reactor Names, and Render True Quote Blocks
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-14
- **Task**: Refine the chat reaction anchor placement and styling, expose who reacted in the floating overlay, and render inserted quotes as actual quote blocks in chat bubbles.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/RoomChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/WorldChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/store.js`
  - `/Users/maihoangviet/Projects/blokus/src/platform/server/index.js`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0011_chat_emoji_picker_and_message_reactions.md`
- **Why**:
  - the current reaction anchor is still too large and visually noisy
  - the anchor should sit closer to a golden-ratio placement on the lower bubble edge
  - users need to see who liked/reacted when opening the reaction overlay
  - quote insertion currently renders as plain text instead of a styled quote block
- **Deliverables**:
  - reduce reaction anchor/chip size to roughly two-thirds of the current footprint and simplify it to a quieter monochrome treatment
  - reposition the reaction anchor/chip using a golden-ratio style placement along the lower bubble edge, mirrored for own vs other messages
  - extend chat reaction payloads so each emoji entry carries reactor identity data for rendering
  - show reactor names grouped by emoji in the floating reaction overlay
  - insert quoted text in a deterministic multi-line format and render leading quote text as a styled quote block inside the message bubble
- **Done Criteria**:
  - the reaction anchor/chip is smaller, quieter, and positioned on the lower bubble edge using the new phi-style offset
  - clicking a reacted message shows who reacted in the floating overlay
  - quote insertion produces a visibly styled quote block on sent/rendered messages
  - room chat and world chat stay behaviorally aligned
  - `npm run build` passes
