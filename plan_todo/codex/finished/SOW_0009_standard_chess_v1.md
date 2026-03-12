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

## Extension: Chess.com-Inspired Chess UI Polish

- **Status**: APPROVED
- **Approved-By**: Viet
- **Task**: Rework the current chess live and replay presentation to adopt a chess.com-inspired visual language while preserving the platform's main three-column match layout.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/chess/LiveView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/games/chess/ReplayView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/games/chess/shared.js`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/finished/SOW_0009_standard_chess_v1.md`
- **Why**: Chess is playable, but the current live and replay views still feel like generic board-game screens. The goal is to move closer to a chess.com-like product feel with SVG pieces, a denser move rail, warmer board styling, and a more dominant center board.
- **As-Is Diagram (ASCII)**:
```text
current chess live view
+------------------------------------------------------------------+
| status panel        | board                    | captured pieces  |
| generic dark cards  | clean but still app-like | generic panel    |
| unicode pieces      | board not yet premium    | info is flat      |
+------------------------------------------------------------------+
```
- **To-Be Diagram (ASCII)**:
```text
polished chess live view
+------------------------------------------------------------------+
| compact side rail | dominant premium board | moves + captures    |
| svg pieces        | warmer palette/frame   | denser product rail |
+------------------------------------------------------------------+
```
- **Deliverables**:
  - replace unicode glyphs with an SVG piece set
  - add a live move list using simple SAN-style notation
  - merge captures + move list into the right rail
  - restyle live/replay boards with a warmer, denser chess presentation
  - keep replay visually aligned with the live chess system
- **Done Criteria**:
  - live chess uses SVG pieces
  - move list appears in the live right rail
  - replay uses the same SVG piece set and board language
  - board remains visually dominant
  - `npm run build` passes
- **Out-of-Scope**:
  - chess clocks
  - engine analysis
  - route changes
  - copying chess.com exactly
- **Proposed-By**: Codex GPT-5
- **plan**: chess-v1-standard-hvh
- **Cautions / Risks**:
  - svg piece treatment must stay lightweight and local to the repo
  - live move list is powered from replay frames in the current contract, so styling changes should not assume extra server payload shape

## Extension: Licensed Classic Staunton Pieces and Container-Fit Board

- **Status**: APPROVED
- **Approved-By**: Viet
- **Task**: Replace the current rough custom chess pieces with a licensed classic Staunton SVG set and make the chess board fit its real container so it stays square, centered, and unclipped in live and replay.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/chess/shared.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/chess/LiveView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/games/chess/ReplayView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/src/games/chess/assets/`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/finished/SOW_0009_standard_chess_v1.md`
- **Why**: The previous custom SVG set still looked rough, and the board fit remained too dependent on CSS-only layout assumptions. A licensed classic Staunton set matches the target visual direction better, and container-driven sizing removes clipping/asymmetry.
- **As-Is Diagram (ASCII)**:
```text
Live / Replay chess
  -> custom inline SVG pieces
  -> piece quality still rough
  -> board can feel off-center / clipped at edges
```
- **To-Be Diagram (ASCII)**:
```text
Live / Replay chess
  -> classic Staunton SVG pieces
  -> premium traditional chess look
  -> board size = min(real container width, real container height)
  -> square, centered, no clipping
```
- **Deliverables**:
  - add a local licensed classic Staunton SVG set under `src/games/chess/assets/`
  - replace inline piece templates with asset-based mapping
  - use the same piece set in live and replay
  - fit the board from the real container dimensions instead of loose viewport/CSS assumptions
  - keep current move list, captures, promotion, and orientation behavior intact
- **Done Criteria**:
  - chess pieces use the local Staunton set
  - board does not clip on any side in live or replay
  - board remains square and centered
  - `npm run build` passes
- **Out-of-Scope**:
  - copying chess.com assets
  - chess rule changes
  - route changes
  - clocks/analysis
- **Proposed-By**: Codex GPT-5
- **plan**: chess-v1-standard-hvh
- **Cautions / Risks**:
  - asset license must stay explicit and safe
  - board fit must be container-driven, not another viewport constant

## Extension: Chess Side Cards with Player-Centric Records

- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-12
- **Task**: Refine the chess live view so the left rail becomes a true player-comparison rail with viewer-centric ordering and chess-only W-D-L records.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/platform/server/index.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/chess/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/chess/LiveView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/finished/SOW_0009_standard_chess_v1.md`
- **Why**: The left rail still mixes small side cards with a separate move/status block. The chess view should instead show two player-centric cards with persistent overall and head-to-head chess records.
- **As-Is Diagram (ASCII)**:
```text
left rail
  -> two small side cards
  -> separate status block for last move / whose turn
  -> no chess-only player record
```
- **To-Be Diagram (ASCII)**:
```text
left rail
  -> exactly two player cards
  -> top card = viewer side, or side to move for spectators
  -> top card larger and more detailed
  -> each card shows chess-only overall and head-to-head W-D-L + win rate
```
- **Deliverables**:
  - extend chess live player projection with overall and head-to-head chess records
  - remove the separate left-side status block
  - render two player-centric cards only, with viewer/turn-based ordering
  - make the top card taller and more detailed than the lower card
- **Done Criteria**:
  - viewer sees their own side card on top; spectators see side-to-move on top
  - records are chess-only and draw-aware
  - left rail no longer duplicates move context already shown on the right
  - `node --check server.js` passes
  - `npm run build` passes
- **Out-of-Scope**:
  - new stats routes
  - cross-game records
  - replay redesign
- **Proposed-By**: Codex GPT-5
- **plan**: chess-v1-standard-hvh
- **Cautions / Risks**:
  - stats must be derived from persisted finished chess matches only
  - empty histories must render cleanly as `0-0-0`

## Extension: Prevent Overflow in Chess Left-Rail Player Cards

- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-12
- **Task**: Fix the new chess left-rail player cards so their content always fits inside the card container without overflowing.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/src/games/chess/LiveView.vue`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/finished/SOW_0009_standard_chess_v1.md`
- **Why**: The player-centric record cards added more content, but the left rail still used rigid row-height assumptions and a two-column record grid that could overflow narrower card widths.
- **As-Is Diagram (ASCII)**:
```text
left rail
  -> two player cards
  -> top card has more content
  -> rail still uses fixed row height assumptions
  -> content can overflow card bounds
```
- **To-Be Diagram (ASCII)**:
```text
left rail
  -> two player cards
  -> top card still larger
  -> card height adapts safely to content
  -> record blocks reflow cleanly
  -> content stays inside container
```
- **Deliverables**:
  - remove rigid fixed-height assumptions from the left-rail card grid
  - keep the top card visually larger than the bottom card
  - let record blocks reflow safely within the card width
- **Done Criteria**:
  - no left-rail card content overflows its container
  - top card remains more prominent than the bottom card
  - `npm run build` passes
- **Out-of-Scope**:
  - changing chess stats content
  - changing board or right-rail layout
  - new API or server behavior
- **Proposed-By**: Codex GPT-5
- **plan**: chess-v1-standard-hvh
- **Cautions / Risks**:
  - the fix should preserve the “top card bigger” hierarchy without brittle fixed row sizing
