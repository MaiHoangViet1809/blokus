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
