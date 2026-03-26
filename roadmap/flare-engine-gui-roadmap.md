# Flare Engine GUI Roadmap
I finished inspecting the Flare mod content structure and sampled the actual schema keys across maps, scripts, powers, items, NPCs, quests, and engine configs. Next I’ll synthesize this into: 1) what the engine can do, 2) what core systems exist, and 3) an implementation-ready GUI feature checklist prioritized by must-have vs optional.

Flare is a strongly data-driven ARPG engine with a lot of game logic exposed through text files, not hardcoded content. From the mod folders you pointed to, your GUI should be treated as a full mod authoring suite, not just a map tool.
## What Flare Is Capable Of

1. Mod stacking and overrides.
2. INI-like content definitions with section blocks, include composition, and append-style extension.
3. Full RPG stat system:
   - primary stats, damage types, resist/absorb/block/avoidance rules, XP tables, classes, equipment flags, death penalties.
4. Skill/power system:
   - active and passive powers, cooldowns, resource costs, targeting rules, LOS checks, projectiles, buffs/debuffs, chained effects, upgrade tiers.
5. Itemization system:
   - qualities, level requirements, stat bonuses, equip slots/flags, stack limits, quest items, consumables, item-granted powers, loot visuals/sfx.
6. Enemy system:
   - stats, AI behavior knobs, powers, pursuit/flee tuning, rarity, categories, loot tables, status-triggered behavior.
7. NPC/dialogue system:
   - topic/response dialogues, conditions by status/items, shops, stock rules, rewards, script hooks, teleport and save-game actions.
8. Quest system:
   - status-flag-driven objectives and progression text.
9. Event scripting system:
   - condition/action rules (status checks, item checks, set/unset status, give/remove items, XP/currency rewards, map changes, spawn, camera shake, audio).
10. Map/world system:
    - isometric tiled maps, multi-layer tile data, map events, inter-map transitions, on-load and trigger events, NPC placement.
11. UI skin/layout modding:
    - menu/widget coordinates, dimensions, labels, slots, sounds, backgrounds.
12. Cutscene/book systems:
    - image + caption sequences, pauses, music; interactive menu-like book/crafting screens.
13. Localization:
    - multi-language support via translation files.
14. Audio/visual assets:
    - OGG, PNG, TTF plus animation and tileset definitions.

## Systems Your GUI Needs

1. Mod manager.
2. Data browser by domain (maps, items, powers, enemies, npcs, quests, scripts, engine configs, menus, localization).
3. Structured editors per domain, not raw text-only.
4. Include/append-aware editor (show inherited fields and effective final values).
5. ID management and cross-reference index (who uses this item/power/status/map).
6. Status-flag manager (create, rename, usage graph).
7. Validation engine (missing refs, duplicate IDs, invalid ranges, bad asset paths, unreachable quest states).
8. Search + dependency graph.
9. Asset picker with previews for icons, tiles, portraits, audio.
10. Export/save preserving original format style.

## Must-Have Editors for V1

1. Item editor.
2. Power editor.
3. Enemy editor.
4. NPC/dialogue editor.
5. Quest editor.
6. Loot table editor.
7. Script rule editor (condition/action blocks).
8. Engine config editor (combat/stats/classes/xp/misc).
9. Map metadata + event editor (even if tile painting stays in Tiled initially).
10. Localization editor.

## Strongly Recommended UX Features

1. Node/flow view for dialogues and script events.
2. Live consistency warnings while typing.
3. One-click launch of Flare with selected mods and debug flags.
4. Effective-value preview under current mod load order.
5. Safe refactors (rename status/item/power and update references globally).
6. Field-level help tooltips from schema docs.

## Practical Scope Advice

1. V1: data integrity first, visuals second.
2. Keep map tile painting optional early; focus on event/NPC/transition editing around maps.
3. Build schema-driven forms so new keys can be added without rewriting the UI.
4. Treat status flags as first-class entities; they are the backbone of quests, NPC flow, and scripts.
