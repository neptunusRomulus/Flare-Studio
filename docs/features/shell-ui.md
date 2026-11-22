# Shell UI — rail, palette card, zen mode

Feature detail split out of `AGENTS.md` (2026-11-22). Rules and invariants live in `AGENTS.md`; this file is
implementation detail. Verify against `src/` before trusting a line here — the code wins.

## Acceptance criteria

- [ ] Every rail group is reachable by mouse and by Tab / Shift+Tab, and a group hidden with Ctrl+Click opens
  again after unhiding.
- [ ] Clicking a rail target, a palette row or a pane never moves or resizes the palette card.
- [ ] Zen mode starts the canvas at y=0 with no title bar, and the Flare mark stays out of the canvas.

## Right rail and palette card

- No left sidebar. Right edge: a thin always-visible icon rail (`src/components/PaletteRail.tsx`,
  `SIDEBAR_RAIL_WIDTH`); clicking an icon opens the list as a floating card over the canvas
  (`src/components/PaletteCard.tsx`, draggable width in `localStorage`); clicking the active icon again
  (or Escape) closes the card and frees the canvas.
- Rail order = Map (Ground/Object/Collision), Entities (NPC/Enemy/Event), Content (Items/Books/Statuses/Quests),
  then UI Settings + World Settings, then Titles + Stats + Power Tree. Localization is a button inside UI
  Settings, not a rail icon. See `src/components/targetGroups.ts` (`railGroups`). Internal ids stay
  `gameSettings`, `worldSettings`, `strings`, `titles`, `stats` and `powerTree`.
- Tab cycles sub-targets inside a group; Shift+Tab cycles main layers Map → Entities → Content → Settings →
  Character (`src/hooks/useSidebarTabHotkeys.ts`).
- Rail visibility (Map/Entities icons only): Ctrl+Click toggles hide/unhide (the icon dims when hidden); mouse
  wheel over that icon changes opacity. These gestures, plus the group's Tab/Shift+Tab help, are listed on the
  bottom ? tip. There are no separate visibility buttons at the bottom of the rail.
- GID readout only in Debug Mode. Minimap bottom-right.

## Zen mode, brand and window chrome

- Zen mode: no title bar. The canvas starts at y=0; the Flare Studio mark (`src/components/brand/BrandMark.tsx`)
  is itself the clickable rounded-square menu button (no circular chrome), parked just left of the map-tab strip
  (`src/components/CanvasMapTabs.tsx`, follows the strip as it widens) or top-left of the canvas when no strip
  shows = app menu (incl. Engine Settings; `src/components/AppControls.tsx`, `MainMenuDialog.tsx`). Save feedback
  (Saving… / Save failed) lives in that button's tooltip. A red unsaved-changes dot appears on the mark and on
  the menu's Save item; there is no green saved dot.
- Window buttons (minimize/maximize/close) are hidden: `src/components/WindowControlBar.tsx` slides a compact
  floating pill (the buttons only) down at the top-right when the pointer touches the top 6px edge, and hides it
  ~600ms after leaving (`WINDOW_BAR_HOT_ZONE`, `WINDOW_BAR_HIDE_MS`). The rest of that slim strip is an invisible
  drag region for moving the window. While the bar is visible, the logo, map-tab strip, Play/zoom group and the
  palette card's top edge shift down by the strip height (`--window-controls-offset`) so nothing is covered.
  Same IPC (`minimize` / `maximize` / `close`).
- Brand: sources in `assets/brand/` (regenerate with `scripts/brand/`), app icons in `build/icons/`, runtime
  copies in `public/brand/`. Chakra Petch is for the logo only.

## Where it lives

| Concern | File |
|---|---|
| Shell layout, dialog wiring, help targets | `src/components/AppMain.tsx` (being split, one seam per commit) |
| Background selection and template tileset import before the first map | `src/hooks/usePreMapSetup.ts` |
| Rail, palette card | `src/components/PaletteDock.tsx`, `src/components/palette/` |
