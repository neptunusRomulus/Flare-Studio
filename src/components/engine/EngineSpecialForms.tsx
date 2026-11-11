import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import {
  parseHeroLayers, parseHeroOptions, parseLootSettings, parseXpTable,
  serializeHeroLayers, serializeHeroOptions, serializeXpTable, unknownIds, upsertLootSettings,
  type HeroLayer, type HeroOption, type XpRow,
} from '@/editor/engineForms';

type TextProps = { text: string; onChange: (text: string) => void };

const Field = ({ label, tip, children }: { label: string; tip: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[9rem_1fr] items-center gap-2">
    <Tooltip content={tip}><span className="text-xs truncate">{label}</span></Tooltip>
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
      <p className="text-[11px] text-muted-foreground">XP needed to reach each level (level=N,XP).</p>
      <div className="grid grid-cols-[5rem_1fr_auto] gap-1 text-[11px] text-muted-foreground">
        <span>Level</span><span>XP</span><span />
      </div>
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
      <p className="text-[11px] text-muted-foreground">Currency name and vendor price ratios from engine/loot.txt. Other loot keys stay in the generic list below if you add them.</p>
      <Field label="Currency name" tip="currency_name">
        <Input className="h-7 text-xs" value={loot.currency_name} onChange={(e) => set('currency_name', e.target.value)} />
      </Field>
      <Field label="Vendor buy ratio" tip="vendor_ratio_buy — multiplier for the Buy tab. Default 1.0.">
        <Input className="h-7 text-xs" value={loot.vendor_ratio_buy} onChange={(e) => set('vendor_ratio_buy', e.target.value)} />
      </Field>
      <Field label="Vendor sell ratio" tip="vendor_ratio_sell — what vendors pay for your items.">
        <Input className="h-7 text-xs" value={loot.vendor_ratio_sell} onChange={(e) => set('vendor_ratio_sell', e.target.value)} />
      </Field>
      <Field label="Sell used items" tip="vendor_ratio_sell_old — price for items you previously sold.">
        <Input className="h-7 text-xs" value={loot.vendor_ratio_sell_old} onChange={(e) => set('vendor_ratio_sell_old', e.target.value)} />
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
      <p className="text-[11px] text-muted-foreground">Appearance choices on the new-hero screen (option=index,base,head,portrait,name).</p>
      <div className="grid grid-cols-[4rem_6rem_7rem_1fr_7rem_auto] gap-1 text-[11px] text-muted-foreground">
        <span>Index</span><span>Base</span><span>Head</span><span>Portrait</span><span>Name</span><span />
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[4rem_6rem_7rem_1fr_7rem_auto] gap-1">
          <Input className="h-6 text-xs" value={row.index} onChange={(e) => setRow(i, { index: e.target.value })} />
          <Input className="h-6 text-xs" value={row.base} onChange={(e) => setRow(i, { base: e.target.value })} />
          <Input className="h-6 text-xs" value={row.head} onChange={(e) => setRow(i, { head: e.target.value })} />
          <Input className="h-6 text-xs" value={row.portrait} onChange={(e) => setRow(i, { portrait: e.target.value })} />
          <Input className="h-6 text-xs" value={row.name} onChange={(e) => setRow(i, { name: e.target.value })} />
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
      <p className="text-[11px] text-muted-foreground">Draw order of equipment layers per facing (layer=direction,types…).</p>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[5rem_1fr_auto] gap-1">
          <Input className="h-6 text-xs" value={row.direction} onChange={(e) => setRow(i, { direction: e.target.value })} />
          <Input className="h-6 text-xs" value={row.types} onChange={(e) => setRow(i, { types: e.target.value })} />
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

const CLASS_FIELDS: Array<{ key: string; label: string; tip: string; kind?: 'item' | 'power' | 'power-bar' }> = [
  { key: 'name', label: 'Name', tip: 'name — must be first in the file' },
  { key: 'description', label: 'Description', tip: 'description' },
  { key: 'equipment', label: 'Starting equipment', tip: 'equipment — comma-separated item ids', kind: 'item' },
  { key: 'equipment_set', label: 'Starting set', tip: 'equipment_set — item ids in a set', kind: 'item' },
  { key: 'carried', label: 'Carried items', tip: 'carried — item ids in inventory', kind: 'item' },
  { key: 'powers', label: 'Starting powers', tip: 'powers — power ids the hero knows', kind: 'power' },
  { key: 'actionbar', label: 'Action bar', tip: 'actionbar — 12 slots; 0 is empty', kind: 'power-bar' },
  { key: 'default_power_tab', label: 'Default power tab', tip: 'default_power_tab — power tree tab index' },
];

type ClassSection = { type: string; fields: Array<{ key: string; value: string; comment?: string }> };

export function ClassHeroForm({
  sections, onFieldChange, fileName, itemIds, powerIds,
}: {
  sections: ClassSection[];
  fileName: string;
  onFieldChange: (fileName: string, sectionIndex: number, fieldIndex: number, key: string, value: string) => void;
  itemIds: Set<string>;
  powerIds: Set<string>;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground">Starting gear, powers and action bar for each class. Unknown item or power ids are flagged.</p>
      {sections.map((section, sectionIndex) => {
        if (section.type && section.type !== 'class') return null;
        const valueOf = (key: string) => section.fields.find((f) => f.key === key)?.value || '';
        const setValue = (key: string, value: string) => {
          const fieldIndex = section.fields.findIndex((f) => f.key === key);
          if (fieldIndex >= 0) onFieldChange(fileName, sectionIndex, fieldIndex, 'value', value);
        };
        return (
          <div key={sectionIndex} className="border border-border/50 rounded-md p-3 space-y-2">
            <div className="text-sm font-medium">{valueOf('name') || 'Class'}</div>
            {CLASS_FIELDS.map((field) => {
              const value = valueOf(field.key);
              const known = field.kind === 'item' ? itemIds : field.kind === 'power' || field.kind === 'power-bar' ? powerIds : null;
              const missing = known && known.size ? unknownIds(value, known, { allowZero: field.kind === 'power-bar' }) : [];
              if (!value && !['name', 'equipment', 'powers', 'actionbar'].includes(field.key) && section.fields.every((f) => f.key !== field.key)) return null;
              return (
                <div key={field.key} className="space-y-0.5">
                  <Field label={field.label} tip={field.tip}>
                    <Input className="h-7 text-xs" value={value} onChange={(e) => setValue(field.key, e.target.value)} disabled={section.fields.every((f) => f.key !== field.key) && field.key !== 'name'} />
                  </Field>
                  {missing.length > 0 && (
                    <p className="text-[11px] text-amber-500 pl-[9rem]">Unknown {field.kind === 'item' ? 'item' : 'power'} id: {missing.join(', ')}</p>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
