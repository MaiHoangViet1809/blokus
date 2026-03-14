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

## Extension: Composer Quote Block as Readonly UI + Shift+Enter Multi-Line Input
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-14
- **Task**: Refactor chat composer quote behavior so quote is a separate readonly block pinned above the editable body, and support `Shift+Enter` for multi-line chat input.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/RoomChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/WorldChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0011_chat_emoji_picker_and_message_reactions.md`
- **Why**:
  - quote currently lives in editable composer text and can be modified accidentally
  - desired UX is quote always pinned above and body typing always starts on the next line
  - composer currently uses single-line input; users need `Shift+Enter` for multiline messages
- **Deliverables**:
  - introduce quote state in composer, rendered as a readonly quote preview box
  - switch composer body field from `input` to `textarea`
  - keep `Enter` to send and enable `Shift+Enter` to insert newline
  - serialize outgoing message as quote block first, then blank line, then body text
  - keep rendered quote UI in bubbles compatible with previous parser
- **Done Criteria**:
  - quote is shown in a separate readonly box and is not directly editable in text area
  - typed body content is always below quote block
  - `Shift+Enter` inserts newline, `Enter` sends
  - `npm run build` passes

## Extension: Bottom-Growing Chat, Larger Panel, and Passive HUD Overlay
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-14
- **Task**: Refine chat panel behavior so messages continue to grow from the bottom without forced scroll resets, enlarge the panel by about 15%, and add a passive translucent HUD state that remains visible but click-through until full chat is opened.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/RoomChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/WorldChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0011_chat_emoji_picker_and_message_reactions.md`
- **Why**:
  - new messages should appear at the bottom and push older messages upward without relying on unconditional scroll resets
  - users need to read older messages without being yanked back to the bottom
  - the current chat panel is slightly too small
  - the product wants a game-style passive chat HUD that is readable but non-interactive until the messenger icon is clicked
- **Deliverables**:
  - keep chronological message ordering and bottom-growth behavior, while only auto-following new messages when the viewer is already near the bottom or just sent a message
  - enlarge room/world chat panels by roughly 15% while keeping viewport clamps
  - render a passive HUD variant when chat is not fully open, showing only a recent message slice with reduced-opacity styling and click-through behavior
  - keep the existing FAB as the trigger to switch from passive HUD to full interactive chat
- **Done Criteria**:
  - users can stay scrolled up in full chat while new messages arrive
  - new messages continue to append at the bottom and push older content upward
  - passive HUD is readable, translucent, and does not block gameplay clicks
  - full chat remains fully interactive when opened
  - `npm run build` passes

## Extension: App Settings Menu with Adjustable Passive Chat Opacity
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-14
- **Task**: Add a topbar app settings menu and expose passive chat opacity as the first persisted UI preference.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/App.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/store.js`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0011_chat_emoji_picker_and_message_reactions.md`
- **Why**:
  - passive chat HUD should be configurable by the user
  - the application bar currently has no app-level settings entry point
  - this preference should survive refreshes using the same client-side persistence style as existing UI selections
- **Deliverables**:
  - add a compact settings button in the top-right application bar cluster
  - open a small app settings popover from that button with a slider for passive chat opacity
  - persist passive chat opacity in store-backed localStorage state
  - apply the stored opacity immediately to passive room/world chat HUD styling through a CSS custom property
- **Done Criteria**:
  - settings menu opens from the top-right topbar and closes on outside click
  - passive chat opacity slider updates the passive HUD immediately
  - preference persists after refresh
  - full interactive chat appearance remains unchanged
  - `npm run build` passes

## Extension: Render App Settings as a Floating Popup Window
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-14
- **Task**: Refine the topbar settings control so it opens a true floating popup window rather than a dropdown that can be hidden behind page content.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/App.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0011_chat_emoji_picker_and_message_reactions.md`
- **Why**:
  - the current settings popover is visually clipped/hidden behind route blocks
  - app configuration should appear as a dedicated floating layer above the shell content
- **Deliverables**:
  - render the app settings UI in a top-level floating popup layer
  - anchor the popup visually near the top-right settings trigger while keeping it above route content
  - preserve the existing passive chat opacity slider and close behaviors
- **Done Criteria**:
  - the settings popup remains visible above surrounding page blocks
  - outside click and route change still close it
  - `npm run build` passes

## Extension: Make Passive Chat Truly See-Through Instead of Frosted
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-14
- **Task**: Refine passive chat HUD styling so inactive chat remains visually see-through for gameplay rather than using a frosted-glass blur effect.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0011_chat_emoji_picker_and_message_reactions.md`
- **Why**:
  - passive chat should let players see gameplay clearly underneath the HUD
  - the current frosted-glass treatment makes the passive overlay feel like a blurred pane instead of a transparent tint
  - passive chat opacity setting should describe tint strength only, not backdrop blur intensity
- **Deliverables**:
  - remove backdrop blur from `.room-chat-panel--passive`
  - keep passive panel and message bubbles on a very light transparent tint only
  - preserve text readability through text color and subtle bubble contrast instead of glass blur
  - clarify that `Passive chat opacity` controls tint strength only
- **Done Criteria**:
  - passive room/world chat no longer blurs gameplay behind them
  - passive chat remains readable while visually see-through
  - the passive opacity slider still adjusts tint intensity immediately
  - full interactive chat appearance remains unchanged
  - `npm run build` passes

## Extension: Convert Passive Chat to a True Text-Only HUD
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-14
- **Task**: Replace the current passive chat overlay with a true text-first HUD so inactive chat stops looking like a translucent panel and instead reads as lightweight overlay text over gameplay.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/App.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/store.js`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0011_chat_emoji_picker_and_message_reactions.md`
- **Why**:
  - the passive chat overlay still feels like a card/panel and obscures gameplay more than intended
  - the current opacity range and default are too high for a true HUD presentation
  - passive chat should prioritize gameplay visibility while remaining legible
- **Deliverables**:
  - remove passive panel chrome in inactive mode and render passive chat as a text-first HUD
  - mute or hide non-essential passive elements, including avatars and action affordances
  - retune passive opacity control to `0%..30%` with a `10%` default
  - update the settings copy so it describes passive HUD tint intensity rather than generic opacity
- **Done Criteria**:
  - passive chat reads like overlay text instead of a translucent panel
  - users can set passive tint as low as `0%`
  - full interactive chat remains unchanged
  - passive opacity changes persist and update immediately
  - `npm run build` passes

## Extension: Remove Shared Panel Glass From Passive Chat HUD
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-14
- **Task**: Remove the remaining shared `.panel` glass treatment from passive chat so inactive room/world chat no longer blur or fog gameplay.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0011_chat_emoji_picker_and_message_reactions.md`
- **Why**:
  - passive chat root still inherits the global `.panel` backdrop blur and panel chrome
  - this shared shell styling keeps the passive HUD visually blurry even after passive-specific tint reductions
- **Deliverables**:
  - explicitly override shared `.panel` glass on `.room-chat-panel--passive`
  - ensure passive chat root has no backdrop blur, fog sheet, or panel chrome
  - keep full interactive chat on the normal panel styling
- **Done Criteria**:
  - inactive room/world chat no longer blur or fog the underlying game board
  - active/open chat still uses the full panel treatment
  - `npm run build` passes

## Extension: Icon-Only Chat Close Button and Outside-Click Collapse
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-14
- **Task**: Replace the text `Close` action in active chat headers with an icon-only `X` button and make outside clicks collapse active chat back to passive HUD mode.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/RoomChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/WorldChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0011_chat_emoji_picker_and_message_reactions.md`
- **Why**:
  - the text `Close` action is visually heavier than needed for chat chrome
  - active chat should collapse naturally when users click back into the main app/game area
- **Deliverables**:
  - replace the header `Close` text button with an icon-only `X` button
  - keep accessibility via `aria-label`
  - close active room/world chat when the pointerdown target lands outside the panel
  - keep passive HUD behavior unchanged
- **Done Criteria**:
  - both active chat headers use an icon-only close control
  - clicking outside an active room/world chat collapses it to passive HUD
  - `npm run build` passes
