## SOW_0010 Exploding Kittens v1 with Selectable Preset Versions

- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Add `exploding_kittens` as a new platform game with preset room-create versions, private hands, reaction windows, exact defuse reinsertion, staging/live/replay support, and no game-specific changes to the platform shells.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/registry.js`
  - `/Users/maihoangviet/Projects/blokus/src/platform/server/registry.js`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/views/HomeView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0010_exploding_kittens_v1.md`
- **Why**: The platform now supports multiple games through generic create/staging/live/replay shells, but it has only board-perfect-information games. Exploding Kittens validates the next abstraction layer: hidden information, viewer-specific state projection, reaction windows, and preset-driven room creation under the same platform architecture.

## As-Is Diagram (ASCII)
```text
Platform
  -> blokus
  -> chess

Create flow
  -> game-specific room-create page
  -> preset/mode selector supported

Live/replay
  -> game-specific views mounted by generic routes

Missing
  -> no hidden-information party/card game
  -> no reaction-window game
  -> no per-viewer private hand projection
```

## To-Be Diagram (ASCII)
```text
Platform
  -> blokus
  -> chess
  -> exploding_kittens

/games/exploding_kittens
  -> choose preset:
     [Base] [Imploding] [Streaking] [Barking]

/rooms/:roomCode
  -> EK staging with player slots and readiness

/matches/:matchId
  -> EK live game
     -> private hands
     -> public discard / deck state
     -> reaction windows
     -> exact defuse reinsertion

/matches/:matchId/replay
  -> EK replay from event history
```

- **Deliverables**:
  - Add a new game folder:
```text
src/games/exploding_kittens/
  index.js
  client.js
  server.js
  create.js
  staging.js
  LiveView.vue
  ReplayView.vue
  shared.js
```
  - Register `exploding_kittens` in:
    - `/Users/maihoangviet/Projects/blokus/src/platform/client/registry.js`
    - `/Users/maihoangviet/Projects/blokus/src/platform/server/registry.js`
  - Add room-create presets for:
    - `base`
    - `imploding`
    - `streaking`
    - `barking`
  - Implement official-faithful EK server logic for the selected preset:
    - deck construction
    - player hands
    - private/public state projection
    - elimination flow
    - attack/turn modifiers
    - exploding/imploding/streaking/barking card behavior
    - exact defuse reinsertion
    - full `Nope` reaction windows and chain resolution
  - Add EK staging flow:
    - player slots up to preset capacity
    - ready state
    - host launch controls
  - Add EK live UI:
    - private hand
    - public piles / turn state / prompts
    - target selection and reaction UI
  - Add EK replay UI from persisted event history
  - Show EK rooms and their selected preset in the main lobby room table.

- **Done Criteria**:
  - `/games/exploding_kittens` can create rooms for all four approved presets
  - `/rooms/:roomCode` staging respects each preset capacity
  - EK live match works end-to-end with private hands and public state separation
  - `Nope` chains work through explicit reaction windows
  - `Defuse` allows exact reinsertion position selection
  - elimination and winner detection work
  - replay works for EK matches
  - `/` room table distinguishes `exploding_kittens` rooms and preset labels
  - `node --check server.js` passes
  - `node --check src/games/exploding_kittens/server.js` passes
  - `npm run build` passes

- **Out-of-Scope**:
  - AI players
  - direct messages or social systems beyond existing platform chat
  - deck customization beyond the selected preset
  - every official modern EK set beyond Base, Imploding, Streaking, Barking
  - matchmaking/ranking
  - moderation systems

- **Proposed-By**: Codex GPT-5
- **plan**: exploding-kittens-v1-platform-game

- **Cautions / Risks**:
  - EK is the first hidden-information game on this platform, so viewer-specific projection must stay server-authoritative.
  - Reaction windows and `Nope` chains are the highest-complexity part of the rules implementation.
  - Replay must remain public-state-first unless a later SoW explicitly adds hidden-history replay.
  - The generic platform shells must not be bent into card-game-specific UI.

- **Assumptions / Defaults**:
  - `exploding_kittens` is a new standalone SoW because it adds a new game, not a regression of an existing SoW.
  - V1 presets are exactly:
    - Base
    - Imploding
    - Streaking
    - Barking
  - Create flow uses one preset selector only, not custom expansion mixing.
  - Hands are private to the owning player; spectators do not see private cards.
  - Full reaction windows are in scope, including `Nope` chaining.
  - Defuse reinsertion uses exact draw-pile position selection, not top/middle/bottom shortcuts.

---

## Extension: Include Generic Match Command Dispatch and Platform Orchestration Touchpoints

- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Expand `SOW_0010` scope to include the platform store and platform server orchestration files required to implement Exploding Kittens without hacking around the current match-command flow.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/registry.js`
  - `/Users/maihoangviet/Projects/blokus/src/platform/server/registry.js`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/views/HomeView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/store.js`
  - `/Users/maihoangviet/Projects/blokus/src/platform/server/index.js`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0010_exploding_kittens_v1.md`
- **Why**: EK is the first hidden-information reaction game on the platform. The current client store still hardcodes Blokus-style `place_piece` transport, and the actual authoritative room/match orchestration lives in the platform server layer. Without including these files, EK implementation would be forced into brittle workarounds.

### As-Is Diagram (ASCII)
```text
Match live UI
  -> store.placeMove(move)
  -> emits match:command with commandType = place_piece

Good for board placement games
  -> blokus

Not enough for EK
  -> draw
  -> play card
  -> nope
  -> choose target
  -> defuse reinsertion
```

### To-Be Diagram (ASCII)
```text
Match live UI
  -> store.sendMatchCommand(commandType, commandPayload)
  -> emits generic match:command

Platform server
  -> routes command to EK driver
  -> driver projects viewer-specific private/public state
```

- **Deliverables**:
  - add generic match-command dispatch in the platform client store
  - keep existing Blokus/Chess call sites working
  - allow EK live view to send arbitrary driver commands cleanly
  - include platform server orchestration file in SoW scope for EK integration
- **Done Criteria**:
  - `SOW_0010` covers all files actually required for EK implementation
  - no platform shell hack is needed to fake EK actions through `place_piece`
  - `node --check server.js` passes after implementation
  - `npm run build` passes after implementation
- **Out-of-Scope**:
  - changing room/create shells
  - redesigning platform routes
  - plugin loading
- **Proposed-By**: Codex GPT-5
- **plan**: exploding-kittens-v1-platform-game
- **Cautions / Risks**:
  - this extension broadens scope into platform orchestration, but only where strictly necessary
  - the generic match-command path must not regress Blokus or Chess

---

## Extension: Fix Exploding Kittens Room `gameType` Registration

- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Fix the Exploding Kittens server driver so newly created EK rooms persist `game_type = exploding_kittens` instead of falling back to Blokus.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/server.js`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0010_exploding_kittens_v1.md`
- **Why**: Browser smoke testing showed that creating an EK room lands on `/rooms/:roomCode` with Blokus staging and `blokus · PREPARE` in the app bar. The platform room-create path writes `rooms.game_type = driver.gameType`, but the EK driver did not expose `gameType`, so the room fell back to Blokus defaults.

### As-Is Diagram (ASCII)
```text
Create EK room
  -> room:create(gameType = exploding_kittens)
  -> createRoomForSession()
  -> insert rooms.game_type = driver.gameType
  -> EK driver has no gameType field
  -> room row falls back/defaults to blokus
  -> /rooms/:roomCode renders Blokus staging
```

### To-Be Diagram (ASCII)
```text
Create EK room
  -> room:create(gameType = exploding_kittens)
  -> createRoomForSession()
  -> insert rooms.game_type = exploding_kittens
  -> room snapshot keeps EK type
  -> /rooms/:roomCode renders EK staging/live correctly
```

- **Deliverables**:
  - add `gameType: EXPLODING_KITTENS_GAME_TYPE` to the EK server driver
  - append this extension to `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0010_exploding_kittens_v1.md`
- **Done Criteria**:
  - creating an EK room persists `room.gameType = exploding_kittens`
  - `/api/rooms/:roomCode` returns EK config, not Blokus fallback config
  - `/rooms/:roomCode` uses EK staging instead of Blokus staging
  - `node --check /Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/server.js` passes
  - `npm run build` passes
- **Out-of-Scope**:
  - broader EK gameplay fixes
  - staging UX redesign
  - platform room-create redesign
- **Proposed-By**: Codex GPT-5
- **plan**: exploding-kittens-v1-platform-game
- **Cautions / Risks**:
  - this is a narrow regression fix; no platform shell changes should be mixed into it
  - existing wrongly-created EK rooms in the local DB will remain wrong unless recreated or repaired separately

---

## Extension: Align Exploding Kittens `createMatch()` with the Platform Driver Contract

- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Fix the Exploding Kittens server driver so `createMatch()` returns the same contract shape the platform match orchestrator expects.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/views/RoomView.vue`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0010_exploding_kittens_v1.md`
- **Why**: EK room staging works, but starting the match fails because the EK driver returns a flat object instead of the platform's required `match / matchPlayers / events` structure.

### As-Is Diagram (ASCII)
```text
room:start
  -> platform startMatch()
  -> driver.createMatch()
  -> EK returns flat fields:
     matchId, boardJson, status, ...
  -> platform reads created.match.id
  -> created.match is undefined
  -> start fails
```

### To-Be Diagram (ASCII)
```text
room:start
  -> platform startMatch()
  -> driver.createMatch()
  -> EK returns:
     match: {...}
     matchPlayers: [...]
     events: [...]
  -> platform persists match normally
  -> route can move into /matches/:matchId
```

- **Deliverables**:
  - change EK `createMatch()` to return the platform contract shape
  - keep current EK initial state/deck logic unchanged
  - add a small null-safe guard in room start navigation if needed so the UI does not explode on bad ack payloads
  - append this extension to `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0010_exploding_kittens_v1.md`
- **Done Criteria**:
  - host can start an EK room without hitting `undefined.id`
  - `/matches/:matchId` route becomes reachable from EK staging
  - `node --check /Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/server.js` passes
  - `npm run build` passes
- **Out-of-Scope**:
  - broader EK gameplay bug fixes after match start
  - hidden-info validation across multiple tabs
  - reaction-window redesign
- **Proposed-By**: Codex GPT-5
- **plan**: exploding-kittens-v1-platform-game
- **Cautions / Risks**:
  - keep the fix narrow; this is a driver contract bug, not a full gameplay pass
  - client null-safe guard should not hide real protocol errors, only avoid a brittle crash

---

## Extension: Fix EK First-Commit Timestamp Binding

- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Fix the Exploding Kittens command finalization path so `firstCommittedAt` is stored as a timestamp string instead of a function reference.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/server.js`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0010_exploding_kittens_v1.md`
- **Why**: EK matches start correctly now, but the first live command fails because `firstCommittedAt` is being returned as a function reference, which SQLite cannot bind.

### As-Is Diagram (ASCII)
```text
EK live match
  -> player sends draw_card
  -> EK handleCommand().finalize()
  -> firstCommittedAt = nowIso   (function ref)
  -> applyDriverMutation()
  -> sqlite update matches(... first_committed_at = ? ...)
  -> cannot bind function to SQL parameter
  -> command fails
```

### To-Be Diagram (ASCII)
```text
EK live match
  -> player sends draw_card
  -> EK handleCommand().finalize()
  -> firstCommittedAt = nowIso() (timestamp string)
  -> applyDriverMutation()
  -> sqlite update succeeds
  -> live match progresses normally
```

- **Deliverables**:
  - change EK `finalize()` to use `nowIso()` instead of `nowIso`
  - append this regression fix to `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0010_exploding_kittens_v1.md`
- **Done Criteria**:
  - `draw_card` no longer fails with `Provided value cannot be bound to SQLite parameter 6`
  - `node --check /Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/server.js` passes
  - `npm run build` passes
- **Out-of-Scope**:
  - broader EK gameplay validation beyond this timestamp bug
  - hidden-info/reaction bugs after the first command
- **Proposed-By**: Codex GPT-5
- **plan**: exploding-kittens-v1-platform-game
- **Cautions / Risks**:
  - keep the fix narrow; this is a timestamp binding regression, not a larger command redesign

---

## Extension: Fix Remaining EK Timestamp Function Bindings

- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Replace all remaining `finishedAt: nowIso` function references in the EK driver with real timestamp strings via `nowIso()`.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/server.js`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0010_exploding_kittens_v1.md`
- **Why**: After fixing `firstCommittedAt`, deeper EK gameplay testing still fails in finish/elimination paths because multiple branches still return `finishedAt` as a function reference instead of a string timestamp.

### As-Is Diagram (ASCII)
```text
EK gameplay branch
  -> elimination / finish
  -> returns finishedAt = nowIso   (function ref)
  -> platform persists finished_at
  -> sqlite bind error on parameter 5
  -> gameplay fails in deeper variant paths
```

### To-Be Diagram (ASCII)
```text
EK gameplay branch
  -> elimination / finish
  -> returns finishedAt = nowIso()
  -> sqlite persists real timestamp string
  -> finish/elimination path works
```

- **Deliverables**:
  - replace every remaining `finishedAt: nowIso` with `finishedAt: nowIso()`
  - append this extension to `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0010_exploding_kittens_v1.md`
- **Done Criteria**:
  - no EK path binds a function object into `finished_at`
  - `node --check /Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/server.js` passes
  - `npm run build` passes
- **Out-of-Scope**:
  - broader EK gameplay redesign
  - UI changes
  - non-timestamp bugs
- **Proposed-By**: Codex GPT-5
- **plan**: exploding-kittens-v1-platform-game
- **Cautions / Risks**:
  - keep fix narrow and mechanical
  - need to catch all remaining `nowIso` function-reference returns in EK server logic
