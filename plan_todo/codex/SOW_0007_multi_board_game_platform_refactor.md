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

## Extension: Flex-Wrap Rack Tiles with Stable Square Footprints
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-10
- **Task**: Replace the live Blokus rack tile layout with a flex-wrap footprint model so square piece tiles no longer over-expand or feel visually overlapping.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The rack was still using fluid grid columns, so tile width remained unstable and visually oversized. A flex-wrap footprint model gives each tile a stable square size and cleaner wrapping.

### As-Is Diagram (ASCII)
```text
piece-grid
  -> css grid
  -> fluid 1fr columns
  -> square tiles still grow too large
  -> rack feels crowded / visually overlapping
```

### To-Be Diagram (ASCII)
```text
piece-grid
  -> flex-wrap
  -> each tile has stable square footprint
  -> tiles wrap cleanly
  -> no visual overlap feeling
```

### Deliverables
- replace rack layout with flex-wrap
- keep square tiles with centered previews
- reduce tile footprint to a stable compact size

### Done Criteria
- rack tiles wrap cleanly without overlap
- rack tiles remain square and centered
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
- the chosen footprint must still keep larger pieces legible
- desktop rack should still present at least two tiles per row in normal width

## Extension: Blokus `solo_1v1` 14x14 Variant
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-10
- **Task**: Add a `solo_1v1` Blokus ruleset with a 14x14 board, two-player capacity, and a mode selector in the Blokus create flow.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/lib/pieces.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/driver.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/stagingModel.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/LiveView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/ReplayView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/games/clientRegistry.js`
  - `/Users/maihoangviet/Projects/blokus/src/views/GameLobbyView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/views/HomeView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/components/GameBoard.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`

### As-Is Diagram (ASCII)
```text
Create Blokus room
  -> one implicit mode only
  -> 20x20 board
  -> capacity 4
  -> room list only shows "blokus"
```

### To-Be Diagram (ASCII)
```text
Create Blokus room
  -> choose mode:
     [Classic 4P] [Solo 1:1]

Solo 1:1
  -> board 14x14
  -> capacity 2
  -> exactly 2 seated players
  -> same 4 color/corner identities
```

### Deliverables
- make Blokus ruleset-driven with `classic_4p` and `solo_1v1`
- add a Blokus mode selector in `/games/blokus`
- expose mode labels in lobby room summaries
- render live/replay boards from dynamic `boardSize`

### Done Criteria
- solo rooms create with capacity 2 and board size 14
- classic rooms remain 20x20 with capacity 4
- room list shows the Blokus mode label
- live and replay views no longer hardcode 20x20
- `node --check server.js` passes
- `npm run build` passes

### Out-of-Scope
- reduced duel piece set
- new game type
- color/corner model redesign

### Proposed-By
- Codex GPT-5

### plan
- multi-board-game-platform-refactor-v1

### Cautions / Risks
- server room summaries and legacy match helpers must stop assuming capacity 4 / board size 20
- replay and board views must render from ruleset config, not fixed grid dimensions

## Extension: Reorganize the Codebase into Lean Game Folders
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-10
- **Task**: Reorganize the project into platform-owned client/server folders and compact per-game folders so new games can be added with low-touch driver and view work.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/App.vue`
  - `/Users/maihoangviet/Projects/blokus/src/router.js`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/`
  - `/Users/maihoangviet/Projects/blokus/src/platform/server/`
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`

### As-Is Diagram (ASCII)
```text
src/
  games/
    blokus/
      driver.js
      stagingModel.js
      LiveView.vue
      ReplayView.vue
    clientRegistry.js
    serverRegistry.js

  views/
    HomeView.vue
    GameLobbyView.vue
    RoomView.vue
    MatchView.vue
    MatchReplayView.vue

server.js
  -> identity/session
  -> room lifecycle
  -> match orchestration
  -> persistence
  -> transport
```

### To-Be Diagram (ASCII)
```text
src/
  platform/
    client/
      registry.js
      store.js
      views/
        HomeView.vue
        GameLobbyView.vue
        RoomView.vue
        MatchView.vue
        MatchReplayView.vue
    server/
      index.js
      registry.js
      rooms.js
      matches.js
      transport.js

  games/
    blokus/
      index.js
      server.js
      create.js
      staging.js
      LiveView.vue
      ReplayView.vue
      shared.js
      GameBoard.vue
```

### Deliverables
- move platform client shell, store, and registries under `src/platform/client`
- make top-level `server.js` a thin entrypoint into `src/platform/server/index.js`
- move platform server registry and helper modules under `src/platform/server`
- migrate Blokus into a compact game folder contract with create, staging, live, replay, server, and shared modules
- update imports and routes to the new structure without changing current Blokus behavior

### Done Criteria
- build still passes after the structure move
- `server.js` remains bootable as the project entrypoint
- Blokus create, staging, live, replay, and solo/classic variants still resolve through the new structure
- `node --check server.js` passes
- `npm run build` passes

### Out-of-Scope
- implementing chess
- dynamic plugin loading
- redesigning routes or live match behavior

### Proposed-By
- Codex GPT-5

### plan
- multi-board-game-platform-refactor-v1

### Cautions / Risks
- move-heavy refactors are sensitive to import path regressions
- platform server is only split to a pragmatic first layer in this extension; not every helper is extracted yet

## Extension: Split Game Manifests by Runtime Boundary
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-10
- **Task**: Fix the post-refactor boot failure by separating client game manifests from server runtime entrypoints so Node never imports `.vue` files.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/index.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/client.js`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/registry.js`
  - `/Users/maihoangviet/Projects/blokus/src/platform/server/registry.js`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`

### As-Is Diagram (ASCII)
```text
src/games/blokus/index.js
  -> imports LiveView.vue
  -> imports ReplayView.vue
  -> exports manifest

platform client registry
  -> imports blokus/index.js
  -> OK under Vite

platform server registry
  -> imports blokus/index.js
  -> Node tries to load .vue
  -> boot fails
```

### To-Be Diagram (ASCII)
```text
src/games/blokus/client.js
  -> imports LiveView.vue
  -> imports ReplayView.vue
  -> exports client manifest

src/games/blokus/index.js
  -> exports base manifest only
  -> no .vue imports

platform client registry
  -> imports blokus/client.js

platform server registry
  -> imports blokus/index.js and blokus/server.js
```

### Deliverables
- split the Blokus manifest into runtime-safe entrypoints
- keep `.vue` imports only in the client manifest
- keep the server registry on server-safe modules only

### Done Criteria
- `node server.js` boots successfully
- `node --check server.js` passes
- `npm run build` passes
- client registry still resolves Blokus create/staging/live/replay correctly
- server registry no longer imports `.vue` transitively

### Out-of-Scope
- further platform structure redesign
- implementing chess
- route changes

### Proposed-By
- Codex GPT-5

### plan
- multi-board-game-platform-refactor-v1

### Cautions / Risks
- client and server manifests must stay aligned enough that adding a new game remains low-touch

## Extension: Remove Legacy Blokus Staging and Command Paths
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-10
- **Task**: Remove legacy Blokus-specific setup and command leftovers so the platform is closer to adding a new game by driver and views instead of editing core shells and stale paths.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/views/RoomView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/stores/app.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/driver.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/stagingModel.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/SetupView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/components/ReplayPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`

### As-Is Diagram (ASCII)
```text
RoomView
  -> staging table
  -> hardcoded room:update-config patch: set_color

server.js
  -> generic room flow
  -> but still owns setPlayerColor()
  -> still exposes room:set-color
  -> still keeps match:place alias
  -> still keeps placeMove()/passTurn() legacy helpers

Dead files
  -> blokus/SetupView.vue
  -> components/ReplayPanel.vue
```

### To-Be Diagram (ASCII)
```text
RoomView
  -> generic setup patch dispatch only

server.js
  -> generic room:update-config
  -> delegated to game driver setup mutation handler
  -> no room:set-color legacy alias
  -> no match:place legacy alias
  -> no unused pre-driver match helpers

Codebase
  -> dead Blokus staging/replay wrapper files removed
```

### Deliverables
- replace hardcoded `set_color` patch handling with driver-routed setup patch handling
- remove legacy `room:set-color` socket path
- remove legacy `match:place` socket alias
- remove unused pre-driver helpers:
  - `placeMove()`
  - `passTurn()`
- delete unused files:
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/SetupView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/components/ReplayPanel.vue`

### Done Criteria
- room setup updates no longer hardcode Blokus patch names in room shell or server transport
- no stale `room:set-color` or `match:place` transport path remains
- dead files listed above are removed
- `node --check server.js` passes
- `npm run build` passes

### Out-of-Scope
- dynamic plugin loading
- refactoring static registries
- implementing chess
- large lobby or match UI redesign

### Proposed-By
- Codex GPT-5

### plan
- multi-board-game-platform-refactor-v1

### Cautions / Risks
- the setup patch contract should stay small and concrete
- current Blokus color selection behavior must remain intact while patch routing moves behind the driver

## Extension: Room Chat with Messenger-Style Floating Panel
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-12
- **Task**: Add a room-wide realtime chat system shared by staging and live match routes, with a Messenger-style floating chat button and panel, unread badge, left/right message alignment, and sender avatar/name metadata.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/platform/server/index.js`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/store.js`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/views/RoomView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/views/MatchView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/RoomChatFab.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/RoomChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`

### As-Is Diagram (ASCII)
```text
Room / Match routes
  -> presence
  -> staging
  -> gameplay
  -> no room communication channel
```

### To-Be Diagram (ASCII)
```text
Room / Match routes
  -> shared room chat available everywhere

UI
  -> floating chat button like Messenger
  -> unread red badge count
  -> click opens chat panel
  -> my messages right
  -> other messages left
  -> each message shows profile name + avatar/icon
```

### Deliverables
- add durable room chat storage with a `room_messages` table
- add realtime room chat transport:
  - `room:chat:send`
  - `state:room-chat:init`
  - `state:room-chat:message`
- extend the platform store with room chat state and unread tracking
- add reusable floating chat UI for both staging and match routes
- keep chat room-scoped, including spectators

### Done Criteria
- users in the same room can send and receive chat in realtime
- chat is available from both `/rooms/:roomCode` and `/matches/:matchId`
- floating chat button appears with unread badge
- my messages render on the right and others on the left
- message rows show sender name and initial avatar badge
- refresh in the same room restores recent message history
- `node --check server.js` passes
- `npm run build` passes

### Out-of-Scope
- private messages
- file or image attachments
- emoji picker
- moderation tools
- global lobby chat

### Proposed-By
- Codex GPT-5

### plan
- multi-board-game-platform-refactor-v1

### Cautions / Risks
- chat must stay room-scoped, not match-scoped
- unread count stays client-local in this version
- message history must stay bounded to avoid heavy payloads

## Extension: Resilient Match Navigation and Terminal-State UX
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-12
- **Task**: Make `/matches/:matchId` navigation and terminal-state UX resilient so users can always leave to main, return to room staging, and understand post-AFK or post-loss states.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/views/MatchView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/store.js`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`

### As-Is Diagram (ASCII)
```text
/matches/:matchId
  -> if room + match + gameView exist
     -> header actions visible
  -> else
     -> "Loading match…"
     -> no room button
     -> no exit-to-main button
     -> no state explanation
```

### To-Be Diagram (ASCII)
```text
/matches/:matchId
  -> persistent route header always visible
     -> Back to room
     -> Replay
     -> Exit to lobby
  -> content area changes by state
     -> live match
     -> finished / waiting rematch
     -> spectator / abandoned notice
     -> fallback loading with navigation still present
```

### Deliverables
- keep match header and navigation visible even when `match` or `gameView` is temporarily unavailable
- rename `Leave` to explicit `Exit to lobby`
- add clear state copy for spectator, abandonment, rematch-wait, and sync-transition states
- preserve the existing redirect back to `/rooms/:roomCode` when the room returns to `PREPARE`

### Done Criteria
- user always has a visible way to return to room or exit to main lobby
- fallback/loading state does not strand the user
- post-AFK/post-loss states are explained
- `npm run build` passes

### Out-of-Scope
- governance redesign
- server lifecycle changes
- replay redesign

### Proposed-By
- Codex GPT-5

### plan
- multi-board-game-platform-refactor-v1

### Cautions / Risks
- route behavior must remain generic across all games
- current redirect to `/rooms/:roomCode` on `PREPARE` must not regress

## Extension: Highlight the Most Recently Placed Blokus Piece
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-12
- **Task**: Highlight exactly one most-recently placed Blokus piece on the live board so the next player can immediately see what was just played.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/GameBoard.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/server/index.js`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The live Blokus board currently shows only the board state and the active hover shadow. It does not distinguish the most recent placed piece, which makes it harder for the next player to see what just changed.
- **As-Is Diagram (ASCII)**:
```text
live board
  -> board state only
  -> current hover shadow
  -> no authoritative "last placed piece" payload
```
- **To-Be Diagram (ASCII)**:
```text
platform server
  -> latest piece_placed event
  -> pass lastPlacedPiece into Blokus gameView

live board
  -> render exactly one highlighted latest footprint
  -> next placement replaces previous highlight
```
- **Deliverables**:
  - extend Blokus live `gameView` with `lastPlacedPiece`
  - derive `lastPlacedPiece` from the latest `piece_placed` event
  - include exact placed cells for the highlighted footprint
  - render a visible highlight overlay in `GameBoard.vue`
  - ensure only the most recent placed piece is highlighted at any time
- **Done Criteria**:
  - after a player places a piece, that exact footprint is highlighted
  - when another player places a piece, the highlight moves to the new footprint
  - only one latest piece highlight exists at a time
  - `node --check src/platform/server/index.js` passes
  - `node --check src/games/blokus/server.js` passes
  - `npm run build` passes
- **Out-of-Scope**:
  - replay changes
  - move history panel
  - animation system redesign
  - highlighting all pieces of the last player
- **Proposed-By**: Codex GPT-5
- **plan**: multi-board-game-platform-refactor-v1
- **Cautions / Risks**:
  - highlight must stay readable on all player colors
  - highlight should not be confused with the current hover shadow
  - best implemented from authoritative move event data, not inferred from the current board

## Extension: Floating Spectator Presence Popup
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Convert the room spectator popup from a clipped in-flow dropdown into a true floating overlay that renders above the staging layout.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/views/RoomView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The current spectator popup is implemented like a local dropdown inside clipped containers, so it gets cut off by panel/layout overflow. It should behave like a floating overlay similar to the chat panel.
- **As-Is Diagram (ASCII)**:
```text
spectator button
  -> absolute dropdown below button
  -> ancestor containers use overflow: hidden
  -> popup clipped by room panel/container
```
- **To-Be Diagram (ASCII)**:
```text
spectator button
  -> floating overlay panel
  -> rendered above room layout
  -> not clipped by staging container
  -> behaves like a lightweight popover/chat-style overlay
```
- **Deliverables**:
  - change spectator popup behavior to a true floating overlay
  - avoid clipping by room/panel container overflow
  - keep same spectator content:
    - name
    - status
    - last online
  - preserve compact one-line spectator summary row
- **Done Criteria**:
  - spectator popup is not clipped by the room container
  - popup appears above surrounding layout
  - hover/focus interaction still works
  - `npm run build` passes
- **Out-of-Scope**:
  - changing spectator data
  - chat redesign
  - room layout redesign beyond this popup
- **Proposed-By**: Codex GPT-5
- **plan**: multi-board-game-platform-refactor-v1
- **Cautions / Risks**:
  - hover-only behavior can be brittle if the floating panel is detached too far from the trigger
  - fix should stay local to spectator popup, not weaken all overflow rules globally

## Extension: Room Chat with Messenger-Style Floating Panel
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Add a platform-level world chat on the main lobby route `/` for users with an active profile, using the same Messenger-style floating interaction model as room chat.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/platform/server/index.js`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/store.js`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/views/HomeView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/WorldChatFab.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/components/WorldChatPanel.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The platform now has room-scoped chat, but the main lobby still has no shared communication layer. Profiles should be able to coordinate globally before joining or creating rooms, while anonymous/no-profile users should see no chat UI.
- **As-Is Diagram (ASCII)**:
```text
/ lobby
  -> profiles
  -> game filter
  -> room table
  -> no shared global chat

room routes
  -> room-scoped chat exists
```
- **To-Be Diagram (ASCII)**:
```text
/ lobby
  -> profiles
  -> game filter
  -> room table
  -> world chat available if active profile exists

No active profile
  -> world chat hidden

Active profile
  -> floating world chat button/panel
  -> global lobby thread shared by all profiles
```
- **Deliverables**:
  - add durable global chat storage with a new `world_messages` table
  - add realtime global chat transport:
    - `world:chat:send`
    - `state:world-chat:init`
    - `state:world-chat:message`
  - extend platform store with world chat state:
    - messages
    - open/closed
    - unread count
  - add floating world chat UI on `/`
  - gate world chat by active profile:
    - no active profile -> no world chat UI
    - active profile -> chat visible and usable
  - keep sender avatar as profile initial + profile name
  - reuse current chat visual language where possible
- **Done Criteria**:
  - users with an active profile can send and receive global lobby chat in realtime
  - users without a profile do not see the world chat UI
  - refresh restores recent world chat history
  - unread badge works client-locally
  - `node --check server.js` passes
  - `npm run build` passes
- **Out-of-Scope**:
  - direct messages
  - moderation tools
  - images/files
  - lobby sub-channels by game type
  - merging room chat and world chat into one thread
- **Proposed-By**: Codex GPT-5
- **plan**: multi-board-game-platform-refactor-v1
- **Cautions / Risks**:
  - world chat must stay distinct from room chat in store/events/UI
  - chat should not load or render for anonymous/no-profile users
  - history must be bounded to avoid heavy bootstrap payloads

## Extension: Small-Screen CSS Scale-to-Fit for Room, Match, and Replay
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Add route-level CSS scale-to-fit behavior for room, live match, and replay screens so short laptop viewports keep all critical controls visible without relying on browser zoom.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/views/RoomView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/views/MatchView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/views/MatchReplayView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/composables/useViewportFit.js`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The fixed-viewport shell still breaks on short laptop screens. On `1024x600`, room staging collapses the main table area behind clipped ancestors, and replay/live routes can lose visible controls. The UI needs route-scoped CSS scaling that preserves the desktop structure while fitting inside the current viewport.
- **As-Is Diagram (ASCII)**:
```text
short laptop viewport
  -> fixed-height route shell
  -> route content keeps desktop footprint
  -> some panels collapse or clip
  -> no safe scrollbar path to hidden controls

Result:
  users can lose columns, buttons, or replay controls
```
- **To-Be Diagram (ASCII)**:
```text
short laptop viewport
  -> route viewport measured
  -> route content measured
  -> scale = min(width-fit, height-fit, 1)
  -> content transformed with CSS scale()
  -> internal scroll regions remain for dense sub-panels

Result:
  room/match/replay stay fully reachable without browser zoom
```
- **Deliverables**:
  - append a shared client composable that measures viewport/content and computes route fit scale
  - wrap `RoomView`, `MatchView`, and `MatchReplayView` with route-fit shell/stage/content structure
  - apply CSS custom-property driven scaling with `transform: scale(...)`
  - preserve local scroll areas like staging tables, score strips, and move lists
  - add compact short-height density rules before scale becomes aggressive
- **Done Criteria**:
  - room staging remains visible and usable on `1024x600`
  - match/replay controls remain visible and clickable on short laptop viewports
  - no document-level scrollbar is introduced on desktop routes
  - floating overlays remain outside the scaled content and keep working
  - `npm run build` passes
- **Out-of-Scope**:
  - browser zoom behavior
  - gameplay rule changes
  - server/API changes
  - home/game-lobby route scaling
- **Proposed-By**: Codex GPT-5
- **plan**: multi-board-game-platform-refactor-v1
- **Cautions / Risks**:
  - transform-based scaling must not break click targets or overlay positioning
  - route-fit wrappers must not remove intentional inner scrollbars
  - the scale floor must preserve readability on very short screens

## Extension: Match Navigation Ownership Belongs to Match Controls, Not a Route Header
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Resolve the internal `SOW_0007` conflict around `/matches/:matchId` navigation by removing the duplicate route-local match header and making match navigation belong to the platform-owned `Match controls` block inside the match route itself.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/platform/client/views/MatchView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The top application bar already shows match context. Keeping another route-local match header duplicates title/phase context and incorrectly makes match navigation look like shell navigation. `Back to room` and `Exit to lobby` are still required, but they belong to the match/game route itself and should live in `Match controls`. `Replay` is not a live-player action and should only be offered to finished-match spectators.
- **As-Is Diagram (ASCII)**:
```text
/matches/:matchId
  -> top application bar shows match context
  -> route-local match header repeats:
     game
     title
     room / turn / phase
     Back to room / Replay / Exit to lobby
  -> Match controls block below only holds governance actions

Result:
  duplicated context
  navigation ownership split across 2 blocks
```
- **To-Be Diagram (ASCII)**:
```text
/matches/:matchId
  -> top application bar is the only context header
  -> no route-local match header block
  -> Match controls block owns:
     Back to room
     Exit to lobby
     Surrender / Vote End / Vote Rematch
     Replay only for spectator on FINISHED match
  -> live or fallback content renders below
```
- **Deliverables**:
  - remove the route-local `match-header` block from `MatchView.vue`
  - move `Back to room` and `Exit to lobby` into the `Match controls` action row
  - show `Replay` only when:
    - current member role is `spectator`
    - room phase is `FINISHED`
    - current match id exists
  - keep `Match controls` visible in fallback/terminal states so users are never stranded
  - update spacing so removing the route header does not leave dead vertical space in viewport-fit layouts
- **Done Criteria**:
  - `/matches/:matchId` no longer shows a duplicate match header block below the application bar
  - `Back to room` and `Exit to lobby` are rendered inside `Match controls`
  - live players do not see `Replay` on the live match route
  - finished-match spectators do see `Replay` inside `Match controls`
  - fallback/loading/terminal states still expose match navigation
  - `npm run build` passes
- **Out-of-Scope**:
  - app bar redesign
  - replay route redesign
  - server/API changes
- **Proposed-By**: Codex GPT-5
- **plan**: multi-board-game-platform-refactor-v1
- **Cautions / Risks**:
  - this extension supersedes the earlier ownership assumption that route navigation lives in a persistent route-local header
  - this extension also supersedes the earlier assumption that `Replay` is a general match-route action for all viewers

## Extension: Home Route Should Expand the Rooms Row, Not the Top Lobby Row
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-13
- **Task**: Fix `/` so the top lobby row keeps content height and the `Rooms` row takes the remaining viewport height.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**: The current home-route grid defines only the first row as `1fr`, so `Profiles + Game Type` expand vertically while the `Rooms` panel falls into an implicit auto row and stays short. The intended behavior is the opposite: the top row should size to content and the `Rooms` panel should own the remaining height.
- **As-Is Diagram (ASCII)**:
```text
/ home
  row 1: Profiles + Game Type -> stretches tall
  row 2: Rooms -> content height only

Result:
  top row wastes vertical space
  Rooms table gets too little height
```
- **To-Be Diagram (ASCII)**:
```text
/ home
  row 1: Profiles + Game Type -> auto content height
  row 2: Rooms -> minmax(0, 1fr)

Result:
  top row stays compact
  Rooms panel fills remaining viewport height
```
- **Deliverables**:
  - make `.platform-lobby-view` use `grid-template-rows: auto minmax(0, 1fr)`
  - keep the fix local to `.platform-lobby-view`
  - allow a home-only short-height override on medium laptop widths so `Profiles + Game Type` do not stack into a full-height column on `1024x600`-class viewports
  - preserve existing desktop 2-column top row and current narrow-screen collapse behavior
  - keep `Rooms` as the scrollable fill panel
- **Done Criteria**:
  - on `/`, the top lobby row stays content-height
  - the `Rooms` panel expands to use remaining height
  - on `1024x600`, the `Rooms` panel still remains visible instead of collapsing to zero height
  - inner room-table scrolling still works
  - `npm run build` passes
- **Out-of-Scope**:
  - redesigning the home route content
  - changing inner sizing of `Profiles` vs `Game Type`
  - changing room table behavior beyond height ownership
- **Proposed-By**: Codex GPT-5
- **plan**: multi-board-game-platform-refactor-v1
- **Cautions / Risks**:
  - the fix should not change other routes that currently rely on the shared grouped selector
  - desktop and narrow responsive breakpoints must keep the same structure, with any two-column rescue limited to short-height medium-width laptops

## Extension: Off-Turn Blokus Piece Transforms, Match-Scoped Rack Memory, and Left-Rail Player Cards
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-14
- **Task**: Let live Blokus players rotate/flip their own remaining pieces outside their turn, persist per-piece transforms for the current match, move player status into left-rail cards, and remove the duplicate footer strip.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/LiveView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**:
  - the live rack currently blocks transform controls outside the active turn even though this is harmless local prep work
  - transform state is only in local component refs, so players lose their preferred piece orientation on refresh/reconnect
  - live Blokus duplicates player state between the left scoreboard and the bottom footer strip
  - the chess live view already demonstrates the preferred pattern: player status belongs in the side cards, not in a separate footer block
- **Deliverables**:
  - allow rotate/flip whenever the viewer is the interactive player and the selected piece is still in their remaining rack
  - keep placement turn-gated exactly as before
  - persist per-piece Blokus transform state in match-scoped localStorage keyed by match id and interactive profile id
  - render richer left-rail player cards with rank, color, cells, piece count, and player state/end state
  - remove the live Blokus footer `player-strip` block entirely
  - keep spectator count visible in the left rail instead of the deleted footer
- **Done Criteria**:
  - players can rotate/flip their own pieces before their turn
  - each piece remembers its last local transform during the same match and resets on a new match id
  - the left rail becomes the single source of player status in live Blokus
  - the footer `player-strip` no longer renders
  - `npm run build` passes

## Extension: Stronger Active-Player Highlight, Labeled Topbar Status, and Circular Blokus Turn Order
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-14
- **Task**: Make the current-turn Blokus player card much more obvious, relabel the topbar identity/status cluster, and make Blokus turn order follow circular board order rather than join order.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/App.vue`
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/LiveView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**:
  - the current `To move` highlight is too subtle in the left rail
  - the topbar identity pills are ambiguous without labels
  - Blokus should advance turns around the board in circular color/corner order, not effectively by room join order
- **Deliverables**:
  - strengthen the visual treatment of the active Blokus player card
  - render topbar pills as labeled `User`, `Status`, and `Role`
  - change Blokus match player ordering to follow `chosen_color_index` when a match starts
  - keep the existing circular `turnIndex + 1` progression over that color-ordered player sequence
- **Done Criteria**:
  - the active Blokus player is visually obvious at a glance
  - topbar identity/status pills read with labels instead of bare values
  - Blokus turns follow color/corner order instead of join order
  - `npm run build` passes

## Extension: Compact the Blokus Left-Rail Player Cards
- **Status**: APPROVED
- **Approved-By**: Viet
- **Approved-On**: 2026-03-14
- **Task**: Make the live Blokus left-rail player cards denser and shorter without losing the information moved there from the deleted footer strip.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/games/blokus/LiveView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0007_multi_board_game_platform_refactor.md`
- **Why**:
  - the new player cards still waste vertical space in the left rail
  - the left support rail is narrow and benefits from denser cards that keep the board dominant
- **Deliverables**:
  - compact the player-card layout while preserving rank, color, cells, pieces, and state
  - replace the roomy lower metric boxes with denser metadata presentation
  - keep the stronger active-player highlight intact
- **Done Criteria**:
  - player cards are visibly shorter and denser
  - no player footer strip returns
  - key player information remains readable
  - `npm run build` passes
