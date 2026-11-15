/**
 * Stacking scale for overlays that portal to document.body.
 * Use these values via style={{ zIndex }} — Tailwind cannot see dynamic z-[${n}] classes.
 *
 * Studio windows sit at 50–70; vendor dialogs at 80 (inline style wins over a z-[9999] class).
 * Select menus and popovers share 10001 so they clear those windows.
 * Inline confirms are 20000; tooltips sit just above so they stay visible inside confirms and popovers.
 */
export const Z_INDEX = {
  toast: 100,
  select: 10001,
  popover: 10001,
  inlineConfirm: 20000,
  tooltip: 20050,
} as const;
