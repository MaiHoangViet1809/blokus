## SOW_0008 Replace `better-sqlite3` with `node:sqlite`

- **Status**: APPROVED
- **Approved-By**: Viet

### Summary
- **Task**: Replace the native `better-sqlite3` dependency with Node's built-in `node:sqlite` so installs work in Windows/corporate proxy environments without prebuilt-binary or `node-gyp` failures.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/package.json`
  - `/Users/maihoangviet/Projects/blokus/package-lock.json`
  - `/Users/maihoangviet/Projects/blokus/server.js`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0008_replace_better_sqlite3_with_node_sqlite.md`
- **Why**: `better-sqlite3` is a native addon. In Windows company-network environments it can fail on both prebuilt binary download and local `node-gyp` fallback. `node:sqlite` is built into Node and avoids npm native install friction while preserving local SQLite file storage and a synchronous usage model close to the current server code.

### As-Is Diagram (ASCII)
```text
npm install
  -> better-sqlite3 install
     -> prebuild-install
        -> corporate proxy / 407
        -> fail
     -> node-gyp rebuild
        -> headers / toolchain / proxy pain
        -> fail

server.js
  -> direct better-sqlite3 usage
  -> sync statements
  -> sqlite file on disk
```

### To-Be Diagram (ASCII)
```text
npm install
  -> no native sqlite addon install
  -> node:sqlite comes from Node runtime

server.js
  -> node:sqlite DatabaseSync
  -> same sqlite file on disk
  -> same schema / migrations / statements
  -> no prebuild-install / no node-gyp for sqlite
```

### Deliverables
- Remove `better-sqlite3` from `/Users/maihoangviet/Projects/blokus/package.json`.
- Update `/Users/maihoangviet/Projects/blokus/package-lock.json` to match the dependency change.
- Migrate DB initialization and prepared statement calls in `/Users/maihoangviet/Projects/blokus/server.js` to `node:sqlite`.
- Document the required Node baseline in `package.json` engines metadata.

### Done Criteria
- Repo no longer depends on `better-sqlite3`.
- Server boots using `node:sqlite`.
- Existing schema creation and migration path still runs.
- `node --check server.js` passes.
- `npm run build` passes.

### Out-of-Scope
- Changing database engine away from SQLite.
- Moving to a remote DB server.
- Large persistence redesign.
- Rewriting room or match data models.

### Proposed-By
- Codex GPT-5

### plan
- platform-sqlite-runtime-simplification-v1

### Cautions / Risks
- `node:sqlite` requires a supported Node version; older Node installs will stop working.
- `node:sqlite` is still marked experimental by Node, so runtime may emit warnings unless handled externally.
- This touches core persistence code, so statement result shapes must stay compatible.
