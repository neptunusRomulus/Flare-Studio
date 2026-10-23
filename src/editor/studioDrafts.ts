import {
  applyTileToProjectIndex,
  canonicalJson,
  contentSlug,
  exportCutsceneFile,
  exportFogMask,
  exportLanguagePot,
  exportParallaxFile,
  exportProcgenRules,
  exportTilesetConfig,
} from '../adapters/flare/flareAdapter.cjs';

export type TileDraft = {
  width: number;
  height: number;
  orientation: 'isometric' | 'orthogonal';
};

export type MapPresentation = {
  parallax: string;
  fogofwar: string;
  save_fogofwar: string;
  procgen_type: string;
  procgen_unique_status: string;
  procgen_reset_status: string;
};

export type CutsceneScene = { caption?: string; image?: string; pause?: string; soundfx?: string };
export type CutsceneScroll = { text?: string; image?: string; separator?: string };
export type CutsceneDraft = {
  caption_margins?: string;
  caption_background?: string;
  vscroll_speed?: string;
  menu_backgrounds?: string;
  music?: string;
  scenes: CutsceneScene[];
  vscroll: CutsceneScroll[];
};

export type ParallaxLayerDraft = {
  image?: string;
  speed?: string;
  fixed_speed?: string;
  map_layer?: string;
};

export type FogDraft = {
  radius?: string;
  bits_per_tile?: string;
  color_dark?: string;
  color_fog?: string;
  tileset_dark?: string;
  tileset_fog?: string;
  bits: string[];
  tiles: string[];
  data?: string;
};

export type ProcgenDraft = {
  doors_max?: string;
  main_path_length_min?: string;
  main_path_length_max?: string;
  main_path_attempts_max?: string;
  branch_length_min?: string;
  branch_length_max?: string;
  branches_per_door_level_max?: string;
  door_spacing_min?: string;
  chunks: string[];
};

export type ProjectFile = { path: string; content: string };

const TEXT_KEYS = new Set(['name', 'title', 'description', 'quest_text', 'caption', 'text', 'tooltip', 'msg', 'book']);

export function emptyMapPresentation(): MapPresentation {
  return {
    parallax: '',
    fogofwar: '',
    save_fogofwar: '',
    procgen_type: '',
    procgen_unique_status: '',
    procgen_reset_status: '',
  };
}

export function normalizeTileDraft(input?: { width?: number; height?: number; orientation?: string } | null): TileDraft {
  const width = Math.floor(Number(input?.width));
  const height = Math.floor(Number(input?.height));
  return {
    width: Number.isFinite(width) && width > 0 ? width : 64,
    height: Number.isFinite(height) && height > 0 ? height : 32,
    orientation: input?.orientation === 'orthogonal' ? 'orthogonal' : 'isometric',
  };
}

export function linesOf(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function readCanonical(text: string | null | undefined): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function tileFiles(indexText: string | null, tileInput?: { width?: number; height?: number; orientation?: string } | null): ProjectFile[] {
  const tile = normalizeTileDraft(tileInput);
  const text = exportTilesetConfig(tile);
  const files: ProjectFile[] = [
    { path: 'engine/tileset_config.txt', content: text },
    {
      path: 'content/documents/engine/tileset_config.txt.json',
      content: canonicalJson('document', { path: 'engine/tileset_config.txt', text }),
    },
  ];
  if (indexText) files.push({ path: 'project.json', content: applyTileToProjectIndex(indexText, tile) });
  return files;
}

export function cutsceneFiles(slugInput: string, draft: CutsceneDraft): ProjectFile[] {
  const slug = contentSlug(slugInput, 'cutscene');
  return [
    { path: `cutscenes/${slug}.txt`, content: exportCutsceneFile(draft) },
    { path: `content/cutscenes/${slug}.json`, content: canonicalJson('cutscene', { id: slug, ...draft }) },
  ];
}

export function collectTranslatableStrings(value: unknown, into: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectTranslatableStrings(item, into);
    return into;
  }
  if (!value || typeof value !== 'object') return into;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (TEXT_KEYS.has(key) && typeof child === 'string' && child.trim()) into.push(child);
    else if (child && typeof child === 'object') collectTranslatableStrings(child, into);
  }
  return into;
}

export function msgidsFromPot(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/^msgid "(.*)"$/gm)) {
    const raw = match[1] || '';
    const decoded = raw.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    if (decoded) found.push(decoded);
  }
  return found;
}

export function potFiles(entries: string[]): ProjectFile[] {
  const strings = entries.map((entry) => entry.trim()).filter(Boolean);
  return [
    { path: 'languages/data.pot', content: exportLanguagePot(strings) },
    { path: 'content/languages/catalog.json', content: canonicalJson('language-catalog', { strings }) },
  ];
}

export function parallaxFiles(slugInput: string, layers: ParallaxLayerDraft[]): ProjectFile[] {
  const slug = contentSlug(slugInput, 'parallax');
  return [
    { path: `maps/parallax/${slug}.txt`, content: exportParallaxFile(layers) },
    { path: `content/parallax/${slug}.json`, content: canonicalJson('parallax', { id: slug, layers }) },
  ];
}

export function parallaxRelativePath(slugInput: string): string {
  return `maps/parallax/${contentSlug(slugInput, 'parallax')}.txt`;
}

export function fogFiles(mask: FogDraft): ProjectFile[] {
  return [
    { path: 'engine/fow_mask.txt', content: exportFogMask(mask) },
    { path: 'content/fog/mask.json', content: canonicalJson('fog', mask) },
  ];
}

export function procgenFiles(slugInput: string, rules: ProcgenDraft): ProjectFile[] {
  const slug = contentSlug(slugInput, 'rules');
  return [
    { path: `maps/procgen/${slug}.txt`, content: exportProcgenRules(rules) },
    { path: `content/procgen/${slug}.json`, content: canonicalJson('procgen', { id: slug, ...rules }) },
  ];
}

export function procgenRelativePath(slugInput: string): string {
  return `maps/procgen/${contentSlug(slugInput, 'rules')}.txt`;
}

/** Header keys `exportMapText` already understands. `procgen_chunks` is not a known key. */
export function mapHeaderForExport(presentation: MapPresentation): {
  parallax?: string;
  fogofwar?: string;
  save_fogofwar?: string;
  procgen_type?: string;
  procgen_unique_status?: string;
  procgen_reset_status?: string;
} {
  const header: {
    parallax?: string;
    fogofwar?: string;
    save_fogofwar?: string;
    procgen_type?: string;
    procgen_unique_status?: string;
    procgen_reset_status?: string;
  } = {};
  if (presentation.parallax) header.parallax = presentation.parallax;
  if (presentation.fogofwar) header.fogofwar = presentation.fogofwar;
  if (presentation.save_fogofwar) header.save_fogofwar = presentation.save_fogofwar;
  if (presentation.procgen_type) header.procgen_type = presentation.procgen_type;
  if (presentation.procgen_unique_status) header.procgen_unique_status = presentation.procgen_unique_status;
  if (presentation.procgen_reset_status) header.procgen_reset_status = presentation.procgen_reset_status;
  return header;
}
