# Branching and production deploy

Use **branches** so that only merges to `main` deploy to production. You can work on features and fixes on other branches and keep production stable.

## Workflow

1. **`main`** = production. Only merge here when you want a new version live.
2. **Feature/fix work** happens on branches, e.g. `feature/calorie-goals`, `fix/login-error`, `chore/update-deps`.
3. **Open a PR** into `main` when a change is ready. CI runs on the PR.
4. **Merge to `main`** when you’re happy with the change. That triggers production deploys on Render and Vercel.

## Commands

```bash
# Start a feature from latest main
git checkout main
git pull
git checkout -b feature/your-feature-name

# Work, commit, push
git add .
git commit -m "Add calorie goals"
git push -u origin feature/your-feature-name
```

Then open a **Pull Request** from `feature/your-feature-name` → `main` on GitHub. After review (or when you’re ready), merge. Production will redeploy from `main`.

## CI

The GitHub Actions workflow in [.github/workflows/ci.yml](../.github/workflows/ci.yml) runs on:

- **Push** to `main` or `master`
- **Pull request** targeting `main` or `master`

So every PR gets typecheck, tests, and build before you merge. No need to merge to see if the branch is green.

## Deploy from `main` only

Configure your hosts so **only the `main` branch** deploys to production.

### Vercel (frontend)

1. Project → **Settings** → **Git**.
2. Under **Production Branch**, set it to `main` (it often is by default).
3. Other branches will get **Preview** deployments if you want; production is only from `main`.

### Render (backend)

1. Service → **Settings** → **Build & Deploy**.
2. **Branch**: set to `main` (or the branch you use for production).
3. Deploys from other branches won’t run unless you add a separate preview service.

After this, pushing or merging to `main` triggers production; pushing to other branches does not.

## Optional: `develop` branch

If you want a long‑lived integration branch:

- Use **`develop`** for day‑to‑day merges and integration.
- When you’re ready to release, open a PR **`develop` → `main`** and merge. That single merge to `main` is your production release.

You can point CI at `develop` as well (e.g. run on push to `develop` and on PRs into `main` and `develop`) by editing the workflow `on.push.branches` and `on.pull_request.branches`.

## Summary

| Branch        | Use for              | Deploys to production? |
|---------------|----------------------|--------------------------|
| `main`        | Production releases   | Yes (when you merge)     |
| `feature/*`   | New features          | No                       |
| `fix/*`       | Bug fixes             | No                       |
| (optional) `develop` | Integration / staging | No (merge to `main` to release) |
