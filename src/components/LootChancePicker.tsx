import Tooltip from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import {
  formatLootChance,
  lootChanceLabel,
  LOOT_CHANCE_WORDS,
  parseLootChance,
  type LootChanceValue,
} from '@/editor/lootChance';

type Props = {
  value: LootChanceValue;
  onChange: (value: LootChanceValue) => void;
  id?: string;
};

const CUSTOM = '__custom__';

const LootChancePicker = ({ value, onChange, id }: Props) => {
  const selected = value.kind === 'word' ? value.stored : CUSTOM;
  return (
    <Tooltip content="loot chance: Always is fixed. Other words save as 50, 20, 5 or 1. Custom keeps a raw percent.">
      <span className="inline-flex min-w-0 items-center gap-1">
        <select
          id={id}
          aria-label="Loot chance"
          className="h-8 min-w-[7.5rem] rounded-md border border-input bg-background px-2 text-xs"
          value={selected}
          onChange={(event) => {
            const next = event.target.value;
            if (next === CUSTOM) {
              const percent = value.kind === 'custom' ? value.percent : lootChanceNumberOr(value, 12);
              onChange({ kind: 'custom', percent, stored: String(percent) });
              return;
            }
            onChange(parseLootChance(next));
          }}
        >
          {LOOT_CHANCE_WORDS.map((entry) => (
            <option key={entry.value} value={entry.value}>{entry.word}</option>
          ))}
          <option value={CUSTOM}>{value.kind === 'custom' ? lootChanceLabel(value) : 'Custom'}</option>
        </select>
        {value.kind === 'custom' && (
          <Input
            aria-label="Custom chance percent"
            type="number"
            min={0}
            max={100}
            step="any"
            className="h-8 w-16 text-xs"
            value={value.stored === '' ? '' : value.percent}
            onChange={(event) => {
              const stored = event.target.value;
              const percent = stored === '' ? 0 : Number(stored);
              onChange({ kind: 'custom', percent: Number.isFinite(percent) ? percent : 0, stored });
            }}
          />
        )}
      </span>
    </Tooltip>
  );
};

function lootChanceNumberOr(value: LootChanceValue, fallback: number): number {
  if (value.kind === 'word') return value.stored === 'fixed' ? fallback : Number(value.stored) || fallback;
  return Number.isFinite(value.percent) && value.percent > 0 ? value.percent : fallback;
}

export function chanceFromPicker(value: LootChanceValue): string {
  return formatLootChance(value);
}

export default LootChancePicker;
