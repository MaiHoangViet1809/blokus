# SOW_0004 Match Replay and Leaderboard

- Status: APPROVED
- Approved-By: Viet
- Approved-On: 2026-03-06

- **Task**: Extend the durable match system to support completed-match replay, persisted historical viewing, richer endgame results, and a leaderboard for top winners.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/src/stores/app.js`
  - `/Users/maihoangviet/Projects/blokus/src/views/HomeView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/views/RoomView.vue`
  - `/Users/maihoangviet/Projects/blokus/src/components/`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0004_match_replay_and_leaderboard.md`
- **Why**: Expose durable completed matches for later review, make persisted move history usable through replay, and add a leaderboard so long-term winners are visible.
- **As-Is Diagram (ASCII)**:
```text
Room -> active match -> finish
     -> latest match snapshot only
     -> no replay timeline UI
     -> no historical match browser
     -> no leaderboard aggregation
```
- **To-Be Diagram (ASCII)**:
```text
Room -> active match -> finish
     -> durable move history kept
     -> replayable finished match timeline
     -> room can open past match details
     -> home shows leaderboard
     -> leaderboard aggregates wins and match stats
```
- **Deliverables**:
  - Durable finished-match retrieval API for replay/history.
  - Replay snapshot derived from persisted `moves` and match metadata.
  - Vue UI to browse a room's finished matches and step through replay state.
  - Leaderboard API and home-screen leaderboard module.
  - Stable winner/result metadata persisted for ranking.
- **Done Criteria**:
  - A finished match can be reopened later and replayed move-by-move from persisted data.
  - Replay still works after server restart.
  - Home screen shows leaderboard ordered by winner performance.
  - Finished matches retain winner, participants, finish time, and terminal state metadata.
  - `node --check server.js` passes.
  - `npm run build` passes.
- **Out-of-Scope**:
  - Full auth/account system.
  - Match sharing/export outside the app.
  - Advanced analytics beyond replay/history/leaderboard.
- **Proposed-By**: Codex GPT-5
- **plan**: match-replay-leaderboard-v1
- **Cautions / Risks**:
  - Replay reconstruction must be deterministic from persisted move events.
  - Leaderboard sort rules must be explicit and stable.
  - History payloads must stay compact enough for the Vue client.
