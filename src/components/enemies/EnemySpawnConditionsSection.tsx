import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { HintLabel } from '@/components/ui/field-hint';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { MoreToggle, EditorSection, enemyInputCls } from './enemyFormPrimitives';

import { SPAWN_CONDITION_KEYS, type SpawnConditionKey } from '@/editor/enemySpawnConditions';

export { SPAWN_CONDITION_KEYS };

type Field = { key: SpawnConditionKey; label: string; placeholder: string; tooltip: string };

const ALWAYS: Field[] = [
  { key: 'requires_status', label: 'Needs status', placeholder: 'quest_started', tooltip: 'Only appears while this status is active.' },
  { key: 'requires_not_status', label: 'Needs status off', placeholder: 'quest_done', tooltip: 'Only appears while this status is not active.' },
  { key: 'requires_level', label: 'Minimum level', placeholder: '5', tooltip: 'The hero must be at least this level.' },
  { key: 'requires_not_level', label: 'Maximum level', placeholder: '10', tooltip: 'The hero must be below this level.' },
];

const MORE: Field[] = [
  { key: 'requires_currency', label: 'Minimum currency', placeholder: '100', tooltip: 'The hero needs at least this much currency.' },
  { key: 'requires_not_currency', label: 'Maximum currency', placeholder: '500', tooltip: 'The hero must have less than this much currency.' },
  { key: 'requires_item', label: 'Needs item', placeholder: 'Item ID', tooltip: 'An item the hero must carry. Add a quantity after a comma if needed.' },
  { key: 'requires_not_item', label: 'Needs item absent', placeholder: 'Item ID', tooltip: 'An item the hero must not carry.' },
  { key: 'requires_class', label: 'Only for class', placeholder: 'warrior', tooltip: 'The class this enemy is for.' },
  { key: 'requires_not_class', label: 'Not for class', placeholder: 'mage', tooltip: 'A class this enemy is not for.' },
  { key: 'invincible_requires_status', label: 'Invincible with status', placeholder: 'boss_phase', tooltip: 'The enemy cannot be hurt while this status is active.' },
  { key: 'invincible_requires_not_status', label: 'Invincible without status', placeholder: 'shield_down', tooltip: 'The enemy cannot be hurt while this status is not active.' },
];

function ConditionRow({ field, values, onChange }: { field: Field; values: Record<string, string>; onChange: (key: string, value: string) => void }) {
  return (
    <div className="space-y-1">
      <HintLabel className="text-xs text-muted-foreground font-normal" hint={field.tooltip}>{field.label}</HintLabel>
      <Input
        aria-label={field.label}
        value={values[field.key] || ''}
        onChange={(event) => onChange(field.key, event.target.value)}
        placeholder={field.placeholder}
        className={enemyInputCls}
      />
    </div>
  );
}

function SpawnLevelRow({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [mode = '', amount = ''] = value.split(',');
  const selected = mode === 'fixed' || mode === 'hero_level' ? mode : 'default';
  return (
    <div className="space-y-1">
      <HintLabel className="text-xs text-muted-foreground font-normal" hint="How the spawned enemy's level is chosen.">Spawn level</HintLabel>
      <div className="flex items-center gap-1">
        <Select value={selected} onValueChange={(next) => onChange(next === 'default' ? '' : `${next},${amount || '1'}`)}>
          <SelectTrigger aria-label="Spawn level" className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Use the enemy's level</SelectItem>
            <SelectItem value="fixed">Always this level</SelectItem>
            <SelectItem value="hero_level">Hero level plus</SelectItem>
          </SelectContent>
        </Select>
        {selected !== 'default' ? (
          <Input
            aria-label="Spawn level amount"
            className={`${enemyInputCls} w-20`}
            value={amount}
            placeholder={selected === 'hero_level' ? '0' : '1'}
            onChange={(event) => onChange(`${selected},${event.target.value}`)}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Map placement conditions; these go into the map [enemy] block, not enemies/*.txt. */
export default function EnemySpawnConditionsSection({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const [more, setMore] = useState(false);
  return (
    <EditorSection title="Spawn conditions">
      <p className="text-[10px] text-muted-foreground">Only affects this placement on the map.</p>
      {ALWAYS.map((field) => <ConditionRow key={field.key} field={field} values={values} onChange={onChange} />)}
      <MoreToggle open={more} onToggle={() => setMore((value) => !value)}>
        {MORE.map((field) => <ConditionRow key={field.key} field={field} values={values} onChange={onChange} />)}
        <SpawnLevelRow value={values.spawn_level || ''} onChange={(value) => onChange('spawn_level', value)} />
      </MoreToggle>
    </EditorSection>
  );
}
