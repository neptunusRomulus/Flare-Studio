import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InlineConfirm } from '@/components/ui/inline-confirm';
import Tooltip from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useAppContext } from '@/context/AppContext';
import CutsceneEditor from '@/components/engine/CutsceneEditor';
import ProcgenRulesForm from '@/components/engine/ProcgenRulesForm';
import { toast } from '@/hooks/use-toast';
import { loadConfigDocument, projectRoot, writeProjectFiles } from '@/editor/projectFiles';
import { useRegisterDirty } from '@/context/SaveHealthContext';
import {
  fogFiles,
  linesOf,
  normalizeTileDraft,
  parallaxFiles,
  parallaxRelativePath,
  readCanonical,
  tileFiles,
  type FogDraft,
  type MapPresentation,
  type ParallaxLayerDraft,
  type TileDraft,
} from '@/editor/studioDrafts';

const selectClass = 'h-8 rounded-md border border-input bg-background px-2 text-sm';

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
  const [tile, setTile] = useState<TileDraft>({ width: 192, height: 96, orientation: 'isometric' });

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

  const presets = [
    {
      width: 64,
      label: 'Low Res',
      description: 'Whole game uses 64×32 tiles, for low-resolution art. fantasycore (192×96) does not fit this size, so you need 64×32 art.',
    },
    {
      width: 192,
      label: 'High Res',
      description: 'Whole game uses 192×96 tiles. Matches fantasycore, the default base mod, so its menus, hero and animations work as they are.',
    },
  ];
  // Preset waiting for the inline "Are you sure?" answer.
  const [pending, setPending] = useState<number | null>(null);

  const save = async (width: number) => {
    setPending(null);
    const draft: TileDraft = { width, height: width / 2, orientation: 'isometric' };
    const indexText = projectPath && window.electronAPI?.readFile
      ? await window.electronAPI.readFile(`${projectRoot(projectPath)}/project.json`)
      : null;
    const saved = await persist(
      projectPath,
      tileFiles(indexText, draft),
      'engine/tileset_config.txt',
      'Could not write engine/tileset_config.txt.'
    );
    if (saved) {
      setTile(draft);
      studioEditor?.setGroundTileSize?.(draft);
      onSaved?.();
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="text-base font-semibold">Tile Size</div>
      <div className="flex gap-2">
        {presets.map((preset) => (
          <div key={preset.width} className="flex-1">
            <InlineConfirm
              open={pending === preset.width}
              onCancel={() => setPending(null)}
              onConfirm={() => { void save(preset.width); }}
            >
              <Tooltip content={preset.description} side="bottom">
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  variant={tile.width === preset.width ? 'default' : 'outline'}
                  onClick={() => setPending(tile.width === preset.width ? null : preset.width)}
                >
                  {preset.label}
                </Button>
              </Tooltip>
            </InlineConfirm>
          </div>
        ))}
      </div>
    </div>
  );
}

export { CutsceneEditor };

export function ParallaxEditor({ editor }: { editor?: StudioEditor | null }) {
  const projectPath = useProjectPath();
  const studioEditor = useStudioEditor(editor);
  const [slug, setSlug] = useState('sky');
  const [layers, setLayers] = useState<ParallaxLayerDraft[]>([{ image: '', speed: '', fixed_speed: '', map_layer: '' }]);
  const [parallaxDirty, setParallaxDirty] = useState(false);
  const skipParallaxLoadRef = useRef(false);

  const updateLayer = (index: number, patch: Partial<ParallaxLayerDraft>) => {
    setLayers((current) => current.map((layer, layerIndex) => layerIndex === index ? { ...layer, ...patch } : layer));
    setParallaxDirty(true);
  };

  const load = async () => {
    if (!projectPath || skipParallaxLoadRef.current) return;
    const parsed = readCanonical(await loadConfigDocument(projectPath, `content/parallax/${slug}.json`));
    if (!parsed || !Array.isArray(parsed.layers)) return;
    setLayers(parsed.layers as ParallaxLayerDraft[]);
    setParallaxDirty(false);
  };

  const save = async () => {
    const saved = await persist(projectPath, parallaxFiles(slug, layers), parallaxRelativePath(slug), 'Could not write the parallax file.');
    if (saved) {
      setParallaxDirty(false);
      studioEditor?.setMapPresentation?.({ parallax: parallaxRelativePath(slug) });
    }
  };

  const parallaxDrafts = useMemo(() => (parallaxDirty ? parallaxFiles(slug, layers) : []), [parallaxDirty, slug, layers]);
  useRegisterDirty('parallax', parallaxDirty, save, parallaxDrafts, (incoming) => {
    skipParallaxLoadRef.current = true;
    const json = incoming.find((file) => file.path.replace(/\\/g, '/').startsWith('content/parallax/') && file.path.endsWith('.json'));
    const parsed = json ? readCanonical(json.content) : null;
    if (parsed?.id) setSlug(String(parsed.id));
    if (Array.isArray(parsed?.layers)) setLayers(parsed.layers as ParallaxLayerDraft[]);
    setParallaxDirty(true);
  });

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Parallax</div>
      <Input value={slug} onChange={(event) => { setSlug(event.target.value); setParallaxDirty(true); }} placeholder="id" width="id" className="h-8" aria-label="Parallax id" />
      {layers.map((layer, index) => (
        <div key={`layer-${index}`} className="space-y-1 rounded-md border border-border p-2">
          <div className="text-xs text-muted-foreground">Layer</div>
          <Input value={layer.image || ''} onChange={(event) => updateLayer(index, { image: event.target.value })} placeholder="image" width="path" className="h-8" aria-label={`Parallax ${index + 1} image`} />
          <Input value={layer.speed || ''} onChange={(event) => updateLayer(index, { speed: event.target.value })} placeholder="speed" width="short" className="h-8" aria-label={`Parallax ${index + 1} speed`} />
          <Input value={layer.fixed_speed || ''} onChange={(event) => updateLayer(index, { fixed_speed: event.target.value })} placeholder="fixed_speed" width="short" className="h-8" aria-label={`Parallax ${index + 1} fixed speed`} />
          <Input value={layer.map_layer || ''} onChange={(event) => updateLayer(index, { map_layer: event.target.value })} placeholder="map_layer" width="id" className="h-8" aria-label={`Parallax ${index + 1} map layer`} />
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => { setLayers([...layers, { image: '', speed: '', fixed_speed: '', map_layer: '' }]); setParallaxDirty(true); }}>Add layer</Button>
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
  const [fogDirty, setFogDirty] = useState(false);
  const skipFogLoadRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !projectPath) return;
    let cancelled = false;
    void loadConfigDocument(projectPath, 'content/fog/mask.json').then((raw) => {
      if (cancelled || skipFogLoadRef.current) return;
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
      setFogDirty(false);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [projectPath]);

  const save = async () => {
    const next: FogDraft = { ...mask, bits: linesOf(bitsText), tiles: linesOf(tilesText) };
    const saved = await persist(projectPath, fogFiles(next), 'engine/fow_mask.txt', 'Could not write engine/fow_mask.txt.');
    if (!saved) return;
    setFogDirty(false);
    const patch: Partial<MapPresentation> = {};
    if (fogofwar) patch.fogofwar = fogofwar;
    if (saveFog) patch.save_fogofwar = saveFog;
    if (Object.keys(patch).length) studioEditor?.setMapPresentation?.(patch);
  };

  const fogDraft = useMemo(() => {
    const next: FogDraft = { ...mask, bits: linesOf(bitsText), tiles: linesOf(tilesText) };
    return fogDirty ? fogFiles(next) : [];
  }, [fogDirty, mask, bitsText, tilesText]);
  useRegisterDirty('fog', fogDirty, save, fogDraft, (incoming) => {
    skipFogLoadRef.current = true;
    const json = incoming.find((file) => file.path.replace(/\\/g, '/') === 'content/fog/mask.json');
    const parsed = json ? readCanonical(json.content) : null;
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
    setFogDirty(true);
  });

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fog of war</div>
      <Input value={mask.radius || ''} onChange={(event) => { setMask({ ...mask, radius: event.target.value }); setFogDirty(true); }} placeholder="radius" width="num" className="h-8" aria-label="Fog radius" />
      <Input value={mask.bits_per_tile || ''} onChange={(event) => { setMask({ ...mask, bits_per_tile: event.target.value }); setFogDirty(true); }} placeholder="bits_per_tile" width="num" className="h-8" aria-label="Bits per tile" />
      <Input value={mask.color_dark || ''} onChange={(event) => { setMask({ ...mask, color_dark: event.target.value }); setFogDirty(true); }} placeholder="color_dark" width="short" className="h-8" aria-label="Color dark" />
      <Input value={mask.color_fog || ''} onChange={(event) => { setMask({ ...mask, color_fog: event.target.value }); setFogDirty(true); }} placeholder="color_fog" width="short" className="h-8" aria-label="Color fog" />
      <Input value={mask.tileset_dark || ''} onChange={(event) => { setMask({ ...mask, tileset_dark: event.target.value }); setFogDirty(true); }} placeholder="tileset_dark" width="path" className="h-8" aria-label="Tileset dark" />
      <Input value={mask.tileset_fog || ''} onChange={(event) => { setMask({ ...mask, tileset_fog: event.target.value }); setFogDirty(true); }} placeholder="tileset_fog" width="path" className="h-8" aria-label="Tileset fog" />
      <Textarea aria-label="Fog bits" value={bitsText} onChange={(event) => { setBitsText(event.target.value); setFogDirty(true); }} placeholder="bit lines" className="h-16 w-full rounded-md border border-input bg-background px-2 py-1 text-sm" />
      <Textarea aria-label="Fog tiles" value={tilesText} onChange={(event) => { setTilesText(event.target.value); setFogDirty(true); }} placeholder="tile lines" className="h-16 w-full rounded-md border border-input bg-background px-2 py-1 text-sm" />
      <Textarea aria-label="Fog mask data" value={mask.data || ''} onChange={(event) => { setMask({ ...mask, data: event.target.value }); setFogDirty(true); }} placeholder="mask data" className="h-16 w-full rounded-md border border-input bg-background px-2 py-1 text-sm" />
      <Label className="block text-xs text-muted-foreground font-normal" htmlFor="map-fogofwar">Map fogofwar</Label>
      <Select value={fogofwar || '__empty__'} onValueChange={(value) => setFogofwar(value === '__empty__' ? '' : value)}>
        <SelectTrigger id="map-fogofwar" className={selectClass}>
          <SelectValue placeholder="leave map header unchanged" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty__">leave map header unchanged</SelectItem>
          <SelectItem value="0">0 disabled</SelectItem>
          <SelectItem value="1">1 minimap</SelectItem>
          <SelectItem value="2">2 tint</SelectItem>
          <SelectItem value="3">3 overlay</SelectItem>
        </SelectContent>
      </Select>
      <Label className="block text-xs text-muted-foreground font-normal" htmlFor="map-save-fog">Map save_fogofwar</Label>
      <Select value={saveFog || '__empty__'} onValueChange={(value) => setSaveFog(value === '__empty__' ? '' : value)}>
        <SelectTrigger id="map-save-fog" className={selectClass}>
          <SelectValue placeholder="leave map header unchanged" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty__">leave map header unchanged</SelectItem>
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
        </SelectContent>
      </Select>
      <Button type="button" size="sm" onClick={() => { void save(); }}>Write fog mask</Button>
    </div>
  );
}

export { default as ProcgenEditor } from '@/components/engine/ProcgenRulesForm';

export const PROCGEN_TYPES = ['', 'links', 'normal', 'start', 'end', 'key', 'door_north_south', 'door_west_east'];

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
      <Label className="block text-xs text-muted-foreground font-normal" htmlFor="map-parallax">Parallax layers</Label>
      <Input id="map-parallax" width="path" value={value.parallax} onChange={(event) => set({ parallax: event.target.value })} placeholder="maps/parallax/sky.txt" className="h-8" />
      <Label className="block text-xs text-muted-foreground font-normal" htmlFor="header-fogofwar">Fog of war</Label>
      <Select value={value.fogofwar || '__empty__'} onValueChange={(next) => set({ fogofwar: next === '__empty__' ? '' : next })}>
        <SelectTrigger id="header-fogofwar" className={selectClass}>
          <SelectValue placeholder="default" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty__">default</SelectItem>
          <SelectItem value="0">0 disabled</SelectItem>
          <SelectItem value="1">1 minimap</SelectItem>
          <SelectItem value="2">2 tint</SelectItem>
          <SelectItem value="3">3 overlay</SelectItem>
        </SelectContent>
      </Select>
      <Label className="block text-xs text-muted-foreground font-normal" htmlFor="header-save-fog">Save fog of war</Label>
      <Select value={value.save_fogofwar || '__empty__'} onValueChange={(next) => set({ save_fogofwar: next === '__empty__' ? '' : next })}>
        <SelectTrigger id="header-save-fog" className={selectClass}>
          <SelectValue placeholder="default" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty__">default</SelectItem>
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
        </SelectContent>
      </Select>
      <HintLabel className="block text-xs text-muted-foreground font-normal" htmlFor="header-procgen-type" hint="Set on chunk maps, not on the rules file. links, normal, start, end, key, door_north_south, or door_west_east tell the generator how to use this chunk.">Procgen type</HintLabel>
      <Select value={value.procgen_type || '__empty__'} onValueChange={(next) => set({ procgen_type: next === '__empty__' ? '' : next })}>
        <SelectTrigger id="header-procgen-type" className={selectClass}>
          <SelectValue placeholder="none" />
        </SelectTrigger>
        <SelectContent>
          {PROCGEN_TYPES.map((type) => <SelectItem key={type || 'none'} value={type || '__empty__'}>{type || 'none'}</SelectItem>)}
        </SelectContent>
      </Select>
      <HintLabel className="block text-xs text-muted-foreground font-normal" htmlFor="header-procgen-unique" hint="On a chunk map: once this status is set, the chunk is no longer eligible for placement.">Procgen unique status</HintLabel>
      <Input id="header-procgen-unique" value={value.procgen_unique_status} onChange={(event) => set({ procgen_unique_status: event.target.value })} placeholder="procgen_unique_status" width="id" className="h-8" aria-label="Procgen unique status" />
      <HintLabel className="block text-xs text-muted-foreground font-normal" htmlFor="header-procgen-reset" hint="If this status is set, the engine regenerates the region instead of loading the saved procgen cache.">Procgen reset status</HintLabel>
      <Input id="header-procgen-reset" value={value.procgen_reset_status} onChange={(event) => set({ procgen_reset_status: event.target.value })} placeholder="procgen_reset_status" width="id" className="h-8" aria-label="Procgen reset status" />
    </div>
  );
}

export function StudioWorldPanel() {
  return (
    <div className="space-y-3">
      <CutsceneEditor />
      <ParallaxEditor />
      <FogEditor />
      <ProcgenRulesForm />
    </div>
  );
}
