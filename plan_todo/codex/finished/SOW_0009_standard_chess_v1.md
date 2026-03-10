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

## Extension: Fix missing `SIDE_OPTIONS` import in chess room setup

- **Status**: APPROVED
- **Approved-By**: Viet
- **Task**: Fix the missing `SIDE_OPTIONS` import in the chess server projection so chess room creation no longer crashes at runtime.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/chess/server.js`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/finished/SOW_0009_standard_chess_v1.md`
- **Why**: Chess room creation currently crashes because `projectRoomSetup()` references `SIDE_OPTIONS` without importing it.
- **As-Is Diagram (ASCII)**:
```text
create chess room
  -> buildGameView()
  -> chess.projectRoomSetup()
  -> uses SIDE_OPTIONS
  -> SIDE_OPTIONS not imported
  -> ReferenceError
  -> room:create fails
```
- **To-Be Diagram (ASCII)**:
```text
create chess room
  -> buildGameView()
  -> chess.projectRoomSetup()
  -> SIDE_OPTIONS imported correctly
  -> setup projection succeeds
  -> room:create returns normally
```
- **Deliverables**:
  - add the missing import in `/Users/maihoangviet/Projects/blokus/src/games/chess/server.js`
  - append this regression-fix extension to `/Users/maihoangviet/Projects/blokus/plan_todo/codex/finished/SOW_0009_standard_chess_v1.md`
- **Done Criteria**:
  - chess room creation no longer throws `ReferenceError: SIDE_OPTIONS is not defined`
  - `node --check src/games/chess/server.js` passes
  - `npm run build` passes
- **Out-of-Scope**:
  - broader chess capacity cleanup
  - staging behavior changes
- **Proposed-By**: Codex GPT-5
- **plan**: chess-v1-standard-hvh
- **Cautions / Risks**:
  - keep the fix narrow; this is an import regression, not a logic redesign

## Extension: Polish Chess Board Presentation and Orientation

- **Status**: APPROVED
- **Approved-By**: Viet
- **Task**: Improve the live chess presentation so pieces are larger and visually centered, board coordinates are clearer and outside the board edge, move feedback has animation, and board orientation flips correctly for the black player.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/chess/LiveView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/games/chess/ReplayView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/finished/SOW_0009_standard_chess_v1.md`
- **Why**: Chess is playable, but its presentation is still below the expected quality bar. Pieces are visually too small, glyph centering is weak, coordinates are not clearly outside the board frame, there is no move animation feedback, and both players currently view the board from the same orientation.
- **As-Is Diagram (ASCII)**:
```text
Live chess board
  -> same orientation for white and black
  -> labels inside squares
  -> pieces use small unicode glyphs
  -> glyphs look slightly off-center
  -> move feedback is static only
```
- **To-Be Diagram (ASCII)**:
```text
Live chess board
  -> white sees white at bottom
  -> black sees black at bottom
  -> A-H and 1-8 shown clearly along board edge/outside frame
  -> pieces larger and visually centered
  -> move feedback includes lightweight animation
```
- **Deliverables**:
  - Flip live board orientation based on the viewing player side:
    - white perspective -> white at bottom
    - black perspective -> black at bottom
  - Keep replay orientation stable and readable with a consistent default.
  - Move coordinate labels out of the square interior and present them clearly along the board edge.
  - Increase chess piece visual size and improve visual centering inside each square.
  - Add lightweight move animation/feedback for chess piece movement.
  - Preserve current move legality, promotion, replay, and governance behavior.
- **Done Criteria**:
  - white player sees white pieces at the bottom
  - black player sees black pieces at the bottom
  - board coordinates are clearer and no longer embedded inside squares
  - chess pieces appear larger and visually centered
  - moves show visible animation/feedback
  - `npm run build` passes
- **Out-of-Scope**:
  - replacing unicode glyphs with SVG assets
  - chess clocks
  - engine analysis
  - changing move rules
- **Proposed-By**: Codex GPT-5
- **plan**: chess-v1-standard-hvh
- **Cautions / Risks**:
  - orientation flip must preserve click/move coordinate correctness
  - replay orientation should stay predictable even without a player-specific perspective
  - glyph-based chess pieces have visual-centering limits compared with SVG assets, so centering will be best-effort within the current glyph approach
