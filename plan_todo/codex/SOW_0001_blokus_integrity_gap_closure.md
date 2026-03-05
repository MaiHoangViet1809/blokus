# SOW_0001 Blokus Integrity Gap Closure

- Status: APPROVED
- Approved-By: Viet
- Approved-On: 2026-03-06

- **Task**: Fix multiplayer game-integrity gaps (turn handling, rejoin authentication, restart safety, room membership consistency, and client rack desync).
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/public/client.js`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0001_blokus_integrity_gap_closure.md`
- **Why**: Prevent match deadlocks, seat hijacking, accidental match resets, ghost players, and UI/server state drift.
- **As-Is Diagram (ASCII)**:
```text
Player leaves mid-game -> players[] shrinks -> turn index unchanged -> invalid turn slot -> game can stall
Rejoin uses same name only -> another client can reclaim seat
Any player can call start_game anytime -> active board resets
Socket can join multiple rooms -> ghost seats
Client adds selected piece back on any error -> local rack desync
```
- **To-Be Diagram (ASCII)**:
```text
Player leaves mid-game -> turn index re-normalized -> valid current player
Rejoin requires per-player token -> only rightful client can reclaim seat
start_game blocked when already started (or restricted policy) -> no accidental reset
Joining a new room removes player from prior room roster -> no ghost seats
Client only rolls back piece on rejected place_move flow -> rack remains accurate
```
- **Deliverables**:
  - `server.js`: turn repair on leave, secure rejoin token flow, start-game guard, single-room membership enforcement.
  - `public/client.js`: persist/reuse rejoin token, narrow error-path rack rollback.
  - This SoW file as traceability artifact.
- **Done Criteria**:
  - `node --check server.js` passes.
  - `node --check public/client.js` passes.
  - Manual smoke checks pass for:
    - no deadlock after mid-game leave,
    - no same-name seat hijack,
    - no unsafe active-game reset,
    - no ghost presence across rooms,
    - no rack desync after non-move errors.
- **Out-of-Scope**:
  - Full scoring and winner computation.
  - Engine redesign or protocol rewrite.
  - Non-functional UI redesign.
- **Proposed-By**: Codex GPT-5
- **plan**: blokus-integrity-gap-closure-v1
- **Cautions / Risks**:
  - Token migration for players already connected.
  - Preserve spectator behavior and client compatibility.
  - Avoid payload shape breaks for existing room-state handlers.
