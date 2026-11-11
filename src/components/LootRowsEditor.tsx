import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import LootChancePicker from '@/components/LootChancePicker';
import {
  formatLootSummary,
  parseLootChance,
  type LootRow,
  type LootSummaryInput,
} from '@/editor/lootChance';

type ItemOption = { id: string | number; name?: string };

type Props = {
  rows: LootRow[];
  onChange: (rows: LootRow[]) => void;
  items?: ItemOption[];
  summary?: Omit<LootSummaryInput, 'rows'>;
};

const emptyItemRow = (): LootRow => ({
  id: '',
  chance: parseLootChance('20'),
  quantityMin: 1,
  quantityMax: 1,
  isTable: false,
});

const emptyTableRow = (): LootRow => ({
  id: '',
  chance: parseLootChance(''),
  quantityMin: 1,
  quantityMax: 1,
  isTable: true,
});

const LootRowsEditor = ({ rows, onChange, items = [], summary }: Props) => {
  const update = (index: number, patch: Partial<LootRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const itemLabel = (id: string) => items.find((item) => String(item.id) === id)?.name || id;
  const sentence = summary ? formatLootSummary({ ...summary, rows, itemName: summary.itemName || itemLabel }) : '';

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {rows.map((row, index) => (
          <div key={`${row.id}-${index}`} className="flex flex-wrap items-center gap-1.5">
            {row.isTable ? (
              <Input
                aria-label="Loot table"
                value={row.id}
                onChange={(event) => update(index, { id: event.target.value, isTable: true })}
                placeholder="loot/table.txt"
                className="h-8 min-w-[10rem] flex-1 font-mono text-xs"
              />
            ) : (
              <select
                aria-label="Loot item"
                className="h-8 min-w-[9rem] flex-1 rounded-md border border-input bg-background px-2 text-xs"
                value={row.id}
                onChange={(event) => update(index, { id: event.target.value, isTable: false })}
              >
                <option value="">Item</option>
                <option value="currency">Currency</option>
                {items.map((item) => (
                  <option key={item.id} value={String(item.id)}>{item.name || item.id} ({item.id})</option>
                ))}
                {row.id && !items.some((item) => String(item.id) === row.id) && row.id !== 'currency' && (
                  <option value={row.id}>{row.id}</option>
                )}
              </select>
            )}
            {!row.isTable && (
              <>
                <LootChancePicker value={row.chance} onChange={(chance) => update(index, { chance })} />
                <Tooltip content="quantity min">
                  <Input
                    aria-label="Quantity min"
                    type="number"
                    min={1}
                    className="h-8 w-14 text-xs"
                    value={row.quantityMin}
                    onChange={(event) => update(index, { quantityMin: Math.max(1, Number(event.target.value) || 1) })}
                  />
                </Tooltip>
                <Tooltip content="quantity max">
                  <Input
                    aria-label="Quantity max"
                    type="number"
                    min={1}
                    className="h-8 w-14 text-xs"
                    value={row.quantityMax}
                    onChange={(event) => update(index, { quantityMax: Math.max(1, Number(event.target.value) || 1) })}
                  />
                </Tooltip>
              </>
            )}
            <button
              type="button"
              aria-label="Remove loot row"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onChange([...rows, emptyItemRow()])}>
          <Plus className="mr-1 h-3 w-3" /> Item
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onChange([...rows, emptyTableRow()])}>
          <Plus className="mr-1 h-3 w-3" /> Loot table
        </Button>
      </div>
      {sentence ? <p className="text-[11px] leading-snug text-muted-foreground">{sentence}</p> : null}
    </div>
  );
};

export default LootRowsEditor;
