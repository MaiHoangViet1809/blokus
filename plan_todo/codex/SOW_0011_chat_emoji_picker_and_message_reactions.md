# SOW_0011_chat_emoji_picker_and_message_reactions

- **Status**: PROPOSED
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
