# SOW_0006 Platform Room/Match State Machine Refactor

- Status: APPROVED
- Approved-By: Viet
- Approved-On: 2026-03-06

## Summary
- **Task**: Refactor room and match lifecycle management into a reusable platform state machine that supports rollback from `STARTING`, suspension/abandonment of empty live matches, and room reuse across future game types beyond Blokus.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/stores/app.js`
  - `/Users/maihoangviet/Projects/blokus/src/views/RoomView.vue`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0006_platform_room_match_state_machine.md`
- **Why**: Current room/game management is too Blokus-specific and archives empty rooms too aggressively. The platform needs a generic lifecycle that distinguishes lobby preparation, game provisioning, live play suspension, abandonment, rematch, and archival so the same room system can host other games later.

## As-Is / To-Be
- **As-Is Diagram (ASCII)**:
```text
NO_ROOM
  -> create room
LOBBY
  -> start
STARTING
  -> immediately becomes IN_GAME
IN_GAME
  -> if players disappear, members are abandoned/removed
  -> room often archives once empty
FINISHED
  -> rematch -> LOBBY
ARCHIVED

Problems:
- STARTING is not recoverable
- empty active rooms do not suspend cleanly
- room lifecycle is tied too closely to Blokus match logic
- platform cannot cleanly host other game types
```

- **To-Be Diagram (ASCII)**:
```text
ROOM_ABSENT
  -> create room(game_type)
ROOM_PREPARE
  -> join / seat / ready / configure
  -> start
ROOM_STARTING
  -> provision game instance
  -> everyone gone before playable state -> ROOM_PREPARE
  -> success -> ROOM_IN_GAME
ROOM_IN_GAME
  -> active game commands routed to game driver
  -> everyone gone -> ROOM_SUSPENDED
ROOM_SUSPENDED
  -> reconnect within TTL -> ROOM_IN_GAME
  -> timeout -> ROOM_ABANDONED
ROOM_ABANDONED
  -> reusable room policy -> ROOM_PREPARE
  -> expire policy -> ROOM_ARCHIVED
ROOM_FINISHED
  -> replay / rematch -> ROOM_PREPARE
  -> empty + TTL -> ROOM_ARCHIVED
ROOM_ARCHIVED
```

## Deliverables
- Introduce explicit platform room phases:
  - `PREPARE`
  - `STARTING`
  - `IN_GAME`
  - `SUSPENDED`
  - `ABANDONED`
  - `FINISHED`
  - `ARCHIVED`
- Separate platform-owned lifecycle from game-owned rules:
  - platform owns room membership, readiness, host transfer, disconnect grace, room reuse, archival
  - game logic owns move validation, turn resolution, scoring, finish conditions
- Add empty-room phase behavior with hybrid policy:
  - `PREPARE` empty -> archive after TTL
  - `STARTING` empty before first committed turn -> rollback to `PREPARE`
  - `IN_GAME` all participants gone -> `SUSPENDED`
  - `SUSPENDED` timeout -> `ABANDONED`
  - `ABANDONED` -> `PREPARE` if room is reusable
  - `FINISHED` empty -> archive after replay/rematch TTL
- Add generic room/game metadata needed for future multi-game hosting:
  - room-level `game_type`
  - match-level lifecycle/status separate from room phase
  - first-committed-turn marker so `STARTING` rollback is safe
- Update room snapshots and client state so the UI reflects:
  - suspended match
  - abandoned match
  - reusable prepare state after abandonment/reset
- Keep Blokus as the first game implementation under the new lifecycle without changing its rules.

## Public Interfaces / Behavior Changes
- Room phase values returned by REST/socket snapshots change to the new platform phases.
- Realtime and bootstrap payloads must expose enough state for the client to show:
  - suspended room
  - abandonment timeout/rejoin possibility
  - rematch/reset availability
- `room:start` becomes a true provisioning transition, not just an immediate pass-through to active play.
- Disconnect handling changes from `offline then archive/remove` to `offline -> suspend or expire according to phase`.

## Done Criteria
- Empty `PREPARE` rooms archive only after TTL, not immediately.
- Empty `STARTING` rooms roll back to `PREPARE`.
- If all active participants disappear during live play, the room enters `SUSPENDED` instead of silently resetting or archiving.
- Reconnect within TTL restores the same suspended match.
- Suspension timeout moves the room to `ABANDONED`, after which the room can be reused from `PREPARE`.
- Finished rooms remain replayable/rematchable before eventual archival.
- Existing Blokus gameplay still works under the new lifecycle.
- `node --check server.js` passes.
- `npm run build` passes.

## Out-of-Scope
- Adding a second game implementation
- Full plugin/module loading system for game drivers
- Ranking/scoring redesign beyond what is needed for lifecycle correctness
- Auth/account system changes
- Large frontend redesign outside lifecycle/status presentation

## Proposed-By
- Codex GPT-5

## plan
- platform-room-match-state-machine-v1

## Cautions / Risks
- Current `STARTING` is effectively instantaneous, so introducing a real provisioning phase requires explicit transition rules.
- Existing replay/history must not break when abandoned matches are introduced.
- Room phase and match status must not be conflated again.
- Reconnect and TTL logic must stay instance-aware because multi-tab support is already in progress.
- UI needs clear copy for `SUSPENDED` and `ABANDONED` so users understand whether they can resume or must restart.

## Assumptions Locked In
- This is a new standalone SoW.
- Default room policy is hybrid by phase.
- Rooms are reusable by default after abandonment, unless explicitly archived by timeout policy.
- Blokus remains the only game implemented in this SoW, but the lifecycle must be shaped for future `game_type` expansion.
