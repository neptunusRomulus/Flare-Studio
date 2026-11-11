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
  /** Original file text, for merge. */
  text: string;
};

const HEADER_KEYS = new Set(['pos', 'align', 'background', 'soundfx_open', 'soundfx_close', 'enabled']);

export function parseMenuText(content: string, file = ''): MenuPanel {
  let pos = { x: 0, y: 0, w: 0, h: 0 };
  let align: MenuAlign = 'topleft';
  let background: string | undefined;
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
  }
  const base = file.replace(/^.*\//, '').replace(/\.txt$/, '');
  const name = base.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Menu';
  return { file, name, pos, align, background, text: String(content || '') };
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

export { HEADER_KEYS };
