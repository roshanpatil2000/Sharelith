# Sharelith: notes for Claude

## Git

- **Never delete a branch**, local or remote. That includes `git branch -d`/`-D`, `git push --delete`, and `gh pr merge --delete-branch`. Merge with plain `gh pr merge <n> --merge`, and leave branch cleanup to the owner.
  Why: deleting a PR's branch closes any PR stacked on it (PR 32 was closed this way when PR 31's branch went).
