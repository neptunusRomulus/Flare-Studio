import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DraftInput from './DraftInput';
import { Switch } from '@/components/ui/switch';
import Tooltip from '@/components/ui/tooltip';
import { InlineConfirm } from '@/components/ui/inline-confirm';
import SearchablePalette, { type SearchablePaletteEntry } from '@/components/ui/searchable-palette';
import EditorPropertyList, { type EditorProperty } from '@/components/EditorPropertyList';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import { keysFor } from '@/adapters/flare/flareAdapter.cjs';
import { KIND_META, POWER_KIND_ORDER, categorizePower, classifyEffect } from '@/editor/powers/powerKinds';
import type { PowerKind, UsedBy } from '@/editor/powers/powerProject';
import { summarizeEffect, summarizePower } from '@/editor/powers/powerSummary';
import { addChainLink, deleteImpact, effectWarnings, powerWarnings, readChain, removeChainLink, uniqueEffectId, updateChainLink, type Warning } from '@/editor/powers/powerChecks';
import { EFFECT_TEMPLATES } from '@/editor/powers/powerTemplates';
import { appendBlock, blockRecord, parseSectionFile, removeBlock, setBlockValue } from '@/editor/powers/sectionFile';
import { EFFECTS_FILE, keyLabel } from '@/editor/powers/powerFiles';
import { KindIcon } from './kindIcon';
import PowerSlider from './PowerSlider';
import TemplatePicker from './TemplatePicker';
import { createFromTemplate } from '@/editor/powers/powerCreate';
import type { ContentKind } from '@/editor/powers/powerKinds';
import type { PowerProjectFiles } from './usePowerProjectFiles';

export type PowerTarget = { type: 'power' | 'effect' | 'flag' | 'new'; id: string };

const POWER_TYPES: Array<{ id: string; label: string; tooltip: string }> = [
  { id: 'fixed', label: 'Hits a spot', tooltip: 'type=fixed: appears at the caster or target' },
  { id: 'missile', label: 'Projectile', tooltip: 'type=missile: flies until it hits' },
  { id: 'repeater', label: 'Chain of hits', tooltip: 'type=repeater: a line of hits, one after another' },
  { id: 'spawn', label: 'Summon', tooltip: 'type=spawn: creates a creature' },
  { id: 'transform', label: 'Transform', tooltip: 'type=transform: turns the caster into a creature' },
  { id: 'block', label: 'Block', tooltip: 'type=block: raises a shield while held' },
];
const EFFECT_TYPES = ['speed', 'attack_speed', 'damage', 'damage_percent', 'heal', 'hpot', 'hpot_percent', 'mpot', 'mpot_percent', 'shield', 'stun', 'fear', 'knockback', 'immunity', 'revive', 'convert', 'death_sentence'];

/** Keys the question sections already show; everything else goes through Properties. */
const POWER_SECTION_KEYS = new Set(['id', 'name', 'description', 'type', 'modifier_damage', 'radius', 'target_range', 'speed', 'count', 'lifespan', 'base_damage',
  'trait_elemental', 'spawn_type', 'buff', 'post_effect', 'post_effect_src', 'requires_mp', 'cooldown', 'icon', 'animation', 'soundfx', 'new_state']);
const EFFECT_SECTION_KEYS = new Set(['id', 'name', 'type', 'icon', 'animation', 'can_stack', 'max_stacks']);
const TOGGLE_KEYS = /^(use_hazard|buff|buff_teleport|buff_party|directional|face|aim_assist|multitarget|floor|complete_animation|requires_los|requires_corpse|remove_corpse|no_attack|passive|meta_power|sacrifice|can_stack|render_above|ignore_resist|wall_reflect|target_party|beacon|on_floor|ignore_zero_damage|lock_target_to_direction|missile_anim|trigger_all|manual_untransform|keep_equipment|untransform_on_hit|can_trigger_passives|script_trigger)$/;

const USED_BY_LABEL: Record<UsedBy['kind'], string> = { enemy: 'Enemy', item: 'Item', event: 'Map event', npc: 'NPC', power: 'Power', skill_tree: 'Skill tree', class: 'Class' };

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <div className="text-xs font-semibold text-muted-foreground">{title}</div>
    <div className="space-y-1.5">{children}</div>
  </section>
);

const Field = ({ label, flareKey, children }: { label: string; flareKey: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
    <Tooltip content={flareKey} side="left"><label className="text-xs truncate">{label}</label></Tooltip>
    <div className="min-w-0">{children}</div>
  </div>
);

const Warnings = ({ items }: { items: Warning[] }) => items.length === 0 ? null : (
  <div className="space-y-0.5">
    {items.map((w) => (
      <Tooltip key={w.id} content={w.tooltip} side="left">
        <div className="flex items-center gap-1.5 text-xs text-amber-500"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{w.text}</div>
      </Tooltip>
    ))}
  </div>
);

const UsedByList = ({ items, extra }: { items: Array<UsedBy & { detail?: string }>; extra?: (u: UsedBy) => React.ReactNode }) => (
  items.length === 0 ? <div className="text-xs text-muted-foreground">Nothing yet.</div> : (
    <div className="flex flex-wrap gap-1">
      {items.filter((u, i) => items.findIndex((x) => x.kind === u.kind && x.name === u.name && x.path === u.path) === i).map((u, i) => (
        <Tooltip key={`${u.path}-${u.key}-${i}`} content={`${u.path} · ${u.key}=`} side="top">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
            <span className="text-muted-foreground">{USED_BY_LABEL[u.kind]}</span>{u.name}{u.detail ? <span className="text-muted-foreground">{u.detail}</span> : null}{extra?.(u)}
          </span>
        </Tooltip>
      ))}
    </div>
  )
);

type Props = { target: PowerTarget; data: PowerProjectFiles; onClose: () => void; onOpen: (t: PowerTarget) => void };

function includeChain(data: PowerProjectFiles, includes: string[] = []) {
  const values: Record<string, string[]> = {};
  for (const inc of includes) {
    for (const line of data.textOf(inc).split('\n')) {
      const m = line.trim().match(/^(post_effect|post_effect_src)=(.*)$/);
      if (m) (values[m[1]] = values[m[1]] || []).push(m[2].trim());
    }
  }
  return readChain(values);
}

const PowerEditor = ({ target, data, onClose, onOpen }: Props) => {
  const { project, kinds, textOf, writeFile, setKind } = data;
  const power = project.powers.find((p) => p.id === target.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  if (!power) return <div className="p-4 text-xs text-muted-foreground">This power no longer exists.</div>;
  const text = textOf(power.path);
  const own = blockRecord(parseSectionFile(text, 'power').blocks[power.blockIndex] || { entries: [] } as never);
  const keys = power.keys;
  const v = (key: string) => (keys[key] || [])[0] || '';
  const set = (key: string, value: string | null) => writeFile(power.path, setBlockValue(textOf(power.path), 'power', power.blockIndex, key, value));
  const usedBy = project.powerUsedBy[power.id] || [];
  const kind = data.powerKinds[power.id] || categorizePower(power, usedBy, kinds[power.id]);
  const effectName = (id: string) => project.effects.find((e) => e.id === id)?.name || id;
  const effectNames = Object.fromEntries(project.effects.map((e) => [e.id, e.name]));
  const warnings = powerWarnings(power, kind, usedBy, project);
  const ownChain = readChain(own);
  const inherited = includeChain(data, power.includes);

  const chainEntries: SearchablePaletteEntry[] = [
    ...project.effects.map((e) => {
      const k = classifyEffect(e, project.effectUsedBy[e.id] || []);
      return { id: `effect:${e.id}`, label: `${e.name} · ${KIND_META[k].label}`, tooltip: `[effect] id=${e.id}`, searchText: e.id };
    }),
    ...EFFECT_TEMPLATES.map((t) => ({ id: `new:${t.id}`, label: `New ${t.label}…`, tooltip: `Creates [effect] in ${EFFECTS_FILE} (from ${t.source})` })),
  ];
  const applyEffect = (entry: string) => {
    if (entry.startsWith('effect:')) {
      const id = entry.slice(7);
      writeFile(power.path, addChainLink(textOf(power.path), power.blockIndex, { effectId: id, magnitude: '0', duration: '3s', chance: '' }));
      return;
    }
    const template = EFFECT_TEMPLATES.find((t) => `new:${t.id}` === entry);
    if (!template) return;
    const id = uniqueEffectId(template.flareId, project);
    writeFile(EFFECTS_FILE, appendBlock(textOf(EFFECTS_FILE), 'effect', [['id', id], ...template.keys]));
    writeFile(power.path, addChainLink(textOf(power.path), power.blockIndex, { effectId: id, magnitude: template.magnitude, duration: template.duration, chance: '' }));
  };

  const ownKeys = [...Object.keys(own), ...added.filter((k) => !own[k])].filter((k) => !POWER_SECTION_KEYS.has(k));
  const properties: EditorProperty[] = ownKeys.map((k) => ({ key: k, label: keyLabel(k), value: (own[k] || [])[0] || '', tooltip: k, kind: TOGGLE_KEYS.test(k) ? 'toggle' : 'text' }));
  const catalog: SearchablePaletteEntry[] = [...(keysFor('powers', 'power') || [])]
    .filter((k) => !POWER_SECTION_KEYS.has(k) && !own[k] && !added.includes(k))
    .sort()
    .map((k) => ({ id: k, label: keyLabel(k), tooltip: k, searchText: k }));

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Tooltip content={`${KIND_META[kind].tooltip} · id=${power.id}`} side="bottom"><span><KindIcon kind={kind} className="w-5 h-5" /></span></Tooltip>
          <DraftInput className="h-8 text-sm font-semibold border-0 shadow-none px-1 focus:ring-0" value={v('name')} placeholder={power.name || 'Name'} aria-label="Name" onChange={(e) => set('name', e.target.value)} />
          <span className={`text-[11px] whitespace-nowrap ${KIND_META[kind].color}`}>{KIND_META[kind].label}</span>
          <InlineConfirm open={confirmDelete} onCancel={() => setConfirmDelete(false)} message={`Delete? ${deleteImpact(usedBy)}`}
            onConfirm={() => { writeFile(power.path, removeBlock(textOf(power.path), 'power', power.blockIndex), true); setKind(power.id, null); setConfirmDelete(false); onClose(); }}>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" aria-label="Delete" onClick={() => setConfirmDelete(true)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </InlineConfirm>
        </div>
        <p className="text-xs text-muted-foreground px-1" data-testid="power-summary">{summarizePower(keys, effectNames)}</p>
        <Warnings items={warnings} />
      </div>

      <Section title="What does it do?">
        <Field label="Works as" flareKey="type">
          <div className="flex flex-wrap gap-1">
            {POWER_TYPES.map((t) => (
              <Tooltip key={t.id} content={t.tooltip}>
                <button type="button" onClick={() => set('type', t.id)}
                  className={`h-6 px-2 rounded-full text-[11px] ${v('type') === t.id ? 'bg-foreground text-background' : 'bg-muted hover:bg-muted/70'}`}>{t.label}</button>
              </Tooltip>
            ))}
          </div>
        </Field>
        <PowerSlider label="Damage" flareKey="modifier_damage" raw={v('modifier_damage')} unit="%" tooltip="Percent of the caster's damage" onChange={(r) => set('modifier_damage', r)} />
        <Field label="Damage from" flareKey="base_damage">
          <DraftInput className="h-7 text-xs" value={v('base_damage')} placeholder="melee, ranged, ment…" onChange={(e) => set('base_damage', e.target.value || null)} />
        </Field>
        <Field label="Element" flareKey="trait_elemental">
          <DraftInput className="h-7 text-xs" value={v('trait_elemental')} placeholder="fire, ice…" onChange={(e) => set('trait_elemental', e.target.value || null)} />
        </Field>
        <PowerSlider label="Area size" flareKey="radius" raw={v('radius')} tooltip="Tiles" onChange={(r) => set('radius', r)} />
        <PowerSlider label="Range" flareKey="target_range" raw={v('target_range')} tooltip="Tiles" onChange={(r) => set('target_range', r)} />
        {(v('type') === 'missile' || v('type') === 'repeater' || v('speed')) && (
          <PowerSlider label="Speed" flareKey="speed" raw={v('speed')} onChange={(r) => set('speed', r)} />
        )}
        {(v('type') === 'missile' || v('type') === 'repeater' || v('count')) && (
          <PowerSlider label="Projectiles" flareKey="count" raw={v('count')} onChange={(r) => set('count', r)} />
        )}
        <PowerSlider label="Lasts" flareKey="lifespan" raw={v('lifespan')} unit="s" onChange={(r) => set('lifespan', r)} />
        {(v('type') === 'spawn' || v('spawn_type')) && (
          <Field label="Summons" flareKey="spawn_type">
            <DraftInput className="h-7 text-xs" value={v('spawn_type')} onChange={(e) => set('spawn_type', e.target.value || null)} />
          </Field>
        )}
        <Field label="Targets caster" flareKey="buff">
          <Switch checked={v('buff') === 'true'} onCheckedChange={(c) => set('buff', c ? 'true' : null)} aria-label="Targets caster" />
        </Field>
        <div className="pt-1 space-y-1">
          <div><Tooltip content="post_effect=id,magnitude,duration[,chance]" side="left"><span className="text-xs">When it hits, apply…</span></Tooltip></div>
          {inherited.map((l, i) => (
            <div key={`inc-${i}`}>
              <Tooltip content={`From an INCLUDE file: ${l.key}=${l.effectId},${l.magnitude},${l.duration}`}>
                <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="w-36 truncate">{effectName(l.effectId)}</span>{l.magnitude} · {l.duration}</span>
              </Tooltip>
            </div>
          ))}
          {ownChain.map((l) => {
            const e = project.effects.find((x) => x.id === l.effectId);
            const k = e ? classifyEffect(e, project.effectUsedBy[e.id] || []) : 'debuff';
            const update = (patch: Partial<typeof l>) => writeFile(power.path, updateChainLink(textOf(power.path), power.blockIndex, l.key, l.index, { ...l, ...patch }));
            return (
              <div key={`${l.key}-${l.index}`} className="flex items-center gap-2">
                <button type="button" className="w-36 flex items-center gap-1 text-xs truncate hover:underline" onClick={() => e && onOpen({ type: 'effect', id: e.id })}>
                  <KindIcon kind={k} />{effectName(l.effectId)}{l.key === 'post_effect_src' ? <span className="text-muted-foreground">(caster)</span> : null}
                </button>
                <Tooltip content="Strength (magnitude)"><DraftInput className="h-7 w-16 text-xs" value={l.magnitude} aria-label="Strength" onChange={(ev) => update({ magnitude: ev.target.value })} /></Tooltip>
                <Tooltip content="Duration (e.g. 5s or 500ms)"><DraftInput className="h-7 w-16 text-xs" value={l.duration} aria-label="Duration" onChange={(ev) => update({ duration: ev.target.value })} /></Tooltip>
                <Tooltip content="Chance % (empty = always)"><DraftInput className="h-7 w-14 text-xs" value={l.chance} placeholder="100" aria-label="Chance" onChange={(ev) => update({ chance: ev.target.value })} /></Tooltip>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" aria-label="Remove effect"
                  onClick={() => writeFile(power.path, removeChainLink(textOf(power.path), power.blockIndex, l.key, l.index))}><X className="w-3.5 h-3.5" /></Button>
              </div>
            );
          })}
          <SearchablePalette buttonLabel="Apply Buff / Debuff" placeholder="Search effects…" entries={chainEntries} onSelect={applyEffect} />
        </div>
      </Section>

      <Section title="How is it used?">
        <PowerSlider label="Mana cost" flareKey="requires_mp" raw={v('requires_mp')} onChange={(r) => set('requires_mp', r)} />
        <PowerSlider label="Cooldown" flareKey="cooldown" raw={v('cooldown')} unit="s" onChange={(r) => set('cooldown', r)} />
        <Field label="Description" flareKey="description">
          <DraftInput className="h-7 text-xs" value={v('description')} onChange={(e) => set('description', e.target.value || null)} />
        </Field>
        <Field label="Used by" flareKey="enemy power= · item power= · event power= · skill tree · class">
          <UsedByList items={usedBy} />
        </Field>
        {usedBy.length === 0 && (
          <Field label="Shown as" flareKey="Studio only (.flare-studio/power-kinds.json)">
            <div className="flex flex-wrap gap-1">
              {POWER_KIND_ORDER.map((k) => (
                <button key={k} type="button" onClick={() => setKind(power.id, k as PowerKind)}
                  className={`h-6 px-2 rounded-full text-[11px] inline-flex items-center gap-1 ${kind === k ? 'bg-foreground text-background' : 'bg-muted hover:bg-muted/70'}`}>
                  <KindIcon kind={k} className="w-3 h-3" />{KIND_META[k].label}
                </button>
              ))}
            </div>
          </Field>
        )}
      </Section>

      <Section title="How does it look and sound?">
        <Field label="Icon" flareKey="icon"><DraftInput className="h-7 text-xs" value={v('icon')} onChange={(e) => set('icon', e.target.value || null)} /></Field>
        <Field label="Animation" flareKey="animation"><DraftInput className="h-7 text-xs" value={v('animation')} placeholder="animations/powers/…" onChange={(e) => set('animation', e.target.value || null)} /></Field>
        <Field label="Sound" flareKey="soundfx"><DraftInput className="h-7 text-xs" value={v('soundfx')} placeholder="soundfx/powers/…" onChange={(e) => set('soundfx', e.target.value || null)} /></Field>
        <Field label="Caster animation" flareKey="new_state"><DraftInput className="h-7 text-xs" value={v('new_state')} placeholder="cast, swing, shoot, instant" onChange={(e) => set('new_state', e.target.value || null)} /></Field>
      </Section>

      <EditorPropertyList properties={properties} catalog={catalog}
        onChange={(k, value) => set(k, value)}
        onAdd={(k) => (TOGGLE_KEYS.test(k) ? set(k, 'true') : setAdded((a) => [...a, k]))}
        onRemove={(k) => { setAdded((a) => a.filter((x) => x !== k)); writeFile(power.path, setBlockValue(textOf(power.path), 'power', power.blockIndex, k, null)); }} />
    </div>
  );
};

const EffectEditor = ({ target, data, onClose, onOpen }: Props) => {
  const { project, textOf, writeFile } = data;
  const effect = project.effects.find((e) => e.id === target.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  if (!effect) return <div className="p-4 text-xs text-muted-foreground">This effect no longer exists.</div>;
  const text = textOf(effect.path);
  const own = blockRecord(parseSectionFile(text, 'effect').blocks[effect.blockIndex] || { entries: [] } as never);
  const v = (key: string) => (effect.keys[key] || [])[0] || '';
  const set = (key: string, value: string | null) => writeFile(effect.path, setBlockValue(textOf(effect.path), 'effect', effect.blockIndex, key, value));
  const uses = project.effectUsedBy[effect.id] || [];
  const kind = classifyEffect(effect, uses);
  const properties: EditorProperty[] = [...Object.keys(own), ...added.filter((k) => !own[k])].filter((k) => !EFFECT_SECTION_KEYS.has(k))
    .map((k) => ({ key: k, label: keyLabel(k), value: (own[k] || [])[0] || '', tooltip: k, kind: TOGGLE_KEYS.test(k) ? 'toggle' : 'text' }));
  const catalog = [...(keysFor('effects', 'effect') || [])].filter((k) => !EFFECT_SECTION_KEYS.has(k) && !own[k] && !added.includes(k)).map((k) => ({ id: k, label: keyLabel(k), tooltip: k }));
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Tooltip content={`${KIND_META[kind].tooltip} · id=${effect.id}`} side="bottom"><span><KindIcon kind={kind} className="w-5 h-5" /></span></Tooltip>
          <DraftInput className="h-8 text-sm font-semibold border-0 shadow-none px-1 focus:ring-0" value={v('name')} placeholder={effect.id} aria-label="Name" onChange={(e) => set('name', e.target.value || null)} />
          <span className={`text-[11px] whitespace-nowrap ${KIND_META[kind].color}`}>{KIND_META[kind].label}</span>
          <InlineConfirm open={confirmDelete} onCancel={() => setConfirmDelete(false)} message={`Delete? ${deleteImpact(uses)}`}
            onConfirm={() => { writeFile(effect.path, removeBlock(textOf(effect.path), 'effect', effect.blockIndex), true); setConfirmDelete(false); onClose(); }}>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" aria-label="Delete" onClick={() => setConfirmDelete(true)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </InlineConfirm>
        </div>
        <p className="text-xs text-muted-foreground px-1">{summarizeEffect(effect.keys, KIND_META[kind].label)}</p>
        <Warnings items={effectWarnings(effect, kind, uses)} />
      </div>
      <Section title="What does it do?">
        <Field label="Changes" flareKey="type">
          <div className="flex flex-wrap gap-1">
            {EFFECT_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => set('type', t)}
                className={`h-6 px-2 rounded-full text-[11px] ${v('type') === t ? 'bg-foreground text-background' : 'bg-muted hover:bg-muted/70'}`}>{keyLabel(t)}</button>
            ))}
          </div>
        </Field>
        <Field label="Stacks" flareKey="can_stack"><Switch checked={v('can_stack') !== 'false'} onCheckedChange={(c) => set('can_stack', c ? 'true' : 'false')} aria-label="Stacks" /></Field>
        {v('can_stack') !== 'false' && (
          <Field label="Max stacks" flareKey="max_stacks"><DraftInput className="h-7 text-xs" value={v('max_stacks')} placeholder="no limit" onChange={(e) => set('max_stacks', e.target.value || null)} /></Field>
        )}
      </Section>
      <Section title="How is it used?">
        <Field label="Applied by" flareKey="post_effect / post_effect_src / remove_effect">
          <div className="flex flex-wrap gap-1">
            {uses.length === 0 ? <span className="text-xs text-muted-foreground">Nothing yet.</span> : uses.map((u, i) => {
              const p = project.powers.find((x) => x.name === u.name && x.path === u.path);
              return (
                <Tooltip key={i} content={`${u.path} · ${u.key}=${effect.id},${u.magnitude},${u.duration}`}>
                  <button type="button" className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/70" onClick={() => p && onOpen({ type: 'power', id: p.id })}>
                    {u.name}{u.key === 'remove_effect' ? <span className="text-muted-foreground">removes</span> : <span className="text-muted-foreground">{u.magnitude} · {u.duration}</span>}
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </Field>
      </Section>
      <Section title="How does it look?">
        <Field label="Icon" flareKey="icon"><DraftInput className="h-7 text-xs" value={v('icon')} onChange={(e) => set('icon', e.target.value || null)} /></Field>
        <Field label="Animation" flareKey="animation"><DraftInput className="h-7 text-xs" value={v('animation')} onChange={(e) => set('animation', e.target.value || null)} /></Field>
      </Section>
      <EditorPropertyList properties={properties} catalog={catalog}
        onChange={(k, value) => set(k, value)} onAdd={(k) => (TOGGLE_KEYS.test(k) ? set(k, 'true') : setAdded((a) => [...a, k]))}
        onRemove={(k) => { setAdded((a) => a.filter((x) => x !== k)); set(k, null); }} />
    </div>
  );
};

const FlagView = ({ target, data }: Props) => {
  const usage = data.project.flags[target.id] || { setBy: [], readBy: [] };
  const row = (label: string, key: string, items: string[]) => (
    <Field label={label} flareKey={key}>
      <div className="flex flex-wrap gap-1">
        {items.length === 0 ? <span className="text-xs text-muted-foreground">Nothing.</span> : items.map((s) => <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{s}</span>)}
      </div>
    </Field>
  );
  const warnings: Warning[] = [];
  if (usage.setBy.length === 0) warnings.push({ id: 'never_set', text: 'Nothing ever sets this flag', tooltip: 'Read by requires_status / requires_not_status, but no set_status' });
  if (usage.readBy.length === 0) warnings.push({ id: 'never_read', text: 'Nothing checks this flag', tooltip: 'Set, but no requires_status / requires_not_status reads it' });
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><KindIcon kind="flag" className="w-5 h-5" /><span className="text-sm font-semibold">{target.id}</span></div>
      <Warnings items={warnings} />
      {row('Set by', 'set_status / unset_status / defeat_status …', usage.setBy)}
      {row('Checked by', 'requires_status / requires_not_status …', usage.readBy)}
    </div>
  );
};

const NewView = ({ target, data, onOpen }: Props) => {
  const kind = (target.id || 'skill') as ContentKind;
  return (
    <TemplatePicker kind={kind} onKind={(k) => onOpen({ type: 'new', id: k })}
      onPick={({ kind: k, templateId }) => {
        if (k === 'flag') return;
        const result = createFromTemplate(data.project, data.textOf, k, templateId);
        for (const w of result.writes) data.writeFile(w.path, w.text, true);
        if (result.kind) data.setKind(result.target.id, result.kind);
        onOpen(result.target);
      }} />
  );
};

/** Editor body without the floating frame (also used by tests). */
export const PowerEditorBody = (props: Props) => {
  const body = props.target.type;
  return body === 'power' ? <PowerEditor key={props.target.id} {...props} /> : body === 'effect' ? <EffectEditor key={props.target.id} {...props} /> : body === 'new' ? <NewView {...props} /> : <FlagView {...props} />;
};

/** Floating editor for a power, effect or story flag. */
const PowerEditorWindow = (props: Props) => {
  const { position, size, dialogRef, handleHeaderMouseDown, handleResizeMouseDown } = useDraggableResizable({ id: 'power_editor', initialWidth: 560, initialHeight: 640 });
  const { onClose } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !(e.target as HTMLElement)?.closest?.('input,textarea')) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div ref={dialogRef} className="bg-background border border-border/70 rounded-lg flex flex-col shadow-xl"
      style={{ position: 'fixed', left: position.x, top: position.y, width: size.width, height: size.height, zIndex: 50 }}
      onClick={(e) => e.stopPropagation()}>
      <div className="h-7 shrink-0 flex items-center justify-end px-1 cursor-move select-none" onMouseDown={handleHeaderMouseDown}>
        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" aria-label="Close" onClick={onClose}><X className="w-3.5 h-3.5" /></Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
        <PowerEditorBody {...props} />
      </div>
      <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize" onMouseDown={handleResizeMouseDown} />
    </div>,
    document.body,
  );
};

export default PowerEditorWindow;
