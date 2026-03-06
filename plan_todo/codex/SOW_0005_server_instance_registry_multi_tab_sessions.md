# SOW_0005 Server Instance Registry for Multi-Tab Durable Sessions

- Status: APPROVED
- Approved-By: Viet
- Approved-On: 2026-03-06

- **Task**: Replace the shared-browser session model with a server-side browser/container and tab-instance registry so each tab can act as an independent player session while surviving refresh.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/stores/app.js`
  - `/Users/maihoangviet/Projects/blokus/src/views/HomeView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/views/RoomView.vue`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0005_server_instance_registry_multi_tab_sessions.md`
- **Why**: The current localStorage/session-token model collides across tabs, breaks two-player same-browser testing, and leaves realtime auth stale after profile changes.
- **As-Is Diagram (ASCII)**:
```text
browser localStorage
  -> shared device/session tokens
  -> all tabs reuse same identity

server session
  -> profile + room bound to shared browser token
  -> socket created before/after profile changes can go stale
```
- **To-Be Diagram (ASCII)**:
```text
browser cookie
  -> stable browser container identity

sessionStorage per tab
  -> client_instance_id

server
  -> browser container
  -> client instance
  -> active session bound to that client instance
  -> room/match authority derived from the active instance/profile

URL
  -> roomCode, matchId, pane, setup
  -> no private auth/session secrets
```
- **Deliverables**:
  - Browser-container and client-instance registry on the server.
  - Instance-bound session resolution for REST bootstrap and Socket.IO auth.
  - Per-tab `client_instance_id` client storage in `sessionStorage`.
  - Query-driven home setup pane and room pane state.
  - Fixed realtime command flow for create/join/watch after profile selection.
- **Done Criteria**:
  - Two fresh tabs in the same browser can select different profiles independently.
  - Refresh restores the same tab instance, active profile, room, and replay pane.
  - `Create room`, `Join by Code`, `Join seat`, and `Watch` work without stale socket timeouts.
  - No session/auth secret is added to the URL.
  - `npm run build` passes.
- **Out-of-Scope**:
  - Full account/auth product redesign.
  - Cross-device account sync.
  - Legacy static `public/` cleanup.
- **Proposed-By**: Codex GPT-5
- **plan**: server-instance-registry-multitab-v1
- **Cautions / Risks**:
  - Existing profiles are tied to the old browser token model and must remain reachable after migration.
  - Realtime and REST auth must agree on the same client instance or room commands will drift.
  - Query-state sync must not leak private identity into shared links.
