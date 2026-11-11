# AGENTS.md — rules for AI agents working on Flare Studio

## Project
- Flare Studio: Electron + React + TypeScript plug-and-play editor/IDE for the Flare engine. Target: **flare-engine master** (`c6772106`, 2026-11-11, engine version **1.15.87**). See `src/flare/engineTarget.ts`. The official v1.15 tag is older and lacks craft/vendor-tab/visual-effect keys.
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

## Product philosophy
- Studio shows the user's concepts, not Flare's data model. Talker, Static and Vendor are Studio inventions, mapped onto Flare keys on save.
- Editors are organized around the user's questions, with plain labels. Raw Flare keys belong only in Tooltips.
- Beginners first: no Unity/Unreal clutter. Every engine feature is still reachable, through progressive disclosure.

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
- Content > Quests: the Quest Map (`src/components/QuestMapView.tsx`, graph in `src/editor/questMap.ts`) replaces the map view; the network button next to "+ Quest" toggles it. Read-only: quests, the NPCs that start/advance/end/mention them, and quest unlocks, linked by statuses. Dragged card positions live only in the Studio sidecar `content/quest-map.json`.
- Entities: add button directly under the sub-switch. Add dialogs have no coordinates: position is instance data set by placing on the map. Unplaced = -1,-1, shown as "Not placed", not exported to the map (`src/editor/entityPlacementRules.ts`).

## Data safety
- Saving merges into existing Flare files: keep unknown keys, repeated keys, INCLUDE/APPEND lines, comments, section and `[dialog]` order.
- NPC, enemy, and multi-stage quest files must round-trip byte-for-byte against flare-game fixtures (including blank lines, unknown keys, comments, and multiple INCLUDE or `[quest]` blocks); keep these tests passing:
  - `src/adapters/flare/serializers.cjs` (`importNpcText`, `exportNpcFile`, `mergeNpcFile`, `normalizeEnemyText`, `applyEnemyFileUpdates`)
  - `src/utils/npcFileUpdate.ts` (Studio object → NPC file update) + `src/utils/npcFileUpdate.test.ts`
  - `src/adapters/flare/npcRoundTrip.test.ts`, fixtures in `tests/fixtures/flare-npcs/` and `tests/fixtures/flare-enemies/`
  - `src/adapters/flare/content.cjs` (`importQuestText`, `exportQuestFile`, `mergeQuestText`, `mergeLootText`, `mergeItemText`, `mergePowerText`, `mergeEffectText`), `src/editor/questSteps.ts`, fixtures in `tests/fixtures/flare-quests/`, `tests/fixtures/flare-loot/`, `tests/fixtures/flare-items/`, `tests/fixtures/flare-powers/`
- Never overwrite hand-made animation files (Studio writes `<name>_studio.txt` instead).
- Enemy files: `gold`, `wander_radius`, `waypoints`, `script` are not StatBlock keys (map-spawn or none); they are dropped with a visible toast.

## Known open issues
- Multi-stage quest journals are edited as step cards; the Role center uses Moments (including Play and a shop-open indicator). List and Board stay behind a toggle.
- Dialogue opens as a chat (`src/components/dialogue/MomentChatView.tsx`, helpers in `src/editor/dialogueChat.ts`): NPC bubbles left with portrait, player right, "shows when" condition chips, effect chips. Deleting a chip or line removes only its own file line.
- Statuses layer = powers, effects and campaign statuses under Studio names (`src/components/powers/`, pure logic in `src/editor/powers/`): Skill / Monster Attack / Item Use / Trap from where a power is used, Buff / Debuff for effects, Story Flag for statuses. Files are edited line by line (`sectionFile.ts`); slider bands come from `scripts/power-tiers.mjs` (flare-game p33/p66). Status fields use the shared `story-flag-suggestions` datalist.

## Edit NPC
- Name and appearance (fantasycore picker, default sprite) are on the first screen. Roles use on/off switches; a reserved gear opens the Role center (Dialogue / Shop / Quest).
- Properties list shows only what is set; new keys go through the searchable Add property palette (synonym search). Raw Flare keys belong in Tooltips only.
- No engine feature may be removed, only relocated.
