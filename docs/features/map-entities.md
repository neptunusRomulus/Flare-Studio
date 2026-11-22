# Map, entities, events and the quest map

Feature detail split out of `AGENTS.md` (2026-11-22). Rules and invariants live in `AGENTS.md`; verify against
`src/` before trusting a line here — the code wins.

## Entities

- "+" in the list header. Add dialogs have no coordinates: position is instance data set by placing on the map.
  Unplaced = -1,-1, shown as "Not placed", not exported to the map (`src/editor/entityPlacementRules.ts`).

## Events and scripts

- Events are reusable `scripts/*.txt` files (a queue of `[event]` steps: EventManager components such as
  `set_status`, `reward_*`, `loot`, `spawn`, `msg`, `cutscene`, `book`, `script`). The Events rail lists those
  files, with a usage count. Drag (or arm and drag an area) onto the map to place an instance.
- The instance inspector (double-click a placed event) sets location, hotspot, `activate` (`on_trigger`,
  `on_interact`, `on_load`, `on_leave`, `on_mapexit`, `on_clear`, `static`), `requires_*`, cooldown/delay,
  tooltip and `script=`. Map export writes those instance keys plus `script=scripts/<id>.txt`, not the action
  components. Books, NPC dialogue and other `script=` fields use the same list (`event-script-suggestions`).
- No second Events tab. Deleting a script file uses the `delete-project-file` IPC (Electron restart required
  after this addition).

## Quest map

- Content > Quests: the Quest Map (`src/components/QuestMapView.tsx`, graph in `src/editor/questMap.ts`)
  replaces the map view; the network button next to "+ Quest" toggles it. Read-only: quests, the NPCs and map
  events that start/advance/end (NPCs also: talk about) them, and quest unlocks, linked by statuses.
  Dragged card positions live only in the Studio sidecar `content/quest-map.json`.
