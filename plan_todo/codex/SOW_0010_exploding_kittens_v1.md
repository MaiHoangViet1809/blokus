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

## Extension: Randomize the First EK Player and Fix Viewer-Local Prompt Dismissal

- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Bring the Base EK state machine closer to official behavior by randomizing the starting player and making `dismiss_prompt` work for viewer-local `sharedFuturePreview` prompts.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/server.js`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0010_exploding_kittens_v1.md`
- **Why**: EK still diverged from the intended rules and prompt model in two important ways: seat 0 always started first, and `Share The Future` produced a viewer-local prompt that could not be dismissed without hitting an unsupported-command error.

### As-Is Diagram (ASCII)
```text
Match setup
  -> turnIndex = 0
  -> seat 0 always goes first

Shared Future preview
  -> target gets a local informational prompt
  -> UI sends dismiss_prompt
  -> server only handles state.prompt-owned dismiss
  -> unsupported command
```

### To-Be Diagram (ASCII)
```text
Match setup
  -> random starting seat
  -> first player varies per match

Shared Future preview
  -> target gets a local informational prompt
  -> dismiss_prompt clears sharedFuturePreview cleanly
  -> no unsupported-command error
```

- **Deliverables**:
  - randomize the starting player in EK `createMatch()`
  - persist the randomized `turnIndex` into initial match state
  - let `dismiss_prompt` clear viewer-local `sharedFuturePreview`
  - keep server-owned prompt dismissal unchanged
- **Done Criteria**:
  - EK no longer always starts with seat 0
  - `Share The Future` target can dismiss the informational prompt without error
  - `node --check /Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/server.js` passes
  - `npm run build` passes
- **Out-of-Scope**:
  - broader reaction-window redesign
  - draw-pile exhaustion policy
  - UI polish
- **Proposed-By**: Codex GPT-5
- **plan**: exploding-kittens-v1-platform-game
- **Cautions / Risks**:
  - starting-player randomization must not break deterministic persisted state after match creation
  - viewer-local dismiss handling must not accidentally clear unrelated server-owned prompts

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

---

## Extension: Open Nope Stack and Confirm-to-Resolve Reaction Model for Exploding Kittens

- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Replace the current seat-ordered EK reaction queue with an open reaction stack where any eligible player may play `Nope` at any time before the reaction window is explicitly resolved by all active players.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/shared.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/LiveView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/ReplayView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/store.js`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0010_exploding_kittens_v1.md`
- **Why**: The current EK reaction model serializes responders by seat order, which is deterministic but not faithful to the feel of the physical game. The correct digital-faithful model is an open reaction stack: any player with `Nope` may respond, the server resolves by command arrival order, and the table explicitly confirms before the stack resolves.

### As-Is Diagram (ASCII)
```text
[EFFECT_PLAYED]
  -> queueReaction()
  -> responders ordered by seat sequence
  -> currentResponder only
  -> each player reacts one at a time

Result:
- deterministic
- easier to implement
- not faithful to EK reaction feel
```

### To-Be Diagram (ASCII)
```text
[EFFECT_PLAYED]
  -> push effect onto reaction stack
  -> open REACTION_WINDOW for all active players

[REACTION_WINDOW]
  -> any eligible player may:
     - play Nope
     - confirm reaction window
  -> each Nope appends to stack in server receive order
  -> each Nope flips effect parity
  -> confirmations reset when a new Nope is played
  -> when all active players confirm:
       resolve stack by final Nope parity
       continue turn flow
```

- **Deliverables**:
  - remove seat-order responder queue logic from EK
  - add open reaction stack logic
  - add `confirm_reaction_window`
  - expose a public reaction stack in EK live `gameView`
  - render that stack in the EK live view
- **Done Criteria**:
  - EK no longer uses seat-order responder queue for reactions
  - any eligible player with `Nope` can respond during an open reaction window
  - multiple `Nope` plays resolve in the exact order received by the server
  - reaction window resolves only after all active players confirm
  - a newly played `Nope` resets confirmations
  - `node --check server.js` passes
  - `node --check /Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/server.js` passes
  - `npm run build` passes
- **Out-of-Scope**:
  - changing non-reaction EK rules unless required by this refactor
  - timers/timeouts for auto-resolve
  - chat/social features
  - animation polish beyond stack visibility
- **Proposed-By**: Codex GPT-5
- **plan**: exploding-kittens-v1-platform-game
- **Cautions / Risks**:
  - this is a reaction-subsystem rewrite, not a small bugfix
  - nopeatable action paths must be retested after the refactor

---

## Extension: Fix `Share The Future` Projection Priority

- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Fix EK `Share The Future` projection so the target sees the local shared preview prompt instead of being blocked by the actor's info prompt.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/server.js`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0010_exploding_kittens_v1.md`
- **Why**: `Share The Future` resolves, but the target currently sees a generic waiting prompt because projection checks the actor-owned server prompt before the target's local `sharedFuturePreview`.

### As-Is Diagram (ASCII)
```text
A plays Share The Future
  -> actor gets info prompt
  -> target gets sharedFuturePreview
  -> projection checks state.prompt first
  -> target sees "Waiting on another player."
```

### To-Be Diagram (ASCII)
```text
A plays Share The Future
  -> actor sees own info prompt
  -> target sees local shared future preview
  -> target dismisses preview cleanly
```

- **Deliverables**:
  - adjust EK prompt projection priority so `sharedFuturePreview` wins for the target viewer
  - keep actor info prompt behavior intact
- **Done Criteria**:
  - target sees `Shared future: ...`
  - target can dismiss it without error
  - `node --check /Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/server.js` passes
  - `npm run build` passes
- **Out-of-Scope**:
  - other EK rule changes
  - broader prompt redesign
- **Proposed-By**: Codex GPT-5
- **plan**: exploding-kittens-v1-platform-game
- **Cautions / Risks**:
  - fix must stay narrow and must not leak private preview state to the wrong viewer

---

## Extension: Normalize EK Public Outcome Labels Across Live Timeline and Replay

- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Upgrade EK public event labeling so live timeline and replay describe the resolved public outcome of actions instead of generic `resolved` text.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/LiveView.vue` only if minor display formatting is needed
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/ReplayView.vue` only if minor display formatting is needed
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0010_exploding_kittens_v1.md`
- **Why**: EK gameplay is resolving correctly in the tested paths, but replay and live timeline still flatten many actions into generic labels that hide the actual public outcome.

### As-Is Diagram (ASCII)
```text
Action resolves correctly
  -> event payload already contains public outcome
  -> buildReplayLabel() ignores that detail
  -> timeline/replay says only:
     "resolved Favor"
     "drew a card"
     "resolved Potluck"
```

### To-Be Diagram (ASCII)
```text
Action resolves correctly
  -> event payload contains public outcome
  -> buildReplayLabel() uses that outcome
  -> timeline/replay says what actually happened publicly
```

- **Deliverables**:
  - improve `buildReplayLabel()` for at least:
    - `draw_card` with `transferredTo`
    - `favor_resolved`
    - `future_altered`
    - `potluck_resolved`
    - `barking_resolved`
    - `pair_stole_card`
  - keep labels public-state-safe
  - keep replay/timeline structures unchanged
- **Done Criteria**:
  - live timeline and replay no longer lose obvious public outcome semantics
  - `npm run build` passes
  - no hidden/private information is leaked by improved labels
- **Out-of-Scope**:
  - deeper EK rule changes
  - hidden-info projection redesign
  - replay UI redesign
- **Proposed-By**: Codex GPT-5
- **plan**: exploding-kittens-v1-platform-game
- **Cautions / Risks**:
  - labels must stay public-only
  - better semantics must not reveal private card identities where the public should not know them

---

## Extension: Shared Card Table and Exploding Kittens Table Layout

- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-14
- **Task**: Rebuild the Exploding Kittens live view around a reusable card-table component system, including visible draw/discard piles and card-draw interactions, without copying unlicensed official card art.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/`
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/LiveView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/ReplayView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/shared.js`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0010_exploding_kittens_v1.md`
- **Why**:
  - EK is a card game, and the current UI still reads like a generic action panel instead of a card table.
  - A reusable card-table foundation will help future card games.
  - Official EK art should not be copied into the repo without a clear license.

### As-Is Diagram (ASCII)
```text
EK live view
+--------------------------------------------------------------+
| players rail | piles/status text | hand/actions             |
| generic panels                                         |
| draw pile is mostly numeric state                      |
| discard is chip list                                   |
| no real card-table feeling                             |
+--------------------------------------------------------------+
```

### To-Be Diagram (ASCII)
```text
EK live view
+--------------------------------------------------------------------------------+
| opponents / player counts                                                      |
+--------------------------------------------------------------------------------+
|                         shared card table surface                              |
|                                                                                |
|        [draw pile stack]   [effect / public area]   [discard pile stack]       |
|                                                                                |
|                 action prompts and public stack sit on the table               |
+--------------------------------------------------------------------------------+
| my hand fan / card row                                                         |
+--------------------------------------------------------------------------------+
```

- **Deliverables**:
  - add reusable platform card-table building blocks:
    - shared table surface component
    - shared pile/stack component
    - shared playing-card component
  - refactor EK live view to use those building blocks
  - visualize:
    - draw pile as a real stack on the table
    - discard pile as a real visible pile
    - hand as cards, not only chips/groups
  - clicking the draw pile on your turn should trigger draw where legal
  - effect-driven draws should still resolve through the same pile area
  - keep current EK rules and hidden-info behavior intact
  - use asset-ready card faces:
    - no unlicensed official EK images copied into the repo in this SoW
    - use safe local visuals/placeholders for now
- **Done Criteria**:
  - EK live view reads like a card-table layout, not a generic panel layout
  - draw pile is a visible stack on the table
  - discard pile is a visible stack on the table
  - player can draw by clicking the pile when legal
  - shared card-table components are reusable by future card games
  - `npm run build` passes
- **Out-of-Scope**:
  - importing official EK card artwork from the internet
  - licensing work for commercial/fan assets
  - redesigning EK rules
  - adding a second card game in this SoW
- **Proposed-By**: Codex GPT-5
- **plan**: exploding-kittens-v1-platform-game
- **Cautions / Risks**:
  - official EK art is likely copyrighted; this SoW should not assume it is free to reuse
  - the shared card-table components must stay generic enough for future card games, but not become an over-abstracted framework
  - hidden-information rules must remain server-authoritative

---

## Extension: Exploding Kittens Art Metadata and Diffusion Prompt Pack

- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-14
- **Task**: Make the EK deck art-ready before any image generation by adding a canonical art metadata manifest, upgrading the shared card renderer to consume it, and shipping a prompt pack for local diffusion generation.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/card_art.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/shared.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/LiveView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/ReplayView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/PlayingCard.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/CardPile.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/finding/ek_card_art_prompt_pack.md`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0010_exploding_kittens_v1.md`
- **Why**:
  - The reusable EK card table now exists, but the deck still lacks a stable art metadata layer and prompt pack for local diffusion generation.
  - We need a canonical `cardId -> art` mapping before generating or dropping any actual illustrations into the repo.

### As-Is Diagram (ASCII)
```text
EK card system
  -> runtime card labels/kinds exist
  -> placeholder visual shell exists
  -> no canonical art manifest
  -> no stable prompt pack per cardId
  -> no image-ready art slot in the card renderer
```

### To-Be Diagram (ASCII)
```text
EK card system
  -> gameplay metadata in shared.js
  -> art metadata in card_art.js
  -> PlayingCard consumes optional art manifest entry
  -> fallback placeholder remains if no image exists
  -> prompt pack doc maps every cardId to a diffusion-ready illustration prompt
```

- **Deliverables**:
  - add `card_art.js` with canonical metadata for all 29 EK card types
  - include per-card:
    - `cardId`
    - `artCode`
    - `family`
    - `frameVariant`
    - `titleLine`
    - `tagLine`
    - `illustrationMode`
    - `promptTitle`
    - `prompt`
    - `negativePrompt`
    - `composition`
    - `rulesetPresence`
    - `supplySummary`
    - optional `characterGroup`
  - upgrade `PlayingCard` to accept an `art` prop and render a fixed illustration window with placeholder fallback
  - pass art metadata through EK live/replay/card-pile rendering
  - add a human-readable prompt pack doc for local diffusion usage
- **Done Criteria**:
  - all 29 current card ids have canonical art metadata
  - live and replay still render correctly with zero generated assets present
  - draw/discard/hand all go through the same art metadata path
  - prompt pack covers every EK card type and stays free of branding/text instructions
  - `npm run build` passes
- **Out-of-Scope**:
  - generating diffusion images
  - importing any official EK artwork
  - server contract or rule changes
- **Proposed-By**: Codex GPT-5
- **plan**: exploding-kittens-v1-platform-game
- **Cautions / Risks**:
  - keep the manifest canonical so the prompt doc does not drift from runtime metadata
  - do not leak branding or typography instructions into prompts
  - the renderer must stay usable before any image files exist

---

## Extension: Python EK Batch Art Generator with In-File Config

- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-15
- **Task**: Add a pure Python batch generator inside this repo that reads canonical EK art metadata, builds prompts from structured components, patches the exported ComfyUI API workflow template from `/Users/maihoangviet/Projects/blokus/StandardFlow.json`, calls the local ComfyUI API, and saves exact output files by `cardId`.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/scripts/batch_generate_ek_cards.py`
  - `/Users/maihoangviet/Projects/blokus/src/games/exploding_kittens/card_art.js`
  - `/Users/maihoangviet/Projects/blokus/StandardFlow.json`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0010_exploding_kittens_v1.md`
- **Why**:
  - EK already has canonical card metadata and a local ComfyUI API template, but batch image generation is still manual and not reproducible.
  - We need a repo-local script that can regenerate consistent illustration assets by `cardId` after style tuning is locked.

### As-Is Diagram (ASCII)
```text
card_art.js
  -> prompts exist
  -> ComfyUI API workflow exists
  -> generation is manual in UI
  -> filenames / seeds / subsets are not reproducible
```

### To-Be Diagram (ASCII)
```text
CONFIG dict in Python
  -> load EK metadata from card_art.js
  -> build prompt per cardId from prompt parts
  -> load StandardFlow.json
  -> patch workflow in memory
  -> POST to local ComfyUI
  -> wait for completion
  -> save output/ek_cards/<cardId>.png
  -> write manifest.json
```

- **Deliverables**:
  - add `/Users/maihoangviet/Projects/blokus/scripts/batch_generate_ek_cards.py`
  - keep all runtime control in top-level Python config dicts/constants, not CLI parsing
  - export canonical metadata from `card_art.js` into Python through a local Node subprocess
  - expose structured `promptSubject` and `promptMood` in `card_art.js` so the Python generator can rebuild prompts from components
  - patch `StandardFlow.json` in memory to inject a save-capable terminal node
  - write:
    - `/Users/maihoangviet/Projects/blokus/output/ek_cards/<cardId>.png`
    - `/Users/maihoangviet/Projects/blokus/output/ek_cards/manifest.json`
- **Done Criteria**:
  - the generator script can target one or many cards through in-file config
  - output filenames are exact `cardId.png`
  - the script reads canonical metadata from `card_art.js` rather than duplicating the deck in Python
  - `StandardFlow.json` is used as a read-only template and patched in memory
  - no runtime generation test is performed by the agent; only code writing and static syntax validation are allowed
- **Out-of-Scope**:
  - manual or automated runtime generation testing
  - prompt-quality tuning for every card
  - importing generated assets into the live game UI
- **Proposed-By**: Codex GPT-5
- **plan**: exploding-kittens-v1-platform-game
- **Cautions / Risks**:
  - the current `StandardFlow.json` ends in `PreviewImage`, so the script must convert it to a save-capable workflow in memory
  - the Python generator depends on local Node being available to export JS metadata
  - ComfyUI output history shape can vary by workflow, so the script should only assume standard saved image payloads
