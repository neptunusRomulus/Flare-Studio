# Content editors — books, statuses, items, animations, cutscenes, quests

Feature detail split out of `AGENTS.md` (2026-11-22). Rules and invariants live in `AGENTS.md`; verify against
`src/` before trusting a line here — the code wins.

## Acceptance criteria

- [ ] A hand-made `animations/*.txt` is never overwritten: Studio writes `<name>_studio.txt` beside it.
- [ ] Book, status/power and quest saves keep unknown keys, repeated keys and section order (`content.cjs`
  merge helpers, fixtures in `tests/fixtures/`).
- [ ] A power `script=` is written as `trigger,filename` and resolves against an existing `scripts/*.txt`.
- [ ] Editing a randomizer definition does not detach the items that reference it by `randomizer_def`.

## Books

- The Books rail layer edits `books/*.txt` as MenuBook files: header `pos`, `align`, `background`, `close`,
  `soundfx_open`, `soundfx_close`; `[text]`, `[image]`, `[button]`; and `[event_open]` / `[event_close]`
  (not `[event]`). There is no title key. Buttons and book events use EventManager component keys (`script`,
  `book`, `cutscene`, `requires_status`, …). Empty keys are omitted; comments, INCLUDE and unknown keys are kept.
  Header keys missing from INCLUDE files are not invented on save.

## Statuses (powers, effects, campaign statuses)

- Statuses layer = powers, effects and campaign statuses under Studio names (`src/components/powers/`, pure
  logic in `src/editor/powers/`): Skill / Monster Attack / Item Use / Trap from where a power is used, Buff /
  Debuff for effects, Story Flag for statuses. Files are edited line by line (`sectionFile.ts`); slider bands
  come from `scripts/power-tiers.mjs` (flare-game p33/p66). Status fields use the shared
  `story-flag-suggestions` datalist.
- Power editor `script=` is `trigger,filename` (`on_cast`, `on_hit`, or `on_wall` plus a `scripts/*.txt` path).
  It uses the shared `event-script-suggestions` list.

## Items, animations, cutscenes

- `items/random/*.txt` randomizer definitions are edited on the Items Random tab; `randomizer_def` on an item
  points at one of those files.
- Animation definitions in `animations/*.txt` are edited from Engine data → Animations. Unpacked sections use
  `render_size` and `position` on an 8-direction sheet; packed sections list `frame=` rows. The editor previews
  the selected section and direction from the project image.
- Cutscenes in `cutscenes/*.txt` are edited on the World Settings card. The editor lists those files, keeps
  component order and INCLUDE lines, and writes the engine file (not a JSON sidecar).

## Quests

- Multi-stage quest journals are edited as step cards; the Role center uses Moments (including Play and a
  shop-open indicator). List and Board stay behind a toggle.
