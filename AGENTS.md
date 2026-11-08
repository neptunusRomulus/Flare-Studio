# AGENTS.md — rules for AI agents working on Flare Studio

## Project
- Flare Studio: Electron + React + TypeScript plug-and-play editor/IDE for the Flare engine (target: **Flare 1.15**).
- Goal: expose every engine feature, but keep the UI simple for beginners (progressive disclosure; no Unity/Unreal-style clutter). Features may be relocated, never removed.
- Long term: a multi-genre engine with CLI/MCP control.

## Workflow
- Work on branch `main-dev2`; commit and push directly. No PRs or extra branches unless asked.
- Never stage/commit the owner's uncommitted `package.json` change or untracked `IDEA.md`. Always `git add <explicit paths>`, never `git add -A` / `.`.
- Commit author is configured repo-locally; don't change git config.
- Before committing run: `npx tsc --noEmit`, `npm test` (= `vitest run`), `npm run build` (= `vite build`). The pre-commit hook (`.husky/pre-commit`) also runs lint-staged, tsc and vitest; it must pass (never `--no-verify`).
- Small, focused commits. The owner is near usage limits: prefer cheap, targeted changes; ask before large rewrites.
- Never launch the Electron app/GUI on the owner's machine unless asked.

## Restart notes (state this in every report, plus what was NOT verified in the running app)
- Renderer-only changes (`src/**`): Ctrl+R.
- `electron/main.cjs`, `preload.js`, `electron/*.cjs`, and `src/adapters/flare/serializers.cjs` / `flareAdapter.cjs` (also loaded by the main process): full restart of `npm run electron-dev`.

## UI rules
- Minimal design. Explanations only in the app Tooltip (`src/components/ui/tooltip.tsx`); no inline help text.
- Confirmations with `InlineConfirm` (`src/components/ui/inline-confirm.tsx`); never OS dialogs or modals.
- Panels must not shift or resize on click.
- Studio calls Flare powers "Statuses".

## Current layout
- No left sidebar. Right dock always visible.
- Main switch at top: Map | Entities | Content | Game Settings; sub-switch directly under it (Ground/Object/Collision; NPC/Enemy/Event; Items/Statuses/Quests). See `src/components/MapTargetSwitch.tsx`, `src/components/targetGroups.ts`, `src/components/EntityDock.tsx`.
- Tab cycles sub-targets; Shift+Tab cycles main layers.
- Map and Entities sub-switch buttons: corner eye = visibility, mouse wheel = opacity (per sub-target).
- Title bar: Flare icon = app menu (incl. Engine Settings; `src/components/AppControls.tsx`, `MainMenuDialog.tsx`), Save button next to it.
- GID readout only in Debug Mode. Minimap bottom-left.
- Entities: add button directly under the sub-switch. Add dialogs have no coordinates: position is instance data set by placing on the map. Unplaced = -1,-1, shown as "Not placed", not exported to the map (`src/editor/entityPlacementRules.ts`).

## Data safety
- Saving merges into existing Flare files: keep unknown keys, repeated keys, INCLUDE/APPEND lines, comments, section and `[dialog]` order.
- NPC files must round-trip byte-for-byte against flare-game fixtures; keep these tests passing:
  - `src/adapters/flare/serializers.cjs` (`importNpcText`, `exportNpcFile`, `mergeNpcFile`, `normalizeEnemyText`)
  - `src/utils/npcFileUpdate.ts` (Studio object → NPC file update) + `src/utils/npcFileUpdate.test.ts`
  - `src/adapters/flare/npcRoundTrip.test.ts`, fixtures in `tests/fixtures/flare-npcs/`
- Never overwrite hand-made animation files (Studio writes `<name>_studio.txt` instead).
- Enemy files: `gold`, `wander_radius`, `waypoints`, `script` are not Flare 1.15 enemy keys (map-spawn or none); they are dropped with a visible toast.

## Known open issues
- Existing NPC file values (vendor fields, ratios, vox) are not loaded into the editor UI (untouched fields keep the file's values).
- NPC editor › Animation › "Import Tileset" sets the portrait instead of the sprite.
- A fresh NPC has no default sprite (likely invisible in-game).
- Deleting a dialog line shifts later dialog items by slot.
- Enemy editor holds only one INCLUDE.
- Blank lines inside NPC file sections are lost.
- Imported NPCs show no thumbnail.
- GID readout updates only on the next mouse move after toggling Debug Mode.

## Next planned work: simplify Edit NPC
- Top preview card with Name.
- Appearance picker from fantasycore thumbnails, with a default sprite.
- Roles Talker/Vendor/Quest with descriptive buttons (e.g. "Edit dialogue") instead of generic "Settings".
- Collapsed "Advanced" for animation technicals, spawn requirements, vox, Stats & Effects, minimap.
- Hide Waypoints/Wander Radius placeholders.
- Rename the two Direction fields to "Stance direction" and "Facing on map".
- Plain labels instead of raw Flare keys (raw key in the tooltip); move inline help text to tooltips; remove the black "+ Add" overlays.
- No engine feature may be removed, only relocated.
