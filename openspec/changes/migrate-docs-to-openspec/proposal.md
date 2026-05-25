## Why

`docs/ARCHITECTURE.md` is a 282-line catch-all that mixes auth, E2E testing, iteration storage, and the diff pipeline into one file with no separation between behavioral contract (what the system must do) and implementation notes (file paths, function names). The project now uses OpenSpec for spec-driven development, but `openspec/specs/` is empty — so the documentation is not discoverable through the OpenSpec workflow and there is no normative spec for AI agents (or humans) to validate against. The two stale design docs in `docs/plans/` add to the confusion by overlapping with what ARCHITECTURE.md describes.

## What Changes

- Split `docs/ARCHITECTURE.md` into four OpenSpec capability specs under `openspec/specs/`, one per concern.
- **BREAKING (for docs only)**: Delete `docs/ARCHITECTURE.md`. References in `AGENTS.md` are updated to point at the new specs.
- Rewrite each section in OpenSpec spec form: SHALL-style requirements with explicit scenarios, with the implementation map (file paths, env var tables, etc.) preserved as a `## Implementation Notes` appendix per spec so no information is lost.
- Move the two existing planning docs in `docs/plans/` into `openspec/changes/archive/` (they are historical change proposals, not living architecture) and delete the now-empty `docs/plans/` directory.
- Update `AGENTS.md` cross-links: `docs/ARCHITECTURE.md` → `openspec/specs/<capability>/spec.md`.

## Capabilities

### New Capabilities
- `auth`: GitHub App OAuth 2.0 + PKCE flow, cross-subdomain token handoff for PR previews, cookie strategy, required permissions.
- `e2e-testing`: Playwright mock-vs-prod mode contract, test directory organisation, and the "one describe per file / no skip / 5s per test" invariants.
- `iteration-storage`: GitHub Action + SQLite artifact iteration tracking, content-deduplicated schema, force-push resilience, stateless fallback.
- `diff-pipeline`: Composable hook pipeline (Source → Filter → Shape → Display → SideFilter → Navigation → Comments) and its stage contracts.

### Modified Capabilities
None — `openspec/specs/` is empty, so this change is purely additive at the spec level.

## Impact

- **Docs**: `docs/ARCHITECTURE.md` deleted; `docs/plans/*` archived; `docs/` directory removed if empty.
- **Specs**: 4 new spec files created under `openspec/specs/`.
- **AGENTS.md**: Section 1.5 (Authentication), 1.6 (Iteration Storage), 1.7 (Diff Pipeline) links retargeted; the inline `Iteration Storage` block trimmed in favour of a single link to the new spec.
- **Code**: None. This change touches documentation only.
- **CI/build**: None.
