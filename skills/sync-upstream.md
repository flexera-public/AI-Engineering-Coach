---
name: sync-upstream
description: >-
  Merge microsoft/AI-Engineering-Coach (upstream/main) into this fork's
  flexera-public/AI-Engineering-Coach (origin/main). Never push to upstream and
  never create a pull request against upstream.
when_to_use: User asks to "sync with upstream", "pull upstream changes", "merge
  upstream/main", "update the fork", or "bring in the latest Microsoft changes".
---

# Sync Upstream

Brings `upstream/main` (`microsoft/AI-Engineering-Coach`) into `origin/main`
(`flexera-public/AI-Engineering-Coach`) on this fork. This is a one-way sync:
changes flow from upstream into the fork, never the other way.

## Hard Rules

- **Never push to `upstream`.** This fork never writes to
  `microsoft/AI-Engineering-Coach`.
- **Never open a pull request against `upstream`.** Do not use
  `create_pull_request`, `create_pull_request_with_copilot`, or
  `assign_copilot_to_issue` targeting the upstream repo. All PRs, if any, target
  `origin` only.
- **Only push to `origin`.** The merge result lands on
  `flexera-public/AI-Engineering-Coach`'s `main` branch.
- If a merge conflict touches shared vs. fork-only code, apply the
  [fork-maintenance](../.github/skills/fork-maintenance/SKILL.md) rules to
  decide placement (`src/` vs `customization/`) before resolving.

## Remotes

Expected remote configuration (verify with `git remote -v` first; do not assume):

```
origin    https://github.com/flexera-public/AI-Engineering-Coach.git
upstream  https://github.com/microsoft/AI-Engineering-Coach.git
```

If `upstream` is missing, add it — do not add or change `origin`:

```bash
git remote add upstream https://github.com/microsoft/AI-Engineering-Coach.git
```

## Steps

1. Fetch both remotes without merging yet:

   ```bash
   git fetch origin
   git fetch upstream
   ```

2. Make sure the local `main` branch tracks `origin/main` and is up to date:

   ```bash
   git checkout main
   git pull origin main
   ```

3. Merge `upstream/main` into local `main`:

   ```bash
   git merge upstream/main
   ```

4. Resolve any conflicts:
   - For conflicts inside `customization/`, keep the fork's version unless the
     upstream change is a clear improvement to that same fork-only file.
   - For conflicts in shared files (`src/`, root configs), prefer taking
     upstream's version unless the fork has a deliberate, tracked deviation.
   - Company-specific or sensitive values must never leak into shared tracked
     files — route them to `customization/sensitive/` per fork-maintenance.
   - After resolving, run the narrowest relevant validation (e.g.
     `npm run check` for source changes) before committing the merge.

5. Push the merge result to `origin/main` only:

   ```bash
   git push origin main
   ```

   Do not push to `upstream` under any circumstance, even with `--force` or to
   a non-`main` branch.

## Anti-patterns

- Running `git push upstream ...` in any form.
- Opening a PR, issue, or any GitHub write operation against
  `microsoft/AI-Engineering-Coach`.
- Rebasing the fork's `main` onto `upstream/main` (use merge, not rebase, so
  the fork's own history and future syncs stay reconcilable).
- Blindly accepting upstream's version of a file inside `customization/`
  without checking whether it reintroduces fork-only code into a shared path.
- Assuming `customization/` shows as untracked after a branch switch means a
  merge conflict — it can just be a branch-layout artifact (see repo memory
  notes on fork sync).
