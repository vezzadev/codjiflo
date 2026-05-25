## Context

`docs/ARCHITECTURE.md` was the project's living architecture document before the team adopted OpenSpec. It has grown to 282 lines and four top-level concerns (auth, E2E testing, iteration storage, diff pipeline), each documented in a free-form mix of prose, key-file tables, environment-variable tables, ASCII diagrams, and CI guidance. The same kinds of statements appear in multiple places — `AGENTS.md` §1.5–§1.7 partially duplicate ARCHITECTURE.md, and parts of the iteration-storage section overlap with `spec/functional/iterations.md`.

`docs/plans/` contains two files (`2026-02-17-s-4.2.1-commit-based-iteration-loader.md` and the matching `-design.md`) that were historical implementation plans for Milestone 4.2.1. They are written in the older "plan + design doc" style that predates OpenSpec change directories. They overlap with what the new `iteration-storage` capability spec describes.

`openspec/specs/` is empty and `openspec/changes/` only contains an `archive/` directory. This change introduces the project's first set of capability specs and demonstrates the OpenSpec workflow end-to-end.

## Goals / Non-Goals

**Goals:**
- Replace the free-form ARCHITECTURE.md with four normative, scenario-bearing capability specs (`auth`, `e2e-testing`, `iteration-storage`, `diff-pipeline`) discoverable via `openspec spec list`.
- Preserve every concrete fact in ARCHITECTURE.md (file paths, env vars, GitHub App permissions, cookie TTLs, SQL schema, pipeline stage table) — none of it is lost; non-normative details live under an `## Implementation Notes` appendix per spec.
- Reduce duplication between `AGENTS.md` and the architecture documentation by linking AGENTS.md to the new specs instead of inlining the same prose.
- Move the historical `docs/plans/*.md` files into `openspec/changes/archive/` so the project's change history is consolidated under `openspec/`.
- Leave the source tree free of a now-redundant `docs/` directory (or shrink it to only what doesn't belong elsewhere).

**Non-Goals:**
- Not changing any application code. This is a documentation-only change.
- Not authoring specs for capabilities that ARCHITECTURE.md does not currently cover (e.g., comments engine, real-time, browser extension). Those will be created when their respective milestones are tackled.
- Not introducing new content. The spec rewrite is a faithful migration; new requirements would be a separate change.
- Not modifying `spec/functional/iterations.md` or `spec/stories/*` — those documents have their own lifecycle.

## Decisions

### Decision 1: One capability per top-level ARCHITECTURE section

ARCHITECTURE.md has four `##`-level sections: Authentication, E2E Testing, Iteration Storage, Diff Pipeline Architecture. Each becomes one capability:

- `auth`
- `e2e-testing`
- `iteration-storage`
- `diff-pipeline`

**Alternative considered:** A single `core-architecture` capability with all four as sub-sections. Rejected — OpenSpec capabilities are intended to be the unit of independent evolution, and these four concerns evolve on independent cadences (e.g., auth permissions change when GitHub App scopes change; e2e test rules change when ESLint rules change). Bundling them would force every future delta to touch the same spec file.

**Alternative considered:** Finer split (e.g., `auth-oauth`, `auth-cookies`, `auth-permissions`). Rejected — the cookie strategy, OAuth flow, and permissions list are tightly coupled (changing one usually requires reasoning about the others), and the resulting specs would be too small to carry useful scenario coverage.

### Decision 2: Preserve non-normative content as `## Implementation Notes`

OpenSpec specs are normative ("the system SHALL …"). ARCHITECTURE.md contains a lot of valuable but non-normative material: exact file paths, env var tables, GitHub App setup checklists, backup values, external repository pointers. Demoting this to an `## Implementation Notes` appendix per spec keeps the spec body crisp while ensuring no fact is lost in the migration.

**Alternative considered:** Move implementation notes into separate README files alongside the code (e.g., `src/features/auth/README.md`). Rejected for this change — it expands scope and asks reviewers to validate two new places of truth instead of one. Can be done as a follow-up.

### Decision 3: Convert each ARCHITECTURE bullet into SHALL + Scenario

Every statement of the form "X happens" in ARCHITECTURE.md is rewritten as a `### Requirement: …` (SHALL/MUST) followed by one or more `#### Scenario:` blocks (WHEN/THEN). The OpenSpec instruction for the `specs` artifact is explicit that scenarios must use four hashtags exactly; the change followed that rule.

Where ARCHITECTURE.md was silent on edge cases that are nonetheless invariant (e.g., "what happens if `oauth_state` mismatches"), I added scenarios derived from common-sense correctness rather than inventing new requirements. Each such scenario corresponds to behaviour the code already enforces.

### Decision 4: Archive `docs/plans/` rather than convert to OpenSpec changes

The two files in `docs/plans/` are completed work (Milestone 4.2.1) and read like implementation plans, not living specs. Converting them retroactively into OpenSpec change directories with proposal/design/tasks would be archaeology with low value. Moving them under `openspec/changes/archive/` (the existing archive convention) preserves history without pretending they were OpenSpec-shaped from the start.

**Alternative considered:** Delete them. Rejected — the design doc has useful rationale for the stateless-mode loader that would be lost.

**Alternative considered:** Convert them into delta specs under `iteration-storage`. Rejected — they describe how a feature was built, not what the system must do. The resulting "requirements" would be implementation accidents.

### Decision 5: Update AGENTS.md links, but do not move its content

AGENTS.md §1.5 (Authentication), §1.6 (Iteration Storage), §1.7 (Diff Pipeline) currently link into `docs/ARCHITECTURE.md`. Those links are retargeted to the new spec paths. The inline summary block in §1.6 is left in place (it's a 10-line elevator pitch useful to agents reading AGENTS.md cold), with the trailing "full architecture" link pointed at `openspec/specs/iteration-storage/spec.md` instead of `spec/functional/iterations.md`.

AGENTS.md is not itself migrated into a spec — it is project-instructions-for-agents, not a system specification.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| External references (issues, PRs, Slack messages) pointing at `docs/ARCHITECTURE.md#anchor` will break. | Leave a tombstone `docs/ARCHITECTURE.md` containing only links to the four new specs for one release cycle, then delete in a follow-up change. |
| The `## Implementation Notes` appendix dilutes the "specs are normative" rule. | Section is clearly headed and visually separated; specs above it stand on their own. Easier to police than scattering the same info across READMEs. |
| Future contributors may not know the four-capability split and add a fifth concern (e.g., comments) into one of the existing specs. | The proposal's "Capabilities" section is the contract — the next proposal that needs a new capability lists it there, then creates `openspec/specs/<name>/spec.md`. |
| `openspec validate` may catch formatting issues only the CLI knows about. | Run `openspec validate migrate-docs-to-openspec --strict` as a tasks.md step before considering the change ready for apply. |

## Migration Plan

1. Land this change (`/opsx:propose` complete, `/opsx:apply` to execute).
2. Validate with `openspec validate migrate-docs-to-openspec --strict`.
3. Apply tasks (see `tasks.md`): create specs, delete ARCHITECTURE.md, move plans, update AGENTS.md.
4. Open a PR. CI runs `npm run typecheck`, `npm run lint`, `npm run test:all` (no functional code changed, so all should pass unmodified).
5. Archive the change with `openspec archive migrate-docs-to-openspec`, which promotes `openspec/changes/migrate-docs-to-openspec/specs/**` into `openspec/specs/**`.

**Rollback:** Revert the PR. ARCHITECTURE.md and `docs/plans/` are restored from git history; `openspec/specs/` reverts to empty.

## Open Questions

None blocking. The decision to leave a tombstone `docs/ARCHITECTURE.md` (Risk #1) can be revisited at apply time if no external references are found.
