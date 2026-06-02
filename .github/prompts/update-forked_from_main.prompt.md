## Plan: Configure Upstream Sync

Confirm the fork’s remotes, keep `origin` on `https://github.com/flexera-public/AI-Engineering-Coach.git`, and use `upstream` for pulling updates from `https://github.com/microsoft/AI-Engineering-Coach.git`. Sync `main` from upstream only after verifying the working tree is clean, then push the updated `main` back to the fork.

**Steps**
1. Inspect remotes and branch tracking to confirm `origin` is `https://github.com/flexera-public/AI-Engineering-Coach.git` and `upstream` is `https://github.com/microsoft/AI-Engineering-Coach.git`.
2. If `upstream` is missing, add `https://github.com/microsoft/AI-Engineering-Coach.git`; if it exists but points elsewhere, update it.
3. Fetch from `upstream` and inspect incoming commits before integrating.
4. Verify the working tree is clean, switch to `main`, and confirm `main` tracks the intended remote branch before integrating.
5. Update local `main` from `upstream/main` using either merge or rebase.
6. Resolve any conflicts caused by fork-specific changes, then run `npm run check` before publishing.
7. Push the synchronized `main` branch to `origin`.
8. Repeat the same fetch-and-integrate flow regularly or automate it in a maintenance routine.

**Relevant files**
- `c:\_repos\SnowSoftwareGlobal\AI-Engineering-Coach-Flexera\.git\config` — verify or update `origin` and `upstream` remotes.
- `c:\_repos\SnowSoftwareGlobal\AI-Engineering-Coach-Flexera\package.json` — repository metadata confirms the upstream source repository.
- `c:\_repos\SnowSoftwareGlobal\AI-Engineering-Coach-Flexera\customization\README.md` — entry point for fork-specific customizations that may need review when upstream updates overlap local changes.

**Verification**
1. Run `git remote -v` and confirm `origin` points to `https://github.com/flexera-public/AI-Engineering-Coach.git` while `upstream` points to `https://github.com/microsoft/AI-Engineering-Coach.git`.
2. Run `git status --short --branch` before syncing and ensure the working tree is clean and the checked-out branch is `main`.
3. After fetch, inspect `git log --oneline main..upstream/main` to see what will be integrated.
4. After merge or rebase, run `npm run check`, then run `git status --short --branch` again.
5. Confirm `git push origin main` succeeds and `main` remains aligned with the intended remote.

**Decisions**
- Included: configuring remotes, choosing merge vs rebase, verifying before push, and syncing `main`.
- Excluded: automating sync in CI and resolving repository governance differences between the fork and upstream.
- Recommended default: use `merge` for the first sync on a customized fork unless the branch history is intentionally kept linear and the team is comfortable with rebasing shared branches.

**Further Considerations**
1. If the fork keeps substantial long-lived product changes, prefer syncing on a temporary branch first and opening a PR into `main` instead of updating `main` directly.
2. If multiple engineers push to the fork’s `main`, avoid force-push workflows after a rebase unless the team explicitly agrees to that policy.
3. If the upstream default branch changes in the future, update the sync commands to match that branch instead of assuming `main`.