## 1. Validate the proposal

- [x] 1.1 Run `openspec validate migrate-docs-to-openspec --strict` and resolve any reported issues
- [x] 1.2 Run `openspec show migrate-docs-to-openspec` and confirm all four spec files (`auth`, `e2e-testing`, `iteration-storage`, `diff-pipeline`) are listed

## 2. Reorganise `docs/`

- [x] 2.1 Move `docs/plans/2026-02-17-s-4.2.1-commit-based-iteration-loader.md` to `openspec/changes/archive/2026-02-17-s-4.2.1-commit-based-iteration-loader.md`
- [x] 2.2 Move `docs/plans/2026-02-17-s-4.2.1-commit-based-iteration-loader-design.md` to `openspec/changes/archive/2026-02-17-s-4.2.1-commit-based-iteration-loader-design.md`
- [x] 2.3 Delete the now-empty `docs/plans/` directory
- [x] 2.4 Delete `docs/ARCHITECTURE.md`
- [x] 2.5 Delete the now-empty `docs/` directory

## 3. Retarget cross-links in `AGENTS.md`

- [x] 3.1 §1.5 Authentication — replace `See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)` with `See [openspec/specs/auth/spec.md](openspec/specs/auth/spec.md)`
- [x] 3.2 §1.6 Iteration Storage — replace the trailing `See [spec/functional/iterations.md](spec/functional/iterations.md)` link with `See [openspec/specs/iteration-storage/spec.md](openspec/specs/iteration-storage/spec.md)`
- [x] 3.3 §1.7 Diff Pipeline Architecture — replace `See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#diff-pipeline-architecture)` with `See [openspec/specs/diff-pipeline/spec.md](openspec/specs/diff-pipeline/spec.md)`
- [x] 3.4 Grep the repo for any remaining `docs/ARCHITECTURE.md` references (`grep -rn "docs/ARCHITECTURE" .` ignoring `.git/` and `node_modules/`) and retarget each one

## 4. Verify the codebase is unaffected

- [x] 4.1 Run `npm run lint` — must pass (no code touched, so this is a smoke test)
- [x] 4.2 Run `npm run typecheck` — must pass
- [x] 4.3 Skim `git diff --stat` — confirm only `docs/`, `AGENTS.md`, and `openspec/` files are touched

## 5. Archive the change

- [ ] 5.1 Open a PR titled "docs: migrate ARCHITECTURE.md to OpenSpec capability specs" with auto-merge enabled (`gh pr create --merge --auto`, not squash)
- [ ] 5.2 After merge, run `openspec archive migrate-docs-to-openspec` to promote `openspec/changes/migrate-docs-to-openspec/specs/**` into `openspec/specs/**`
- [ ] 5.3 Confirm `openspec spec list` shows `auth`, `e2e-testing`, `iteration-storage`, `diff-pipeline`
