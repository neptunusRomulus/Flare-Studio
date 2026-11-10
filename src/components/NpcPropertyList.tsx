import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Tooltip from '@/components/ui/tooltip';
import DirectionField from '@/components/DirectionField';
import { FolderOpen, HelpCircle, X } from 'lucide-react';
import SearchablePalette from '@/components/ui/searchable-palette';
import type { MapObject } from '@/types';
import { sectionsFromNpcText, type KeyValue } from '@/utils/npcFileUpdate';
import {
  filterPropertyCatalog,
  isCustomTilesetAppearance,
  listNpcPropertyCards,
  patchAddProperty,
  patchListValue,
  patchLineValue,
  patchPolarity,
  patchRemoveCard,
  resolveStatsAndEffects,
  type NpcPropertyCard,
  type NpcPropertyKind,
  type PropertyCatalogEntry,
} from '@/editor/npcPropertyCards';

type Props = {
  editingObject: MapObject;
  get: (key: string, fallback?: string) => string;
  setProp: (key: string, value: string | null) => void;
  applyPatch: (patch: Record<string, string | null>) => void;
  projectPath: string | null;
};

const inlineInput = 'h-6 w-auto min-w-[2.5rem] max-w-[8rem] px-1 text-xs text-center inline-block align-baseline border border-border rounded bg-background';

const CardShell = ({
  tip,
  onRemove,
  children,
}: {
  tip: string;
  onRemove: () => void;
  children: React.ReactNode;
}) => (
  <div className="flex items-start gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-2 text-xs">
    <Tooltip content={tip}>
      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-1 gap-y-1 leading-relaxed">
        {children}
        <HelpCircle className="w-3 h-3 text-muted-foreground shrink-0" />
      </div>
    </Tooltip>
    <button
      type="button"
      className="h-6 w-6 shrink-0 flex items-center justify-center rounded hover:bg-muted"
      aria-label="Remove property"
      onClick={onRemove}
    >
      <X className="w-3.5 h-3.5" />
    </button>
  </div>
);

const PolaritySelect = ({
  have,
  onChange,
}: {
  have: boolean;
  onChange: (have: boolean) => void;
}) => (
  <Select value={have ? 'have' : 'have_not'} onValueChange={(v) => onChange(v === 'have')}>
    <SelectTrigger className="h-6 w-[7.5rem] px-1 text-xs">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="have">has</SelectItem>
      <SelectItem value="have_not">doesn&apos;t have</SelectItem>
    </SelectContent>
  </Select>
);

const NpcPropertyList = ({ editingObject, get, setProp, applyPatch, projectPath }: Props) => {
  const browseInclude = async (index: number) => {
    const api = window.electronAPI as typeof window.electronAPI & {
      selectProjectFile?: (opts: { projectPath?: string | null; title?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>;
    };
    if (!api?.selectProjectFile) return;
    const selected = await api.selectProjectFile({
      projectPath,
      title: 'Choose a shared NPC file',
      filters: [
        { name: 'NPC or text files', extensions: ['txt'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (selected) applyPatch(patchLineValue('npc_includes', index, selected, editingObject.properties));
  };
  const [animMore, setAnimMore] = useState(false);
  const [fileStats, setFileStats] = useState<KeyValue[] | undefined>();
  const [fileEffects, setFileEffects] = useState<KeyValue[][] | undefined>();

  const tilesetPath = get('tilesetPath', '');
  const tilesetSourcePath = get('tilesetSourcePath', '');
  const customTileset = isCustomTilesetAppearance(tilesetPath, tilesetSourcePath);
  const npcFilename = get('npcFilename', '');

  useEffect(() => {
    let cancelled = false;
    if (!npcFilename || !projectPath) {
      setFileStats(undefined);
      setFileEffects(undefined);
      return;
    }
    const api = window.electronAPI as unknown as { readFile?: (p: string) => Promise<string | null> };
    if (!api?.readFile) return;
    const file = `${projectPath.replace(/\\/g, '/')}/npcs/${npcFilename.replace(/\\/g, '/').replace(/^npcs\//, '')}`;
    api.readFile(file).then((txt) => {
      if (cancelled) return;
      setFileStats(sectionsFromNpcText(txt || '', 'stats').flat());
      setFileEffects(sectionsFromNpcText(txt || '', 'visual_effect'));
    }).catch(() => {
      if (!cancelled) {
        setFileStats([]);
        setFileEffects([]);
      }
    });
    return () => { cancelled = true; };
  }, [npcFilename, projectPath]);

  const cards = useMemo(
    () => listNpcPropertyCards({
      properties: editingObject.properties,
      fileStats,
      fileEffects,
      customTileset,
    }),
    [editingObject.properties, fileStats, fileEffects, customTileset],
  );

  const catalog = useMemo(
    () => filterPropertyCatalog('', cards, { customTileset }),
    [cards, customTileset],
  );

  const remove = (card: NpcPropertyCard) => {
    applyPatch(patchRemoveCard(card, editingObject.properties, fileStats, fileEffects));
  };

  const add = (entry: PropertyCatalogEntry) => {
    applyPatch(patchAddProperty(entry.kind, editingObject.properties));
  };

  const writeStats = (next: KeyValue[]) => setProp('npc_stats', JSON.stringify([next]));
  const writeEffects = (next: KeyValue[][]) => setProp('npc_visual_effects', JSON.stringify(next));

  const updateStat = (index: number, field: 'key' | 'value', value: string) => {
    const { stats } = resolveStatsAndEffects(editingObject.properties, fileStats, fileEffects);
    writeStats(stats.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const updateEffect = (index: number, key: string, value: string) => {
    const { effects } = resolveStatsAndEffects(editingObject.properties, fileStats, fileEffects);
    writeEffects(effects.map((fx, i) => {
      if (i !== index) return fx;
      const rest = fx.filter((e) => e.key !== key);
      return value ? [...rest, { key, value }] : rest;
    }));
  };

  const renderCard = (card: NpcPropertyCard) => {
    const tip = filterPropertyCatalog('', [], { customTileset: true }).find((e) => e.kind === card.kind);
    const tipText = tip ? `${tip.flareKey} — ${tip.description}` : card.kind;

    switch (card.kind) {
      case 'level':
        return (
          <CardShell key={card.id} tip={tipText} onRemove={() => remove(card)}>
            <span>Appears when player level is</span>
            <Input
              type="number"
              className={inlineInput}
              value={card.values.min}
              placeholder="Min"
              min={0}
              onChange={(e) => setProp('requires_level', e.target.value === '' ? null : e.target.value)}
            />
            <span>–</span>
            <Input
              type="number"
              className={inlineInput}
              value={card.values.max}
              placeholder="Max"
              min={0}
              onChange={(e) => setProp('requires_not_level', e.target.value === '' ? null : e.target.value)}
            />
          </CardShell>
        );
      case 'currency':
        return (
          <CardShell key={card.id} tip={tipText} onRemove={() => remove(card)}>
            <span>Appears when player currency is</span>
            <Input
              type="number"
              className={inlineInput}
              value={card.values.min}
              placeholder="Min"
              min={0}
              onChange={(e) => setProp('requires_currency', e.target.value === '' ? null : e.target.value)}
            />
            <span>–</span>
            <Input
              type="number"
              className={inlineInput}
              value={card.values.max}
              placeholder="Max"
              min={0}
              onChange={(e) => setProp('requires_not_currency', e.target.value === '' ? null : e.target.value)}
            />
          </CardShell>
        );
      case 'status':
        return (
          <CardShell key={card.id} tip={tipText} onRemove={() => remove(card)}>
            <span>Appears only if player</span>
            <PolaritySelect
              have={card.polarity !== 'have_not'}
              onChange={(have) => applyPatch(patchPolarity('status', card, have, editingObject.properties))}
            />
            <span>status</span>
            <Input
              className={`${inlineInput} min-w-[6rem] max-w-[12rem] text-left`}
              value={card.values.value}
              placeholder="status"
              onChange={(e) => {
                const key = card.polarity === 'have_not' ? 'requires_not_status' : 'requires_status';
                applyPatch(patchListValue(key, card.index, e.target.value, editingObject.properties));
              }}
            />
          </CardShell>
        );
      case 'item':
        return (
          <CardShell key={card.id} tip={tipText} onRemove={() => remove(card)}>
            <span>Appears only if player</span>
            <PolaritySelect
              have={card.polarity !== 'have_not'}
              onChange={(have) => applyPatch(patchPolarity('item', card, have, editingObject.properties))}
            />
            <span>item</span>
            <Input
              className={`${inlineInput} min-w-[4rem] max-w-[8rem] text-left`}
              value={card.values.value}
              placeholder="id"
              onChange={(e) => {
                const key = card.polarity === 'have_not' ? 'requires_not_item' : 'requires_item';
                const qty = card.values.qty;
                const encoded = qty ? `${e.target.value}:${qty}` : e.target.value;
                applyPatch(patchListValue(key, card.index, encoded, editingObject.properties));
              }}
            />
            <span>×</span>
            <Input
              type="number"
              className={inlineInput}
              value={card.values.qty}
              placeholder="1"
              min={1}
              onChange={(e) => {
                const key = card.polarity === 'have_not' ? 'requires_not_item' : 'requires_item';
                const encoded = e.target.value ? `${card.values.value}:${e.target.value}` : card.values.value;
                applyPatch(patchListValue(key, card.index, encoded, editingObject.properties));
              }}
            />
          </CardShell>
        );
      case 'class':
        return (
          <CardShell key={card.id} tip={tipText} onRemove={() => remove(card)}>
            <span>Appears only if player</span>
            <PolaritySelect
              have={card.polarity !== 'have_not'}
              onChange={(have) => applyPatch(patchPolarity('class', card, have, editingObject.properties))}
            />
            <span>class</span>
            <Input
              className={`${inlineInput} min-w-[5rem] max-w-[10rem] text-left`}
              value={card.values.value}
              placeholder="class"
              onChange={(e) => {
                const key = card.polarity === 'have_not' ? 'requires_not_class' : 'requires_class';
                applyPatch(patchListValue(key, card.index, e.target.value, editingObject.properties));
              }}
            />
          </CardShell>
        );
      case 'facing':
        return (
          <CardShell key={card.id} tip={tipText} onRemove={() => remove(card)}>
            <span className="w-full">Facing on map</span>
            <DirectionField
              value={card.values.direction}
              onChange={(value) => setProp('map_direction', value)}
              label=""
            />
          </CardShell>
        );
      case 'waypoints':
        return (
          <CardShell key={card.id} tip={tipText} onRemove={() => remove(card)}>
            <span>Waypoint</span>
            <Input
              className={`${inlineInput} min-w-[5rem] max-w-[10rem] text-left`}
              value={card.values.point}
              placeholder="x,y"
              onChange={(e) => applyPatch({ ...patchLineValue('waypoints', card.index, e.target.value, editingObject.properties), wander_radius: null })}
            />
          </CardShell>
        );
      case 'wander_radius':
        return (
          <CardShell key={card.id} tip={tipText} onRemove={() => remove(card)}>
            <span>Wander radius</span>
            <Input
              type="number"
              min={0}
              className={`${inlineInput} min-w-[4rem] max-w-[6rem]`}
              value={card.values.radius}
              placeholder="tiles"
              onChange={(e) => applyPatch({ wander_radius: e.target.value, waypoints: null })}
            />
          </CardShell>
        );
      case 'minimap':
        return (
          <CardShell key={card.id} tip={tipText} onRemove={() => remove(card)}>
            <span>Hidden on minimap</span>
          </CardShell>
        );
      case 'intro_voice':
        return (
          <CardShell key={card.id} tip={tipText} onRemove={() => remove(card)}>
            <span>Intro voice:</span>
            <Input
              className={`${inlineInput} min-w-[8rem] max-w-[16rem] text-left`}
              value={card.values.file}
              placeholder="sound.ogg"
              onChange={(e) => applyPatch(patchListValue('vox_intro', card.index, e.target.value, editingObject.properties))}
            />
          </CardShell>
        );
      case 'include':
        return (
          <CardShell key={card.id} tip={tipText} onRemove={() => remove(card)}>
            <span>Shared file:</span>
            <Input
              className={`${inlineInput} min-w-[8rem] max-w-[16rem] text-left`}
              value={card.values.file}
              placeholder="npcs/base/common.txt"
              onChange={(e) => applyPatch(patchLineValue('npc_includes', card.index, e.target.value, editingObject.properties))}
            />
            <button
              type="button"
              className="h-6 w-6 shrink-0 flex items-center justify-center rounded hover:bg-muted"
              aria-label="Choose file"
              onClick={() => { void browseInclude(card.index); }}
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          </CardShell>
        );
      case 'custom_animation':
        return (
          <CardShell key={card.id} tip={tipText} onRemove={() => remove(card)}>
            <span>Custom animation</span>
            <span className="text-muted-foreground">frame</span>
            <Input
              type="number"
              className={inlineInput}
              value={card.values.width}
              placeholder="W"
              min={1}
              onChange={(e) => setProp('anim_render_width', e.target.value || null)}
            />
            <span>×</span>
            <Input
              type="number"
              className={inlineInput}
              value={card.values.height}
              placeholder="H"
              min={1}
              onChange={(e) => setProp('anim_render_height', e.target.value || null)}
            />
            <span className="text-muted-foreground">frames</span>
            <Input
              type="number"
              className={inlineInput}
              value={card.values.frames}
              min={1}
              onChange={(e) => setProp('anim_frames', e.target.value || null)}
            />
            <span className="text-muted-foreground">duration</span>
            <Input
              className={inlineInput}
              value={card.values.duration}
              placeholder="1200ms"
              onChange={(e) => setProp('anim_duration', e.target.value || null)}
            />
            <button
              type="button"
              className="text-[10px] text-muted-foreground underline underline-offset-2"
              onClick={() => setAnimMore((v) => !v)}
            >
              More
            </button>
            {animMore && (
              <div className="w-full flex flex-wrap items-center gap-1 pt-1">
                <span className="text-muted-foreground">offset</span>
                <Input
                  type="number"
                  className={inlineInput}
                  value={card.values.offset_x}
                  onChange={(e) => setProp('anim_render_offset_x', e.target.value || null)}
                />
                <span>,</span>
                <Input
                  type="number"
                  className={inlineInput}
                  value={card.values.offset_y}
                  onChange={(e) => setProp('anim_render_offset_y', e.target.value || null)}
                />
                <Select value={card.values.type || 'looped'} onValueChange={(v) => setProp('anim_type', v)}>
                  <SelectTrigger className="h-6 w-28 px-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="looped">Looped</SelectItem>
                    <SelectItem value="play_once">Play once</SelectItem>
                    <SelectItem value="back_forth">Back and forth</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={card.values.blend || 'normal'} onValueChange={(v) => setProp('anim_blend_mode', v)}>
                  <SelectTrigger className="h-6 w-20 px-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="add">Add</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  className={inlineInput}
                  value={card.values.alpha}
                  placeholder="α"
                  min={0}
                  max={255}
                  onChange={(e) => setProp('anim_alpha_mod', e.target.value || null)}
                />
                <Input
                  className={inlineInput}
                  value={card.values.color}
                  placeholder="255,255,255"
                  onChange={(e) => setProp('anim_color_mod', e.target.value || null)}
                />
              </div>
            )}
          </CardShell>
        );
      case 'stat':
        return (
          <CardShell key={card.id} tip={tipText} onRemove={() => remove(card)}>
            <span>Stat</span>
            <Input
              className={`${inlineInput} min-w-[4rem] font-mono text-left`}
              value={card.values.key}
              placeholder="key"
              onChange={(e) => updateStat(card.index, 'key', e.target.value)}
            />
            <span>=</span>
            <Input
              className={`${inlineInput} min-w-[5rem] font-mono text-left`}
              value={card.values.value}
              placeholder="value"
              onChange={(e) => updateStat(card.index, 'value', e.target.value)}
            />
          </CardShell>
        );
      case 'visual_effect':
        return (
          <CardShell key={card.id} tip={tipText} onRemove={() => remove(card)}>
            <span>Effect</span>
            <Input
              className={`${inlineInput} min-w-[4rem] font-mono text-left`}
              value={card.values.id}
              placeholder="id"
              onChange={(e) => updateEffect(card.index, 'id', e.target.value)}
            />
            <Input
              className={`${inlineInput} min-w-[8rem] max-w-[14rem] font-mono text-left`}
              value={card.values.animation}
              placeholder="animation"
              onChange={(e) => updateEffect(card.index, 'animation', e.target.value)}
            />
            <Input
              className={inlineInput}
              value={card.values.duration}
              placeholder="2s"
              onChange={(e) => updateEffect(card.index, 'duration', e.target.value)}
            />
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={/^(true|1)$/i.test(card.values.automatic || '')}
                onChange={(e) => updateEffect(card.index, 'automatic', e.target.checked ? 'true' : '')}
              />
              automatic
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={!/^(false|0)$/i.test(card.values.render_above || '')}
                onChange={(e) => updateEffect(card.index, 'render_above', e.target.checked ? 'true' : 'false')}
              />
              above
            </label>
            <Input
              className={`${inlineInput} min-w-[6rem] max-w-[12rem] text-left`}
              value={card.values.requires_status}
              placeholder="requires status"
              onChange={(e) => updateEffect(card.index, 'requires_status', e.target.value)}
            />
            <Input
              className={`${inlineInput} min-w-[6rem] max-w-[12rem] text-left`}
              value={card.values.requires_not_status}
              placeholder="requires not status"
              onChange={(e) => updateEffect(card.index, 'requires_not_status', e.target.value)}
            />
          </CardShell>
        );
      default:
        return null;
    }
  };

  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold">Properties</h4>
      <div className="space-y-1.5">
        {cards.map(renderCard)}
      </div>
      <SearchablePalette
        entries={catalog.map((entry) => ({
          id: entry.kind,
          label: entry.label,
          tooltip: `${entry.flareKey} — ${entry.description}`,
          searchText: [entry.label, entry.flareKey, entry.description, ...(entry.synonyms || [])].join(' '),
        }))}
        onSelect={(id) => {
          const entry = catalog.find((item) => item.kind === id);
          if (entry) add(entry);
        }}
      />
    </section>
  );
};

export default NpcPropertyList;
export type { NpcPropertyKind };
