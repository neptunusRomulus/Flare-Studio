/**
 * The one tileset import path: the sidebar Upload button and the
 * "Start with template" project option both go through here.
 * A tab holds one tileset; a layer has at most MAX_LAYER_TABS tabs.
 */
import type { TileMapEditor } from './TileMapEditor';
import { defTilesForImage, type DefSlicedTile } from './tilesetDef';
import { getStoredFlarePath } from '@/flare/flarePathStore';

export const MAX_LAYER_TABS = 10;

type TabLike = { id: number; tileset?: unknown };

export type TilesetImportEditor = {
  getLayerTabs: (layerType: string) => TabLike[];
  getActiveLayerTabId: (layerType: string) => number | null;
  createLayerTab: (layerType: string, name?: string) => number;
  setActiveLayerTab: (layerType: string, tabId: number) => void;
  getGroundTileSize?: () => { width: number; height: number };
  importBrushImageToLayerTab: TileMapEditor['importBrushImageToLayerTab'];
};

/** Active tab for a manual import; creates one when the layer has none. null = tab limit reached. */
export function ensureActiveTab(editor: TilesetImportEditor, layerType: string): number | null {
  const tabs = editor.getLayerTabs(layerType) || [];
  const active = editor.getActiveLayerTabId(layerType);
  if (typeof active === 'number') return active;
  if (tabs.length >= MAX_LAYER_TABS) return null;
  const id = editor.createLayerTab(layerType);
  editor.setActiveLayerTab(layerType, id);
  return id;
}

/**
 * Tab for the next of several imports: the active tab while it is still
 * empty, otherwise a new tab. null = tab limit reached.
 */
export function nextEmptyTab(editor: TilesetImportEditor, layerType: string): number | null {
  const tabs = editor.getLayerTabs(layerType) || [];
  const active = editor.getActiveLayerTabId(layerType);
  const activeTab = tabs.find((t) => t.id === active);
  if (activeTab && !activeTab.tileset) return activeTab.id;
  const empty = tabs.find((t) => !t.tileset);
  if (empty) return empty.id;
  if (tabs.length >= MAX_LAYER_TABS) return null;
  return editor.createLayerTab(layerType);
}

export type TilesetImportOptions = {
  /** Real path of the PNG (template import passes the engine file); manual import asks the preload bridge. */
  imagePath?: string | null;
  /** Engine whose mods are searched by file name when the PNG's own mod has no def. */
  flarePath?: string | null;
};

/**
 * Warning for grid slicing when the image isn't an exact multiple of the tile size
 * (the right/bottom remainder is dropped). null = fits, or sizes unknown/invalid.
 */
export function gridFitWarning(imageW: number, imageH: number, tileW: number, tileH: number): string | null {
  const ok = (n: number) => Number.isFinite(n) && n > 0;
  if (![imageW, imageH, tileW, tileH].every(ok)) return null;
  if (imageW % tileW === 0 && imageH % tileH === 0) return null;
  return `This tileset doesn't fit ${tileW}×${tileH} tiles (${imageW}×${imageH})`;
}

/** Tiles from the matching Flare tilesetdef, or null when there is none (then grid slicing is used). */
export async function findDefTiles(
  file: File,
  groundHeight: number,
  opts: TilesetImportOptions = {},
): Promise<Map<number, DefSlicedTile> | null> {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (!api?.findTilesetDef) return null;
  let imagePath = opts.imagePath ?? null;
  if (!imagePath) {
    try { imagePath = (api as { getPathForFile?: (f: File) => string | null }).getPathForFile?.(file) ?? null; } catch { imagePath = null; }
  }
  try {
    const found = await api.findTilesetDef(imagePath || file.name, opts.flarePath ?? getStoredFlarePath());
    if (!found?.text) return null;
    const tiles = defTilesForImage(found.text, file.name, groundHeight);
    return tiles.size > 0 ? tiles : null;
  } catch (err) {
    console.warn('[Tileset] def lookup failed', err);
    return null;
  }
}

/**
 * Import a tileset PNG into a tab: sliced by its Flare tilesetdef when one is
 * found (tile ids and origins kept), otherwise into a uniform ground-size grid.
 * Returns how it was sliced.
 */
export async function importTilesetIntoTab(
  editor: TilesetImportEditor,
  layerType: string,
  tabId: number,
  file: File,
  projectPath?: string,
  opts: TilesetImportOptions = {},
): Promise<{ fromDef: boolean; warning: string | null }> {
  const ground = editor.getGroundTileSize?.() ?? { width: 192, height: 96 };
  const defTiles = await findDefTiles(file, ground.height, opts);
  await editor.importBrushImageToLayerTab(layerType, tabId, file, projectPath, undefined, undefined, ground.width, ground.height, true, defTiles ?? undefined);
  let warning: string | null = null;
  if (!defTiles) {
    const tab = (editor.getLayerTabs(layerType) || []).find((t) => t.id === tabId) as { tileset?: { image?: HTMLImageElement | null } } | undefined;
    const img = tab?.tileset?.image;
    if (img) warning = gridFitWarning(img.naturalWidth || img.width, img.naturalHeight || img.height, ground.width, ground.height);
  }
  return { fromDef: !!defTiles, warning };
}

/** File from a data: URL, for images read by the main process. */
export function fileFromDataUrl(dataUrl: string, name: string): File {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(0, comma);
  const type = (meta.match(/^data:([^;]+)/) || [])[1] || 'image/png';
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type });
}

// Most useful first, so the ones that fit in the tab limit are the ones people paint with.
const TEMPLATE_PRIORITY = [
  'tileset_grassland',
  'tileset_grassland_water',
  'tileset_dungeon',
  'tileset_cave',
  'tileset_snowplains',
  'tileset_snowplains_water',
  'tileset_snowplains_ice',
  'tileset_snowplains_other',
];

export function orderTemplateTilesets<T extends { name: string }>(files: T[]): T[] {
  const rank = (name: string) => {
    const i = TEMPLATE_PRIORITY.indexOf(name.replace(/\.png$/i, '').toLowerCase());
    return i < 0 ? TEMPLATE_PRIORITY.length : i;
  };
  return [...files].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

export type TemplateImportResult = { imported: string[]; skipped: string[]; failed: string[]; misfit: string[] };

/**
 * Import the installed Flare's fantasycore tilesets into the Background
 * layer, one tab each, until the tab limit.
 */
export async function importTemplateTilesets(
  editor: TilesetImportEditor,
  flarePath: string,
  projectPath?: string,
  layerType = 'background',
  onProgress?: (done: number, total: number) => void,
): Promise<TemplateImportResult> {
  const result: TemplateImportResult = { imported: [], skipped: [], failed: [], misfit: [] };
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (!api?.listTemplateTilesets || !api.readFileAsDataURL) return result;
  const listing = await api.listTemplateTilesets(flarePath);
  if (!listing.ok) return result;
  let firstTab: number | null = null;
  const ordered = orderTemplateTilesets(listing.files);
  let done = 0;
  onProgress?.(0, ordered.length);
  for (const entry of ordered) {
    if (done > 0) onProgress?.(done, ordered.length);
    done++;
    const tabId = nextEmptyTab(editor, layerType);
    if (tabId === null) {
      result.skipped.push(entry.name);
      continue;
    }
    try {
      const dataUrl = await api.readFileAsDataURL(entry.path);
      if (!dataUrl) throw new Error('unreadable');
      const { warning } = await importTilesetIntoTab(editor, layerType, tabId, fileFromDataUrl(dataUrl, entry.name), projectPath, { imagePath: entry.path, flarePath });
      if (warning) result.misfit.push(entry.name);
      if (firstTab === null) firstTab = tabId;
      result.imported.push(entry.name);
    } catch (err) {
      console.warn('[Template] Could not import', entry.name, err);
      result.failed.push(entry.name);
    }
  }
  if (firstTab !== null) editor.setActiveLayerTab(layerType, firstTab);
  return result;
}
