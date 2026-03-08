## SOW_0007 Multi-Board-Game Platform Refactor with MOBA-Style Reconnect

- **Status**: APPROVED
- **Approved-By**: Viet

### Summary
- **Task**: Refactor the current Blokus app into a real multi-board-game platform with a platform core, game-driver layer, and game-specific UI layer, while supporting MOBA-style disconnect/rejoin semantics with default `suspend then reclaim` behavior.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/stores/app.js`
  - `/Users/maihoangviet/Projects/blokus/src/router.js`
  - `/Users/maihoangviet/Projects/blokus/src/views/RoomView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/components/GameBoard.vue`
  - `/Users/maihoangviet/Projects/blokus/src/components/ReplayPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/lib/pieces.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The current app has durable room/session state, but platform lifecycle, Blokus rules, replay, and UI are still tightly coupled. The system needs a generic platform boundary so other board games can be added without rewriting room/session/reconnect logic again.

### As-Is Diagram (ASCII)

#### 1. Current Architecture
```text
Browser
  -> client instance
  -> profile
  -> room
  -> match

server.js
  -> browser/session logic
  -> room lifecycle
  -> room member rules
  -> Blokus setup rules
  -> Blokus move legality
  -> Blokus board state
  -> Blokus replay
  -> leaderboard

Result:
  platform logic and Blokus logic are coupled together
```

#### 2. Current Room / Match Lifecycle
```text
[NO_ROOM]
   |
   | create/join
   v
[PREPARE]
   | ready / setup
   | host start
   v
[STARTING]
   | create match
   v
[IN_GAME]
   | place move / auto-pass
   | disconnect handling
   v
[SUSPENDED]
   | reconnect
   +------------------> [IN_GAME]
   |
   | grace timeout
   v
[ABANDONED]
   | next join resets room
   v
[PREPARE]

[IN_GAME]
   | finish
   v
[FINISHED]
   | rematch
   v
[PREPARE]
```

#### 3. Current Disconnect Handling Problem
```text
disconnect
  -> member goes offline
  -> room may suspend
  -> match-specific consequences are partly hard-coded in platform code
  -> reclaim/abandon rules are not generalized by game type
```

### To-Be Diagram (ASCII)

#### 1. Target Platform Architecture
```text
+-----------------------+
| Platform Core         |
|-----------------------|
| browser containers    |
| client instances      |
| profiles              |
| sessions              |
| rooms                 |
| seats / members       |
| room phases           |
| reconnect leases      |
| suspend / abandon     |
| replay catalog        |
| transport             |
+-----------+-----------+
            |
            v
+-----------------------+
| Game Driver Registry  |
|-----------------------|
| blokus                |
| chess                 |
| checkers              |
| ...                   |
+-----------+-----------+
            |
            v
+-----------------------+
| Game-Specific UI      |
|-----------------------|
| staging/live/replay   |
| by game type          |
+-----------------------+
```

#### 2. Target Room State Machine
```text
[ROOM_ABSENT]
   |
   | create room(game_type, config)
   v
[ROOM_PREPARE]
   | join / seat / ready / setup
   | start allowed by platform + driver
   v
[ROOM_STARTING]
   | driver provisions match
   | everyone leaves before playable state
   +---------------------------> [ROOM_PREPARE]
   |
   | playable
   v
[ROOM_ACTIVE]
   | game commands routed to driver
   | disconnect of any required player
   v
[ROOM_SUSPEND_PENDING]
   | platform reserves seats and opens reclaim window
   v
[ROOM_SUSPENDED]
   | player rejoins within ttl
   +---------------------------> [ROOM_ACTIVE]
   |
   | ttl expires
   v
[ROOM_ABANDONED]
   | reusable room policy
   +---------------------------> [ROOM_PREPARE]
   |
   | archive policy
   +---------------------------> [ROOM_ARCHIVED]

[ROOM_ACTIVE]
   | driver returns terminal result
   v
[ROOM_FINISHED]
   | rematch
   +---------------------------> [ROOM_PREPARE]
   |
   | history ttl
   +---------------------------> [ROOM_ARCHIVED]
```

#### 3. Target Disconnect / Rejoin State Machine
```text
[CONNECTED_PLAYER]
   |
   | websocket disconnect / browser drop
   v
[OFFLINE_RESERVED]
   | seat reserved
   | reclaim token/identity remains valid
   | reconnect timer running
   |
   | reconnect with same platform identity
   +------------------------------> [CONNECTED_PLAYER]
   |
   | grace expires
   v
[ABANDONED_PLAYER]
   | driver/platform abandonment policy applied
   | may become spectator / forfeited / removed
```

#### 4. Target Match Control Model
```text
platform event
  -> "player_disconnected"
  -> "player_reconnected"
  -> "reclaim_expired"

driver policy decides:
  -> suspend match
  -> keep suspended until reclaim
  -> resume on return
  -> abandon/forfeit after ttl
```

### Deliverables
- Introduce a platform/game driver split in the server:
  - platform-owned room/session/presence logic
  - a driver registry keyed by `gameType`
  - Blokus migrated as the first registered driver
- Replace direct game-specific live commands with a generic `match:command` path while preserving existing room commands.
- Split room/match payloads into generic platform metadata plus driver-produced `gameView`.
- Add reconnect lease handling as a generic platform concept with default `suspend then reclaim`.
- Move Blokus setup/rules/replay concerns behind the Blokus driver boundary.
- Split the frontend room flow into a generic room shell plus driver-selected game setup/live/replay views.
- Add routes for non-live history/replay views that no longer depend on a single room workspace layout.
- Make leaderboard/history game-aware via `gameType`.

### Done Criteria
- `gameType` is operational, not decorative.
- Room/session lifecycle works without importing Blokus rules directly into the platform core.
- Blokus is loaded through the driver registry and still works functionally.
- Disconnect during active play suspends the room and allows reclaim within the grace window.
- Reconnect resumes the same seat without hijack from another tab/profile.
- Live gameplay transport supports a generic game command path.
- Room/match responses expose generic platform state plus a game-specific view payload.
- History/replay paths are driven by driver logic rather than hard-coded Blokus reconstruction in platform code.
- `node --check server.js` passes.
- `npm run build` passes.

### Out-of-Scope
- Adding a second concrete game implementation.
- External plugin loading for drivers.
- Full account/auth redesign.

---

## Extension: Platform-First Router and View Redesign

- **Status**: APPROVED
- **Approved-By**: Viet

### Summary
- **Task**: Rework the SPA navigation into a platform-first flow where `/` is the universal lobby, room creation moves to `/games/:gameType`, room staging lives at `/rooms/:roomCode`, and live/replay are split onto `/matches/:matchId...`.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/App.vue`
  - `/Users/maihoangviet/Projects/blokus/src/router.js`
  - `/Users/maihoangviet/Projects/blokus/src/stores/app.js`
  - `/Users/maihoangviet/Projects/blokus/src/views/HomeView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/views/RoomView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/views/`
  - `/Users/maihoangviet/Projects/blokus/src/games/`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The platform is still room-first and Blokus-shaped. Multi-game support needs platform-first navigation: choose a game, browse matching rooms in a table, create a room from a per-game page, and treat live matches as separate resources from staging rooms.

### As-Is Diagram (ASCII)
```text
/
  -> HomeView
     -> profiles
     -> create room
     -> join by code
     -> public rooms
     -> leaderboard / recent

/rooms/:roomCode
  -> RoomView
     -> prepare
     -> live
     -> history
     -> replay
```

### To-Be Diagram (ASCII)
```text
/
  -> PlatformLobbyView
     -> profiles
     -> game selector/filter
     -> room table
     -> row actions: Join / Watch
     -> Create room -> /games/:gameType

/games/:gameType
  -> GameLobbyView
     -> per-game create room flow

/rooms/:roomCode
  -> RoomStagingView
     -> room shell
     -> seats / ready / spectators
     -> game setup only

/matches/:matchId
  -> MatchLiveView
     -> live gameplay only

/matches/:matchId/replay
  -> MatchReplayView
     -> replay only
```

### Deliverables
- Replace the current room-first router with platform-first routes:
  - `/`
  - `/games/:gameType`
  - `/rooms/:roomCode`
  - `/matches/:matchId`
  - `/matches/:matchId/replay`
- Rebuild `/` into a platform lobby with:
  - profile section
  - active game selector/filter
  - compact room table filtered by selected game
  - `Join` / `Watch` actions in each room row
- Move room creation off `/` and into `/games/:gameType`.
- Make `/rooms/:roomCode` staging-only.
- Make `/matches/:matchId` live-only and `/matches/:matchId/replay` replay-only.
- Update store/API usage so room tables and match routes can hydrate from game-aware platform payloads.

### Done Criteria
- `/` shows profiles, a game selector/filter, and a room table filtered by the selected game.
- Room rows expose `Join` and `Watch` in the same row.
- `Create room` from `/` navigates to `/games/:gameType`.
- `/rooms/:roomCode` no longer owns live/replay responsibility.
- `/matches/:matchId` renders live play and `/matches/:matchId/replay` renders replay.
- Browser refresh on each route restores the same resource view.
- `node --check server.js` passes.
- `npm run build` passes.

### Out-of-Scope
- Adding a second game implementation.
- Reworking the underlying reconnect/session model beyond what routing/state hydration needs.
- New leaderboard/rankings routes beyond preserving existing data access.

### Cautions / Risks
- `HomeView.vue` already has local uncommitted edits and must be merged carefully.
- Room and match are distinct resources now, so navigation and hydration must not assume one route can own both.
- Existing replay/history payloads must keep working while the router responsibility moves.

---

## Extension: Staging Realtime Sync and Host Ownership Preservation

- **Status**: APPROVED
- **Approved-By**: Viet

### Summary
- **Task**: Fix staging-room realtime updates so seat/slot changes appear without refresh, and preserve host ownership across transient browser refresh/disconnect.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/stores/app.js`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: After the platform-first route split, joining a `PREPARE` room no longer refreshes the setup slot view for existing viewers, and a host browser refresh can incorrectly transfer host ownership to another member.

### As-Is Diagram (ASCII)
```text
PREPARE join
  -> room member inserted
  -> server emits room snapshot only
  -> client updates room but not setup gameView
  -> slot grid stays stale

Host refresh
  -> socket disconnect
  -> host marked offline
  -> transferHost() runs immediately
  -> another member becomes host
  -> original host reconnects without reclaiming host role
```

### To-Be Diagram (ASCII)
```text
PREPARE join
  -> room member inserted
  -> server emits room snapshot + setup gameView to room viewers
  -> client updates room and setup state together
  -> slot grid reflects seat/color/ready changes immediately

Host refresh
  -> socket disconnect
  -> host marked offline
  -> host role remains reserved during grace/reconnect window
  -> reconnect restores same host ownership
  -> host transfer only happens when the host truly leaves or expires
```

### Deliverables
- Preserve host ownership during transient disconnects by changing host-transfer behavior.
- Add a room-view realtime payload for room viewers that includes setup `gameView`.
- Update the client store to consume setup room-view payloads without requiring a manual refresh.

### Done Criteria
- A second player joining a `PREPARE` room appears in the host’s slot grid without page refresh.
- Refreshing the host page does not transfer host ownership to another player.
- `node --check server.js` passes.
- `npm run build` passes.

### Out-of-Scope
- Fixing the separate `client_instances.token` uniqueness bug.
- Redesigning the room/member identity model.

### Cautions / Risks
- Host transfer must still work for explicit leave and real expiry/removal.
- Realtime room updates must not regress the public room list flow.

---

## Extension: Universal RTS-Style Staging Table

- **Status**: APPROVED
- **Approved-By**: Viet

### Summary
- **Task**: Replace the current pre-game slot-card layout with a platform-owned RTS-style staging table shell that supports game-defined setup columns.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/views/RoomView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/games/clientRegistry.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: A multi-game platform needs one consistent staging model. The current slot cards are too Blokus-specific and do not scale to side-by-side setup fields like color, faction, team, or AI configuration.

### As-Is Diagram (ASCII)
```text
/rooms/:roomCode
  -> setup view
     -> slot cards
     -> launch control card
     -> spectators card

Problem:
  game setup is not structured as a reusable lobby table
```

### To-Be Diagram (ASCII)
```text
/rooms/:roomCode
  -> platform staging shell

+--------------------------------------------------------------------------------+
| Slot | Player | Control | Ready | Status | [Game Column] | [Game Column] ... |
| 1    | Viet   | Human   | Yes   | Online | Blue          | Top-left          |
| 2    | Open   | Open    | -     | Empty  | Red           | Top-right         |
| 3    | Open   | Open    | -     | Empty  | Green         | Bottom-right      |
| 4    | Open   | Open    | -     | Empty  | Orange        | Bottom-left       |
+--------------------------------------------------------------------------------+
| Spectators / launch control remain in bounded side panels                      |
+--------------------------------------------------------------------------------+
```

### Deliverables
- Replace the staging card grid in `RoomView.vue` with a table-style shell.
- Keep fixed platform columns:
  - `Slot`
  - `Player`
  - `Control`
  - `Ready`
  - `Status`
  - `Actions`
- Add game-defined extra columns through the client game registry.
- Migrate Blokus to the new staging model with extra columns:
  - `Color`
  - `Starting Corner`
- Preserve existing staging actions:
  - take seat
  - choose color
  - ready/unready
  - host start
- Keep spectators and launch control as secondary panels.

### Done Criteria
- `PREPARE` renders as a bounded RTS-style staging table, not slot cards.
- The staging shell is platform-owned and reusable.
- Blokus shows driver-defined `Color` and `Starting Corner` columns.
- `npm run build` passes.

### Out-of-Scope
- Implementing faction/team/AI fields for Blokus.
- Adding a second game.
- Changing live match or replay routes.

### Cautions / Risks
- The shell must not hard-code Blokus-only columns.
- The table must remain usable within the fixed viewport.
- Replacing SQLite.
- Large visual redesign outside what is required to separate generic room shell and Blokus game views.

### Proposed-By
- Codex GPT-5

### plan
- multi-board-game-platform-refactor-v1

### Cautions / Risks
- `src/stores/app.js` already has unrelated uncommitted work; implementation must preserve it while evolving the store shape.
- Existing replay/history and live room routes must not regress while payloads are split.
- The driver contract must be generic enough for hidden-info and simultaneous-phase games without over-engineering a plugin system now.
- Reconnect lease data must remain platform-owned and not drift back into game-specific state.
