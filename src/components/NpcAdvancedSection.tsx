import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { InlineConfirm } from '@/components/ui/inline-confirm';
import { ChevronDown, ChevronUp, HelpCircle, Plus, X } from 'lucide-react';
import { parseSectionProperty, sectionsFromNpcText, type KeyValue } from '@/utils/npcFileUpdate';

type Props = {
  npcFilename: string;
  projectPath: string | null;
  getEditingObjectProperty: (key: string, fallback?: string) => string;
  updateEditingObjectProperty: (key: string, value: string | null) => void;
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

/**
 * [stats] and [visual_effect] of the NPC file. Until edited, the file's values are only shown;
 * the first edit makes the list authoritative (it then replaces those sections on save).
 */
const NpcAdvancedSection = ({ npcFilename, projectPath, getEditingObjectProperty, updateEditingObjectProperty }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [fileSections, setFileSections] = useState<{ stats: KeyValue[][]; visual_effect: KeyValue[][] } | null>(null);
  const [confirmVfx, setConfirmVfx] = useState<number | null>(null);
  const statsProp = getEditingObjectProperty('npc_stats', '');
  const vfxProp = getEditingObjectProperty('npc_visual_effects', '');

  useEffect(() => {
    if (!expanded || fileSections || !npcFilename || !projectPath) return;
    const api = window.electronAPI as unknown as { readFile?: (p: string) => Promise<string | null> };
    if (!api?.readFile) return;
    const file = `${projectPath.replace(/\\/g, '/')}/npcs/${npcFilename.replace(/\\/g, '/').replace(/^npcs\//, '')}`;
    api.readFile(file).then((txt) => {
      setFileSections({ stats: sectionsFromNpcText(txt || '', 'stats'), visual_effect: sectionsFromNpcText(txt || '', 'visual_effect') });
    }).catch(() => setFileSections({ stats: [], visual_effect: [] }));
  }, [expanded, fileSections, npcFilename, projectPath]);

  const stats: KeyValue[] = statsProp ? (parseSectionProperty(statsProp)[0] || []) : (fileSections?.stats.flat() || []);
  const effects: KeyValue[][] = vfxProp ? parseSectionProperty(vfxProp) : (fileSections?.visual_effect || []);
  const writeStats = (next: KeyValue[]) => updateEditingObjectProperty('npc_stats', JSON.stringify([next]));
  const writeVfx = (next: KeyValue[][]) => updateEditingObjectProperty('npc_visual_effects', JSON.stringify(next));

  return (
    <div className="border border-border rounded-md bg-muted/20">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 text-sm font-semibold hover:bg-muted/50 rounded-t-md text-left"
      >
        {expanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
        <span>Stats &amp; Effects</span>
      </button>
      {expanded && (
        <div className="space-y-3 px-3 pb-3">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-xs text-muted-foreground">Stats</label>
              <Tooltip content="[stats] section, read by StatBlock (e.g. speed=, stat=hp,100). Repeated keys are allowed.">
                <HelpCircle className="w-3 h-3 text-muted-foreground" />
              </Tooltip>
              <button type="button" className="ml-auto h-5 w-5 flex items-center justify-center rounded hover:bg-muted" onClick={() => writeStats([...stats, { key: '', value: '' }])} aria-label="Add stat">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-1">
              {stats.map((entry, i) => (
                <div key={i} className="flex gap-1">
                  <Input className="h-7 text-xs font-mono w-28" value={entry.key} placeholder="key"
                    onChange={(e) => writeStats(stats.map((s, j) => (j === i ? { ...s, key: e.target.value } : s)))} />
                  <Input className="h-7 text-xs font-mono flex-1" value={entry.value} placeholder="value"
                    onChange={(e) => writeStats(stats.map((s, j) => (j === i ? { ...s, value: e.target.value } : s)))} />
                  <button type="button" className="h-7 w-7 shrink-0 flex items-center justify-center rounded hover:bg-muted" onClick={() => writeStats(stats.filter((_, j) => j !== i))} aria-label="Remove stat">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-xs text-muted-foreground">Visual Effects</label>
              <Tooltip content="[visual_effect] sections. Trigger one from a dialog with visual_effect=<id>, or set Automatic.">
                <HelpCircle className="w-3 h-3 text-muted-foreground" />
              </Tooltip>
              <button type="button" className="ml-auto h-5 w-5 flex items-center justify-center rounded hover:bg-muted" onClick={() => writeVfx([...effects, [{ key: 'id', value: `effect_${effects.length + 1}` }]])} aria-label="Add visual effect">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {effects.map((fx, i) => (
                <div key={i} className="rounded border border-border p-2 space-y-1">
                  <div className="grid grid-cols-2 gap-1">
                    {VFX_FIELDS.filter((f) => !f.bool).map((f) => (
                      <Tooltip key={f.key} content={`${f.key}: ${f.tooltip}`}>
                        <Input className="h-7 text-xs font-mono" value={valueOf(fx, f.key)} placeholder={f.key === 'id' ? 'id' : `${f.key}${f.placeholder && f.placeholder !== f.key ? ` (${f.placeholder})` : ''}`}
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
                        <Tooltip key={f.key} content={f.tooltip}>
                          <label className="inline-flex items-center gap-1.5">
                            <input type="checkbox" className="h-3.5 w-3.5" checked={on}
                              onChange={(e) => writeVfx(effects.map((x, j) => (j === i ? setValue(x, f.key, e.target.checked === def ? '' : String(e.target.checked)) : x)))} />
                            {f.key === 'render_above' ? 'Above NPC' : 'Automatic'}
                          </label>
                        </Tooltip>
                      );
                    })}
                    <div className="ml-auto">
                      <InlineConfirm open={confirmVfx === i} message="Remove this effect?" onCancel={() => setConfirmVfx(null)}
                        onConfirm={() => { setConfirmVfx(null); writeVfx(effects.filter((_, j) => j !== i)); }}>
                        <button type="button" className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted" onClick={() => setConfirmVfx(i)} aria-label="Remove visual effect">
                          <X className="w-3 h-3" />
                        </button>
                      </InlineConfirm>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NpcAdvancedSection;
