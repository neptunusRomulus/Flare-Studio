/** Map [enemy] placement conditions; they are not StatBlock keys. */
export const SPAWN_CONDITION_KEYS = [
  'requires_status', 'requires_not_status', 'requires_level', 'requires_not_level',
  'requires_currency', 'requires_not_currency', 'requires_item', 'requires_not_item',
  'requires_class', 'requires_not_class',
  'invincible_requires_status', 'invincible_requires_not_status', 'spawn_level',
] as const;

export type SpawnConditionKey = typeof SPAWN_CONDITION_KEYS[number];
