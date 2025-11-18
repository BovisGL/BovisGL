# Git workflow for contributors

This document describes the lightweight branching and PR workflow to follow when developing new features for this repository. It defines a simple, review-first model:

- Create a small, focused feature branch for each feature or task.
- Commit frequently and push your branch to the remote for backups and review.
Open a Pull Request (PR) against the `main` branch for review/iteration.
Once the feature is fully implemented and reviewed and merged into `main`, open a PR from `main` into `production` for the production deploy.

Note: this doc intentionally does NOT cover how to test locally yet (that will be added later). It covers only branching, committing, pushing, and PR flow.

---

## Branching model (high-level)

1. Always branch from `main`:
   - `main` is the development branch (daily development happens here).
   - `production` is the separate branch that reflects the code deployed to production.
   - Create feature branches off `main`.
2. Feature branches follow the naming convention:
   - `feature/<short-description>` (e.g. `feature/auth-token-rotation`) or `bugfix/<short>` for fixes.
   - Keep names short, lower-case, with hyphens.


---

## Day-to-day flow (step-by-step)

1. Create a feature branch (start of work):

```bash
# make sure you are up-to-date
git checkout main
git fetch origin
git pull --rebase origin main

# create and switch to a new feature branch
git checkout -b feature/short-descriptive-name
```

2. Commit frequently while working locally. Good rules of thumb:
- Commit for each small, logical change (e.g., "add input validation to X", "refactor Y into helper").
- Commit messages should follow the commit conventions (`.internal-docs/COMMIT_CONVENTION.md`).

Common commands while working:

```bash
# stage changes
git add path/to/file1 path/to/file2

# commit with a conventional commit message
git commit -m "feat(communications): handle missing player name in sync"

# if you need to edit the last commit message before pushing
git commit --amend
```

3. Push your branch to the remote regularly (every session or after meaningful progress):

```bash
git push -u origin feature/short-descriptive-name
```

-4. Open a PR to `main` for review (early):
- On GitHub (or your Git host), open a PR **from** `feature/short-descriptive-name` **into** `main`.
- Fill the PR description: short summary, motivation, and any relevant notes or links to issues.
- Request reviewers (admins or other devs).

5. Iterate on review feedback:
- Make changes locally, commit, and push to the same branch:

```bash
git add .
git commit -m "fix(communications): guard against undefined name"
git push
```

- The PR will update automatically with your pushed commits.

6. Merge into `main` after approval:
 - Use the merge strategy your team prefers (squash-merge or merge commit). Keep history readable.

7. When the feature is fully complete and ready for production:
 - Option A: Create a PR from `main` into `production` that contains the tested, reviewed set of features.
 - Option B: If absolutely necessary, open a PR directly from the feature branch into `production` once approved (not recommended).

Either way, the final step to get code into production is a PR into `production`, approved and merged.

---

## Recommended commands for keeping your branch up-to-date

Before pushing or opening a PR, rebase or merge `main` to reduce conflicts:

Rebase (keeps a linear history):
```bash
git fetch origin
git checkout feature/short-descriptive-name
git rebase origin/main
# resolve any conflicts, then continue
git rebase --continue
# then push (force with lease if you rebased)
git push --force-with-lease
```

Or merge (keeps original history):
```bash
git fetch origin
git checkout feature/short-descriptive-name
git merge origin/main
# resolve conflicts, commit, then push normally
git push
```

Note: if you rebase and have already pushed the branch, use `--force-with-lease` to update the remote safely.

---

## How often to commit, push, and pull

- Commit frequency: commit every small, logically-complete change. Rough guideline: every 10–60 minutes of work or at each discrete step.
- Push frequency: push at least once per working session, and push after you reach a stable checkpoint (so remote contains a backup of your work).
- Pull/Sync frequency: pull or rebase from `main` at least daily or before opening a PR to avoid long-lived drift and large conflicts.

This balance ensures you have a clear local history while keeping the remote up-to-date for review and backups.

---

## PR guidelines

 - PR target for early review: `main` branch.
 - PR target for production: `production` branch.
- PR title should be short and descriptive. Include the scope if relevant, e.g. `feat(communications): better sync handling`.
- PR description should explain the "why" and list any important changes.
- Link to issues or other PRs when relevant.
- Request at least one reviewer (or follow project-specific rules).
- After approval, merge using the repository's preferred method (squash vs merge commit). If you squash, include a meaningful commit message.

---

## Useful commands summary

Create branch:
```bash
git checkout -b feature/short-desc
```

Stage and commit:
```bash
git add file1 file2
git commit -m "<type>(scope): short message"
```

Push branch:
```bash
git push -u origin feature/short-desc
```

Open a PR: go to the repo on GitHub and create a PR from your branch into `main` (for review) or into `production` (for production when ready).

Update branch with latest main (rebase):
```bash
git fetch origin
git rebase origin/main
git push --force-with-lease
```

Merge main to production (example flow):
```bash
# On GitHub: open a PR from main -> production, review, approve, then merge
```

Fixing the last local commit before push:
```bash
git commit --amend --no-edit   # to add staged changes into last commit
git commit --amend -m "new message"  # to change message
```

If you accidentally pushed a broken commit and need to rewrite history, coordinate with the team and use:
```bash
git push --force-with-lease
```

---

## Tips and etiquette

- Keep feature branches focused and small. Large, long-lived branches are hard to review.
- Write clear PR descriptions and link issues. That helps reviewers and future maintainers.
- Use the commit convention from `.internal-docs/COMMIT_CONVENTION.md` so automated tooling and changelogs work well.
- If you need to do a risky/large refactor, discuss it with admins first and consider feature-flagging or splitting into smaller pieces.

---

