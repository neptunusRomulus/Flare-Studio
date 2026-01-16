The files listed below were identified as local backup/temporary copies and have been removed from the repository to reduce clutter.

- `src/App.tsx.inprogress.bak`
- `src/components/EditEnemyWindow.old.tsx` (not found in working tree)
- `electron/main.cjs.headcopy`
- `electron/main.cjs.workbackup`
- `electron/main.js`

Moved ad-hoc root scripts and design assets to tidy the project root:

- `script.js` -> `scripts/script.js`
- `test-blend.js` -> `scripts/test-blend.js`
- `print_lines.py` -> `scripts/print_lines.py`
- `check-icons.js` -> `scripts/check-icons.js`
- `check-icons.cjs` -> `scripts/check-icons.cjs`
- `check-lucide.cjs` -> `scripts/check-lucide.cjs`
- `flarestudio-logo.psd` -> `assets/design/flarestudio-logo.psd`

These files were deleted from the working tree but remain accessible in Git history. To restore a deleted file, run:

```
git checkout -- <path/to/file>
```

If you intentionally keep local editor backups, add patterns to `.gitignore` (for example: `*.bak`, `*.old.*`, `*inprogress*`).

Maintainers: prefer relying on Git history rather than committing local backup files.
