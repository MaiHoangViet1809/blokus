# SOW_0002 Cursor-Locked Preview Alignment

- Status: APPROVED
- Approved-By: Viet
- Approved-On: 2026-03-06
- Proposed-On: 2026-03-06

- **Task**: Fix in-turn hover-preview and click placement alignment so the selected piece stays exactly under the mouse point across the full board, including edges.
- **Location**:
  - `/Users/maihoangviet/Projects/blokus/public/client.js`
  - `/Users/maihoangviet/Projects/blokus/plan_todo/codex/SOW_0002_cursor_locked_preview_alignment.md`
- **Why**:
  - Current in-turn behavior is select-piece, move cursor on board, preview follows cursor, then click-to-place.
  - In that hover-preview flow, pointer-to-piece alignment drifts near edges.
  - This causes user-visible inaccuracy and mis-trust in placement before click.

- **Investigation Summary (Root Cause)**:
  - Current preview uses center-offset anchoring (`getCenterOffset`) to compute `anchorX/anchorY`, then clips out-of-bounds cells during draw.
  - Near board edges, clipping removes asymmetric cells, so the visible piece mass shifts away from cursor and appears to "drift."
  - Mouse-to-grid conversion is not clamped, adding minor boundary jumps at extreme right/bottom pixels.
  - Historical `init push` behavior anchored preview directly from `hoverCell` (top-left model), avoiding this growing edge drift perception.

- **As-Is Diagram (ASCII)**:
```text
Mouse -> hoverCell
      -> center-offset anchor (anchor = hover - center)
      -> draw in-bounds cells only
      -> near edges: asymmetric clipping
      -> visible preview appears farther from mouse
```

- **To-Be Diagram (ASCII)**:
```text
Mouse -> clamped hoverCell (0..19)
      -> deterministic cursor-locked anchor model
         (same model used by hover preview + click placement)
      -> draw preview using that exact anchor
      -> cursor-to-piece lock remains stable at center and edges
```

- **Deliverables**:
  - `public/client.js` updates to unify and lock anchor math for:
    - hover preview rendering,
    - local legality checks,
    - click placement payload.
  - Remove/replace center-offset behavior that causes drift.
  - Clamp hover coordinate conversion at board boundaries.

- **Done Criteria**:
  - `node --check public/client.js` passes.
  - Manual smoke validation:
    - select long and asymmetric pieces (e.g., `pentomino_I`, `pentomino_F`);
    - move cursor to all four edges/corners;
    - observed preview remains cursor-locked (no increasing gap);
    - click placement lands exactly where preview indicates.
  - No regression to turn gating, orientation rotation/flip, legality coloring, or basic piece selection flow.

- **Out-of-Scope**:
  - Server rule changes or network protocol changes.
  - Rack redesign or theme/UI styling changes.
  - Endgame/turn-system enhancements.

- **Proposed-By**: Codex GPT-5
- **plan**: cursor-lock-preview-alignment-v1
- **Cautions / Risks**:
  - Changing anchor semantics may alter user expectation for where the piece pivots during rotate/flip.
  - Must keep preview and emitted move coordinates perfectly consistent to avoid "looks valid but rejected" desync.
  - Must avoid reintroducing hold-drag assumptions into a flow that currently behaves as select-preview-click.
