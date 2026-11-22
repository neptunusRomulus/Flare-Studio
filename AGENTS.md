# AGENTS.md — rules for AI agents working on Flare Studio

This file is loaded on every task, so it holds only what the code cannot tell you: forbidden actions, product
and UX invariants, and decisions with their reasons. Feature detail lives in `docs/features/` and is read on
demand (see the map at the bottom). Do not paste implementation detail back into this file.

## Project
- Flare Studio: Electron + React + TypeScript plug-and-play editor/IDE for the Flare engine. Target: **flare-engine master** (`c6772106`, 2026-11-11, engine version **1.15.87**). See `src/flare/engineTarget.ts`. The official v1.15 tag is older and lacks craft/vendor-tab/visual-effect keys.
- Goal: expose every engine feature, but keep the UI simple for beginners (progressive disclosure; no Unity/Unreal-style clutter). Features may be relocated, never removed.
- Long term: a multi-genre engine with CLI/MCP control.

## Historical context and resume
- The owner's Flare Bot history was exported locally: `../flare-studio-notes/Agent/Grok Arşivi/Flare Bot — 2026-10-23.md` (1,049 messages). The accompanying `README.md` explains its scope.
- If the owner asks what was previously decided, asks to continue from a prior point, or asks about the old Grok work, read that archive and the current status notes before answering. Do not claim that the history is unavailable without checking these paths.
- Current facts take priority over historical chat: this `AGENTS.md`, then `../flare-studio-notes/Benim/Durum.md` and the newest dated note. The archive can contain superseded plans and implementation claims.

## Workflow
- Work on branch `main-dev2`; commit and push directly. No PRs or extra branches unless asked.
- Never stage/commit the owner's uncommitted `package.json` change or untracked `IDEA.md`. Always `git add <explicit paths>`, never `git add -A` / `.`.
- Commit author is configured repo-locally; don't change git config.
- Before committing run: `npx tsc --noEmit`, `npm test` (= `vitest run`), `npm run build` (= `vite build`). The pre-commit hook (`.husky/pre-commit`) also runs lint-staged, tsc and vitest; it must pass (never `--no-verify`).
- DevTools stay closed in tests: the e2e launcher passes `FLARE_NO_DEVTOOLS=1` and `electron/main.cjs` skips `openDevTools()` when it is set or when `CI` is set. Keep that guard — a DevTools window steals focus and breaks window/focus/screenshot assertions.
- Small, focused commits. The owner is near usage limits: prefer cheap, targeted changes; ask before large rewrites.

## Restart notes (state this in every report, plus what was NOT verified in the running app)
- Renderer-only changes (`src/**`): Ctrl+R.
- `electron/main.cjs`, `preload.js`, `electron/*.cjs`, and `src/adapters/flare/serializers.cjs` / `flareAdapter.cjs` (also loaded by the main process): full restart of `npm run electron-dev`.

## Product philosophy
- Studio shows the user's concepts, not Flare's data model. Talker, Static and Vendor are Studio inventions, mapped onto Flare keys on save.
- Editors are organized around the user's questions, with plain labels. Raw Flare keys belong only in Tooltips.
- Beginners first: no Unity/Unreal clutter. Every engine feature is still reachable, through progressive disclosure.

## UI rules
- Minimal design. Explanations only in the app Tooltip (`src/components/ui/tooltip.tsx`); no inline help text.
- Confirmations with `InlineConfirm` (`src/components/ui/inline-confirm.tsx`); never OS dialogs or modals.
- Panels must not shift or resize on click.
- Studio calls Flare powers "Statuses".
- No engine feature may be removed, only relocated.

## Data safety
- Saving merges into existing Flare files: keep unknown keys, repeated keys, INCLUDE/APPEND lines, comments, section and `[dialog]` order.
- NPC, enemy, and multi-stage quest files must round-trip byte-for-byte against flare-game fixtures (including blank lines, unknown keys, comments, and multiple INCLUDE or `[quest]` blocks); keep these tests passing:
  - `src/adapters/flare/serializers.cjs` (`importNpcText`, `exportNpcFile`, `mergeNpcFile`, `normalizeEnemyText`, `applyEnemyFileUpdates`)
  - `src/utils/npcFileUpdate.ts` (Studio object → NPC file update) + `src/utils/npcFileUpdate.test.ts`
  - `src/adapters/flare/npcRoundTrip.test.ts`, fixtures in `tests/fixtures/flare-npcs/` and `tests/fixtures/flare-enemies/`
  - `src/adapters/flare/content.cjs` (`importQuestText`, `exportQuestFile`, `mergeQuestText`, `mergeLootText`, `mergeItemText`, `mergePowerText`, `mergeEffectText`), `src/editor/questSteps.ts`, fixtures in `tests/fixtures/flare-quests/`, `tests/fixtures/flare-loot/`, `tests/fixtures/flare-items/`, `tests/fixtures/flare-powers/`
- Never overwrite hand-made animation files (Studio writes `<name>_studio.txt` instead).
- Enemy files: `gold`, `wander_radius`, `waypoints`, `script` are not StatBlock keys (map-spawn or none); they are dropped with a visible toast.

## Feature detail — read before editing an area
| Touching | Read |
|---|---|
| Rail, palette card, zen mode, app menu, window controls, brand, GID/minimap | `docs/features/shell-ui.md` |
| Map tabs, entity placement, events/`scripts/*.txt`, quest map | `docs/features/map-entities.md` |
| NPC editor, Role center, properties palette, dialogue chat | `docs/features/npc-editor.md` |
| Books, Statuses/powers, items randomizer, animations, cutscenes, quest journals | `docs/features/content-editors.md` |
| Stats / UI Settings / World Settings cards, Engine data panes | `docs/features/settings-panes.md` |

These files are hints, not contracts: verify against `src/` before trusting a line.

## Context hygiene (do not regress)
- A feature commit updates its `docs/features/<area>.md`, never this file. If `AGENTS.md` grows, something belongs in `docs/`.
- Anything derivable from `src/`, `../flare-engine/` or `scripts/` is looked up, not copied: engine keys, attribute lists, gap lists, file inventories.
- One-off history goes to `../flare-studio-notes/` (dated notes, Grok archive); read it when the owner asks about the past, not on every task.
- Stale guidance is worse than no guidance: if a line here is no longer true and not worth keeping, delete it in the same commit that made it false.
