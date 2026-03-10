# SOW_0009 Standard Chess v1

- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-10
- **Task**: Add a first playable `chess` game type to the platform using the new game-folder structure, with standard 8x8 human-vs-human chess and platform-integrated staging, live match, replay, and a generic `Rooms` heading in the lobby.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/chess/`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/registry.js`
  - `/Users/maihoangviet/Projects/blokus/src/platform/server/registry.js`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/views/HomeView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0009_standard_chess_v1.md`
- **Why**: The platform structure is now clean enough to prove the multi-game architecture with a second game. Chess is the best validation target because it differs materially from Blokus in board shape, setup, move rules, replay semantics, and scoring.

## As-Is Diagram (ASCII)
```text
Platform
  -> gameType registry exists
  -> generic create/staging/live/replay routes exist

Games implemented
  -> blokus only

Home lobby
  -> heading says "<selected game> Rooms"
  -> reads as Blokus-specific when only filtering
```

## To-Be Diagram (ASCII)
```text
Platform
  -> blokus
  -> chess

Chess
  -> /games/chess
  -> /rooms/:roomCode staging
  -> /matches/:matchId live chess
  -> /matches/:matchId/replay chess replay

Home lobby
  -> generic heading: "Rooms"
  -> selected game acts as a filter, not as a title hardcode
```

- **Deliverables**:
  - Add a new game folder:
```text
src/games/chess/
  index.js
  client.js
  server.js
  create.js
  staging.js
  LiveView.vue
  ReplayView.vue
  shared.js
```
  - Register `chess` in:
    - `/Users/maihoangviet/Projects/blokus/src/platform/client/registry.js`
    - `/Users/maihoangviet/Projects/blokus/src/platform/server/registry.js`
  - Add standard chess v1 server logic:
    - 8x8 board
    - White/Black sides
    - legal move validation per piece
    - turn order
    - captures
    - check detection
    - checkmate
    - stalemate
    - castling
    - en passant
    - promotion
  - Add chess create/staging flow:
    - game type `chess`
    - one standard mode only in v1
    - exactly 2 seats
    - side assignment in staging: `White` / `Black`
  - Add chess live UI:
    - 8x8 board
    - piece rendering
    - turn/status
    - captured-piece summary
  - Add chess replay UI:
    - step through move history on 8x8 board
  - Change the lobby room-table heading in `/Users/maihoangviet/Projects/blokus/src/platform/client/views/HomeView.vue` from a game-named heading to a generic `Rooms` heading.
- **Done Criteria**:
  - `/games/chess` can create a chess room
  - `/rooms/:roomCode` for chess shows exactly 2 seats
  - chess live match works end-to-end for normal moves
  - castling, en passant, and promotion are supported
  - checkmate and stalemate end the match correctly
  - replay works for chess matches
  - `/` room table distinguishes `chess` from `blokus`
  - lobby heading reads generically as `Rooms`
  - `node --check server.js` passes
  - `npm run build` passes
- **Out-of-Scope**:
  - AI opponent
  - chess clocks / timers
  - PGN/FEN import/export
  - threefold repetition claim
  - fifty-move rule claim
  - premoves
  - engine analysis
  - variants like Chess960, bughouse, etc.
- **Proposed-By**: Codex GPT-5
- **plan**: chess-v1-standard-hvh
- **Cautions / Risks**:
  - Chess legality is less forgiving than Blokus; move validation must be exact.
  - Promotion UX must be decision-complete; default assumption below avoids ambiguity.
  - The current staging shell remains table-driven, so chess staging must conform to that contract in this SoW.
- **Assumptions / Defaults**:
  - V1 is standard human-vs-human chess only.
  - Promotion defaults to a required explicit choice in the client UI, not auto-queen.
  - Automatic draw detection in v1 includes:
    - stalemate
    - insufficient material
  - Threefold repetition and fifty-move draw claims are out of scope for this first version.
  - Side choice happens in staging via `White` / `Black`.
