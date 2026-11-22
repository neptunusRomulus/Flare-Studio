# Event editor — a placed event instance and its script file

Hints, not contracts: verify against `src/` before trusting a line.
Opened by double-clicking a placed event on the map (`src/components/EventDialog.tsx`, helper modules in
`src/editor/eventScripts.ts` and `src/editor/eventFormProperties.ts`).

## What the user can do

- Inspect and change a placed event: position, hotspot, `activate`, `requires_*`, cooldown/delay, tooltip.
- Edit the reusable `scripts/<id>.txt` the instance points at, as a queue of `[event]` steps (set_status,
  reward_*, loot, spawn, msg, cutscene, book, script, …).
- Add engine keys the form has no field for, through the searchable extra-property palette.
- Pick a `script=` target from the same suggestion list books and NPC dialogue use.
- Create a beginner **Random dungeon** from an event: Studio writes the host map, its hidden openings map and
  the rules file, links the event to the host, and lets the user draw entrance, normal and exit rooms.

## Acceptance criteria

Written before the split below, one line per provable outcome; each is true today and must stay true.

- [x] A saved script keeps every step the form does not model — unknown `[event]` component keys, repeated
  values, comments, blank lines and step order survive the round trip.
  Enforced by `src/editor/eventScripts.test.ts` ("preserves comments when unchanged") and
  `src/editor/eventFormProperties.test.ts` ("keeps keys the form does not own").
- [x] Instance keys and action keys stay apart: the map file receives only `location`, `hotspot`, `activate`,
  `requires_*`, `cooldown`/`delay`, tooltip and `script=scripts/<id>.txt`; the action components stay in the
  script file. Enforced by `src/editor/eventScripts.test.ts` ("splits instance keys from action keys").
- [x] Every event key flare-engine `c6772106` loads that the form has no field for is still editable and
  round-trips, including repeated values. Enforced by `src/editor/eventFormProperties.test.ts` ("round-trips
  every engine key" and "covers every event key … the form has no field for").
- [x] The usage count in the Events rail counts live placements on the open map, including unsaved ones, and
  ignores that map's saved copy. Enforced by `src/editor/eventScripts.test.ts`.
- [x] Random dungeon writes a host map, a hidden openings map and a rules file, and points the event at the
  host. Enforced by `src/editor/randomDungeon.test.ts` and `src/components/engine/RandomDungeonDialog.test.tsx`.
- [x] Beginner rules keep door chunks closed (`doors_max=0`), reuse the first room's size for later rooms and
  report a missing entrance, missing exit, missing openings or mismatched room sizes before launch. Enforced by
  the same tests.
- [x] Drawing a room creates a sealed, blank map; Studio never paints walls for the user. Enforced by
  `src/editor/randomDungeon.test.ts` ("builds a sealed blank room …").
- [x] The Random dungeon UI shows plain labels; `doors_max` is fixed at zero in this flow and stays editable in
  the advanced procgen editor. Enforced by `RandomDungeonDialog.test.tsx`.
- [ ] `script=` suggestions come from one shared list (`EVENT_SCRIPT_LIST_ID`), so a script created for a book
  or NPC dialogue shows up in the event inspector — no second Events tab. Manual check.
- [ ] Deleting a script file asks first and goes through the `delete-project-file` IPC, never a direct unlink
  from the renderer. Manual check (Electron restart required after IPC additions).

## Where it lives

| Concern | File |
|---|---|
| Dialog shell, dirty tracking, layout | `src/components/EventDialog.tsx` |
| Instance vs action split, parse/serialize/merge | `src/editor/eventScripts.ts` |
| Instance keys for the map file (pure, tested) | `src/components/events/eventInstanceProps.ts` |
| The floating window around the form (title, save, resize) | `src/components/events/EventDialogFrame.tsx` |
| Random-dungeon link helpers (map file, inherited style, room name) | `src/components/events/dungeonLink.ts` |
| A map object read back into the form (pure, tested) | `src/components/events/eventDataFromObject.ts` |
| The map object an event save writes (pure, tested) | `src/components/events/eventInstanceUpdate.ts` |
| Writing one `scripts/*.txt` with a merge base | `src/components/events/eventScriptSave.ts` |
| Keys the form does not model | `src/editor/eventExtraProperties.ts` |
| Sections: information, positioning, requirements, script form | `src/components/events/` |
| Activation ↔ Flare mapping, instance model | `src/components/events/eventDialogModel.ts` |
| Usage counts | `src/hooks/useEventScripts.ts` |
| Random dungeon host, openings and rooms | `src/editor/randomDungeon.ts` |
| Random dungeon beginner dialog | `src/components/engine/RandomDungeonDialog.tsx` |

## Known traps

- The dialog is ~970 lines and is the top churn candidate (`npm run radar`): instance inspector, script queue
  editor, procgen events and the random-dungeon launch all live in one component. Split it along those seams,
  not by line count.
- `activate` is stored as a Flare token (`on_trigger`, `on_interact`, `on_load`, `on_leave`, `on_mapexit`,
  `on_clear`, `static`); the UI labels are Studio language. An unknown value in an existing file must survive,
  not be coerced to the default.
- Map export writes the instance keys only. Editing a script from here changes every placement that points at
  it — say so before saving, the same way `delete-project-file` does.
- The random-dungeon host uses `hero_pos=0,0` like the official Empyrean hosts; `Try in game` quick-launches
  that host, so the first view is the empty host before the procgen event fills it. Do not move the hero into
  the event rectangle just to make the launch look busier.
