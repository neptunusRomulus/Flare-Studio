/**
 * One plain sentence for the enemy header, e.g.
 * "A strong melee enemy that hits fast, chases from far away and usually drops Health Potion."
 */
import { durationSeconds } from '@/editor/powers/powerSummary';
import { strengthLabel, type StrengthTier } from '@/editor/enemyStrength';
import { isFixedChance, lootChanceNumber, type LootRow } from '@/editor/lootChance';

export type EnemySummaryInput = {
  strength?: StrengthTier | null;
  isMelee?: boolean;
  isRanged?: boolean;
  isCaster?: boolean;
  isBoss?: boolean;
  cooldown?: string;
  combatStyle?: string;
  threatRange?: string;
  chancePursue?: string;
  chanceFlee?: string;
  isStationary?: boolean;
  wanderRadius?: string;
  dropName?: string;
  dropChance?: 'always' | 'usually' | 'sometimes' | 'rarely' | '';
};

const num = (value: string | undefined) => {
  const n = parseFloat(String(value || '').split(',')[0]);
  return Number.isFinite(n) ? n : null;
};

function dropAdverb(chance: EnemySummaryInput['dropChance']): string {
  if (chance === 'always') return 'always drops';
  if (chance === 'usually') return 'usually drops';
  if (chance === 'sometimes') return 'sometimes drops';
  if (chance === 'rarely') return 'rarely drops';
  return 'drops';
}

/** Pick a short drop clause from loot rows (highest non-table chance, or first Always). */
export function dropFromLootRows(
  rows: LootRow[],
  itemName: (id: string) => string,
): { dropName: string; dropChance: NonNullable<EnemySummaryInput['dropChance']> } | null {
  const usable = rows.filter((row) => !row.isTable && row.id.trim() && row.id !== 'currency');
  if (!usable.length) {
    const currency = rows.find((row) => !row.isTable && row.id === 'currency');
    if (!currency) return null;
    return { dropName: 'currency', dropChance: adverbForChance(currency) };
  }
  const fixed = usable.find((row) => isFixedChance(row.chance));
  const chosen = fixed || usable.slice().sort((a, b) => lootChanceNumber(b.chance) - lootChanceNumber(a.chance))[0];
  const name = itemName(chosen.id) || chosen.id;
  if (!name) return null;
  return { dropName: name, dropChance: adverbForChance(chosen) };
}

function adverbForChance(row: LootRow): NonNullable<EnemySummaryInput['dropChance']> {
  if (isFixedChance(row.chance)) return 'always';
  const n = lootChanceNumber(row.chance);
  if (n >= 50) return 'usually';
  if (n >= 20) return 'sometimes';
  if (n > 0) return 'rarely';
  return '';
}

export function summarizeEnemy(input: EnemySummaryInput): string {
  const kinds: string[] = [];
  if (input.isMelee) kinds.push('melee');
  if (input.isRanged) kinds.push('ranged');
  if (input.isCaster) kinds.push('caster');
  const role = input.isBoss ? 'boss' : 'enemy';
  const kindText = kinds.length === 0
    ? ''
    : kinds.length === 1
      ? kinds[0]
      : kinds.length === 2
        ? `${kinds[0]} and ${kinds[1]}`
        : `${kinds.slice(0, -1).join(', ')} and ${kinds[kinds.length - 1]}`;
  const strength = input.strength ? strengthLabel(input.strength).toLowerCase() : '';
  const adjectives = [strength, kindText].filter(Boolean).join(' ');
  const subject = adjectives ? `${adjectives} ${role}` : role;
  const article = /^[aeiou]/i.test(subject) ? 'An' : 'A';

  const clauses: string[] = [];
  const cooldown = durationSeconds(input.cooldown || '');
  if (cooldown != null && cooldown > 0 && cooldown <= 1) clauses.push('hits fast');
  const threat = num(input.threatRange);
  if (input.combatStyle === 'aggressive' || (threat != null && threat >= 12)) {
    clauses.push('chases from far away');
  }
  if (input.isStationary) clauses.push('stands still');
  else if (num(input.wanderRadius) && (num(input.wanderRadius) as number) > 0) clauses.push('wanders');
  const flee = num(input.chanceFlee);
  if (flee != null && flee >= 50) clauses.push('flees easily');
  if (input.dropName) clauses.push(`${dropAdverb(input.dropChance)} ${input.dropName}`);

  if (!clauses.length) return `${article} ${subject}.`;
  if (clauses.length === 1) return `${article} ${subject} that ${clauses[0]}.`;
  const head = clauses.slice(0, -1).join(', ');
  return `${article} ${subject} that ${head} and ${clauses[clauses.length - 1]}.`;
}
