/**
 * menus/*.txt panel position math. Menu::parseMenuKey reads pos (rectangle)
 * and align; Menu::align then calls Utils::alignToScreenEdge (c6772106).
 * Integer division matches C++ toward-zero for these non-negative sizes.
 * Virtual view size follows RenderDevice::windowResizeInternal plus
 * engine/resolutions.txt (virtual_height, required_width/height, frame).
 */

export const ALIGNMENTS = [
  'topleft', 'top', 'topright',
  'left', 'center', 'right',
  'bottomleft', 'bottom', 'bottomright',
  'frame_topleft', 'frame_top', 'frame_topright',
  'frame_left', 'frame_center', 'frame_right',
  'frame_bottomleft', 'frame_bottom', 'frame_bottomright',
] as const;

export type MenuAlign = (typeof ALIGNMENTS)[number];

export type Rect = { x: number; y: number; w: number; h: number };

export type Resolutions = {
  virtualHeights: number[];
  minScreenW: number;
  minScreenH: number;
  frameW: number;
  frameH: number;
  minRenderSize?: number;
  maxRenderSize?: number;
};

export const DEFAULT_RESOLUTIONS: Resolutions = {
  virtualHeights: [960, 1080, 1440],
  minScreenW: 1280,
  minScreenH: 720,
  frameW: 1674,
  frameH: 960,
};

export function parseResolutionsText(content: string): Resolutions {
  const out = { ...DEFAULT_RESOLUTIONS, virtualHeights: [...DEFAULT_RESOLUTIONS.virtualHeights] };
  for (const raw of String(content || '').split(/\r?\n/)) {
    const line = raw.trim();
    const eq = line.indexOf('=');
    if (eq <= 0 || line.startsWith('#')) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === 'virtual_height') {
      out.virtualHeights = value.split(',').map((part) => Number(part.trim())).filter((n) => n > 0).sort((a, b) => a - b);
    } else if (key === 'required_width') out.minScreenW = Number(value) || out.minScreenW;
    else if (key === 'required_height') out.minScreenH = Number(value) || out.minScreenH;
    else if (key === 'menu_frame_width') out.frameW = Number(value) || out.frameW;
    else if (key === 'menu_frame_height') out.frameH = Number(value) || out.frameH;
  }
  return out;
}

/** view_w / view_h for a window size, per RenderDevice::windowResizeInternal. */
export function viewSize(screenW: number, screenH: number, resolutions: Resolutions = DEFAULT_RESOLUTIONS): { viewW: number; viewH: number } {
  let viewH = screenH;
  const minRender = resolutions.minRenderSize ?? 0;
  let maxRender = resolutions.maxRenderSize ?? 0;
  const heights = resolutions.virtualHeights;
  if (maxRender === 0 && heights.length) maxRender = heights[heights.length - 1];
  if (minRender > 0 && minRender > viewH) viewH = minRender;
  if (heights.length) {
    if (minRender < heights[0] && screenH < heights[0]) viewH = heights[0];
    else if (screenH >= maxRender) viewH = maxRender;
  }
  viewH = trunc(viewH);
  let viewW = trunc(screenW * (viewH / screenH));
  const minScreenW = Math.max(resolutions.minScreenW, resolutions.frameW);
  if (viewW < minScreenW) viewW = minScreenW;
  return { viewW, viewH };
}

const trunc = (n: number) => (n < 0 ? Math.ceil(n) : Math.floor(n));

export function parseAlignment(value: string, fallback: MenuAlign = 'topleft'): MenuAlign {
  const s = String(value || '').trim();
  return (ALIGNMENTS as readonly string[]).includes(s) ? (s as MenuAlign) : fallback;
}

export function parsePos(value: string): Rect {
  const parts = String(value || '').split(',').map((part) => Number(part.trim()));
  return {
    x: Number.isFinite(parts[0]) ? trunc(parts[0]) : 0,
    y: Number.isFinite(parts[1]) ? trunc(parts[1]) : 0,
    w: Number.isFinite(parts[2]) ? trunc(parts[2]) : 0,
    h: Number.isFinite(parts[3]) ? trunc(parts[3]) : 0,
  };
}

export function formatPos(rect: Rect): string {
  return `${rect.x},${rect.y},${rect.w},${rect.h}`;
}

/**
 * Align a pos rectangle onto the view, like Utils::alignToScreenEdge.
 * `pos` is the pre-align rectangle (window_area_base + size).
 */
export function alignToScreenEdge(
  pos: Rect,
  align: MenuAlign,
  viewW: number,
  viewH: number,
  frameW = 0,
  frameH = 0,
): Rect {
  const r = { ...pos };
  const halfW = trunc(viewW / 2);
  const halfH = trunc(viewH / 2);
  const rw = trunc(r.w / 2);
  const rh = trunc(r.h / 2);
  switch (align) {
    case 'topleft':
      break;
    case 'top':
      r.x = (halfW - rw) + r.x;
      break;
    case 'topright':
      r.x = (viewW - r.w) + r.x;
      break;
    case 'left':
      r.y = (halfH - rh) + r.y;
      break;
    case 'center':
      r.x = (halfW - rw) + r.x;
      r.y = (halfH - rh) + r.y;
      break;
    case 'right':
      r.x = (viewW - r.w) + r.x;
      r.y = (halfH - rh) + r.y;
      break;
    case 'bottomleft':
      r.y = (viewH - r.h) + r.y;
      break;
    case 'bottom':
      r.x = (halfW - rw) + r.x;
      r.y = (viewH - r.h) + r.y;
      break;
    case 'bottomright':
      r.x = (viewW - r.w) + r.x;
      r.y = (viewH - r.h) + r.y;
      break;
    case 'frame_topleft':
      r.x = trunc((viewW - frameW) / 2) + r.x;
      r.y = trunc((viewH - frameH) / 2) + r.y;
      break;
    case 'frame_top':
      r.x = trunc((viewW - frameW) / 2) + (trunc(frameW / 2) - rw) + r.x;
      r.y = trunc((viewH - frameH) / 2) + r.y;
      break;
    case 'frame_topright':
      r.x = trunc((viewW - frameW) / 2) + (frameW - r.w) + r.x;
      r.y = trunc((viewH - frameH) / 2) + r.y;
      break;
    case 'frame_left':
      r.x = trunc((viewW - frameW) / 2) + r.x;
      r.y = trunc((viewH - frameH) / 2) + (trunc(frameH / 2) - rh) + r.y;
      break;
    case 'frame_center':
      r.x = trunc((viewW - frameW) / 2) + (trunc(frameW / 2) - rw) + r.x;
      r.y = trunc((viewH - frameH) / 2) + (trunc(frameH / 2) - rh) + r.y;
      break;
    case 'frame_right':
      r.x = trunc((viewW - frameW) / 2) + (frameW - r.w) + r.x;
      r.y = trunc((viewH - frameH) / 2) + (trunc(frameH / 2) - rh) + r.y;
      break;
    case 'frame_bottomleft':
      r.x = trunc((viewW - frameW) / 2) + r.x;
      r.y = trunc((viewH - frameH) / 2) + (frameH - r.h) + r.y;
      break;
    case 'frame_bottom':
      r.x = trunc((viewW - frameW) / 2) + (trunc(frameW / 2) - rw) + r.x;
      r.y = trunc((viewH - frameH) / 2) + (frameH - r.h) + r.y;
      break;
    case 'frame_bottomright':
      r.x = trunc((viewW - frameW) / 2) + (frameW - r.w) + r.x;
      r.y = trunc((viewH - frameH) / 2) + (frameH - r.h) + r.y;
      break;
    default:
      break;
  }
  return r;
}

/** Inverse of alignToScreenEdge: a dragged screen top-left back to pos x,y. */
export function posFromScreen(
  screen: { x: number; y: number },
  size: { w: number; h: number },
  align: MenuAlign,
  viewW: number,
  viewH: number,
  frameW = 0,
  frameH = 0,
): Rect {
  const pos = { x: 0, y: 0, w: size.w, h: size.h };
  const alignedOrigin = alignToScreenEdge(pos, align, viewW, viewH, frameW, frameH);
  return { x: screen.x - alignedOrigin.x, y: screen.y - alignedOrigin.y, w: size.w, h: size.h };
}

export type MenuPanel = {
  file: string;
  name: string;
  pos: Rect;
  align: MenuAlign;
  background?: string;
  soundfxOpen?: string;
  soundfxClose?: string;
  enabled?: string;
  /** All other menu keys, in file order. Repeated keys (slot) keep every value. */
  values: Record<string, string[]>;
  tabArea?: Rect;
  /** Original file text, for merge. */
  text: string;
};

/** Fantasy Core menus/powers.txt when the project has no override. */
export const DEFAULT_POWERS_MENU_POS: Rect = { x: 0, y: -35, w: 640, h: 832 };
export const DEFAULT_POWERS_TAB_AREA: Rect = { x: 64, y: 60, w: 512, h: 672 };

const HEADER_KEYS = new Set(['pos', 'align', 'background', 'soundfx_open', 'soundfx_close', 'enabled']);

export function parseMenuText(content: string, file = ''): MenuPanel {
  let pos = { x: 0, y: 0, w: 0, h: 0 };
  let align: MenuAlign = 'topleft';
  let background: string | undefined;
  let soundfxOpen: string | undefined;
  let soundfxClose: string | undefined;
  let enabled: string | undefined;
  const values: Record<string, string[]> = {};
  let tabArea: Rect | undefined;
  for (const raw of String(content || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('[')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === 'pos') pos = parsePos(value);
    else if (key === 'align') align = parseAlignment(value);
    else if (key === 'background') background = value;
    else if (key === 'soundfx_open') soundfxOpen = value;
    else if (key === 'soundfx_close') soundfxClose = value;
    else if (key === 'enabled') enabled = value;
    else if (key === 'tab_area') tabArea = parsePos(value);
    else (values[key] ??= []).push(value);
  }
  const base = file.replace(/^.*\//, '').replace(/\.txt$/, '');
  const name = base.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Menu';
  return { file, name, pos, align, background, soundfxOpen, soundfxClose, enabled, values, tabArea, text: String(content || '') };
}

export type PowersMenuLayout = { pos: Rect; tabArea: Rect; background?: string };

/** Read menus/powers.txt, falling back to Fantasy Core pos/tab_area. */
export function parsePowersMenuLayout(content: string): PowersMenuLayout {
  const panel = parseMenuText(content, 'menus/powers.txt');
  const pos = panel.pos.w > 0 && panel.pos.h > 0 ? panel.pos : DEFAULT_POWERS_MENU_POS;
  const tabArea = panel.tabArea && panel.tabArea.w > 0 && panel.tabArea.h > 0 ? panel.tabArea : DEFAULT_POWERS_TAB_AREA;
  return { pos, tabArea, background: panel.background };
}

/** Convert a power position (relative to menu pos) into a point inside tab_area. */
export function menuToTabPoint(position: { x: number; y: number }, tabArea: Rect): { x: number; y: number } {
  return { x: position.x - tabArea.x, y: position.y - tabArea.y };
}

/** Convert a point inside tab_area back to a menu-relative position string. */
export function tabToMenuPosition(point: { x: number; y: number }, tabArea: Rect, snap = 0): string {
  const snapValue = (n: number) => (snap > 0 ? Math.round(n / snap) * snap : Math.round(n));
  return `${snapValue(point.x + tabArea.x)},${snapValue(point.y + tabArea.y)}`;
}

/** Rewrite only the pos= line; leave every other line untouched. */
export function mergeMenuPos(existingText: string, pos: Rect): string {
  const lines = String(existingText || '').replace(/\r/g, '').split('\n');
  const trailing = lines.length && lines[lines.length - 1] === '';
  if (trailing) lines.pop();
  const value = formatPos(pos);
  let replaced = false;
  const out = lines.map((line) => {
    const trimmed = line.trim();
    if (replaced || trimmed.startsWith('#') || trimmed.startsWith('[')) return line;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return line;
    if (trimmed.slice(0, eq).trim() !== 'pos') return line;
    replaced = true;
    const indent = line.match(/^\s*/)?.[0] || '';
    return `${indent}pos=${value}`;
  });
  if (!replaced) out.unshift(`pos=${value}`);
  return `${out.join('\n')}\n`;
}

/** Rewrite common menu keys while keeping comments, unknown keys and line order. */
export function mergeMenuSettings(existingText: string, panel: Pick<MenuPanel, 'pos' | 'align' | 'background' | 'soundfxOpen' | 'soundfxClose' | 'enabled'> & { values?: Record<string, string[]> }): string {
  const lines = String(existingText || '').replace(/\r/g, '').split('\n');
  const trailing = lines.length && lines[lines.length - 1] === '';
  if (trailing) lines.pop();
  const values: Record<string, string> = {
    pos: formatPos(panel.pos),
    align: panel.align,
    background: panel.background?.trim() || '',
    soundfx_open: panel.soundfxOpen?.trim() || '',
    soundfx_close: panel.soundfxClose?.trim() || '',
    enabled: panel.enabled?.trim() || '',
  };
  const seen = new Set<string>();
  const extraSeen: Record<string, number> = {};
  const extras = panel.values || {};
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) { out.push(line); continue; }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) { out.push(line); continue; }
    const key = trimmed.slice(0, eq).trim();
    if (!(key in values)) {
      if (!(key in extras)) { out.push(line); continue; }
      const index = extraSeen[key] || 0;
      extraSeen[key] = index + 1;
      const extra = extras[key][index];
      if (extra && extra.trim()) {
        const indent = line.match(/^\s*/)?.[0] || '';
        out.push(`${indent}${key}=${extra.trim()}`);
      }
      continue;
    }
    seen.add(key);
    const value = values[key];
    if (!value) continue;
    const indent = line.match(/^\s*/)?.[0] || '';
    out.push(`${indent}${key}=${value}`);
  }
  const missing = Object.entries(values).filter(([key, value]) => value && !seen.has(key));
  if (missing.length) out.unshift(...missing.map(([key, value]) => `${key}=${value}`));
  for (const [key, list] of Object.entries(extras)) {
    if (key in values) continue;
    const start = extraSeen[key] || 0;
    for (const value of list.slice(start)) {
      if (value && value.trim()) out.push(`${key}=${value.trim()}`);
    }
  }
  return `${out.join('\n')}\n`;
}

export const MAIN_MENU_FILES = [
  'inventory.txt',
  'character.txt',
  'powers.txt',
  'log.txt',
  'actionbar.txt',
  'hp.txt',
  'mp.txt',
  'xp.txt',
  'minimap.txt',
  'hudlog.txt',
  'activeeffects.txt',
  'vendor.txt',
  'stash.txt',
  'enemy.txt',
  'talker.txt',
];

/** Menus that stay on screen together in Flare (bars, minimap, combat log, enemy plate). */
export const HUD_MENU_FILES = new Set([
  'actionbar.txt',
  'hp.txt',
  'mp.txt',
  'xp.txt',
  'minimap.txt',
  'hudlog.txt',
  'activeeffects.txt',
  'enemy.txt',
]);

export function menuFileName(file: string): string {
  return file.replace(/\\/g, '/').replace(/^.*\//, '');
}

export function isHudMenu(file: string): boolean {
  return HUD_MENU_FILES.has(menuFileName(file));
}

/**
 * Game-like preview: HUD panels stay visible; other menus show one at a time
 * (the selected one). `showAll` restores the stacked “every panel at once” view.
 */
export function visibleMenuFiles(files: string[], selected: string, showAll: boolean): Set<string> {
  if (showAll) return new Set(files);
  const visible = new Set(files.filter(isHudMenu));
  if (selected) visible.add(selected);
  return visible;
}

export { HEADER_KEYS };
