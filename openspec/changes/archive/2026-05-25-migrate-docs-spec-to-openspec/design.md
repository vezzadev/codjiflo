## Context

CodjiFlo's "what & why" documentation lives across three folder conventions accumulated over seven milestones:

- `spec/functional/` — 12 declarative product specs (the canonical "what")
- `spec/stories/milestone-*.md` — 9 milestone roadmaps (what we shipped, with overlap into "what")
- `spec/test/` — 3 test matrices (acceptance criteria expressed as test cases)
- `spec/demo/` — demo materials
- `docs/ARCHITECTURE.md` — implementation architecture (auth, iteration storage, diff pipeline)
- `docs/plans/` — ad-hoc implementation plan documents (2 files for S-4.2.1)

OpenSpec is already installed at `openspec/` with the `spec-driven` schema selected in `openspec/config.yaml`, but `openspec/specs/` is empty. Each new `/opsx:propose` runs against an empty baseline, so new changes can never reference existing capability specs — there are none.

Current per-file inbound link graph: 9 milestone stories link to functional specs ~30 times, `AGENTS.md` links to `spec/functional/iterations.md` and `docs/ARCHITECTURE.md`, and the milestone stories link to each other. We need to keep the link graph correct after the move (within archives, links remain archive-internal; from-archive-to-live-spec links re-target to `openspec/specs/`).

Stakeholders: agents (primary consumer of the spec tree), Pedro (sole maintainer), future contributors discovering the project.

## Goals / Non-Goals

**Goals:**
- One canonical home (`openspec/specs/`) for declarative product behaviour.
- Preserve every normative rule from `spec/functional/` — nothing is lost, only reformatted.
- Keep `git mv` history intact so blame survives.
- Make `openspec list --specs` produce a useful capability inventory.
- Populate `openspec/project.md` so future `/opsx:propose` runs inherit project conventions automatically.
- Archive (not delete) historical artifacts so the milestone narrative remains reachable.

**Non-Goals:**
- No production code changes. Zero impact on `src/`, `e2e/`, build, runtime, or tests.
- No new product behaviour. This is purely a documentation reorganisation.
- Not rewriting the architecture document — `docs/ARCHITECTURE.md` is moved as-is to `openspec/project.md` with minimal edits (front-matter, link fixups).
- Not creating per-file delta specs for each future change. Live specs in `openspec/specs/` will be edited directly by future `/opsx:apply` runs that archive deltas.
- Not migrating `spec/test/` content into the OpenSpec spec format. Test matrices are not first-class OpenSpec artifacts; they relocate to `openspec/test-matrices/` and stay in their original form.

## Decisions

### Decision 1: Nine capability specs, one per functional concern

**What:** Create exactly nine capabilities — `diff-viewing`, `comments`, `iterations`, `review-lifecycle`, `realtime-updates`, `unauthenticated-access`, `backend-abstraction`, `ui-shell`, `data-models`.

**Why:** Mirrors the existing `spec/functional/` file boundaries 1:1 (with the four `iterations*.md` files consolidated). Keeps the migration mechanical and reviewable. Each capability is independently testable and has natural ownership.

**Alternative considered:** Split `iterations` into `iterations-stateful` and `iterations-stateless` (mirroring source). Rejected: the two modes share ~849 lines of `iterations-common` content, and OpenSpec capabilities are best organised by what-the-user-perceives ("iterations work") rather than what-the-platform-supports ("we have two modes"). Mode selection is itself a requirement within `iterations`.

**Alternative considered:** Merge `data-models` into the consuming capabilities. Rejected: the TypeScript types are referenced from 6+ specs; duplicating would drift.

### Decision 2: Promote `docs/ARCHITECTURE.md` to `openspec/project.md`

**What:** Move `docs/ARCHITECTURE.md` → `openspec/project.md` and surface its content via the existing `openspec/config.yaml` `context:` mechanism (or directly read by tooling — `openspec/project.md` is the conventional location).

**Why:** OpenSpec is designed to inject project context into every artifact-generation run. Today, `config.yaml` has an empty `context:` block and `ARCHITECTURE.md` sits unreferenced. Co-locating them means future `/opsx:propose` runs get architecture context for free.

**Alternative considered:** Keep `docs/ARCHITECTURE.md` and reference from `config.yaml`. Rejected: split-brain location. Authors will keep adding to `docs/` and `openspec/` will drift.

### Decision 3: Archive milestone stories and implementation plans under `openspec/archive/legacy/`

**What:** Move `spec/stories/milestone-*.md` and `docs/plans/*.md` into `openspec/archive/legacy/` preserving filenames. Do not migrate them as OpenSpec changes.

**Why:**
- They describe work that is **already shipped**. OpenSpec changes are for proposed/in-flight work; archived changes track "how we got here." Treating shipped milestones as OpenSpec changes would create 9 phantom "completed changes" with no real implementation deltas to record.
- The narrative value (what shipped in M1 vs M4.2 and why) is historical interest, best served by a flat archive folder.
- `openspec/archive/` already exists (sibling of `openspec/changes/`) — the convention is in place.

**Alternative considered:** Reverse-engineer each milestone into a synthetic OpenSpec change in `openspec/changes/archive/`. Rejected: high cost, low value, dilutes the change history with retrofitted entries.

### Decision 4: Relocate test matrices to `openspec/test-matrices/` unchanged

**What:** `spec/test/*.md` → `openspec/test-matrices/*.md`. Keep the content verbatim.

**Why:** Test matrices are acceptance-criteria-as-tests. They're useful but they're not the same artifact as a capability spec, and OpenSpec's `spec-driven` schema has no first-class slot for them. Co-locating with `openspec/` keeps them discoverable; keeping them out of `openspec/specs/` prevents confusion about what's a "live spec."

**Alternative considered:** Inline test matrices into the relevant capability specs as scenarios. Rejected: test matrices are exhaustive (e.g., `azure-devops-test-matrix.md` is 858 lines of dense rows). Inlining would 3-5x the size of every capability spec and obscure the requirements.

### Decision 5: Use `git mv` for every move

**What:** Every relocation uses `git mv <old> <new>` rather than create-new + delete-old.

**Why:** Preserves `git blame` and `git log --follow`. The functional specs have meaningful history (multiple authors, many edits) that we want to keep walkable.

**Trade-off:** `git mv` followed by content rewrite produces a "rename + modify" commit that's harder to review than a pure rename. Mitigation: per-file, do `git mv` first, commit, then in a separate commit do the OpenSpec-format rewrite.

### Decision 6: Rewrite source files into OpenSpec format rather than embed verbatim

**What:** Each capability spec is rewritten from prose into the OpenSpec `Requirement` + `Scenario` shape (SHALL/MUST language, WHEN/THEN scenarios). Source content is preserved in substance but not in form.

**Why:** OpenSpec's value depends on the structure. Tools (`openspec validate`, `openspec show`, change deltas) only work on the canonical format. Verbatim embedding would give us a folder of differently-shaped docs that happen to live in `openspec/specs/`.

**Alternative considered:** Embed as-is in the first pass, format later. Rejected: "later" never comes, and the change becomes invisible (no requirement count, no delta tracking).

**Trade-off:** Rewriting risks dropping nuance. Mitigation: the dispatched per-capability drafting agents are explicitly told to preserve every rule and to report any intentionally-dropped content for review.

## Risks / Trade-offs

- **Risk:** A rewritten capability spec loses a nuance from the source that a downstream agent relied on. **Mitigation:** The legacy file remains accessible via `git log` (and during the change, via the unmoved `spec/functional/` folder until the final cleanup commit). Each draft agent reports dropped content; spot-check before archival.

- **Risk:** Cross-references inside surviving files (`AGENTS.md`, `README.md`, the milestone archives) break. **Mitigation:** A dedicated link-rewrite task in `tasks.md` does a repo-wide grep for `spec/functional/`, `spec/stories/`, `docs/ARCHITECTURE.md`, `docs/plans/` and updates each hit.

- **Risk:** Format violations (3 vs 4 hashes for `Scenario`) silently fail OpenSpec validation, leaving requirements without scenarios. **Mitigation:** Run `openspec validate migrate-docs-spec-to-openspec` after writing each spec; tasks include this as an explicit step.

- **Risk:** The four-into-one consolidation of `iterations*.md` loses the stateful-vs-stateless contrast. **Mitigation:** Use requirement names prefixed by mode (`Stateful Mode — …`, `Stateless Mode — …`, `Mode Selection — …`) so the contrast survives.

- **Trade-off:** Once `docs/` and `spec/` are deleted, agents with stale instructions (cached `CLAUDE.md` content, in-flight conversations) will hit dead links for a session. Acceptable — the new `AGENTS.md` will point at `openspec/`.

## Migration Plan

1. Draft all nine capability specs inside `openspec/changes/migrate-docs-spec-to-openspec/specs/` (this change directory). They sit in the change for review.
2. Validate the change: `openspec validate migrate-docs-spec-to-openspec --strict`.
3. Execute the file moves (`git mv` for archives, `git mv` for `docs/ARCHITECTURE.md` → `openspec/project.md`, relocate test matrices).
4. Rewrite cross-references in `AGENTS.md`, root `README.md` (if any), and `.github/` configs.
5. Delete the now-empty `docs/` and `spec/` directories.
6. Run `openspec archive migrate-docs-spec-to-openspec`. This moves the drafted specs from `changes/migrate-docs-spec-to-openspec/specs/` into `openspec/specs/` as the live capability tree.
7. Verify: `openspec list --specs` shows 9 capabilities; `openspec validate --strict` is clean; sample `openspec show diff-viewing` renders.

**Rollback:** All changes are git-tracked. `git revert <merge-commit>` restores `docs/` and `spec/` and removes `openspec/specs/`. No data loss risk.

## Open Questions

- Should the milestone archive get a one-line `INDEX.md` summarising each milestone with ship-date and one-sentence outcome? — Default: yes, add to `tasks.md` as a small step. Cheap and aids discoverability.
- Should `spec/demo/s-4.2.1/` content (demo materials for the stateless-iteration feature) be archived under `openspec/archive/legacy/demo/` or moved to a new `demo/` top-level folder? — Default: archive under `legacy/demo/` for consistency. Demos are bound to a moment in time.
- Future capability for the GitHub Action producer (`codjiflo/action`)? It's a separate repo today; if/when it lands in this monorepo, a tenth capability `iteration-capture-action` would be appropriate. Out of scope for this migration.
