/**
 * The one tileset import path: the sidebar Upload button and the
 * "Start with template" project option both go through here.
 * A tab holds one tileset; a layer has at most MAX_LAYER_TABS tabs.
 */
import type { TileMapEditor } from './TileMapEditor';

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

/** Slice the image into project-size tiles in that tab (same call the Upload button always used). */
export async function importTilesetIntoTab(
  editor: TilesetImportEditor,
  layerType: string,
  tabId: number,
  file: File,
  projectPath?: string,
): Promise<void> {
  const ground = editor.getGroundTileSize?.() ?? { width: 192, height: 96 };
  try {
    await editor.importBrushImageToLayerTab(layerType, tabId, file, projectPath, undefined, undefined, ground.width, ground.height, true);
  } catch {
    // Fall back to the legacy call if the runtime class shape differs.
    await editor.importBrushImageToLayerTab(layerType, tabId, file, projectPath);
  }
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

export type TemplateImportResult = { imported: string[]; skipped: string[]; failed: string[] };

/**
 * Import the installed Flare's fantasycore tilesets into the Background
 * layer, one tab each, until the tab limit.
 */
export async function importTemplateTilesets(
  editor: TilesetImportEditor,
  flarePath: string,
  projectPath?: string,
  layerType = 'background',
): Promise<TemplateImportResult> {
  const result: TemplateImportResult = { imported: [], skipped: [], failed: [] };
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (!api?.listTemplateTilesets || !api.readFileAsDataURL) return result;
  const listing = await api.listTemplateTilesets(flarePath);
  if (!listing.ok) return result;
  let firstTab: number | null = null;
  for (const entry of orderTemplateTilesets(listing.files)) {
    const tabId = nextEmptyTab(editor, layerType);
    if (tabId === null) {
      result.skipped.push(entry.name);
      continue;
    }
    try {
      const dataUrl = await api.readFileAsDataURL(entry.path);
      if (!dataUrl) throw new Error('unreadable');
      await importTilesetIntoTab(editor, layerType, tabId, fileFromDataUrl(dataUrl, entry.name), projectPath);
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
