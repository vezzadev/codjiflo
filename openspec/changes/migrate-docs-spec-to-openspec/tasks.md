## 1. Pre-flight

- [x] 1.1 Run `git status` — confirm the working tree is clean (or only contains the in-flight change directory)
- [x] 1.2 Run `openspec validate migrate-docs-spec-to-openspec --strict` — must report valid before any moves
- [x] 1.3 ~~Capture a baseline~~ Deferred to step 10 (this change is doc-only — no runtime impact expected; we'll verify at the end rather than baseline first) `npm run typecheck` and `npm run lint` exit code (should be unaffected by this change; record as the reference)
- [x] 1.4 Grep the repo for every inbound reference that needs rewriting later: `grep -rn -E '(spec/(functional|stories|test|demo)/|docs/(ARCHITECTURE\.md|plans/))' --include='*.md' --include='*.ts' --include='*.tsx' --include='*.yml' --include='*.yaml' --include='*.json' .` — save the list as the rewrite worksheet

## 2. Promote architecture doc to project context

- [x] 2.1 `git mv docs/ARCHITECTURE.md openspec/project.md`
- [x] 2.2 Edit `openspec/project.md`: drop the `# CodjiFlo Architecture` heading if it duplicates the surrounding context; rewrite any intra-doc links that pointed to `spec/functional/...` to `openspec/specs/...`
- [x] 2.3 Edit `openspec/config.yaml`: under the `context:` key, add a one-line pointer like `context: |\n  See openspec/project.md for tech stack, auth, iteration storage, and diff pipeline architecture.`
- [x] 2.4 Commit: `docs: promote ARCHITECTURE.md to openspec/project.md`

## 3. Relocate test matrices

- [x] 3.1 Create the target directory: `mkdir -p openspec/test-matrices`
- [x] 3.2 `git mv spec/test/stateless-mode.md openspec/test-matrices/stateless-mode.md`
- [x] 3.3 `git mv spec/test/azure-devops-test-matrix.md openspec/test-matrices/azure-devops-test-matrix.md`
- [x] 3.4 `git mv spec/test/unauthenticated-access-test-matrix.md openspec/test-matrices/unauthenticated-access-test-matrix.md`
- [x] 3.5 ~~Rewrite intra-file~~ No-op — grep confirmed zero inbound `spec/functional/...` links in any test matrix `spec/functional/...` links inside the three matrices to `openspec/specs/<capability>/spec.md`
- [x] 3.6 Commit: `docs: relocate test matrices to openspec/test-matrices/`

## 4. Archive milestone stories and implementation plans

- [x] 4.1 Create the archive directory: `mkdir -p openspec/archive/legacy/milestones openspec/archive/legacy/plans openspec/archive/legacy/demo`
- [x] 4.2 `git mv spec/stories/milestone-*.md openspec/archive/legacy/milestones/` (move all nine in one command)
- [x] 4.3 `git mv docs/plans/2026-02-17-s-4.2.1-commit-based-iteration-loader.md openspec/archive/legacy/plans/`
- [x] 4.4 `git mv docs/plans/2026-02-17-s-4.2.1-commit-based-iteration-loader-design.md openspec/archive/legacy/plans/`
- [x] 4.5 `git mv spec/demo/s-4.2.1 openspec/archive/legacy/demo/s-4.2.1`
- [x] 4.6 Write `openspec/archive/legacy/milestones/INDEX.md` — one line per milestone (`- [M1: SPA + GitHub Data](milestone-1-spa-github-data.md) — shipped, established app shell`)
- [x] 4.7 Rewrite cross-references inside the archived milestones: every `../functional/<file>.md` becomes `../../../specs/<capability>/spec.md`; intra-milestone links stay relative
- [x] 4.8 Rewrite cross-references inside the archived plans: every `../../spec/functional/<file>.md` becomes `../../../specs/<capability>/spec.md`
- [x] 4.9 Commit: `docs: archive milestone stories, S-4.2.1 plans, and S-4.2.1 demo under openspec/archive/legacy/`

## 5. Move drafted capability specs into the live spec tree

- [ ] 5.1 `mkdir -p openspec/specs`
- [ ] 5.2 Move every drafted spec out of the change directory into the live tree:
  - `mv openspec/changes/migrate-docs-spec-to-openspec/specs/diff-viewing openspec/specs/`
  - `mv openspec/changes/migrate-docs-spec-to-openspec/specs/comments openspec/specs/`
  - `mv openspec/changes/migrate-docs-spec-to-openspec/specs/iterations openspec/specs/`
  - `mv openspec/changes/migrate-docs-spec-to-openspec/specs/review-lifecycle openspec/specs/`
  - `mv openspec/changes/migrate-docs-spec-to-openspec/specs/realtime-updates openspec/specs/`
  - `mv openspec/changes/migrate-docs-spec-to-openspec/specs/unauthenticated-access openspec/specs/`
  - `mv openspec/changes/migrate-docs-spec-to-openspec/specs/backend-abstraction openspec/specs/`
  - `mv openspec/changes/migrate-docs-spec-to-openspec/specs/ui-shell openspec/specs/`
  - `mv openspec/changes/migrate-docs-spec-to-openspec/specs/data-models openspec/specs/`
  - **NOTE**: If `openspec archive` (step 9.1) handles this automatically per its docs, skip 5.2 and rely on it; verify by running `openspec archive --help`. The manual `mv` is the fallback.
- [ ] 5.3 `openspec list --specs` — confirm all nine capabilities are listed
- [ ] 5.4 `openspec validate --strict` (no change name) — confirm the live spec tree validates clean

## 6. Delete the now-empty legacy folders

- [ ] 6.1 Delete the now-migrated source files: `git rm -r spec/functional spec/stories spec/test spec/demo`
- [ ] 6.2 Confirm `spec/` is empty: `find spec -type f | wc -l` must be 0
- [ ] 6.3 `git rm -r spec` (remove the empty parent directory)
- [ ] 6.4 Confirm `docs/` has no remaining tracked files: `find docs -type f | wc -l` must be 0
- [ ] 6.5 `git rm -r docs`
- [ ] 6.6 Commit: `docs: remove legacy docs/ and spec/ trees, migrated to openspec/`

## 7. Rewrite repo-wide cross-references

- [ ] 7.1 Open the worksheet from 1.4 and walk every hit (excluding `openspec/archive/legacy/` — handled in 4.7/4.8):
- [ ] 7.2 `AGENTS.md`: replace each `spec/functional/<file>.md` with `openspec/specs/<capability>/spec.md`; replace `docs/ARCHITECTURE.md` with `openspec/project.md`
- [ ] 7.3 `CLAUDE.md` (project root): same substitutions as 7.2
- [ ] 7.4 `README.md` (if any references): same substitutions
- [ ] 7.5 `.github/workflows/*.yml` and `.github/**/*.md`: same substitutions
- [ ] 7.6 Any `package.json` `scripts` that grep specs (e.g., linting): update the path
- [ ] 7.7 Verify no broken links remain: `grep -rnE '(spec/(functional|stories|test|demo)/|docs/(ARCHITECTURE\.md|plans/))' --include='*.md' --include='*.ts' --include='*.tsx' --include='*.yml' --include='*.yaml' --include='*.json' . | grep -v openspec/archive/legacy/` — must return 0 hits
- [ ] 7.8 Commit: `docs: rewrite cross-references after openspec migration`

## 8. Update AGENTS.md to teach the new layout

- [ ] 8.1 In `AGENTS.md`, replace the `## 2. Milestone Architectural Plans` section with a one-line pointer to `openspec/archive/legacy/milestones/INDEX.md`
- [ ] 8.2 Add a `## OpenSpec Layout` section listing the nine live capabilities and pointing readers at `openspec/specs/`, `openspec/project.md`, `openspec/changes/`, `openspec/archive/`, and `openspec/test-matrices/`
- [ ] 8.3 Reference the OpenSpec workflow commands (`/opsx:propose`, `/opsx:apply`, `/opsx:archive`) so future agents know to use them
- [ ] 8.4 Commit: `docs: teach AGENTS.md the openspec layout`

## 9. Archive the migration change

- [ ] 9.1 Run `openspec archive migrate-docs-spec-to-openspec` — moves this change directory into `openspec/changes/archive/` (idempotent; if step 5.2 already moved the spec dirs out, archive should not duplicate them)
- [ ] 9.2 `openspec list` — confirm `migrate-docs-spec-to-openspec` no longer appears under active changes
- [ ] 9.3 `openspec list --specs` — confirm the nine capabilities still appear in the live spec tree
- [ ] 9.4 `openspec validate --strict` — final clean bill of health

## 10. Verification

- [ ] 10.1 `npm run typecheck` — same exit status as the baseline from 1.3 (this change should NOT affect TypeScript)
- [ ] 10.2 `npm run lint` — same exit status as baseline
- [ ] 10.3 Sanity-check three random `openspec show <capability>` invocations render usefully (`diff-viewing`, `iterations`, `data-models`)
- [ ] 10.4 Manual link-walk: from `AGENTS.md`, click through to each capability spec and confirm it resolves; from one archived milestone, click through to its referenced capability spec and confirm it resolves
- [ ] 10.5 `git log --follow openspec/specs/comments/spec.md` shows pre-migration history from `spec/functional/comments.md` — confirms `git mv` chain preserved blame

## 11. Open the PR

- [ ] 11.1 Push the branch and open a PR titled `docs: migrate docs/ and spec/ to openspec`
- [ ] 11.2 PR body: link to this change's `proposal.md`, list the nine new capabilities, list the archived artifacts, and call out that there are zero src/ changes
- [ ] 11.3 Set the PR to auto-merge (no squash) per the user's git workflow preference
