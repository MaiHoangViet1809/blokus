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
