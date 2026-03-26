# History rewrite notice

On 2025-12-08 the repository history was rewritten to remove large build and release artifacts
that exceeded GitHub limits (for example files under `release/`, `build/`, `dist/`). This was done
to keep the repository small and make normal Git operations reliable.

What was removed
- `release/`, `build/`, `dist/` directories were removed from history.

Backups
- A remote backup branch was created before the rewrite: `origin/backup-main`.
- A local backup branch was created: `my-local-backup`.

If you need the old artifacts or history
1. Fetch the remote backup:

```bash
git fetch origin backup-main:backup-main
git checkout backup-main
```

2. Or restore locally from `my-local-backup` (if present):

```bash
git checkout my-local-backup
```

Recommended workflow going forward
- Keep binary releases outside the repository. Use GitHub Releases or a cloud storage for
  large exe/zip files.
- Add the following directories to `.gitignore`: `release/`, `build/`, `dist/`.

If you have questions or need help recovering something from the old history, contact the
repository owner.
