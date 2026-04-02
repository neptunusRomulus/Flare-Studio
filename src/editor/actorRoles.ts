type NpcRoleKey = 'isTalker' | 'isVendor' | 'isQuestGiver';
type EnemyRoleKey = 'isMelee' | 'isRanged' | 'isCaster' | 'isSummoner' | 'isBoss' | 'isPassive' | 'isStationary';
type ActorRoleKey = NpcRoleKey | EnemyRoleKey;

type ActorDialogState = {
  type: 'npc' | 'enemy';
  name: string;
  tilesetPath: string;
  portraitPath: string;
  locationX: number;
  locationY: number;
} & Record<ActorRoleKey, boolean>;

const NPC_ROLE_OPTIONS: Array<{ key: NpcRoleKey; label: string; badgeClass: string; description: string }> = [
  { key: 'isTalker', label: 'Talker', badgeClass: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30', description: 'Has dialogue interactions' },
  { key: 'isVendor', label: 'Vendor', badgeClass: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', description: 'Sells items to the player' },
  { key: 'isQuestGiver', label: 'Quest', badgeClass: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30', description: 'Provides or tracks quests' }
];

const ENEMY_ROLE_OPTIONS: Array<{ key: EnemyRoleKey; label: string; badgeClass: string; description: string }> = [
  { key: 'isMelee', label: 'Melee', badgeClass: 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40', description: 'Closes distance quickly and deals damage in close combat.' },
  { key: 'isRanged', label: 'Ranged', badgeClass: 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/40', description: 'Attacks from a distance and avoids close combat.' },
  { key: 'isCaster', label: 'Caster', badgeClass: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/40', description: 'Uses spells with high impact but low durability.' },
  { key: 'isSummoner', label: 'Summoner', badgeClass: 'bg-teal-500/20 text-teal-600 dark:text-teal-400 border-teal-500/40', description: 'Relies on summoned allies rather than direct damage.' },
  { key: 'isBoss', label: 'Boss', badgeClass: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40', description: 'Powerful enemy with high durability and multiple attack patterns.' },
  { key: 'isPassive', label: 'Passive / Neutral', badgeClass: 'bg-lime-500/20 text-lime-600 dark:text-lime-400 border-lime-500/40', description: 'Does not attack unless provoked or triggered.' },
  { key: 'isStationary', label: 'Stationary', badgeClass: 'bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/40', description: 'Immobile enemy that controls an area with ranged attacks.' }
];

const ENEMY_ROLE_META_LOOKUP: Record<EnemyRoleKey, { label: string; badgeClass: string; description: string }> =
  ENEMY_ROLE_OPTIONS.reduce((acc, option) => {
    acc[option.key] = option;
    return acc;
  }, {} as Record<EnemyRoleKey, { label: string; badgeClass: string; description: string }>);

const EMPTY_ACTOR_ROLES: Record<ActorRoleKey, boolean> = {
  isTalker: false,
  isVendor: false,
  isQuestGiver: false,
  isMelee: false,
  isRanged: false,
  isCaster: false,
  isSummoner: false,
  isBoss: false,
  isPassive: false,
  isStationary: false
};

export type { ActorDialogState, ActorRoleKey, EnemyRoleKey, NpcRoleKey };
export { NPC_ROLE_OPTIONS, ENEMY_ROLE_OPTIONS, ENEMY_ROLE_META_LOOKUP, EMPTY_ACTOR_ROLES };
