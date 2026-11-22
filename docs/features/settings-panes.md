# Settings cards and Engine data panes

Feature detail split out of `AGENTS.md` (2026-11-22). Rules and invariants live in `AGENTS.md`; verify against
`src/` before trusting a line here — the code wins.

## Stats card

- The Stats card XP pane also edits `enemies/xp_scaling/*.txt` tables (`[absolute]` / `[relative]`
  `level=N,multiplier`). Enemies point at a table with `xp_scaling=`. The shared `xp-scaling-suggestions`
  datalist feeds the enemy field.
- The Stats card also edits `engine/combat.txt`, `engine/damage_types.txt`, `engine/xp_table.txt`,
  `engine/classes.txt`, `engine/hero_options.txt`, `engine/hero_layers.txt` and `engine/equip_flags.txt`
  (in-card sections). `engine/elements.txt` is deprecated in Flare; use damage types. `engine/hero_layers.txt`
  is also deprecated; Flare prefers `render_layers` in `engine/stats.txt`. Equip flags use `id` and `name`
  (not the outdated name/description example in the default file).
- `items/step_sounds.txt` and `engine/avatar/<base>.txt` are edited in the Stats Appearance pane. `sfx_step` in
  `engine/stats.txt` uses the `step-sound-suggestions` list of those ids.

## UI Settings card

- Edits `engine/font_settings.txt`, `engine/font_colors.txt`, `engine/tooltips.txt`, `engine/resolutions.txt`,
  `engine/combat_text.txt`, `engine/icons.txt`, `engine/menu_backgrounds.txt`, `engine/mouse_cursor.txt`,
  `engine/widget_settings.txt`, `engine/default_settings.txt` and `engine/default_keybindings.txt` (in-card
  sections). Tile size, Localization and Engine data stay on the General pane. `default_settings` and
  `default_keybindings` are in a Defaults pane; they are the mod's shipped player defaults (often only in packs
  such as gcw0_defaults). Colors are `r,g,b` or `r,g,b,a`. `font_fallback` has been removed from Flare. There is
  no `fonts.txt`; TTF files live in `fonts/` and are named in `font_settings.txt`. The Fonts pane can add a
  `.ttf` into the project and preview it. `soundfx/subtitles.txt` is edited in a Subtitles pane (style plus
  id/text rows tied to a sound file). Keybindings are saved in the current format (`file_version` and a
  `[default]` section of `action=bind,type`).

## World Settings card

- Edits `engine/gameplay.txt`, `engine/misc.txt`, `engine/death_penalty.txt`, `engine/default_music.txt` and
  `engine/loot.txt`. `engine/fow_mask.txt` was already in the Fog of war block. Cutscenes are edited here too
  (see `content-editors.md`).

## Engine data panes

- Status tracking (Engine data → Status tracking) is a read-only index of campaign statuses found in project
  `.txt` files: where each status is set, unset, required or mentioned.
- Mod settings (Engine data → Mod settings) edits the project `settings.txt` manifest: description, version,
  `requires` (dependency load order), game and engine version bounds. Play uses that requires list plus this
  folder name as `--mods`. The player's global `mods.txt` is not edited.
- Test save (Engine data → Test save) writes a temporary `avatar.txt` under
  `path_user/saves/<prefix>_studio_test/1/` with map, XP, items and campaign statuses. It does not launch Flare.
  The Play button still writes its own short-lived playtest save when the user runs the game. Requires an
  Electron restart for `write-flare-test-save`.
