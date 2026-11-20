import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import {
  parseHeroLayers, parseHeroOptions, parseLootSettings, parseXpTable,
  serializeHeroLayers, serializeHeroOptions, serializeXpTable, unknownIds, upsertLootSettings,
  type HeroLayer, type HeroOption, type XpRow,
} from '@/editor/engineForms';
import {
  emptyHeroClass,
  parseClassesFile,
  serializeClassesFile,
  type HeroClassEntry,
} from '@/editor/heroClasses';
import {
  emptyEquipFlag,
  parseEquipFlags,
  serializeEquipFlags,
} from '@/editor/equipFlags';

type TextProps = { text: string; onChange: (text: string) => void };

const Field = ({ label, tip, children }: { label: string; tip: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[9rem_1fr] items-center gap-2">
    <HintLabel className="text-xs truncate font-normal" hint={tip}>{label}</HintLabel>
    {children}
  </div>
);

export function XpTableForm({ text, onChange }: TextProps) {
  const rows = parseXpTable(text);
  const setRow = (index: number, patch: Partial<XpRow>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(serializeXpTable(next, text));
  };
  return (
    <div className="space-y-2">
      <FieldHint hint="XP needed to reach each level (level=N,XP).">
        <div className="grid grid-cols-[5rem_1fr_auto] gap-1 text-[11px] text-muted-foreground">
          <span>Level</span><span>XP</span><span />
        </div>
      </FieldHint>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[5rem_1fr_auto] gap-1">
          <Input className="h-6 text-xs" value={row.level} onChange={(e) => setRow(i, { level: e.target.value })} />
          <Input className="h-6 text-xs" value={row.xp} onChange={(e) => setRow(i, { xp: e.target.value })} />
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Remove level" onClick={() => onChange(serializeXpTable(rows.filter((_, j) => j !== i), text))}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange(serializeXpTable([...rows, { level: String((Number(rows.at(-1)?.level) || rows.length) + 1), xp: '0' }], text))}>
        <Plus className="w-3 h-3 mr-1" />Level
      </Button>
    </div>
  );
}

export function LootSettingsForm({ text, onChange }: TextProps) {
  const loot = parseLootSettings(text);
  const set = (key: keyof typeof loot, value: string) => onChange(upsertLootSettings(text, { [key]: value }));
  return (
    <div className="space-y-2">
      <FieldHint hint="engine/loot.txt. Empty keys are not written. Comments and unknown keys are kept. vendor_ratio and vendor_ratio_buyback are deprecated.">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Loot</div>
      </FieldHint>
      <Field label="currency_name" tip="Displayed name of currency.">
        <Input width="name" className="h-7 text-xs" value={loot.currency_name} onChange={(e) => set('currency_name', e.target.value)} />
      </Field>
      <Field label="vendor_ratio_buy" tip="Global multiplier for item prices on the Buy tab. Default 1.0.">
        <Input width="num" className="h-7 text-xs" value={loot.vendor_ratio_buy} onChange={(e) => set('vendor_ratio_buy', e.target.value)} />
      </Field>
      <Field label="vendor_ratio_sell" tip="Multiplier for what vendors pay and for the Sell tab. Default 0.25.">
        <Input width="num" className="h-7 text-xs" value={loot.vendor_ratio_sell} onChange={(e) => set('vendor_ratio_sell', e.target.value)} />
      </Field>
      <Field label="vendor_ratio_sell_old" tip="Sell-tab price after the player leaves the map or quits. Falls back to vendor_ratio_sell.">
        <Input width="num" className="h-7 text-xs" value={loot.vendor_ratio_sell_old} onChange={(e) => set('vendor_ratio_sell_old', e.target.value)} />
      </Field>
      <Field label="tooltip_margin" tip="Vertical offset of the loot tooltip from the loot itself.">
        <Input width="num" className="h-7 text-xs" value={loot.tooltip_margin} onChange={(e) => set('tooltip_margin', e.target.value)} />
      </Field>
      <Field label="autopickup_currency" tip="Enable autopickup for currency.">
        <Input width="short" className="h-7 text-xs" value={loot.autopickup_currency} onChange={(e) => set('autopickup_currency', e.target.value)} />
      </Field>
      <Field label="autopickup_range" tip="Minimum distance the player must be from loot to trigger autopickup.">
        <Input width="num" className="h-7 text-xs" value={loot.autopickup_range} onChange={(e) => set('autopickup_range', e.target.value)} />
      </Field>
      <Field label="sfx_loot" tip="Sound effect played when loot drops.">
        <Input width="path" className="h-7 text-xs" value={loot.sfx_loot} onChange={(e) => set('sfx_loot', e.target.value)} />
      </Field>
      <Field label="drop_max" tip="Maximum number of random item stacks that can drop at once.">
        <Input width="num" className="h-7 text-xs" value={loot.drop_max} onChange={(e) => set('drop_max', e.target.value)} />
      </Field>
      <Field label="drop_radius" tip="Distance in tiles from the origin that loot can drop.">
        <Input width="num" className="h-7 text-xs" value={loot.drop_radius} onChange={(e) => set('drop_radius', e.target.value)} />
      </Field>
      <Field label="hide_radius" tip="If an entity is within this radius of a piece of loot, the label is hidden unless highlighted.">
        <Input width="num" className="h-7 text-xs" value={loot.hide_radius} onChange={(e) => set('hide_radius', e.target.value)} />
      </Field>
      <Field label="extended_items_offset" tip="Starting item ID for extended items. 0 (default) places them after the last items/items.txt id.">
        <Input width="num" className="h-7 text-xs" value={loot.extended_items_offset} onChange={(e) => set('extended_items_offset', e.target.value)} />
      </Field>
      <Field label="vendor_ratio" tip="Deprecated in v1.12.85. Use vendor_ratio_sell instead.">
        <Input width="num" className="h-7 text-xs" value={loot.vendor_ratio} onChange={(e) => set('vendor_ratio', e.target.value)} />
      </Field>
      <Field label="vendor_ratio_buyback" tip="Deprecated in v1.12.85. Use vendor_ratio_sell_old instead.">
        <Input width="num" className="h-7 text-xs" value={loot.vendor_ratio_buyback} onChange={(e) => set('vendor_ratio_buyback', e.target.value)} />
      </Field>
    </div>
  );
}

export function HeroOptionsForm({ text, onChange }: TextProps) {
  const rows = parseHeroOptions(text);
  const setRow = (index: number, patch: Partial<HeroOption>) => {
    onChange(serializeHeroOptions(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)), text));
  };
  return (
    <div className="space-y-2">
      <FieldHint hint="New-hero appearances in engine/hero_options.txt (option=index,base,head,portrait,name). base is a folder in images/avatar; head is a png in that folder; portrait is a filename; name is the default hero name.">
        <div className="flex flex-wrap items-end gap-1 text-[11px] text-muted-foreground">
          <span className="w-20">index</span><span className="w-36">base</span><span className="w-36">head</span><span className="w-full max-w-md">portrait</span><span className="w-44">name</span>
        </div>
      </FieldHint>
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1">
          <Input aria-label={`Hero option index ${i + 1}`} width="num" className="h-6 text-xs" value={row.index} onChange={(e) => setRow(i, { index: e.target.value })} />
          <Input aria-label={`Hero option base ${i + 1}`} width="id" className="h-6 text-xs" value={row.base} onChange={(e) => setRow(i, { base: e.target.value })} />
          <Input aria-label={`Hero option head ${i + 1}`} width="id" className="h-6 text-xs" value={row.head} onChange={(e) => setRow(i, { head: e.target.value })} />
          <Input aria-label={`Hero option portrait ${i + 1}`} width="path" className="h-6 text-xs" value={row.portrait} onChange={(e) => setRow(i, { portrait: e.target.value })} />
          <Input aria-label={`Hero option name ${i + 1}`} width="name" className="h-6 text-xs" value={row.name} onChange={(e) => setRow(i, { name: e.target.value })} />
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Remove option" onClick={() => onChange(serializeHeroOptions(rows.filter((_, j) => j !== i), text))}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange(serializeHeroOptions([...rows, { index: String(rows.length), base: '', head: '', portrait: '', name: '' }], text))}>
        <Plus className="w-3 h-3 mr-1" />Appearance
      </Button>
    </div>
  );
}

export function HeroLayersForm({ text, onChange }: TextProps) {
  const rows = parseHeroLayers(text);
  const setRow = (index: number, patch: Partial<HeroLayer>) => {
    onChange(serializeHeroLayers(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)), text));
  };
  return (
    <div className="space-y-2">
      <FieldHint hint="Draw order of equipment layers per facing (layer=direction,types…). Deprecated: Flare now loads render_layers from engine/stats.txt. This file is still read for older mods.">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hero layers</div>
      </FieldHint>
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1">
          <Input aria-label={`Hero layer direction ${i + 1}`} width="short" className="h-6 text-xs" value={row.direction} onChange={(e) => setRow(i, { direction: e.target.value })} />
          <Input aria-label={`Hero layer types ${i + 1}`} width="path" className="h-6 text-xs" value={row.types} onChange={(e) => setRow(i, { types: e.target.value })} />
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Remove layer" onClick={() => onChange(serializeHeroLayers(rows.filter((_, j) => j !== i), text))}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange(serializeHeroLayers([...rows, { direction: '', types: '' }], text))}>
        <Plus className="w-3 h-3 mr-1" />Layer
      </Button>
    </div>
  );
}


const CLASS_FIELD_META: Array<{ key: keyof HeroClassEntry['scalars']; tip: string; width: 'name' | 'path' | 'num' | 'id'; kind?: 'item' | 'power' | 'power-bar' }> = [
  { key: 'name', tip: 'Displayed name of the class. Must be first in the block; the engine uses it as the class id.', width: 'name' },
  { key: 'description', tip: 'A description of this class.', width: 'path' },
  { key: 'currency', tip: 'Starting currency for this class.', width: 'num' },
  { key: 'equipment', tip: 'Comma-separated item ids that are equipped at the start.', width: 'path', kind: 'item' },
  { key: 'carried', tip: 'Comma-separated item ids placed in inventory at the start.', width: 'path', kind: 'item' },
  { key: 'powers', tip: 'Comma-separated power ids unlocked at the start.', width: 'path', kind: 'power' },
  { key: 'actionbar', tip: 'Power ids for the action bar slots. 0 is an empty slot.', width: 'path', kind: 'power-bar' },
  { key: 'campaign', tip: 'Comma-separated campaign statuses set when starting this class.', width: 'path' },
  { key: 'power_tree', tip: 'Path to a powers/trees/*.txt file. If empty, Flare loads powers/trees/default.txt.', width: 'path' },
  { key: 'hero_options', tip: 'Comma-separated indices of hero_options this class can use.', width: 'path' },
  { key: 'default_power_tab', tip: 'Index of the tab to open in the Powers menu.', width: 'num' },
];

export function ClassHeroForm({
  text,
  onChange,
  itemIds,
  powerIds,
}: {
  text: string;
  onChange: (text: string) => void;
  itemIds?: Set<string>;
  powerIds?: Set<string>;
}) {
  const file = parseClassesFile(text);
  const write = (classes: HeroClassEntry[]) => onChange(serializeClassesFile({ header: file.header, classes }, text));
  const setClass = (index: number, next: HeroClassEntry) => write(file.classes.map((entry, i) => (i === index ? next : entry)));
  const setScalar = (index: number, key: keyof HeroClassEntry['scalars'], value: string) => {
    const entry = file.classes[index];
    setClass(index, { ...entry, scalars: { ...entry.scalars, [key]: value } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <FieldHint hint="Starting gear, powers, primaries and the power tree for each [class] in engine/classes.txt. Empty keys are not written. Comments above the first class are kept.">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Classes</div>
        </FieldHint>
        <Button type="button" size="sm" variant="outline" onClick={() => write([...file.classes, emptyHeroClass()])}>
          <Plus className="w-3 h-3 mr-1" />
          Add class
        </Button>
      </div>
      {file.classes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No classes yet. Add one, or save after loading a mod fallback.</p>
      ) : file.classes.map((entry, index) => (
        <div key={index} className="rounded-md border border-border p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">{entry.scalars.name || 'New class'}</div>
            <Button type="button" size="sm" variant="outline" onClick={() => write(file.classes.filter((_, i) => i !== index))}>
              <Trash2 className="w-3 h-3 mr-1" />
              Remove
            </Button>
          </div>
          {CLASS_FIELD_META.map((field) => {
            const value = entry.scalars[field.key];
            const known = field.kind === 'item' ? itemIds : field.kind === 'power' || field.kind === 'power-bar' ? powerIds : undefined;
            const missing = known && known.size ? unknownIds(value, known, { allowZero: field.kind === 'power-bar' }) : [];
            return (
              <div key={field.key} className="space-y-0.5">
                <Field label={field.key} tip={field.tip}>
                  <Input className="h-7 text-xs" width={field.width} value={value} onChange={(event) => setScalar(index, field.key, event.target.value)} />
                </Field>
                {missing.length > 0 ? (
                  <p className="text-[11px] text-amber-500 pl-[9rem]">Unknown {field.kind === 'item' ? 'item' : 'power'} id: {missing.join(', ')}</p>
                ) : null}
              </div>
            );
          })}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <HintLabel className="text-xs font-normal" hint="primary=stat,value — starting points in a primary stat from engine/primary_stats.txt.">primary</HintLabel>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setClass(index, { ...entry, primaries: [...entry.primaries, { stat: '', value: '' }] })}>
                <Plus className="w-3 h-3 mr-1" />Add
              </Button>
            </div>
            {entry.primaries.map((primary, primaryIndex) => (
              <div key={primaryIndex} className="flex flex-wrap items-center gap-2">
                <Input aria-label={`Class ${index + 1} primary stat ${primaryIndex + 1}`} width="id" className="h-7 text-xs" value={primary.stat} onChange={(event) => {
                  const primaries = entry.primaries.map((row, i) => (i === primaryIndex ? { ...row, stat: event.target.value } : row));
                  setClass(index, { ...entry, primaries });
                }} />
                <Input aria-label={`Class ${index + 1} primary value ${primaryIndex + 1}`} width="num" className="h-7 text-xs" value={primary.value} onChange={(event) => {
                  const primaries = entry.primaries.map((row, i) => (i === primaryIndex ? { ...row, value: event.target.value } : row));
                  setClass(index, { ...entry, primaries });
                }} />
                <Button type="button" size="sm" variant="outline" onClick={() => setClass(index, { ...entry, primaries: entry.primaries.filter((_, i) => i !== primaryIndex) })}>Remove</Button>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <HintLabel className="text-xs font-normal" hint="equipment_set=set_id,item ids — starting items for one equipment set. The set id must be greater than 0.">equipment_set</HintLabel>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setClass(index, { ...entry, equipment_sets: [...entry.equipment_sets, { setId: '', items: '' }] })}>
                <Plus className="w-3 h-3 mr-1" />Add
              </Button>
            </div>
            {entry.equipment_sets.map((set, setIndex) => (
              <div key={setIndex} className="flex flex-wrap items-center gap-2">
                <Input aria-label={`Class ${index + 1} equipment set id ${setIndex + 1}`} width="num" className="h-7 text-xs" value={set.setId} onChange={(event) => {
                  const equipment_sets = entry.equipment_sets.map((row, i) => (i === setIndex ? { ...row, setId: event.target.value } : row));
                  setClass(index, { ...entry, equipment_sets });
                }} />
                <Input aria-label={`Class ${index + 1} equipment set items ${setIndex + 1}`} width="path" className="h-7 text-xs" value={set.items} onChange={(event) => {
                  const equipment_sets = entry.equipment_sets.map((row, i) => (i === setIndex ? { ...row, items: event.target.value } : row));
                  setClass(index, { ...entry, equipment_sets });
                }} />
                <Button type="button" size="sm" variant="outline" onClick={() => setClass(index, { ...entry, equipment_sets: entry.equipment_sets.filter((_, i) => i !== setIndex) })}>Remove</Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function EquipFlagsForm({ text, onChange }: { text: string; onChange: (text: string) => void }) {
  const file = parseEquipFlags(text);
  const write = (flags: typeof file.flags) => onChange(serializeEquipFlags({ header: file.header, flags }, text));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <FieldHint hint="[flag] blocks in engine/equip_flags.txt. The engine keys are id (the identifier items use) and name (the displayed label). The default-mod example still shows name/description; those are not the keys Flare reads. Empty name is omitted. Leading comments and APPEND are kept.">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Equipment flags</div>
        </FieldHint>
        <Button type="button" size="sm" variant="outline" onClick={() => write([...file.flags, emptyEquipFlag()])}>
          <Plus className="w-3 h-3 mr-1" />
          Add flag
        </Button>
      </div>
      {file.flags.length === 0 ? (
        <p className="text-xs text-muted-foreground">No equipment flags.</p>
      ) : file.flags.map((flag, index) => (
        <div key={index} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <HintLabel className="text-[11px] font-normal text-muted-foreground" hint="Identifier used by items. Must come first in the block.">id</HintLabel>
            <Input aria-label={`Equip flag id ${index + 1}`} width="id" className="h-7 text-xs" value={flag.id} onChange={(event) => write(file.flags.map((row, i) => (i === index ? { ...row, id: event.target.value } : row)))} />
          </div>
          <div className="space-y-1">
            <HintLabel className="text-[11px] font-normal text-muted-foreground" hint="Displayed name of this equip flag.">name</HintLabel>
            <Input aria-label={`Equip flag name ${index + 1}`} width="name" className="h-7 text-xs" value={flag.name} onChange={(event) => write(file.flags.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)))} />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => write(file.flags.filter((_, i) => i !== index))}>Remove</Button>
        </div>
      ))}
    </div>
  );
}

