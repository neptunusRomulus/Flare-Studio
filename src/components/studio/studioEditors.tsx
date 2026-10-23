import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppContext } from '@/context/AppContext';
import { toast } from '@/hooks/use-toast';
import { loadConfigDocument, projectRoot, writeProjectFiles } from '@/editor/projectFiles';
import {
  collectTranslatableStrings,
  cutsceneFiles,
  fogFiles,
  linesOf,
  msgidsFromPot,
  normalizeTileDraft,
  parallaxFiles,
  parallaxRelativePath,
  potFiles,
  procgenFiles,
  procgenRelativePath,
  readCanonical,
  tileFiles,
  type CutsceneDraft,
  type CutsceneScene,
  type CutsceneScroll,
  type FogDraft,
  type MapPresentation,
  type ParallaxLayerDraft,
  type ProcgenDraft,
  type TileDraft,
} from '@/editor/studioDrafts';

const selectClass = 'h-8 w-full rounded-md border border-input bg-background px-2 text-sm';

type StudioEditor = {
  getGroundTileSize?: () => { width: number; height: number; orientation: string };
  setGroundTileSize?: (tile: { width?: number; height?: number; orientation?: string }) => void;
  getMapPresentation?: () => MapPresentation;
  setMapPresentation?: (next: Partial<MapPresentation>) => void;
};

function useProjectPath(): string | null {
  const ctx = useAppContext();
  return typeof ctx.currentProjectPath === 'string' ? ctx.currentProjectPath : null;
}

function useStudioEditor(explicit?: StudioEditor | null): StudioEditor | null {
  const ctx = useAppContext();
  if (explicit) return explicit;
  const fromContext = ctx.editor;
  if (fromContext && typeof fromContext === 'object') return fromContext as StudioEditor;
  return null;
}

async function persist(projectPath: string | null, files: Array<{ path: string; content: string }>, ok: string, fail: string) {
  if (!projectPath) {
    toast({ title: 'No project', description: 'Open a project before writing this file.', variant: 'destructive' });
    return false;
  }
  const saved = await writeProjectFiles(projectPath, files);
  toast(saved ? { title: 'Saved', description: ok } : { title: 'Save failed', description: fail, variant: 'destructive' });
  return saved;
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export function TileSizeForm({ editor, onSaved }: { editor?: StudioEditor | null; onSaved?: () => void }) {
  const projectPath = useProjectPath();
  const studioEditor = useStudioEditor(editor);
  const [tile, setTile] = useState<TileDraft>({ width: 64, height: 32, orientation: 'isometric' });

  useEffect(() => {
    if (typeof window === 'undefined' || !projectPath || !window.electronAPI?.readFile) return;
    let cancelled = false;
    const root = projectRoot(projectPath);
    void window.electronAPI.readFile(`${root}/project.json`).then((text) => {
      if (cancelled) return;
      const parsed = readCanonical(text);
      const stored = parsed?.tile;
      if (stored && typeof stored === 'object') {
        setTile(normalizeTileDraft(stored as TileDraft));
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [projectPath]);

  const update = (next: TileDraft) => {
    const normalized = normalizeTileDraft(next);
    setTile(normalized);
    studioEditor?.setGroundTileSize?.(normalized);
  };

  const save = async () => {
    const indexText = projectPath && window.electronAPI?.readFile
      ? await window.electronAPI.readFile(`${projectRoot(projectPath)}/project.json`)
      : null;
    const saved = await persist(
      projectPath,
      tileFiles(indexText, tile),
      'engine/tileset_config.txt',
      'Could not write engine/tileset_config.txt.'
    );
    if (saved) onSaved?.();
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tile size</div>
      <label className="block text-xs text-muted-foreground" htmlFor="tile-width">Tile width</label>
      <Input id="tile-width" type="number" min={1} value={tile.width} className="h-8" onChange={(event) => update({ ...tile, width: Number(event.target.value) })} />
      <label className="block text-xs text-muted-foreground" htmlFor="tile-height">Tile height</label>
      <Input id="tile-height" type="number" min={1} value={tile.height} className="h-8" onChange={(event) => update({ ...tile, height: Number(event.target.value) })} />
      <label className="block text-xs text-muted-foreground" htmlFor="tile-orientation">Orientation</label>
      <select id="tile-orientation" className={selectClass} value={tile.orientation} onChange={(event) => update({ ...tile, orientation: event.target.value === 'orthogonal' ? 'orthogonal' : 'isometric' })}>
        <option value="isometric">isometric</option>
        <option value="orthogonal">orthogonal</option>
      </select>
      <Button type="button" size="sm" onClick={() => { void save(); }}>Write tileset config</Button>
    </div>
  );
}

export function CutsceneEditor() {
  const projectPath = useProjectPath();
  const [slug, setSlug] = useState('intro');
  const [draft, setDraft] = useState<CutsceneDraft>({
    caption_margins: '',
    caption_background: '',
    vscroll_speed: '',
    menu_backgrounds: '',
    music: '',
    scenes: [{ caption: '', image: '', pause: '', soundfx: '' }],
    vscroll: [],
  });

  const load = async (id = slug, isCurrent: () => boolean = () => true) => {
    if (!projectPath || typeof window === 'undefined') return;
    const text = await loadConfigDocument(projectPath, `content/cutscenes/${id}.json`);
    if (!isCurrent()) return;
    const parsed = readCanonical(text);
    if (!parsed) return;
    const scenes = Array.isArray(parsed.scenes) ? parsed.scenes as CutsceneScene[] : [];
    const vscroll = Array.isArray(parsed.vscroll) ? parsed.vscroll as CutsceneScroll[] : [];
    if (!isCurrent()) return;
    setDraft({
      caption_margins: stringField(parsed, 'caption_margins'),
      caption_background: stringField(parsed, 'caption_background'),
      vscroll_speed: stringField(parsed, 'vscroll_speed'),
      menu_backgrounds: stringField(parsed, 'menu_backgrounds'),
      music: stringField(parsed, 'music'),
      scenes: scenes.length ? scenes : [{ caption: '', image: '', pause: '', soundfx: '' }],
      vscroll,
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    void load('intro', () => !cancelled);
    return () => { cancelled = true; };
    // Load the default cutscene when the project changes. Slug edits stay local until Load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath]);

  const setScene = (index: number, patch: Partial<CutsceneScene>) => {
    setDraft((current) => ({
      ...current,
      scenes: current.scenes.map((scene, sceneIndex) => sceneIndex === index ? { ...scene, ...patch } : scene),
    }));
  };

  const save = async () => {
    await persist(projectPath, cutsceneFiles(slug, draft), `cutscenes/${slug}.txt`, 'Could not write the cutscene.');
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cutscene</div>
      <Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="id" className="h-8" aria-label="Cutscene id" />
      <Input value={draft.music || ''} onChange={(event) => setDraft({ ...draft, music: event.target.value })} placeholder="music" className="h-8" aria-label="Cutscene music" />
      <Input value={draft.caption_margins || ''} onChange={(event) => setDraft({ ...draft, caption_margins: event.target.value })} placeholder="caption_margins" className="h-8" aria-label="Caption margins" />
      <Input value={draft.caption_background || ''} onChange={(event) => setDraft({ ...draft, caption_background: event.target.value })} placeholder="caption_background" className="h-8" aria-label="Caption background" />
      <Input value={draft.vscroll_speed || ''} onChange={(event) => setDraft({ ...draft, vscroll_speed: event.target.value })} placeholder="vscroll_speed" className="h-8" aria-label="Vscroll speed" />
      <Input value={draft.menu_backgrounds || ''} onChange={(event) => setDraft({ ...draft, menu_backgrounds: event.target.value })} placeholder="menu_backgrounds" className="h-8" aria-label="Menu backgrounds" />
      {draft.scenes.map((scene, index) => (
        <div key={`scene-${index}`} className="space-y-1 rounded-md border border-border p-2">
          <div className="text-xs text-muted-foreground">Scene</div>
          <Input value={scene.caption || ''} onChange={(event) => setScene(index, { caption: event.target.value })} placeholder="caption" className="h-8" aria-label={`Scene ${index + 1} caption`} />
          <Input value={scene.image || ''} onChange={(event) => setScene(index, { image: event.target.value })} placeholder="image" className="h-8" aria-label={`Scene ${index + 1} image`} />
          <Input value={scene.pause || ''} onChange={(event) => setScene(index, { pause: event.target.value })} placeholder="pause" className="h-8" aria-label={`Scene ${index + 1} pause`} />
          <Input value={scene.soundfx || ''} onChange={(event) => setScene(index, { soundfx: event.target.value })} placeholder="soundfx" className="h-8" aria-label={`Scene ${index + 1} soundfx`} />
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, scenes: [...draft.scenes, { caption: '', image: '', pause: '', soundfx: '' }] })}>Add scene</Button>
      {draft.vscroll.map((scroll, index) => (
        <div key={`scroll-${index}`} className="space-y-1 rounded-md border border-border p-2">
          <div className="text-xs text-muted-foreground">Vscroll</div>
          <Input value={scroll.text || ''} onChange={(event) => setDraft({ ...draft, vscroll: draft.vscroll.map((entry, entryIndex) => entryIndex === index ? { ...entry, text: event.target.value } : entry) })} placeholder="text" className="h-8" aria-label={`Vscroll ${index + 1} text`} />
          <Input value={scroll.image || ''} onChange={(event) => setDraft({ ...draft, vscroll: draft.vscroll.map((entry, entryIndex) => entryIndex === index ? { ...entry, image: event.target.value } : entry) })} placeholder="image" className="h-8" aria-label={`Vscroll ${index + 1} image`} />
          <Input value={scroll.separator || ''} onChange={(event) => setDraft({ ...draft, vscroll: draft.vscroll.map((entry, entryIndex) => entryIndex === index ? { ...entry, separator: event.target.value } : entry) })} placeholder="separator" className="h-8" aria-label={`Vscroll ${index + 1} separator`} />
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, vscroll: [...draft.vscroll, { text: '', image: '', separator: '' }] })}>Add vscroll</Button>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => { void load(); }}>Load cutscene</Button>
        <Button type="button" size="sm" onClick={() => { void save(); }}>Write cutscene</Button>
      </div>
    </div>
  );
}

export function LanguagePotEditor() {
  const projectPath = useProjectPath();
  const [text, setText] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined' || !projectPath) return;
    let cancelled = false;
    void loadConfigDocument(projectPath, 'content/languages/catalog.json').then((raw) => {
      if (cancelled) return;
      const parsed = readCanonical(raw);
      const stored = parsed?.strings;
      if (Array.isArray(stored)) {
        setText(stored.filter((entry) => typeof entry === 'string').join('\n'));
        return;
      }
      return loadConfigDocument(projectPath, 'languages/data.pot').then((pot) => {
        if (!cancelled && pot) setText(msgidsFromPot(pot).join('\n'));
      });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [projectPath]);

  const scan = async () => {
    if (!projectPath || typeof window === 'undefined' || !window.electronAPI?.readDir || !window.electronAPI.readFile) {
      toast({ title: 'No project', description: 'Open a project before scanning strings.', variant: 'destructive' });
      return;
    }
    const root = projectRoot(projectPath);
    const files: string[] = [];
    const walk = async (rel: string, depth: number) => {
      if (depth > 5 || files.length > 200) return;
      const entries = await window.electronAPI.readDir(`${root}/${rel}`);
      for (const entry of entries || []) {
        const child = `${rel}/${entry.name}`;
        if (entry.isDirectory) await walk(child, depth + 1);
        else if (entry.name.endsWith('.json')) files.push(child);
      }
    };
    await walk('content', 0);
    const strings = linesOf(text);
    for (const file of files) {
      const raw = await window.electronAPI.readFile(`${root}/${file}`);
      const parsed = readCanonical(raw);
      if (parsed) strings.push(...collectTranslatableStrings(parsed));
    }
    setText(Array.from(new Set(strings)).join('\n'));
  };

  const save = async () => {
    await persist(projectPath, potFiles(linesOf(text)), 'languages/data.pot', 'Could not write languages/data.pot.');
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Language catalog</div>
      <textarea
        aria-label="Translatable strings"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={'One string per line'}
        className="h-24 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
      />
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => { void scan(); }}>Scan project</Button>
        <Button type="button" size="sm" onClick={() => { void save(); }}>Write catalog</Button>
      </div>
    </div>
  );
}

export function ParallaxEditor({ editor }: { editor?: StudioEditor | null }) {
  const projectPath = useProjectPath();
  const studioEditor = useStudioEditor(editor);
  const [slug, setSlug] = useState('sky');
  const [layers, setLayers] = useState<ParallaxLayerDraft[]>([{ image: '', speed: '', fixed_speed: '', map_layer: '' }]);

  const updateLayer = (index: number, patch: Partial<ParallaxLayerDraft>) => {
    setLayers((current) => current.map((layer, layerIndex) => layerIndex === index ? { ...layer, ...patch } : layer));
  };

  const load = async () => {
    if (!projectPath) return;
    const parsed = readCanonical(await loadConfigDocument(projectPath, `content/parallax/${slug}.json`));
    if (!parsed || !Array.isArray(parsed.layers)) return;
    setLayers(parsed.layers as ParallaxLayerDraft[]);
  };

  const save = async () => {
    const saved = await persist(projectPath, parallaxFiles(slug, layers), parallaxRelativePath(slug), 'Could not write the parallax file.');
    if (saved) studioEditor?.setMapPresentation?.({ parallax: parallaxRelativePath(slug) });
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Parallax</div>
      <Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="id" className="h-8" aria-label="Parallax id" />
      {layers.map((layer, index) => (
        <div key={`layer-${index}`} className="space-y-1 rounded-md border border-border p-2">
          <div className="text-xs text-muted-foreground">Layer</div>
          <Input value={layer.image || ''} onChange={(event) => updateLayer(index, { image: event.target.value })} placeholder="image" className="h-8" aria-label={`Parallax ${index + 1} image`} />
          <Input value={layer.speed || ''} onChange={(event) => updateLayer(index, { speed: event.target.value })} placeholder="speed" className="h-8" aria-label={`Parallax ${index + 1} speed`} />
          <Input value={layer.fixed_speed || ''} onChange={(event) => updateLayer(index, { fixed_speed: event.target.value })} placeholder="fixed_speed" className="h-8" aria-label={`Parallax ${index + 1} fixed speed`} />
          <Input value={layer.map_layer || ''} onChange={(event) => updateLayer(index, { map_layer: event.target.value })} placeholder="map_layer" className="h-8" aria-label={`Parallax ${index + 1} map layer`} />
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => setLayers([...layers, { image: '', speed: '', fixed_speed: '', map_layer: '' }])}>Add layer</Button>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => { void load(); }}>Load parallax</Button>
        <Button type="button" size="sm" onClick={() => { void save(); }}>Write parallax</Button>
      </div>
    </div>
  );
}

export function FogEditor({ editor }: { editor?: StudioEditor | null }) {
  const projectPath = useProjectPath();
  const studioEditor = useStudioEditor(editor);
  const [mask, setMask] = useState<FogDraft>({
    radius: '',
    bits_per_tile: '',
    color_dark: '',
    color_fog: '',
    tileset_dark: '',
    tileset_fog: '',
    bits: [],
    tiles: [],
    data: '',
  });
  const [bitsText, setBitsText] = useState('');
  const [tilesText, setTilesText] = useState('');
  const [fogofwar, setFogofwar] = useState('');
  const [saveFog, setSaveFog] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined' || !projectPath) return;
    let cancelled = false;
    void loadConfigDocument(projectPath, 'content/fog/mask.json').then((raw) => {
      if (cancelled) return;
      const parsed = readCanonical(raw);
      if (!parsed) return;
      const bits = Array.isArray(parsed.bits) ? parsed.bits.map(String) : [];
      const tiles = Array.isArray(parsed.tiles) ? parsed.tiles.map(String) : [];
      setMask({
        radius: stringField(parsed, 'radius'),
        bits_per_tile: stringField(parsed, 'bits_per_tile'),
        color_dark: stringField(parsed, 'color_dark'),
        color_fog: stringField(parsed, 'color_fog'),
        tileset_dark: stringField(parsed, 'tileset_dark'),
        tileset_fog: stringField(parsed, 'tileset_fog'),
        bits,
        tiles,
        data: stringField(parsed, 'data'),
      });
      setBitsText(bits.join('\n'));
      setTilesText(tiles.join('\n'));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [projectPath]);

  const save = async () => {
    const next: FogDraft = { ...mask, bits: linesOf(bitsText), tiles: linesOf(tilesText) };
    const saved = await persist(projectPath, fogFiles(next), 'engine/fow_mask.txt', 'Could not write engine/fow_mask.txt.');
    if (!saved) return;
    const patch: Partial<MapPresentation> = {};
    if (fogofwar) patch.fogofwar = fogofwar;
    if (saveFog) patch.save_fogofwar = saveFog;
    if (Object.keys(patch).length) studioEditor?.setMapPresentation?.(patch);
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fog of war</div>
      <Input value={mask.radius || ''} onChange={(event) => setMask({ ...mask, radius: event.target.value })} placeholder="radius" className="h-8" aria-label="Fog radius" />
      <Input value={mask.bits_per_tile || ''} onChange={(event) => setMask({ ...mask, bits_per_tile: event.target.value })} placeholder="bits_per_tile" className="h-8" aria-label="Bits per tile" />
      <Input value={mask.color_dark || ''} onChange={(event) => setMask({ ...mask, color_dark: event.target.value })} placeholder="color_dark" className="h-8" aria-label="Color dark" />
      <Input value={mask.color_fog || ''} onChange={(event) => setMask({ ...mask, color_fog: event.target.value })} placeholder="color_fog" className="h-8" aria-label="Color fog" />
      <Input value={mask.tileset_dark || ''} onChange={(event) => setMask({ ...mask, tileset_dark: event.target.value })} placeholder="tileset_dark" className="h-8" aria-label="Tileset dark" />
      <Input value={mask.tileset_fog || ''} onChange={(event) => setMask({ ...mask, tileset_fog: event.target.value })} placeholder="tileset_fog" className="h-8" aria-label="Tileset fog" />
      <textarea aria-label="Fog bits" value={bitsText} onChange={(event) => setBitsText(event.target.value)} placeholder="bit lines" className="h-16 w-full rounded-md border border-input bg-background px-2 py-1 text-sm" />
      <textarea aria-label="Fog tiles" value={tilesText} onChange={(event) => setTilesText(event.target.value)} placeholder="tile lines" className="h-16 w-full rounded-md border border-input bg-background px-2 py-1 text-sm" />
      <textarea aria-label="Fog mask data" value={mask.data || ''} onChange={(event) => setMask({ ...mask, data: event.target.value })} placeholder="mask data" className="h-16 w-full rounded-md border border-input bg-background px-2 py-1 text-sm" />
      <label className="block text-xs text-muted-foreground" htmlFor="map-fogofwar">Map fogofwar</label>
      <select id="map-fogofwar" className={selectClass} value={fogofwar} onChange={(event) => setFogofwar(event.target.value)}>
        <option value="">leave map header unchanged</option>
        <option value="0">0 disabled</option>
        <option value="1">1 minimap</option>
        <option value="2">2 tint</option>
        <option value="3">3 overlay</option>
      </select>
      <label className="block text-xs text-muted-foreground" htmlFor="map-save-fog">Map save_fogofwar</label>
      <select id="map-save-fog" className={selectClass} value={saveFog} onChange={(event) => setSaveFog(event.target.value)}>
        <option value="">leave map header unchanged</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
      <Button type="button" size="sm" onClick={() => { void save(); }}>Write fog mask</Button>
    </div>
  );
}

const PROCGEN_FIELDS: Array<[keyof Omit<ProcgenDraft, 'chunks'>, string]> = [
  ['doors_max', 'doors_max'],
  ['main_path_length_min', 'main_path_length_min'],
  ['main_path_length_max', 'main_path_length_max'],
  ['main_path_attempts_max', 'main_path_attempts_max'],
  ['branch_length_min', 'branch_length_min'],
  ['branch_length_max', 'branch_length_max'],
  ['branches_per_door_level_max', 'branches_per_door_level_max'],
  ['door_spacing_min', 'door_spacing_min'],
];

export function ProcgenEditor() {
  const projectPath = useProjectPath();
  const [slug, setSlug] = useState('rules');
  const [rules, setRules] = useState<ProcgenDraft>({ chunks: [] });
  const [chunksText, setChunksText] = useState('');

  const load = async () => {
    if (!projectPath) return;
    const parsed = readCanonical(await loadConfigDocument(projectPath, `content/procgen/${slug}.json`));
    if (!parsed) return;
    const next: ProcgenDraft = { chunks: [] };
    for (const [key] of PROCGEN_FIELDS) next[key] = stringField(parsed, key);
    const chunks = Array.isArray(parsed.chunks) ? parsed.chunks.map(String) : [];
    next.chunks = chunks;
    setRules(next);
    setChunksText(chunks.join('\n'));
  };

  const save = async () => {
    const next = { ...rules, chunks: linesOf(chunksText) };
    await persist(projectPath, procgenFiles(slug, next), procgenRelativePath(slug), 'Could not write the procgen rules.');
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Procedural rules</div>
      <Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="id" className="h-8" aria-label="Procgen id" />
      {PROCGEN_FIELDS.map(([key, label]) => (
        <Input
          key={key}
          value={rules[key] || ''}
          onChange={(event) => setRules({ ...rules, [key]: event.target.value })}
          placeholder={label}
          className="h-8"
          aria-label={label}
        />
      ))}
      <textarea aria-label="Procgen chunks" value={chunksText} onChange={(event) => setChunksText(event.target.value)} placeholder="chunk filenames" className="h-16 w-full rounded-md border border-input bg-background px-2 py-1 text-sm" />
      <p className="text-xs text-muted-foreground">Event <span className="font-mono">procgen_filename</span> points at {procgenRelativePath(slug)}. Chunk type stays on the map header.</p>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => { void load(); }}>Load rules</Button>
        <Button type="button" size="sm" onClick={() => { void save(); }}>Write rules</Button>
      </div>
    </div>
  );
}

const PROCGEN_TYPES = ['', 'links', 'normal', 'start', 'end', 'key', 'door_north_south', 'door_west_east'];

export function MapPresentationFields({
  value,
  onChange,
}: {
  value: MapPresentation;
  onChange: (next: MapPresentation) => void;
}) {
  const set = (patch: Partial<MapPresentation>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Map header</div>
      <label className="block text-xs text-muted-foreground" htmlFor="map-parallax">Parallax layers</label>
      <Input id="map-parallax" value={value.parallax} onChange={(event) => set({ parallax: event.target.value })} placeholder="maps/parallax/sky.txt" className="h-8" />
      <label className="block text-xs text-muted-foreground" htmlFor="header-fogofwar">Fog of war</label>
      <select id="header-fogofwar" className={selectClass} value={value.fogofwar} onChange={(event) => set({ fogofwar: event.target.value })}>
        <option value="">default</option>
        <option value="0">0 disabled</option>
        <option value="1">1 minimap</option>
        <option value="2">2 tint</option>
        <option value="3">3 overlay</option>
      </select>
      <label className="block text-xs text-muted-foreground" htmlFor="header-save-fog">Save fog of war</label>
      <select id="header-save-fog" className={selectClass} value={value.save_fogofwar} onChange={(event) => set({ save_fogofwar: event.target.value })}>
        <option value="">default</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
      <label className="block text-xs text-muted-foreground" htmlFor="header-procgen-type">Procgen type</label>
      <select id="header-procgen-type" className={selectClass} value={value.procgen_type} onChange={(event) => set({ procgen_type: event.target.value })}>
        {PROCGEN_TYPES.map((type) => <option key={type || 'none'} value={type}>{type || 'none'}</option>)}
      </select>
      <Input value={value.procgen_unique_status} onChange={(event) => set({ procgen_unique_status: event.target.value })} placeholder="procgen_unique_status" className="h-8" aria-label="Procgen unique status" />
      <Input value={value.procgen_reset_status} onChange={(event) => set({ procgen_reset_status: event.target.value })} placeholder="procgen_reset_status" className="h-8" aria-label="Procgen reset status" />
    </div>
  );
}

export function StudioWorldPanel() {
  return (
    <div className="space-y-3">
      <CutsceneEditor />
      <LanguagePotEditor />
      <ParallaxEditor />
      <FogEditor />
      <ProcgenEditor />
    </div>
  );
}
