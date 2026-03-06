# SOW_0003 Durable Lobby/Session Rewrite with Vue 3

- Status: APPROVED
- Approved-By: Viet
- Approved-On: 2026-03-06

- **Task**: Rewrite the project into a Vue 3 + Vite SPA backed by the existing Node/Express server, with durable lobby, room, session, and match state stored in SQLite.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/package.json`
  - `/Users/maihoangviet/Projects/blokus/package-lock.json`
  - `/Users/maihoangviet/Projects/blokus/index.html`
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/vite.config.js`
  - `/Users/maihoangviet/Projects/blokus/src/`
  - `/Users/maihoangviet/Projects/blokus/public/`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0003_durable_lobby_session_rewrite_vue3.md`
- **Why**: Replace the current socket-bound, in-memory lobby/session/game implementation with a durable, server-authoritative architecture and a maintainable Vue frontend.
- **As-Is Diagram (ASCII)**:
```text
Browser -> static public/index.html + client.js
        -> Socket.IO events only
        -> localStorage name/room/token hints

Express/Socket.IO server
  -> in-memory sessions Map
  -> in-memory rooms Map
  -> room.started boolean
  -> no durable lobby/session/match store
```
- **To-Be Diagram (ASCII)**:
```text
Vue 3 + Vite SPA
  -> REST bootstrap/resource reads
  -> Socket.IO realtime commands/state
  -> durable client session token

Express server
  -> profile/session service
  -> room/lobby service
  -> match/game service
  -> SQLite authoritative persistence
```
- **Deliverables**:
  - Vue 3 + Vite SPA with Vue Router and Pinia for profile, lobby, room, and match flows.
  - SQLite-backed durable models for profiles, sessions, rooms, room members, matches, match players, and moves.
  - REST endpoints for bootstrap/resource reads.
  - Socket.IO event model for realtime room and match updates.
  - Removal/replacement of the legacy static one-page client flow.
- **Done Criteria**:
  - Server boots locally.
  - Vite frontend builds locally.
  - Session restore works across refresh.
  - Public room list, room join, ready/start, match play, pass, finish, and rematch work from durable snapshots.
  - `node --check server.js` passes.
  - `npm run build` passes.
- **Out-of-Scope**:
  - Full user authentication/accounts.
  - Multi-server deployment support.
  - Migration of existing in-memory rooms or live sessions.
- **Proposed-By**: Codex GPT-5
- **plan**: durable-lobby-session-rewrite-vue3-v1
- **Cautions / Risks**:
  - This is a broad rewrite touching frontend architecture and backend state model at once.
  - Existing uncommitted edits in legacy static assets must not be destructively reverted outside the rewrite scope.
  - SQLite schema and realtime event shapes must stay aligned to avoid client/server drift.

## Extension 2026-03-06: Viewport-Fit SPA Layout Regression

- **Status**: APPROVED
- **Approved-By**: Viet
- **Task**: Refit the Vue SPA so the UI always stays inside the current viewport with no page-level vertical scroll, using route-level tabs plus bounded internal scroll regions.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/App.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
  - `/Users/maihoangviet/Projects/blokus/src/views/HomeView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/views/RoomView.vue`
- **Why**: The SOW_0003 rewrite currently stacks full-height sections in document flow, which causes the home route to overflow vertically and breaks the fixed-screen product requirement.
- **As-Is Diagram (ASCII)**:
```text
Viewport
  -> top bar
  -> stacked route sections
  -> document grows taller than screen
  -> browser page scroll
```
- **To-Be Diagram (ASCII)**:
```text
Viewport
  -> fixed app shell (no body/document scroll)
  -> route dashboard fills remaining height
  -> route tabs switch major sections
  -> only bounded lists/panels scroll internally
```
- **Deliverables**:
  - Fixed-height SPA shell in `App.vue`/`style.css`.
  - Home dashboard with `Lobby` and `Stats` modes.
  - Room dashboard with `Room`, `History`, and `Replay` side-panel modes.
  - Internal scroll regions for public rooms, leaderboard, recent matches, history, and replay details.
- **Done Criteria**:
  - No body/document vertical scrollbar on desktop and narrow mobile viewport checks.
  - Home route keeps profile and room actions inside a fixed dashboard.
  - Room route keeps header, board, piece rack, player status, and footer guidance inside the viewport in room mode.
  - `npm run build` passes.
- **Out-of-Scope**:
  - Backend/session changes.
  - Gameplay rule changes.
  - Legacy `public/` layout cleanup.

## Extension 2026-03-06: Home Button Hit-Target Regression

- **Status**: APPROVED
- **Approved-By**: Viet
- **Task**: Fix the home dashboard overlap that blocks button clicks, and move the `Profiles` section into a dedicated setup tab.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/views/HomeView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
- **Why**: The viewport-fit layout compressed the left setup column into overlapping subsections, causing `Profiles` and room-action buttons to become partially unclickable.
- **As-Is Diagram (ASCII)**:
```text
Home / Lobby
  -> fixed setup column
  -> 3 forced stacked subsections
  -> overlap between Profiles and Join by Code
  -> click interception on buttons
```
- **To-Be Diagram (ASCII)**:
```text
Home / Lobby
  -> fixed setup column
  -> one setup panel
  -> tabs: Create Room / Join by Code / Profiles
  -> no overlap
  -> clear click targets for all home actions
```
- **Deliverables**:
  - Tabbed setup panel on the home route.
  - Non-overlapping layout for create/join/profile actions.
  - Verified home interactions for profile create/select, room create, join-by-code, room refresh, and room join/watch buttons.
- **Done Criteria**:
  - `Create` in `Profiles` is clickable.
  - `Create room` works after profile activation.
  - Home action buttons no longer have intercepted hit targets.
  - `npm run build` passes.
  - Browser smoke check passes without page overflow regressions.
- **Out-of-Scope**:
  - Room route layout changes.
  - Backend/session behavior changes.

## Extension 2026-03-06: In-Game Board-First Layout Correction

- **Status**: APPROVED
- **Approved-By**: Viet
- **Task**: Rework the `IN_GAME` room layout so the board is the dominant visual area, non-game panels no longer permanently consume a desktop column during live play, and the active match view fits the viewport while using available width more effectively.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/src/views/RoomView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/components/GameBoard.vue`
  - `/Users/maihoangviet/Projects/blokus/src/style.css`
- **Why**: The current room layout still behaves like a room-management dashboard during active play. The board is constrained by multiple width caps, while room/history/replay navigation and a persistent side panel continue to consume width during `IN_GAME`. This makes the board too small and reduces usability.
- **As-Is Diagram (ASCII)**:
```text
IN_GAME route
  -> shell width capped
  -> two-column workspace always active
     -> left: gameplay
     -> right: room details / players / spectators / actions
  -> board area also split again:
     -> board
     -> fixed rack column
  -> board canvas capped by dvh width rule
  -> result: board is visually too small
```
- **To-Be Diagram (ASCII)**:
```text
IN_GAME route
  -> board-first workspace
  -> primary width goes to board + piece controls
  -> non-game panels move behind phase-aware tabs/drawer/pane switching
  -> room/history/replay controls remain accessible but do not permanently cost gameplay width
  -> board scales to available viewport space first
```
- **Deliverables**:
  - Phase-aware room layout in `RoomView.vue`.
  - Board/rack layout adjustment in `GameBoard.vue` and `style.css`.
  - CSS correction so active-match rooms use available viewport width more efficiently without reintroducing page scroll.
- **Done Criteria**:
  - In `IN_GAME`, the board is visibly larger than the current implementation on desktop-width screens.
  - `Room Details / Players / Spectators / Actions` do not permanently occupy a full side column during active play unless explicitly opened by the user.
  - `Room / History / Replay` navigation is phase-aware and does not reduce gameplay width by default during live play.
  - The room route still fits within the viewport with no page-level vertical or horizontal scroll.
  - `npm run build` passes.
  - Browser verification confirms the larger board footprint, usable gameplay controls, and reachable replay/history flows.
- **Out-of-Scope**:
  - Backend/session logic.
  - Blokus rule changes.
  - Replay data/model changes.
  - Home route layout changes.
