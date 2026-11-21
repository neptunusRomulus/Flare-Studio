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
- No left sidebar. Right edge: a thin always-visible icon rail (`src/components/PaletteRail.tsx`, `SIDEBAR_RAIL_WIDTH`); clicking an icon opens the list as a floating card over the canvas (`src/components/PaletteCard.tsx`, draggable width in `localStorage`); clicking the active icon again (or Escape) closes the card and frees the canvas.
- Rail order = Map (Ground/Object/Collision), Entities (NPC/Enemy/Event), Content (Items/Books/Statuses/Quests), then UI Settings + World Settings, then Titles + Stats + Power Tree. Localization is a button inside UI Settings, not a rail icon. See `src/components/targetGroups.ts` (`railGroups`). Internal ids stay `gameSettings`, `worldSettings`, `strings`, `titles`, `stats` and `powerTree`.
- Tab cycles sub-targets inside a group; Shift+Tab cycles main layers Map → Entities → Content → Settings → Character (`src/hooks/useSidebarTabHotkeys.ts`).
- Rail visibility (Map/Entities icons only): Ctrl+Click toggles hide/unhide (the icon dims when hidden); mouse wheel over that icon changes opacity. These gestures, plus the group's Tab/Shift+Tab help, are listed on the bottom ? tip. There are no separate visibility buttons at the bottom of the rail.
- The Stats card XP pane also edits `enemies/xp_scaling/*.txt` tables (`[absolute]` / `[relative]` `level=N,multiplier`). Enemies point at a table with `xp_scaling=`. The shared `xp-scaling-suggestions` datalist feeds the enemy field.
- The Stats card also edits `engine/combat.txt`, `engine/damage_types.txt`, `engine/xp_table.txt`, `engine/classes.txt`, `engine/hero_options.txt`, `engine/hero_layers.txt` and `engine/equip_flags.txt` (in-card sections). `engine/elements.txt` is deprecated in Flare; use damage types. `engine/hero_layers.txt` is also deprecated; Flare prefers `render_layers` in `engine/stats.txt`. Equip flags use `id` and `name` (not the outdated name/description example in the default file).
- The Books rail layer edits `books/*.txt` as MenuBook files: header `pos`, `align`, `background`, `close`, `soundfx_open`, `soundfx_close`; `[text]`, `[image]`, `[button]`; and `[event_open]` / `[event_close]` (not `[event]`). There is no title key. Buttons and book events use EventManager component keys (`script`, `book`, `cutscene`, `requires_status`, …). Empty keys are omitted; comments, INCLUDE and unknown keys are kept. Header keys missing from INCLUDE files are not invented on save.
- The UI Settings card also edits `engine/font_settings.txt`, `engine/font_colors.txt`, `engine/tooltips.txt`, `engine/resolutions.txt`, `engine/combat_text.txt`, `engine/icons.txt`, `engine/menu_backgrounds.txt`, `engine/mouse_cursor.txt`, `engine/widget_settings.txt`, `engine/default_settings.txt` and `engine/default_keybindings.txt` (in-card sections). Tile size, Localization and Engine data stay on the General pane. `default_settings` and `default_keybindings` are in a Defaults pane; they are the mod's shipped player defaults (often only in packs such as gcw0_defaults). Colors are `r,g,b` or `r,g,b,a`. `font_fallback` has been removed from Flare. There is no `fonts.txt`; TTF files live in `fonts/` and are named in `font_settings.txt`. The Fonts pane can add a `.ttf` into the project and preview it. `soundfx/subtitles.txt` is edited in a Subtitles pane (style plus id/text rows tied to a sound file). Keybindings are saved in the current format (`file_version` and a `[default]` section of `action=bind,type`). `items/step_sounds.txt` and `engine/avatar/<base>.txt` are edited in the Stats Appearance pane. `sfx_step` in `engine/stats.txt` uses the `step-sound-suggestions` list of those ids.
- The World Settings card also edits `engine/gameplay.txt`, `engine/misc.txt`, `engine/death_penalty.txt`, `engine/default_music.txt` and `engine/loot.txt`. `engine/fow_mask.txt` was already in the Fog of war block.
- Zen mode: no title bar. The canvas starts at y=0; the Flare Studio mark (`src/components/brand/BrandMark.tsx`) is itself the clickable rounded-square menu button (no circular chrome), parked just left of the map-tab strip (`src/components/CanvasMapTabs.tsx`, follows the strip as it widens) or top-left of the canvas when no strip shows = app menu (incl. Engine Settings; `src/components/AppControls.tsx`, `MainMenuDialog.tsx`). Save feedback (Saving… / Save failed) lives in that button's tooltip. A red unsaved-changes dot appears on the mark and on the menu's Save item; there is no green saved dot.
- Window buttons (minimize/maximize/close) are hidden: `src/components/WindowControlBar.tsx` slides a compact floating pill (the buttons only) down at the top-right when the pointer touches the top 6px edge, and hides it ~600ms after leaving (`WINDOW_BAR_HOT_ZONE`, `WINDOW_BAR_HIDE_MS`). The rest of that slim strip is an invisible drag region for moving the window. While the bar is visible, the logo, map-tab strip, Play/zoom group and the palette card's top edge shift down by the strip height (`--window-controls-offset`) so nothing is covered. Same IPC (`minimize` / `maximize` / `close`).
- Brand: sources in `assets/brand/` (regenerate with `scripts/brand/`), app icons in `build/icons/`, runtime copies in `public/brand/`. Chakra Petch is for the logo only.
- GID readout only in Debug Mode. Minimap bottom-right.
- Content > Quests: the Quest Map (`src/components/QuestMapView.tsx`, graph in `src/editor/questMap.ts`) replaces the map view; the network button next to "+ Quest" toggles it. Read-only: quests, the NPCs and map events that start/advance/end (NPCs also: talk about) them, and quest unlocks, linked by statuses. Dragged card positions live only in the Studio sidecar `content/quest-map.json`.
- Entities: "+" in the list header. Add dialogs have no coordinates: position is instance data set by placing on the map. Unplaced = -1,-1, shown as "Not placed", not exported to the map (`src/editor/entityPlacementRules.ts`).
- Events are reusable `scripts/*.txt` files (a queue of `[event]` steps: EventManager components such as `set_status`, `reward_*`, `loot`, `spawn`, `msg`, `cutscene`, `book`, `script`). The Events rail lists those files, with a usage count. Drag (or arm and drag an area) onto the map to place an instance. The instance inspector (double-click a placed event) sets location, hotspot, `activate` (`on_trigger`, `on_interact`, `on_load`, `on_leave`, `on_mapexit`, `on_clear`, `static`), `requires_*`, cooldown/delay, tooltip and `script=`. Map export writes those instance keys plus `script=scripts/<id>.txt`, not the action components. Books, NPC dialogue and other `script=` fields use the same list (`event-script-suggestions`). No second Events tab. Deleting a script file uses the `delete-project-file` IPC (Electron restart required after this addition).
- Power editor `script=` is `trigger,filename` (`on_cast`, `on_hit`, or `on_wall` plus a `scripts/*.txt` path). It uses the shared `event-script-suggestions` list.

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

- `items/random/*.txt` randomizer definitions are edited on the Items Random tab; `randomizer_def` on an item points at one of those files.
- Animation definitions in `animations/*.txt` are edited from Engine data → Animations. Unpacked sections use `render_size` and `position` on an 8-direction sheet; packed sections list `frame=` rows. The editor previews the selected section and direction from the project image.
- Cutscenes in `cutscenes/*.txt` are edited on the World Settings card. The editor lists those files, keeps component order and INCLUDE lines, and writes the engine file (not a JSON sidecar).
- Status tracking (Engine data → Status tracking) is a read-only index of campaign statuses found in project `.txt` files: where each status is set, unset, required or mentioned.
- Mod settings (Engine data → Mod settings) edits the project `settings.txt` manifest: description, version, `requires` (dependency load order), game and engine version bounds. Play uses that requires list plus this folder name as `--mods`. The player's global `mods.txt` is not edited.
