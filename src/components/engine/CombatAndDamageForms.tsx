import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import {
  COMBAT_RANGE_KEYS,
  parseCombatSettings,
  upsertCombatSettings,
  type CombatSettings,
} from '@/editor/engineForms';
import { emptyDamageType, type DamageType } from '@/editor/statsTitles';

const RANGE_HINT: Record<(typeof COMBAT_RANGE_KEYS)[number], string> = {
  absorb_percent: 'Min,max percent of damage that can be absorbed. Engine default is 0,100. A max below 100 keeps at least 1 damage from non-elemental attacks.',
  resist_percent: 'Min,max percent of damage that can be resisted. Engine default is 0,100. A max below 100 keeps at least 1 damage from elemental attacks.',
  block_percent: 'Min,max percent absorbed during the block animation. Engine default is 0,100.',
  avoidance_percent: 'Min,max chance that damage is avoided. Engine default is 0,100.',
  miss_damage_percent: 'Min,max percent of damage dealt on a miss. Engine default is 0,0.',
  crit_damage_percent: 'Min,max percent of damage dealt on a critical hit. Engine default is 200,200.',
  overhit_damage_percent: 'Min,max percent of damage dealt on an overhit. Engine default is 100,100.',
};

function splitRange(value: string): { min: string; max: string } {
  const i = value.indexOf(',');
  if (i < 0) return { min: value, max: '' };
  return { min: value.slice(0, i).trim(), max: value.slice(i + 1).trim() };
}

function joinRange(min: string, max: string): string {
  if (!min.trim() && !max.trim()) return '';
  return `${min.trim()},${max.trim()}`;
}

export function CombatSettingsForm({ text, onChange }: { text: string; onChange: (text: string) => void }) {
  const combat = parseCombatSettings(text);
  const set = (key: keyof CombatSettings, value: string) => onChange(upsertCombatSettings(text, { [key]: value }));
  return (
    <div className="space-y-3">
      <FieldHint hint="Min,max percent limits from engine/combat.txt. Leave a field empty to omit the key and use the engine default. Unknown keys and comments are kept on save.">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Combat</div>
      </FieldHint>
      <div className="space-y-2">
        {COMBAT_RANGE_KEYS.map((key) => {
          const range = splitRange(combat[key]);
          return (
            <div key={key} className="flex flex-wrap items-center gap-2">
              <HintLabel className="text-xs font-normal w-44 shrink-0" hint={RANGE_HINT[key]}>{key}</HintLabel>
              <Input aria-label={`${key} min`} width="num" className="h-7 text-xs" value={range.min} onChange={(event) => set(key, joinRange(event.target.value, range.max))} />
              <Input aria-label={`${key} max`} width="num" className="h-7 text-xs" value={range.max} onChange={(event) => set(key, joinRange(range.min, event.target.value))} />
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <HintLabel className="text-xs font-normal w-44 shrink-0" hint="Rounds HP/MP combat numbers (damage, healing, MP cost). Engine default is round.">resource_round_method</HintLabel>
        <Select value={combat.resource_round_method || 'default'} onValueChange={(value) => set('resource_round_method', value === 'default' ? '' : value)}>
          <SelectTrigger className="h-7" width="short">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="none">none</SelectItem>
            <SelectItem value="round">round</SelectItem>
            <SelectItem value="floor">floor</SelectItem>
            <SelectItem value="ceil">ceil</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <HintLabel className="text-xs font-normal w-44 shrink-0" hint="How poise is tested: chance (default), hp, or absorb.">poise_style</HintLabel>
        <Select value={combat.poise_style || 'default'} onValueChange={(value) => set('poise_style', value === 'default' ? '' : value)}>
          <SelectTrigger className="h-7" width="short">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="chance">chance</SelectItem>
            <SelectItem value="hp">hp</SelectItem>
            <SelectItem value="absorb">absorb</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Switch
          id="offscreen-enemy-encounters"
          checked={combat.offscreen_enemy_encounters === 'true'}
          onCheckedChange={(checked) => set('offscreen_enemy_encounters', checked ? 'true' : (combat.offscreen_enemy_encounters ? 'false' : 'false'))}
        />
        <HintLabel className="text-xs font-normal" htmlFor="offscreen-enemy-encounters" hint="If true, enemies can enter combat even when they are off-screen. Engine default is false.">offscreen_enemy_encounters</HintLabel>
      </div>
    </div>
  );
}

export function DamageTypesForm({ types, onChange }: { types: DamageType[]; onChange: (types: DamageType[]) => void }) {
  const setType = (index: number, patch: Partial<DamageType>) => {
    onChange(types.map((type, i) => (i === index ? { ...type, ...patch } : type)));
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <FieldHint hint="[damage_type] blocks in engine/damage_types.txt. id is used by items and powers. If min, max or resist is empty, the engine uses dmg_<id>_min, dmg_<id>_max and <id>_resist. elemental=true also applies this type to non-elemental power damage. engine/elements.txt is deprecated; use this file instead.">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Damage types</div>
        </FieldHint>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...types, emptyDamageType()])}>
          <Plus className="w-3 h-3 mr-1" />
          Add type
        </Button>
      </div>
      {types.length === 0 ? (
        <p className="text-xs text-muted-foreground">No damage types.</p>
      ) : types.map((type, index) => (
        <div key={index} className="rounded-md border border-border p-2 space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <HintLabel className="text-[11px] font-normal text-muted-foreground" hint="Identifier used as item damage_type and power base_damage.">id</HintLabel>
                <Input aria-label={`Damage type id ${index + 1}`} width="id" className="h-7 text-xs" value={type.id} onChange={(event) => setType(index, { id: event.target.value })} />
              </div>
              <div className="space-y-1">
                <HintLabel className="text-[11px] font-normal text-muted-foreground" hint="Displayed name for this damage type.">name</HintLabel>
                <Input aria-label={`Damage type name ${index + 1}`} width="name" className="h-7 text-xs" value={type.name} onChange={(event) => setType(index, { name: event.target.value })} />
              </div>
              <div className="space-y-1">
                <HintLabel className="text-[11px] font-normal text-muted-foreground" hint="Optional shorter name used on Resist Damage labels. Falls back to name if empty.">name_short</HintLabel>
                <Input aria-label={`Damage type short name ${index + 1}`} width="name" className="h-7 text-xs" value={type.name_short} onChange={(event) => setType(index, { name_short: event.target.value })} />
              </div>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => onChange(types.filter((_, i) => i !== index))}>
              <Trash2 className="w-3 h-3 mr-1" />
              Remove
            </Button>
          </div>
          <div className="space-y-1">
            <HintLabel className="text-[11px] font-normal text-muted-foreground" hint="Shown in Character menu tooltips.">description</HintLabel>
            <Input aria-label={`Damage type description ${index + 1}`} width="path" className="h-7 text-xs" value={type.description} onChange={(event) => setType(index, { description: event.target.value })} />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <HintLabel className="text-[11px] font-normal text-muted-foreground" hint="Stat/effect id for minimum damage. Empty uses dmg_<id>_min.">min</HintLabel>
              <Input aria-label={`Damage type min ${index + 1}`} width="id" className="h-7 text-xs" value={type.min} onChange={(event) => setType(index, { min: event.target.value })} />
            </div>
            <div className="space-y-1">
              <HintLabel className="text-[11px] font-normal text-muted-foreground" hint="Stat/effect id for maximum damage. Empty uses dmg_<id>_max.">max</HintLabel>
              <Input aria-label={`Damage type max ${index + 1}`} width="id" className="h-7 text-xs" value={type.max} onChange={(event) => setType(index, { max: event.target.value })} />
            </div>
            <div className="space-y-1">
              <HintLabel className="text-[11px] font-normal text-muted-foreground" hint="Stat/effect id for resistance. Empty uses <id>_resist.">resist</HintLabel>
              <Input aria-label={`Damage type resist ${index + 1}`} width="id" className="h-7 text-xs" value={type.resist} onChange={(event) => setType(index, { resist: event.target.value })} />
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              <Switch
                id={`damage-elemental-${index}`}
                checked={type.elemental === 'true'}
                onCheckedChange={(checked) => setType(index, { elemental: checked ? 'true' : '' })}
              />
              <HintLabel className="text-xs font-normal" htmlFor={`damage-elemental-${index}`} hint="If true, this type is elemental and is also applied to powers with non-elemental base damage.">elemental</HintLabel>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
