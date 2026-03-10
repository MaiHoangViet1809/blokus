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

---

## Extension: Room Staging Control Consolidation

- **Status**: APPROVED
- **Approved-By**: Viet

### Summary
- **Task**: Refine `/rooms/:roomCode` so the top app bar shows useful room/profile/game status, the room header centralizes staging controls, the launch control panel is removed, the staging table and room history share one `70/30` row, and spectators become a compact hoverable summary row.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/App.vue`
  - `/Users/maihoangviet/Projects/blokus/src/views/RoomView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The current room staging route spreads key controls across multiple areas and spends too much space on separate support panels. The room route should feel like a focused control screen.

### As-Is Diagram (ASCII)
```text
Top App Bar
  -> generic platform text
  -> profile + connection only

Room Header
  -> room meta
  -> leave only

Main Area
  -> staging table
  -> launch control panel
  -> recent matches panel
  -> spectators panel
```

### To-Be Diagram (ASCII)
```text
Top App Bar
+--------------------------------------------------------------------------------+
| Brand | current profile | current game | room phase/status | connection        |
+--------------------------------------------------------------------------------+

Room Header
+--------------------------------------------------------------------------------+
| XE4CXK                                                                          |
| host-room                                                                       |
| Game: blokus · Phase: PREPARE · Host: aaa                                       |
| [Ready/Unready] [Start] [Leave] [Rematch] [role/status pills]                  |
+--------------------------------------------------------------------------------+

Main Row
+-----------------------------------------------+--------------------------------+
| staging table                                 | recent room matches            |
| width: 70%                                    | width: 30%                     |
+-----------------------------------------------+--------------------------------+

Row 4
+--------------------------------------------------------------------------------+
| Spectators: 3 [hover for details]                                              |
| hover -> name | status | last online                                           |
+--------------------------------------------------------------------------------+
```

### Deliverables
- Upgrade the top app bar for room-staging routes.
- Move staging controls into the room header block.
- Remove the separate launch control panel.
- Make the staging table and room history share one `70/30` row.
- Add compact spectator summary with hover detail.
- Extend room snapshot members with enough data for spectator last-online detail.

### Done Criteria
- `/rooms/:roomCode` app bar shows room/game/profile/status context.
- The room header is the primary staging control area.
- The launch control panel is gone.
- The staging/history row uses a `70/30` split.
- Spectators render as a compact hoverable row with `name`, `status`, and `last online`.
- `node --check server.js` passes.
- `npm run build` passes.

### Out-of-Scope
- Live match route redesign.
- Replay route redesign.
- Room lifecycle rule changes.

### Cautions / Risks
- App-bar context must stay room-scoped, not Blokus-scoped.
- Hover detail must not break viewport-fit constraints.
- `last online` must come from a stable room snapshot field.

---

## Extension: Match Start Driver Contract Fix

- **Status**: APPROVED
- **Approved-By**: Viet

### Summary
- **Task**: Fix the driver/platform contract mismatch in match creation so `room:start` inserts valid `match_players.profile_id` values.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/driver.js`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The platform and Blokus driver disagree on the `matchPlayers` field name for player identity, causing `SQLITE_CONSTRAINT_NOTNULL` when a match starts.

### As-Is Diagram (ASCII)
```text
room:start
  -> driver.createMatch()
  -> matchPlayers[{ profileId, seatIndex, ... }]
  -> server inserts player.profile_id
  -> undefined written
  -> sqlite NOT NULL constraint failure
```

### To-Be Diagram (ASCII)
```text
room:start
  -> driver.createMatch()
  -> matchPlayers contract matches platform expectation
  -> server inserts valid profile_id values
  -> match starts successfully
```

### Deliverables
- Align `matchPlayers` identity fields between platform and Blokus driver.
- Restore successful `room:start` inserts into `match_players`.

### Done Criteria
- Starting a match no longer raises `NOT NULL constraint failed: match_players.profile_id`.
- `node --check server.js` passes.
- `npm run build` passes.

### Out-of-Scope
- Broader driver API redesign.
- Unrelated session/bootstrap bugs.

### Cautions / Risks
- The `matchPlayers` contract must stay consistent for future drivers.

---

## Extension: Match Governance and Match-to-Room Return Flow

- **Status**: APPROVED
- **Approved-By**: Viet

### Summary
- **Task**: Add a platform-owned governance bar to `/matches/:matchId` with leave, reconnect status, surrender, vote-end, and vote-rematch controls, and complete the route-back loop from match to room staging when the room returns to `PREPARE`.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/stores/app.js`
  - `/Users/maihoangviet/Projects/blokus/src/views/MatchView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: Live matches currently expose gameplay but not platform governance. The route-back to room exists only as a passive phase watcher and not as a complete user-facing match lifecycle.

### As-Is Diagram (ASCII)
```text
/rooms/:roomCode
  -> start
  -> /matches/:matchId

/matches/:matchId
  -> Room staging
  -> Replay
  -> Leave

Return flow:
  if room.phase becomes PREPARE
    -> client redirects back to /rooms/:roomCode

Missing:
  -> surrender
  -> vote end
  -> vote rematch
  -> governance state in match payload
```

### To-Be Diagram (ASCII)
```text
/rooms/:roomCode
  -> staging
  -> start
  -> /matches/:matchId

/matches/:matchId
+--------------------------------------------------------------------------------+
| Match header                                                                   |
+--------------------------------------------------------------------------------+
| Governance Bar                                                                 |
| [Leave] [Reconnect status] [Surrender] [Vote End] [Vote Rematch*]              |
| governance state: vote counts / waiting / suspended / finished                 |
+--------------------------------------------------------------------------------+
| Live gameplay                                                                  |
+--------------------------------------------------------------------------------+

Match-to-room flow
  -> finish / unanimous vote end / unanimous vote rematch
  -> room returns to PREPARE
  -> client redirects to /rooms/:roomCode
```

### Deliverables
- Add a generic `match:governance` command path.
- Persist governance vote state with the active match.
- Expose governance state in `buildMatchSnapshot()`.
- Add `surrender`, `vote_end_match`, and `vote_rematch` actions.
- Add a governance bar to `/matches/:matchId`.
- Preserve the route-back to `/rooms/:roomCode` once the room returns to `PREPARE`.

### Done Criteria
- `/matches/:matchId` shows governance controls and vote state.
- Players can surrender from the live match route.
- Players can vote to end an active match.
- Players can vote rematch from the finished match route.
- When rematch returns the room to `PREPARE`, the client reliably routes back to `/rooms/:roomCode`.
- `node --check server.js` passes.
- `npm run build` passes.

### Out-of-Scope
- In-place restart of an active live match.
- Redesigning game-specific controls.
- Replay redesign.

### Cautions / Risks
- Governance must remain platform-owned, not Blokus-specific.
- Vote semantics must stay explicit and deterministic.
- Route-back must not leave stale live match state on screen.
- Replacing SQLite.
- Large visual redesign outside what is required to separate generic room shell and Blokus game views.

---

## Extension: Single-Source Room Staging Controls

- **Status**: APPROVED
- **Approved-By**: Viet

### Summary
- **Task**: Remove duplicated staging controls so each room-staging action appears in exactly one place.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/views/RoomView.vue`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The recent staging/control refactors left `Ready/Unready` exposed both in the room header and in the staging table, which makes the lobby harder to scan and violates the one-action-one-location rule.

### As-Is Diagram (ASCII)
```text
Room header
  -> [Ready] [Start] [Leave]

Staging table row
  -> [Ready] again for current player row

Result:
  same action appears in 2 places
```

### To-Be Diagram (ASCII)
```text
Room header
  -> [Ready/Unready] [Start] [Leave] [Rematch]

Staging table row
  -> row-local actions only
     [Take seat] for open slot
     no duplicate ready toggle
```

### Deliverables
- Keep `Ready/Unready` only in the room header control block.
- Remove duplicated row-level `Ready/Unready` action from the staging table.
- Keep row-level `Take seat` where applicable.

### Done Criteria
- In `/rooms/:roomCode`, `Ready/Unready` appears only once.
- `Start`, `Leave`, and `Rematch` remain single-source controls.
- Staging table still supports seat claiming.
- `npm run build` passes.

### Out-of-Scope
- Broader staging-table redesign.
- Live match route changes.

### Cautions / Risks
- Row actions must still make sense after removing the duplicate ready button.

---

## Extension: Legacy Static Client Cleanup and Generated Artifact Ignore Rules

- **Status**: APPROVED
- **Approved-By**: Viet

### Summary
- **Task**: Remove the unused legacy static client files and ignore generated local artifacts from the new SPA/platform workflow.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/public/index.html`
  - `/Users/maihoangviet/Projects/blokus/public/style.css`
  - `/Users/maihoangviet/Projects/blokus/.gitignore`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The repo now runs from the Vite SPA and `dist/` output, but legacy static client files are still present as unrelated diffs. Generated artifacts from build/runtime/debug are also still showing up in git status and should be ignored.

### As-Is Diagram (ASCII)
```text
Current app
  -> index.html
  -> src/*
  -> dist/ served by server

Legacy files still present
  -> public/index.html
  -> public/style.css

Git status noise
  -> data/
  -> dist/
  -> .DS_Store
  -> .playwright-cli/
```

### To-Be Diagram (ASCII)
```text
Current app
  -> index.html
  -> src/*
  -> dist/ served by server

Legacy static client removed
  -> no unused public HTML/CSS leftovers

Git status
  -> source diffs only
  -> generated artifacts ignored
```

### Deliverables
- Delete unused legacy files:
  - `public/index.html`
  - `public/style.css`
- Extend `.gitignore` for:
  - `dist/`
  - `data/`
  - `.DS_Store`
  - keep `.playwright-cli/`

### Done Criteria
- Legacy `public/` HTML/CSS files are removed.
- Generated artifacts no longer appear as untracked noise after cleanup.
- `npm run build` passes.

### Out-of-Scope
- Deleting `public/client.js`.
- Broader repo cleanup.
- Changing runtime server behavior.

### Cautions / Risks
- File-level destructive impact:
  - delete `/Users/maihoangviet/Projects/blokus/public/index.html`
  - delete `/Users/maihoangviet/Projects/blokus/public/style.css`

---

## Extension: Client Instance Bootstrap Collision Fix

- **Status**: APPROVED
- **Approved-By**: Viet

### Summary
- **Task**: Fix `client_instances.token` bootstrap collisions by making client-instance resolution token-authoritative instead of browser-container-scoped.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: `/api/bootstrap` can return `500` in the browser even though direct `curl` works. The root cause is a contract mismatch in the instance registry: `client_instances.token` is globally unique in the database, but lookup still scopes it by `browser_container_id`. When the browser cookie changes while `sessionStorage` keeps the old client-instance token, bootstrap attempts to insert a duplicate token and fails.

### As-Is Diagram (ASCII)
```text
Browser tab
  -> sessionStorage has client_instance_id = X
  -> browser cookie changes / missing -> new browser_container

Bootstrap
  -> ensureBrowserContainer(new container)
  -> ensureClientInstance(new container, token X)
  -> lookup by (browser_container_id, token) misses
  -> insert client_instances(token = X)
  -> UNIQUE constraint failed: client_instances.token
  -> /api/bootstrap returns 500
```

### To-Be Diagram (ASCII)
```text
Browser tab
  -> sessionStorage has client_instance_id = X
  -> browser cookie changes / missing -> new browser_container

Bootstrap
  -> resolve client instance by token X first
  -> restore the owning browser container for that tab identity
  -> no duplicate insert
  -> /api/bootstrap returns JSON
```

### Deliverables
- Make client-instance lookup token-authoritative.
- Prevent duplicate insert attempts for an existing `client_instances.token`.
- Preserve multi-tab behavior and refresh continuity.

### Done Criteria
- `/api/bootstrap` no longer fails with `UNIQUE constraint failed: client_instances.token`.
- Browser refresh with an existing `sessionStorage` client instance id returns JSON successfully.
- `node --check server.js` passes.
- `npm run build` passes.

### Out-of-Scope
- Broader auth redesign.
- Moving session identity into URLs.

### Cautions / Risks
- The fix must preserve the intended separation:
  - browser container = shared browser identity
  - client instance = per-tab identity

---

## Extension: Match-Route App Bar Context and Replay Grid Clarity

- **Status**: APPROVED
- **Approved-By**: Viet

### Summary
- **Task**: Add match-route context to the global app bar and strengthen the Blokus replay board grid so space and boundaries are unambiguous.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/App.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The platform now routes live play through `/matches/:matchId`, but the app shell still only surfaces room-route context. Replay also needs a clearer grid so viewers do not misread Blokus board space.

### As-Is Diagram (ASCII)
```text
/matches/:matchId
  -> app bar shows generic platform copy
  -> match route lacks game context in top shell

/matches/:matchId/replay
  -> board cells render
  -> grid/boundaries are visually weak
```

### To-Be Diagram (ASCII)
```text
/matches/:matchId
  -> app bar shows:
     game name
     match/room title
     phase/status
     turn/replay context

/matches/:matchId/replay
  -> replay board shows:
     explicit grid
     clear board boundary
     clearer empty-space readability
```

### Deliverables
- Extend global app bar context handling for `/matches/*`.
- Show game name and match context in the app bar on live and replay match routes.
- Strengthen replay board visuals with clearer grid lines and a clearer board frame.

### Done Criteria
- `/matches/:matchId` app bar shows game-aware match context.
- `/matches/:matchId/replay` app bar shows replay context.
- Replay board has a visibly clear grid and boundary.
- `npm run build` passes.

### Out-of-Scope
- Replay behavior redesign.
- Route restructuring.
- Game logic changes.

### Cautions / Risks
- The app bar must stay platform-owned, not Blokus-hardcoded.
- Replay grid should become clearer without making occupied cells harder to read.

---

## Extension: Uppercase and Unique Profile Names

- **Status**: APPROVED
- **Approved-By**: Viet

### Summary
- **Task**: Normalize profile names to uppercase and enforce platform-wide uniqueness on that uppercase form.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: Duplicate visible names make rooms, matches, replay, and governance ambiguous. Converting names to uppercase gives one consistent display style and one clear uniqueness rule.

### As-Is Diagram (ASCII)
```text
Create profile "alice"
  -> inserted as "alice"

Create profile "ALICE"
  -> inserted again

Result:
  duplicate visible identity
  inconsistent casing
```

### To-Be Diagram (ASCII)
```text
Create profile "alice"
  -> normalized to "ALICE"
  -> inserted

Create profile "ALICE"
  -> normalized to "ALICE"
  -> rejected

Result:
  all profile names display in uppercase
  uniqueness is enforced on uppercase names
```

### Deliverables
- Normalize profile names to uppercase on the server before insert.
- Enforce uniqueness on normalized profile names.
- Return a clear API error when the normalized name already exists.

### Done Criteria
- Creating `"alice"` stores `"ALICE"`.
- Creating `"ALICE"` after `"alice"` is rejected.
- Existing unique profile creation still works.
- `node --check server.js` passes.
- `npm run build` passes.

### Out-of-Scope
- Profile rename flow.
- Broader auth redesign.

### Cautions / Risks
- Existing duplicate local rows may block a direct unique index if both normalize to the same uppercase name.
- The migration should avoid hard failure on already-dirty local databases.

---

## Extension: Spectator-First Room Entry and Room Control Bar Cleanup

- **Status**: APPROVED
- **Approved-By**: Viet

### Summary
- **Task**: Refine room entry and room staging so lobby entry is spectator-first, seated players can leave their seat without leaving the room, and the second block on `/rooms/:roomCode` becomes a pure Room Control Bar.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/views/HomeView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/views/RoomView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: Room entry is still split between `Join` and `Watch`, seated players cannot easily return to spectator mode, and the second block on the room route duplicates metadata already shown in the app bar.

### As-Is Diagram (ASCII)
```text
/ (platform lobby)
  room table row
    -> [Join] [Watch]

/rooms/:roomCode
  app bar
    -> room/game/phase/host context

  second block
    -> room code / room title / game / phase / host
    -> [player] [PREPARE] [Ready] [Start] [Leave]
```

### To-Be Diagram (ASCII)
```text
/ (platform lobby)
  room table row
    -> [Join]
  Join
    -> always enters as spectator/watch first

/rooms/:roomCode
  app bar
    -> room/game/phase/host context

  second block = Room Control Bar
    -> [Ready/Unready] [Start] [Leave seat] [Leave room] [Rematch if applicable]

Behavior
  spectator
    -> can Take seat
  seated player
    -> can Leave seat and remain spectator in the room
```

### Deliverables
- Make main room table and join-by-code spectator-first.
- Remove separate `Watch` action from the main room table.
- Support player-to-spectator demotion in `PREPARE` without leaving the room.
- Convert the second room block into a pure Room Control Bar.
- Remove duplicated metadata and low-value pills from that block.

### Done Criteria
- Main room list shows only one room-row action.
- Joining from the lobby enters as spectator by default.
- A seated player can leave their seat and remain in the room as spectator.
- The second room block contains controls only.
- `node --check server.js` passes.
- `npm run build` passes.

### Out-of-Scope
- Route changes.
- Live match redesign.
- New room lifecycle rules.

### Cautions / Risks
- Leaving seat must clear seat-specific staging state.
- Spectator demotion must stay blocked once the match is live.

### Proposed-By
- Codex GPT-5

### plan
- multi-board-game-platform-refactor-v1

### Cautions / Risks
- `src/stores/app.js` already has unrelated uncommitted work; implementation must preserve it while evolving the store shape.
- Existing replay/history and live room routes must not regress while payloads are split.
- The driver contract must be generic enough for hidden-info and simultaneous-phase games without over-engineering a plugin system now.
- Reconnect lease data must remain platform-owned and not drift back into game-specific state.

## Extension: Deterministic Seat Claims and Live Blokus Scoreboard
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-10
- **Task**: Make `Take seat` claim the exact clicked staging row and add a live Blokus mini scoreboard ranked by remaining tile cells.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/stores/app.js`
  - `/Users/maihoangviet/Projects/blokus/src/views/RoomView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/driver.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/LiveView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: Generic player joins lose seat intent and create an avoidable race in staging. Live Blokus also needs a clear leader indicator based on remaining tile cells, not piece count.

### As-Is Diagram (ASCII)
```text
PREPARE staging
  open row clicked
  -> claimSeat()
  -> room:join(roomCode)
  -> no seatIndex in request
  -> server promotes spectator to generic player seat
  -> viewers receive room update, but clicked-seat intent is lost

IN_GAME
  player strip shows remaining piece count
  -> not actual lead metric
```

### To-Be Diagram (ASCII)
```text
PREPARE staging
  open row clicked
  -> claimSeat(seatIndex)
  -> room:join(roomCode, seatIndex)
  -> server claims that exact seat or rejects with "seat already taken"
  -> emit refreshed room + setup view
  -> all viewers see the same seat outcome immediately

IN_GAME
  mini scoreboard
    -> player
    -> color
    -> remaining tile cells
    -> rank
  sorted by remaining tile cells ascending
```

### Deliverables
- extend `room:join` with optional `seatIndex`
- make staging `Take seat` pass the clicked row’s seat index
- reject stale seat claims with a clear conflict error
- expose `remainingCells` in Blokus live player projections
- add a compact live scoreboard ranked by remaining tile cells ascending

### Done Criteria
- exact-seat claims succeed or fail deterministically
- all room viewers see seat changes immediately
- live Blokus shows a compact scoreboard using remaining cells
- `node --check server.js` passes
- `npm run build` passes

### Out-of-Scope
- changing overall room layout
- changing Blokus scoring rules

### Proposed-By
- Codex GPT-5

### plan
- multi-board-game-platform-refactor-v1

### Cautions / Risks
- seat-claim contract change touches both client and server
- exact-seat claim must preserve spectator-first room entry
- scoreboard ordering must follow lower remaining cells = leading

## Extension: Board-Only Match Row with Scoreboard and Pieces Support Row
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-10
- **Task**: Re-layout the live Blokus match view so the board is isolated as the main square play surface, and the support row shows `Scoreboard` on the left and `Pieces` on the right with flexible width/height.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/LiveView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/components/GameBoard.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The live match view still stacks support panels inefficiently and keeps the pieces rack inside the board component. The board should be a strict square play surface with sharp corners, and the scoreboard and pieces should share the support row below it.

### As-Is Diagram (ASCII)
```text
Live match
  -> board + pieces inside GameBoard
  -> scoreboard below board
  -> board uses softened rounded corners
```

### To-Be Diagram (ASCII)
```text
Live match
  -> row 2: board only
  -> row 3: scoreboard | pieces
  -> board remains square
  -> board corners are sharp
```

### Deliverables
- make `GameBoard.vue` board-only
- move pieces/rack actions into `LiveView.vue`
- place scoreboard left and pieces right in the support row
- make both support panels stretch to available width/height
- keep the board square with sharp corners and minimum readable size

### Done Criteria
- board is isolated from the pieces panel
- scoreboard is left and pieces are right in the same row
- board remains square and sharp-edged
- `npm run build` passes

### Out-of-Scope
- gameplay rule changes
- route changes
- replay layout changes

### Proposed-By
- Codex GPT-5

### plan
- multi-board-game-platform-refactor-v1

### Cautions / Risks
- moving rack UI out of `GameBoard.vue` touches transform state ownership
- support row must still fit the fixed-viewport layout

## Extension: Remove Match-Route Side Gutters and Compact the Meta Strip
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-10
- **Task**: Remove the large side gutters on `/matches/:matchId` and shrink the oversized bottom player/meta strip back to compact height.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The live match route still inherits the generic shell width cap, and the gameplay panel still uses a stale extra grid row that makes the bottom strip much taller than intended.

### As-Is Diagram (ASCII)
```text
viewport
| gutter | live match shell | gutter |

live match panel
  -> header
  -> gameplay row
  -> oversized player/meta strip
```

### To-Be Diagram (ASCII)
```text
viewport
| near-full-width live match shell |

live match panel
  -> header
  -> gameplay row
  -> compact player/meta strip
```

### Deliverables
- relax the shell width cap for `.match-view`
- remove the stale gameplay-panel extra row
- keep the player/meta strip content-height only

### Done Criteria
- `/matches/:matchId` uses nearly full available width
- the player/meta strip is compact again
- `npm run build` passes

### Out-of-Scope
- broader app-wide shell width changes
- match gameplay layout redesign beyond these two regressions

### Proposed-By
- Codex GPT-5

### plan
- multi-board-game-platform-refactor-v1

### Cautions / Risks
- match-route width override must not introduce horizontal overflow
- compacting the footer row must not collapse the player/meta content

## Extension: Prevent Board Clipping in the Three-Column Match Layout
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-10
- **Task**: Fix the live Blokus three-column match layout so the center square board never clips at the edges.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The current center board track and canvas rules still force a minimum size that can exceed the available middle-column width, which causes the board to clip.

### As-Is Diagram (ASCII)
```text
match row
| scoreboard | [ board too wide ] | pieces |
|            | [ clipped ]        |        |
```

### To-Be Diagram (ASCII)
```text
match row
| scoreboard | [ square board fits ] | pieces |
|            | [ no clipping ]       |        |
```

### Deliverables
- relax the center grid track minimum
- remove the hard board canvas minimum that causes clipping
- keep the board square and fully contained in the center column

### Done Criteria
- board no longer clips in the three-column desktop layout
- `npm run build` passes

### Out-of-Scope
- gameplay rule changes
- wider live match layout redesign

### Proposed-By
- Codex GPT-5

### plan
- multi-board-game-platform-refactor-v1

### Cautions / Risks
- the board must stay square while shrinking to fit the actual center column

## Extension: Fit the Live Board by Container, Not Viewport
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-10
- **Task**: Fix the live Blokus board clipping bug on `/matches/:matchId` by sizing the square board from the actual center container instead of from `100dvh`.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/components/GameBoard.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The board canvas was still sized from viewport height, not from the real middle-column container. That let the square exceed the row height and clip at the top/bottom.

### As-Is Diagram (ASCII)
```text
match-main-row
| scoreboard | board column                | pieces |
|            | board size derived from dvh |        |
|            | -> too tall for row         |        |
|            | -> clipped top/bottom       |        |
```

### To-Be Diagram (ASCII)
```text
match-main-row
| scoreboard | square board fits container | pieces |
|            | side = min(width, height)   |        |
|            | no clipping                 |        |
```

### Deliverables
- remove viewport-based board sizing
- size the board from the measured center container
- keep the board square and fully contained

### Done Criteria
- board no longer clips in the live three-column layout
- `node --check server.js` passes
- `npm run build` passes

### Out-of-Scope
- gameplay rule changes
- broader match layout redesign

### Proposed-By
- Codex GPT-5

### plan
- multi-board-game-platform-refactor-v1

### Cautions / Risks
- container measurement must react to resize without breaking hover/place alignment

## Extension: Square Piece Tiles and Transform-Synced Rack Preview
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-10
- **Task**: Make every live Blokus piece tile square and keep the selected rack preview synchronized with rotate/flip state.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/LiveView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The rack currently uses content-sized tiles and canonical piece cells only, so the selected thumbnail can diverge from the transformed board shadow after rotate/flip.

### As-Is Diagram (ASCII)
```text
Pieces panel
  -> rectangular content-sized tiles
  -> selected thumbnail stays in base orientation
  -> board shadow uses rotated/flipped shape
```

### To-Be Diagram (ASCII)
```text
Pieces panel
  -> every piece sits in a square tile
  -> selected thumbnail follows rotate/flip
  -> selected thumbnail matches board shadow
```

### Deliverables
- make piece tiles square
- render selected rack preview from transformed cells
- keep non-selected tiles canonical

### Done Criteria
- all piece tiles remain square
- selected piece preview matches board shadow after rotate/flip
- `npm run build` passes

### Out-of-Scope
- route changes
- gameplay rule changes

### Proposed-By
- Codex GPT-5

### plan
- multi-board-game-platform-refactor-v1

### Cautions / Risks
- selected preview must stay centered so transforms do not visually jump

## Extension: Flexible Square Rack Tiles Within the Pieces Panel
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-10
- **Task**: Keep the live Blokus rack tiles square while making them flex within the rack container without growing so large that preview and label content crowd or overlap.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/LiveView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The square tiles introduced earlier still stretched too large inside the rack column, causing the preview and label to compete for limited vertical space and look visually broken.

### As-Is Diagram (ASCII)
```text
Pieces panel
  -> 2-column square tiles
  -> tiles stretch too large
  -> preview + label crowd inside tile
  -> visual overlap / cramped layout
```

### To-Be Diagram (ASCII)
```text
Pieces panel container
  -> 2-column responsive grid
  -> square tiles stay compact
  -> preview centered near top
  -> label anchored at bottom
  -> no overlap
```

### Deliverables
- keep a 2-column desktop rack layout with square tiles
- limit tile growth so they stay compact within the rack panel
- reposition preview and label so content fits cleanly inside each square tile
- preserve transform-synced selected preview behavior

### Done Criteria
- piece tiles remain square
- piece tiles no longer visually overlap or crowd their own contents
- selected tile still matches the transformed board preview after rotate/flip
- `npm run build` passes

### Out-of-Scope
- route/layout changes outside the rack panel
- server/API changes

### Proposed-By
- Codex GPT-5

### plan
- multi-board-game-platform-refactor-v1

### Cautions / Risks
- rack sizing changes must not break the 2-column desktop layout
- preview reduction must still keep larger polyominoes legible

## Extension: Smaller Square Rack Tiles with Centered Shape-Only Preview
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-10
- **Task**: Make the live Blokus rack tiles smaller, remove visible text labels from the tiles, and center the shape thumbnail inside each square tile.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/LiveView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The rack was still rendering oversized square tiles with the thumbnail pushed upward and a visible label competing for space, which made the shape-driven rack harder to scan and use.

### As-Is Diagram (ASCII)
```text
square tile
  -> tile too large
  -> preview pushed upward
  -> label shown
  -> shape does not sit in the visual center
```

### To-Be Diagram (ASCII)
```text
smaller square tile
  -> no visible label
  -> centered shape preview
  -> tile about 4/5 previous size
  -> shape-driven scanning only
```

### Deliverables
- reduce desktop rack tile size
- remove visible labels from piece tiles
- center shape previews inside each square tile
- preserve transform-synced selected preview behavior

### Done Criteria
- rack tiles are visibly smaller
- no visible piece label appears in the tile
- the shape preview is visually centered
- selected tile still matches board preview after rotate/flip
- `npm run build` passes

### Out-of-Scope
- route changes
- server/API changes
- broader match layout redesign

### Proposed-By
- Codex GPT-5

### plan
- multi-board-game-platform-refactor-v1

### Cautions / Risks
- reducing tile size too far can hurt larger-piece legibility
- centering must still keep transformed previews visually stable
