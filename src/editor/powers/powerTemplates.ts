/**
 * Ready-made starting points. Each one is copied from a real flare-game
 * power or effect (source noted) and trimmed to keys that work in any mod.
 */
import type { EffectKind, PowerKind } from './powerProject';

export type PowerTemplate = {
  id: string;
  label: string;
  kind: PowerKind;
  /** flare-game reference the keys were taken from */
  source: string;
  keys: Array<[string, string]>;
  /** Optional effect created with it and chained via post_effect (id gets a unique suffix). */
  effect?: { template: string; magnitude: string; duration: string };
};

export type EffectTemplate = {
  id: string;
  label: string;
  kind: EffectKind;
  source: string;
  /** Id of the same effect in flare-game; reused when the project already has it. */
  flareId: string;
  keys: Array<[string, string]>;
  /** Suggested post_effect magnitude and duration when chained. */
  magnitude: string;
  duration: string;
};

export const EFFECT_TEMPLATES: EffectTemplate[] = [
  { id: 'speed_buff', flareId: 'haste', label: 'Speed Buff', kind: 'buff', source: 'empyrean_campaign powers/effects.txt id=haste', keys: [['name', 'Haste'], ['type', 'speed'], ['icon', '9'], ['can_stack', 'false']], magnitude: '120', duration: '10s' },
  { id: 'slow_debuff', flareId: 'slow', label: 'Slow Debuff', kind: 'debuff', source: 'empyrean_campaign powers/effects.txt id=slow', keys: [['name', 'Slow'], ['type', 'speed'], ['icon', '24'], ['can_stack', 'false']], magnitude: '50', duration: '5s' },
  { id: 'shield', flareId: 'mage_shield', label: 'Shield', kind: 'buff', source: 'empyrean_campaign powers/effects.txt id=mage_shield', keys: [['name', 'Shield'], ['type', 'shield'], ['icon', '15'], ['animation', 'animations/powers/shield.txt'], ['can_stack', 'false']], magnitude: '0', duration: '0' },
  { id: 'poison', flareId: 'poison', label: 'Poison', kind: 'debuff', source: 'empyrean_campaign powers/effects.txt id=poison', keys: [['name', 'Poison'], ['type', 'damage'], ['icon', '42'], ['animation', 'animations/powers/spark_green_loop.txt'], ['can_stack', 'false']], magnitude: '5', duration: '5s' },
  { id: 'bleeding', flareId: 'bleeding', label: 'Bleeding', kind: 'debuff', source: 'empyrean_campaign powers/effects.txt id=bleeding', keys: [['name', 'Bleeding'], ['type', 'damage_percent'], ['icon', '25'], ['animation', 'animations/powers/spark_red_loop.txt'], ['can_stack', 'false']], magnitude: '5', duration: '5s' },
  { id: 'stun', flareId: 'paralyze', label: 'Stun', kind: 'debuff', source: 'empyrean_campaign powers/effects.txt id=paralyze', keys: [['name', 'Stun'], ['type', 'stun'], ['icon', '26'], ['can_stack', 'false']], magnitude: '0', duration: '1s' },
  { id: 'regeneration', flareId: 'hp_heal', label: 'Regeneration', kind: 'buff', source: 'empyrean_campaign powers/effects.txt id=hp_heal', keys: [['name', 'Regeneration'], ['type', 'heal'], ['icon', '11'], ['animation', 'animations/powers/heal.txt'], ['can_stack', 'false']], magnitude: '25', duration: '1s' },
];

export const POWER_TEMPLATES: PowerTemplate[] = [
  {
    id: 'fireball', label: 'Fireball', kind: 'skill', source: 'empyrean_campaign powers/base/magician/fireball.txt + id=122',
    keys: [['name', 'Fireball'], ['description', 'Launch a ball of fire.'], ['type', 'missile'], ['icon', '34'], ['new_state', 'cast'], ['face', 'true'], ['directional', 'true'],
      ['animation', 'animations/powers/fireball.txt'], ['soundfx', 'soundfx/powers/fireball.ogg'], ['use_hazard', 'true'], ['aim_assist', 'true'], ['base_damage', 'ment'],
      ['lifespan', '800ms'], ['radius', '1.0'], ['speed', '16'], ['trait_elemental', 'fire'], ['requires_mp', '5'], ['modifier_damage', 'multiply,130,0'], ['cooldown', '1s']],
  },
  {
    id: 'heal', label: 'Heal', kind: 'skill', source: 'empyrean_campaign powers/base/items/health_potion.txt (as a spell)',
    keys: [['name', 'Heal'], ['description', 'Restore some HP.'], ['type', 'fixed'], ['icon', '64'], ['new_state', 'cast'], ['soundfx', 'soundfx/powers/heal.ogg'], ['buff', 'true'], ['requires_mp', '10'], ['cooldown', '5s']],
    effect: { template: 'regeneration', magnitude: '25', duration: '1s' },
  },
  {
    id: 'dash', label: 'Dash', kind: 'skill', source: 'empyrean_campaign powers/categories/enemy.txt id=240 (teleport)',
    keys: [['name', 'Dash'], ['description', 'Jump to the target spot.'], ['type', 'fixed'], ['icon', '12'], ['new_state', 'instant'], ['soundfx', 'soundfx/powers/teleport.ogg'], ['no_attack', 'true'],
      ['lifespan', '533ms'], ['starting_pos', 'source'], ['buff_teleport', 'true'], ['target_range', '6'], ['target_neighbor', '1'], ['requires_los', 'true'], ['cooldown', '3s'], ['buff', 'true']],
  },
  {
    id: 'summon', label: 'Summon', kind: 'skill', source: 'empyrean_campaign powers/base/magician/summon_skeleton.txt',
    keys: [['name', 'Summon'], ['description', 'Raise an ally to fight with you.'], ['type', 'spawn'], ['icon', '12'], ['new_state', 'cast'], ['cooldown', '2s'], ['soundfx', 'soundfx/powers/teleport.ogg'],
      ['spawn_type', 'summon_skeleton'], ['spawn_level', 'hero_level,1,1'], ['starting_pos', 'source'], ['target_neighbor', '1'], ['use_hazard', 'true'], ['no_attack', 'true'], ['requires_mp', '10']],
  },
  {
    id: 'poison_arrow', label: 'Poison Arrow', kind: 'skill', source: 'empyrean_campaign powers/base/ranger/poison_shot.txt',
    keys: [['name', 'Poison Arrow'], ['description', 'Shoot an arrow that poisons.'], ['type', 'missile'], ['icon', '42'], ['new_state', 'shoot'], ['face', 'true'], ['soundfx', 'soundfx/powers/shoot.ogg'],
      ['use_hazard', 'true'], ['starting_pos', 'melee'], ['aim_assist', 'true'], ['base_damage', 'ranged'], ['lifespan', '533ms'], ['radius', '1.0'], ['speed', '24'], ['requires_flags', 'ranged'], ['modifier_damage', 'multiply,75,0'], ['cooldown', '1s']],
    effect: { template: 'poison', magnitude: '5', duration: '5s' },
  },
  {
    id: 'monster_bite', label: 'Bite', kind: 'monster', source: 'empyrean_campaign powers/categories/enemy.txt melee attacks',
    keys: [['name', 'Bite'], ['type', 'fixed'], ['new_state', 'swing'], ['face', 'true'], ['use_hazard', 'true'], ['base_damage', 'melee'], ['starting_pos', 'melee'], ['radius', '1.0'], ['lifespan', '33ms'], ['soundfx', 'soundfx/melee_attack.ogg']],
  },
  {
    id: 'monster_spit', label: 'Spit', kind: 'monster', source: 'empyrean_campaign powers/categories/enemy.txt ranged attacks',
    keys: [['name', 'Spit'], ['type', 'missile'], ['new_state', 'shoot'], ['face', 'true'], ['directional', 'true'], ['use_hazard', 'true'], ['base_damage', 'ranged'], ['radius', '1.0'], ['speed', '15'], ['lifespan', '800ms']],
    effect: { template: 'slow_debuff', magnitude: '50', duration: '3s' },
  },
  {
    id: 'health_potion', label: 'Health Potion', kind: 'item', source: 'empyrean_campaign powers/base/items/health_potion.txt',
    keys: [['name', 'Health Potion'], ['description', 'Restore 25% of maximum HP'], ['type', 'fixed'], ['icon', '64'], ['soundfx', 'soundfx/powers/potion.ogg'], ['new_state', 'instant'], ['cooldown', '500ms'], ['buff', 'true'], ['requires_hpmp_state', 'all,not_percent,100,ignore,0']],
    effect: { template: 'regeneration', magnitude: '25', duration: '1s' },
  },
  {
    id: 'shield_scroll', label: 'Shield', kind: 'item', source: 'empyrean_campaign powers/base/magician/shield.txt',
    keys: [['name', 'Shield'], ['description', 'Create a force field that absorbs damage.'], ['type', 'fixed'], ['icon', '15'], ['new_state', 'cast'], ['soundfx', 'soundfx/powers/shield.ogg'], ['buff', 'true'], ['cooldown', '30s'], ['base_damage', 'ment']],
    effect: { template: 'shield', magnitude: '0', duration: '0' },
  },
  {
    id: 'poison_cloud', label: 'Poison Cloud', kind: 'trap', source: 'empyrean_campaign powers/base/ranger/poison_shot_aoe.txt + bear_trap.txt',
    keys: [['name', 'Poison Cloud'], ['type', 'fixed'], ['animation', 'animations/powers/dark_mist.txt'], ['use_hazard', 'true'], ['multitarget', 'true'], ['starting_pos', 'target'], ['base_damage', 'ranged'], ['radius', '2.0'], ['lifespan', '5s'], ['floor', 'true']],
    effect: { template: 'poison', magnitude: '5', duration: '3s' },
  },
  {
    id: 'spike_trap', label: 'Spike Trap', kind: 'trap', source: 'empyrean_campaign powers/categories/environment.txt id=178',
    keys: [['name', 'Spike Trap'], ['type', 'fixed'], ['animation', 'animations/powers/spikes.txt'], ['use_hazard', 'true'], ['lifespan', '533ms'], ['radius', '0.75'], ['starting_pos', 'source'], ['complete_animation', 'true'], ['base_damage', 'melee'], ['visual_random', '4'], ['soundfx', 'soundfx/powers/spikes.ogg'], ['source_type', 'neutral']],
    effect: { template: 'bleeding', magnitude: '5', duration: '10s' },
  },
];

export function templatesFor(kind: PowerKind): PowerTemplate[] {
  return POWER_TEMPLATES.filter((template) => template.kind === kind);
}
