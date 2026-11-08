import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { HelpCircle, Plus, X } from 'lucide-react';
import { parseSectionProperty, sectionsFromNpcText, type KeyValue } from '@/utils/npcFileUpdate';

type Props = {
  npcFilename: string;
  projectPath: string | null;
  getEditingObjectProperty: (key: string, fallback?: string) => string;
  updateEditingObjectProperty: (key: string, value: string | null) => void;
  /** When true, render only the stats/effects body (parent owns the accordion). */
  embedded?: boolean;
  forceExpanded?: boolean;
};

/** Flare 1.15 [visual_effect] keys (NPC.cpp); other keys of an effect are kept as they are. */
const VFX_FIELDS: Array<{ key: string; placeholder: string; tooltip: string; bool?: boolean }> = [
  { key: 'id', placeholder: 'id', tooltip: 'Identifier, triggered from a dialog with visual_effect=<id>. Required.' },
  { key: 'animation', placeholder: 'animations/...txt', tooltip: 'Animation played when the effect triggers. Required.' },
  { key: 'duration', placeholder: '2s', tooltip: 'How long the effect lasts.' },
  { key: 'requires_status', placeholder: 'status', tooltip: 'Campaign statuses required to trigger it.' },
  { key: 'requires_not_status', placeholder: 'status', tooltip: 'Campaign statuses that must not be set.' },
  { key: 'render_above', placeholder: '', tooltip: 'Draw above the NPC (default on).', bool: true },
  { key: 'automatic', placeholder: '', tooltip: 'Start without a dialog trigger (default off).', bool: true },
];

const valueOf = (entries: KeyValue[], key: string) => entries.find((e) => e.key === key)?.value ?? '';
const setValue = (entries: KeyValue[], key: string, value: string): KeyValue[] => {
  const i = entries.findIndex((e) => e.key === key);
  if (!value) return entries.filter((e) => e.key !== key);
  if (i < 0) return [...entries, { key, value }];
  return entries.map((e, j) => (j === i ? { key, value } : e));
};

export function countStatsAndEffects(
  get: (key: string, fallback?: string) => string,
  fileStatsLen = 0,
  fileEffectsLen = 0,
): number {
  const statsProp = get('npc_stats', '');
  const vfxProp = get('npc_visual_effects', '');
  const statsLen = statsProp ? (parseSectionProperty(statsProp)[0] || []).filter((e) => e.key || e.value).length : fileStatsLen;
  const effectsLen = vfxProp ? parseSectionProperty(vfxProp).length : fileEffectsLen;
  return statsLen + effectsLen;
}

/**
 * [stats] and [visual_effect] of the NPC file. Until edited, the file's values are only shown;
 * the first edit makes the list authoritative (it then replaces those sections on save).
 */
const NpcAdvancedSection = ({
  npcFilename,
  projectPath,
  getEditingObjectProperty,
  updateEditingObjectProperty,
  embedded = false,
  forceExpanded = false,
}: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [fileSections, setFileSections] = useState<{ stats: KeyValue[][]; visual_effect: KeyValue[][] } | null>(null);
  const statsProp = getEditingObjectProperty('npc_stats', '');
  const vfxProp = getEditingObjectProperty('npc_visual_effects', '');
  const isOpen = forceExpanded || expanded;

  useEffect(() => {
    if (!isOpen || fileSections || !npcFilename || !projectPath) return;
    const api = window.electronAPI as unknown as { readFile?: (p: string) => Promise<string | null> };
    if (!api?.readFile) return;
    const file = `${projectPath.replace(/\\/g, '/')}/npcs/${npcFilename.replace(/\\/g, '/').replace(/^npcs\//, '')}`;
    api.readFile(file).then((txt) => {
      setFileSections({ stats: sectionsFromNpcText(txt || '', 'stats'), visual_effect: sectionsFromNpcText(txt || '', 'visual_effect') });
    }).catch(() => setFileSections({ stats: [], visual_effect: [] }));
  }, [isOpen, fileSections, npcFilename, projectPath]);

  const stats: KeyValue[] = statsProp ? (parseSectionProperty(statsProp)[0] || []) : (fileSections?.stats.flat() || []);
  const effects: KeyValue[][] = vfxProp ? parseSectionProperty(vfxProp) : (fileSections?.visual_effect || []);
  const writeStats = (next: KeyValue[]) => updateEditingObjectProperty('npc_stats', JSON.stringify([next]));
  const writeVfx = (next: KeyValue[][]) => updateEditingObjectProperty('npc_visual_effects', JSON.stringify(next));

  const body = (
    <div className={embedded ? 'space-y-3' : 'space-y-3 px-3 pb-3'}>
      <div className="space-y-1.5">
        {stats.map((entry, i) => (
          <div key={i} className="flex gap-1">
            <Tooltip content="[stats] key (e.g. speed, or stat)">
              <Input className="h-7 text-xs font-mono w-28" value={entry.key} placeholder="Key"
                onChange={(e) => writeStats(stats.map((s, j) => (j === i ? { ...s, key: e.target.value } : s)))} />
            </Tooltip>
            <Tooltip content="[stats] value">
              <Input className="h-7 text-xs font-mono flex-1" value={entry.value} placeholder="Value"
                onChange={(e) => writeStats(stats.map((s, j) => (j === i ? { ...s, value: e.target.value } : s)))} />
            </Tooltip>
            <button type="button" className="h-7 w-7 shrink-0 flex items-center justify-center rounded hover:bg-muted" onClick={() => writeStats(stats.filter((_, j) => j !== i))} aria-label="Remove stat">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="h-7 px-2 text-xs rounded-md border border-dashed border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground inline-flex items-center gap-1"
          onClick={() => writeStats([...stats, { key: '', value: '' }])}
        >
          <Plus className="w-3.5 h-3.5" />
          Add stat
        </button>
      </div>

      <div className="space-y-2">
        {effects.map((fx, i) => (
          <div key={i} className="rounded border border-border p-2 space-y-1">
            <div className="grid grid-cols-2 gap-1">
              {VFX_FIELDS.filter((f) => !f.bool).map((f) => (
                <Tooltip key={f.key} content={`${f.key}: ${f.tooltip}`}>
                  <Input className="h-7 text-xs font-mono" value={valueOf(fx, f.key)} placeholder={f.key === 'id' ? 'id' : f.key}
                    onChange={(e) => writeVfx(effects.map((x, j) => (j === i ? setValue(x, f.key, e.target.value) : x)))} />
                </Tooltip>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs">
              {VFX_FIELDS.filter((f) => f.bool).map((f) => {
                const def = f.key === 'render_above';
                const raw = valueOf(fx, f.key);
                const on = raw ? raw === 'true' || raw === '1' : def;
                return (
                  <Tooltip key={f.key} content={`${f.key}: ${f.tooltip}`}>
                    <label className="inline-flex items-center gap-1.5">
                      <input type="checkbox" className="h-3.5 w-3.5" checked={on}
                        onChange={(e) => writeVfx(effects.map((x, j) => (j === i ? setValue(x, f.key, e.target.checked === def ? '' : String(e.target.checked)) : x)))} />
                      {f.key === 'render_above' ? 'Above NPC' : 'Automatic'}
                    </label>
                  </Tooltip>
                );
              })}
              <button
                type="button"
                className="ml-auto h-6 w-6 flex items-center justify-center rounded hover:bg-muted"
                onClick={() => writeVfx(effects.filter((_, j) => j !== i))}
                aria-label="Remove visual effect"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="h-7 px-2 text-xs rounded-md border border-dashed border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground inline-flex items-center gap-1"
          onClick={() => writeVfx([...effects, [{ key: 'id', value: `effect_${effects.length + 1}` }]])}
        >
          <Plus className="w-3.5 h-3.5" />
          Add effect
        </button>
      </div>
    </div>
  );

  if (embedded) return body;

  return (
    <div className="border border-border rounded-md bg-muted/20">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 text-sm font-semibold hover:bg-muted/50 rounded-t-md text-left"
      >
        <span>Stats &amp; Effects</span>
        <Tooltip content="[stats] and [visual_effect] sections from the NPC file.">
          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
        </Tooltip>
      </button>
      {expanded && body}
    </div>
  );
};

export default NpcAdvancedSection;
