# AGENTS.md — Repo Operating Contract

This document defines non-negotiable guardrails for AI agents (Codex).  
Use RFC2119 keywords: **MUST**, **SHOULD**, **MAY**, **NEVER**.

---

## SoW Compliance Guardrail
- Before writing code or editing files, STOP and confirm an approved SoW exists for the task at hand. If not, draft one and obtain approval.
- At each major task switch, re-check that the active SoW still covers the work. If the scope changes, pause and update/seek approval.
- Document the SoW reference (file name or timestamp) when summarizing work so reviewers can trace it quickly.
- This SoW will not apply for debug/testing routine of AI Agent, Agent can freely create reuse-able code inside scripts folder to debug/test its finding.

---

## Coding Standards
- Python 3.10+, four-space indent.
- **MUST** follow SOLID, DRY, KISS principles, but prefer composite over inheritance, this will let project robust
- **MUST** avoid over-engineering, avoid over-verbose, avoid over-abstract.
- **NEVER** use PROTOCOL in this project.
- **NEVER** create `__init__.py` files - use direct imports instead.
- Naming: `snake_case` (func/module), `PascalCase` (class), `UPPER_SNAKE` (constants).
- **MUST** edit with diff-surfacing tools (`apply_patch`, IDE VCS). **NEVER** use script ad-hoc rewrite.
- **Imports/Deps**: Do not guard optional imports; add deps into `pyproject.toml` then `uv sync`.  
- **typing**: when needed, `from typing import *` (team preference).
- **Refactors**: When APIs evolve, update call sites directly. **NEVER** put temporary alias/shim.

---

## Testing Policy
- Preferred stack: `pytest`, `pytest-asyncio`, `ruff`, `uv run ty check`.  
- Place tests under `tests/`.
- **NEVER** auto-run tests; compile/syntax check is sufficient unless instructed.

---

## Version Control & PR Discipline
- After every code update: `git add` + `git commit`. **NEVER** `git push`.  
- Commit message MUST mirror the final summary you deliver to the user for that change. If you summarise multiple bullets, ensure the first line of the commit reflects the primary outcome (e.g. `feat(common): add tcbs watchlist adapter`).
- Agent MUST commit immediately after completing each scoped task using the same summary shared in the final response; defer only when the user explicitly instructs otherwise.
- Commit message (Conventional):  
  - `feat(auto): add OBV-based entry`  
  - `fix(brokers): retry auth on 401`

---

## Risk & Safety Guardrails
- **NEVER** rename or remove public APIs without SoW approval.  
- **NEVER** write outside the workspace.  
- **NEVER** change credentials, CI, or deployment scripts.  
- **NEVER** revert or overwrite user-authored changes without explicit confirmation from the user; always clarify ownership before modifying unexpected diffs.
- Before any destructive change (delete/move), agent MUST present a file-level impact list.


---

## Scope-of-Work (SoW) Template (MUST use before coding)
Agent MUST present below SoW for approval before applying patches:
- **Task**: <one-sentence change>
- **Location**: <exact folder/file paths>
- **Why**: <business/tech driver>
- **As-Is Diagram (ASCII)**: <current behavior/architecture/state machine>
- **To-Be Diagram (ASCII)**: <target behavior/architecture/state machine>
- **Deliverables**: <files added/modified, funcs/classes exported>
- **Done Criteria**: <compiles, style checks pass, demo runnable, etc.>
- **Out-of-Scope**: <what is explicitly excluded>
- **Proposed-By**: <AI Agent Name, e.g., "Claude Opus 4.5", "Codex GPT5.2", "Gemini", etc.>
- **plan**: <plan name if task related to plan under plan_todo>
- **Cautions / Risks**: list down cautions might happen

## Non-Negotiable SoW Compliance
- Must always read code and run experiment to check the conclusion first, before propose SOW.
- For **any request that changes this repo** (bugfix, refactor, feature, upgrade, cleanup), **STOP** and confirm there is an **APPROVED Scope-of-Work (SoW)** for the exact task.
- **Do not write code, edit files, or apply patches** (outside `plan_todo/`) until an approved SoW exists.
- At every major task switch, re-check the active SoW still covers the work. If scope changes, **pause** and draft an updated SoW for approval.
- after finished a SOW, move that SOW into your own agent finished folder (`plan_todo/claude/finished/` or `plan_todo/codex/finished/`)
- If a bug/regression is caused by a previously implemented SoW, agent **MUST** extend that same SoW (append extension section) and **MUST NOT** create a standalone new SoW.

## Where SoW Lives + What Counts as “Approved”

### Folder structure (MUST follow)

```
plan_todo/
  claude/          ← SOWs authored by Claude
    finished/      ← Claude's completed SOWs
  codex/           ← SOWs authored by Codex
    finished/      ← Codex's completed SOWs
  deprecated/      ← SOWs that were cancelled or superseded
  finding/         ← Shared research/investigation docs (not SOWs)
```

- **Every agent MUST create SOWs only inside their own subfolder** (`claude/` or `codex/`).
  This prevents index collisions when both agents work concurrently — each namespace is independent.
- **NEVER** create SOWs directly under `plan_todo/` root.
- SOW numbers are **per-agent** — `claude/sow_072_...` and `codex/sow_072_...` are different files, not duplicates.
- When a SOW is complete, move it to **your own** `finished/` subfolder using `git mv`:
  - Claude: `git mv plan_todo/claude/sow_XXX.md plan_todo/claude/finished/sow_XXX.md`
  - Codex:  `git mv plan_todo/codex/sow_XXX.md plan_todo/codex/finished/sow_XXX.md`
- Research docs (investigations, findings, handoffs) go into `plan_todo/finding/` — shared by all agents.
- **`Proposed-By`** field in every SOW MUST name the authoring agent (e.g. `Claude Sonnet 4.6`, `Codex GPT-5`).

### Approval

- A SoW is considered **approved only** if it contains an explicit approval marker, e.g.:
  - `Status: APPROVED`
  - or `Approved-By: Viet`

- When moving SoW files, **MUST** use `git mv` (no delete+add).

- Hard constraints for execution:
  - **No scope creep.** Only touch files listed in the SoW **Location**.
  - Run the SoW **Done Criteria** (or safe equivalents if paths differ).
  - Capture outputs needed for review (e.g., `git status`, `git diff`, compile/smoke checks).

## Traceability Requirements
- In every work summary, include the SoW reference (filename and/or timestamp) so reviewers can trace quickly.
- If the SoW is missing/ambiguous, STOP and request clarification rather than guessing.

## Anti-Patterns to Avoid

### No Single-Use Wrappers
- **NEVER** create a function that's only called once
- **NEVER** create a function just to "organize" code - inline it instead
- If a function doesn't eliminate repetition, it adds indirection for no benefit

**Bad:**
```python
def create_config(cfg):
    return Config(a=cfg["a"], b=cfg["b"])

def main():
    config = create_config(cfg)  # Pointless indirection
```

**Good:**
```python
def main():
    config = Config(a=cfg["a"], b=cfg["b"])  # Just do it inline
```

### The 2+ Rule
- Only extract a function when the same code appears **2+ times**
- "I might need this later" is **not** a valid reason to create abstraction

### No "Slim Wrappers"
- **NEVER** wrap a class/function just to rename parameters
- **NEVER** wrap just to provide "defaults" - use the original with explicit values
- If your function body is just `return SomeClass(...)`, delete the function

### Abstraction Must Earn Its Place
Every abstraction has a cost (indirection, more code to read/maintain). It **MUST** provide at least one of:
1. Eliminating duplication (DRY) - used 2+ times
2. Hiding genuine complexity - not just moving code around
3. Enabling testability/mocking - actual test requirement

A function that just passes arguments through provides none of these benefits.
