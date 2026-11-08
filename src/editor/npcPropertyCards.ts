/**
 * Edit NPC "Properties" cards: detect set values, catalog for +Add, fixed display order.
 * Labels are user language; Flare keys stay in tooltips only.
 */
import { importNpcText } from '@/adapters/flare/flareAdapter.cjs';
import { parseSectionProperty, sectionsFromNpcText, type KeyValue } from '@/utils/npcFileUpdate';
import { isImageFilePath } from '@/utils/animationUtils';

export type NpcPropertyCategory = 'appear' | 'map' | 'audio' | 'look' | 'stats';

export type NpcPropertyKind =
  | 'level'
  | 'currency'
  | 'status'
  | 'item'
  | 'class'
  | 'facing'
  | 'minimap'
  | 'intro_voice'
  | 'custom_animation'
  | 'stat'
  | 'visual_effect';

export type NpcPropertyCard = {
  id: string;
  kind: NpcPropertyKind;
  category: NpcPropertyCategory;
  /** For multi cards of the same kind */
  index: number;
  /** status/item/class polarity */
  polarity?: 'have' | 'have_not';
  /** Display/edit payload */
  values: Record<string, string>;
};

export type PropertyCatalogEntry = {
  kind: NpcPropertyKind;
  category: NpcPropertyCategory;
  label: string;
  flareKey: string;
  description: string;
  synonyms: string[];
  /** Can add more than one card */
  multi?: boolean;
  /** Hidden from picker when already present (non-multi) */
  singleton?: boolean;
};

export const CATEGORY_ORDER: NpcPropertyCategory[] = ['appear', 'map', 'audio', 'look', 'stats'];

export const PROPERTY_CATALOG: PropertyCatalogEntry[] = [
  {
    kind: 'level',
    category: 'appear',
    label: 'Appears at a player level range',
    flareKey: 'requires_level / requires_not_level',
    description: 'Only load this NPC when the player level is in range.',
    synonyms: ['level', 'seviye', 'min level', 'max level', 'requires_level'],
    singleton: true,
  },
  {
    kind: 'currency',
    category: 'appear',
    label: 'Appears at a currency range',
    flareKey: 'requires_currency / requires_not_currency',
    description: 'Only load this NPC when the player has enough (or little enough) currency.',
    synonyms: ['currency', 'gold', 'money', 'para', 'requires_currency'],
    singleton: true,
  },
  {
    kind: 'status',
    category: 'appear',
    label: 'Appears only with a status',
    flareKey: 'requires_status / requires_not_status',
    description: 'Only load this NPC if a campaign status is set (or not set).',
    synonyms: ['status', 'power', 'quest flag', 'requires_status', 'have status'],
    multi: true,
  },
  {
    kind: 'item',
    category: 'appear',
    label: 'Appears only with an item',
    flareKey: 'requires_item / requires_not_item',
    description: 'Only load this NPC if the player has (or does not have) an item.',
    synonyms: ['item', 'inventory', 'requires_item', 'have item'],
    multi: true,
  },
  {
    kind: 'class',
    category: 'appear',
    label: 'Appears only for a class',
    flareKey: 'requires_class / requires_not_class',
    description: 'Only load this NPC for a player base class.',
    synonyms: ['class', 'sınıf', 'warrior', 'requires_class'],
    multi: true,
  },
  {
    kind: 'facing',
    category: 'map',
    label: 'Facing on map',
    flareKey: 'spawn_direction',
    description: 'Which way the NPC faces when it appears on the map.',
    synonyms: ['facing', 'direction', 'spawn', 'yüz', 'spawn_direction'],
    singleton: true,
  },
  {
    kind: 'minimap',
    category: 'map',
    label: 'Hide on minimap',
    flareKey: 'show_on_minimap',
    description: 'Do not show this NPC on the minimap (default is shown).',
    synonyms: ['minimap', 'map icon', 'hide', 'show_on_minimap'],
    singleton: true,
  },
  {
    kind: 'intro_voice',
    category: 'audio',
    label: 'Intro voice',
    flareKey: 'vox_intro',
    description: 'Sound played when first talking to this NPC.',
    synonyms: ['voice', 'sound', 'audio', 'vox', 'intro', 'ses'],
    multi: true,
  },
  {
    kind: 'custom_animation',
    category: 'look',
    label: 'Custom animation',
    flareKey: 'anim_render_* / anim_frames / anim_duration / …',
    description: 'Frame size and timing for an imported tileset (not a catalog appearance).',
    synonyms: ['animation', 'frames', 'duration', 'blend', 'alpha', 'offset', 'tileset'],
    singleton: true,
  },
  {
    kind: 'stat',
    category: 'stats',
    label: 'Stat',
    flareKey: '[stats]',
    description: 'A StatBlock key such as speed or stat=hp,100.',
    synonyms: ['stat', 'stats', 'speed', 'hp', 'mp'],
    multi: true,
  },
  {
    kind: 'visual_effect',
    category: 'stats',
    label: 'Visual effect',
    flareKey: '[visual_effect]',
    description: 'An on-NPC visual effect triggered from dialog or automatically.',
    synonyms: ['effect', 'vfx', 'visual', 'glow', 'visual_effect'],
    multi: true,
  },
];

const KIND_ORDER = PROPERTY_CATALOG.map((e) => e.kind);

export const isCustomTilesetAppearance = (tilesetPath: string, tilesetSourcePath: string) =>
  Boolean(tilesetSourcePath) || (Boolean(tilesetPath) && isImageFilePath(tilesetPath));

const splitMulti = (raw: string): string[] =>
  String(raw || '')
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);

const propText = (properties: Record<string, unknown> | undefined, key: string): string => {
  if (!properties || !(key in properties)) return '';
  const v = properties[key];
  return Array.isArray(v) ? String(v[0] ?? '') : v == null ? '' : String(v);
};

const hasProp = (properties: Record<string, unknown> | undefined, key: string) =>
  !!properties && key in properties;

/** Resolve stats/effects: edited JSON props win; otherwise file sections. */
export function resolveStatsAndEffects(
  properties: Record<string, unknown> | undefined,
  fileStats?: KeyValue[],
  fileEffects?: KeyValue[][],
): { stats: KeyValue[]; effects: KeyValue[][] } {
  const statsProp = propText(properties, 'npc_stats');
  const vfxProp = propText(properties, 'npc_visual_effects');
  const stats = statsProp ? (parseSectionProperty(statsProp)[0] || []) : (fileStats || []);
  const effects = vfxProp ? parseSectionProperty(vfxProp) : (fileEffects || []);
  return { stats, effects };
}

export function listNpcPropertyCards(input: {
  properties: Record<string, unknown> | undefined;
  fileStats?: KeyValue[];
  fileEffects?: KeyValue[][];
  customTileset?: boolean;
}): NpcPropertyCard[] {
  const p = input.properties || {};
  const cards: NpcPropertyCard[] = [];
  const push = (card: Omit<NpcPropertyCard, 'id'> & { id?: string }) => {
    cards.push({
      ...card,
      id: card.id || `${card.kind}:${card.polarity || 'x'}:${card.index}`,
    });
  };

  if (hasProp(p, 'requires_level') || hasProp(p, 'requires_not_level')) {
    push({
      kind: 'level',
      category: 'appear',
      index: 0,
      values: { min: propText(p, 'requires_level'), max: propText(p, 'requires_not_level') },
    });
  }

  if (hasProp(p, 'requires_currency') || hasProp(p, 'requires_not_currency')) {
    push({
      kind: 'currency',
      category: 'appear',
      index: 0,
      values: { min: propText(p, 'requires_currency'), max: propText(p, 'requires_not_currency') },
    });
  }

  const statusHave = hasProp(p, 'requires_status') ? splitMulti(propText(p, 'requires_status')) : [];
  if (hasProp(p, 'requires_status') && statusHave.length === 0) statusHave.push('');
  statusHave.forEach((value, index) => {
    push({ kind: 'status', category: 'appear', index, polarity: 'have', values: { value } });
  });
  const statusNot = hasProp(p, 'requires_not_status') ? splitMulti(propText(p, 'requires_not_status')) : [];
  if (hasProp(p, 'requires_not_status') && statusNot.length === 0) statusNot.push('');
  statusNot.forEach((value, index) => {
    push({ kind: 'status', category: 'appear', index, polarity: 'have_not', values: { value } });
  });

  const itemHave = hasProp(p, 'requires_item') ? splitMulti(propText(p, 'requires_item')) : [];
  if (hasProp(p, 'requires_item') && itemHave.length === 0) itemHave.push('');
  const itemQty = propText(p, 'requires_item_quantity');
  itemHave.forEach((value, index) => {
    const [id, qty] = value.includes(':') ? value.split(':') : [value, itemQty];
    push({ kind: 'item', category: 'appear', index, polarity: 'have', values: { value: id, qty: qty || '' } });
  });
  const itemNot = hasProp(p, 'requires_not_item') ? splitMulti(propText(p, 'requires_not_item')) : [];
  if (hasProp(p, 'requires_not_item') && itemNot.length === 0) itemNot.push('');
  const itemNotQty = propText(p, 'requires_not_item_quantity');
  itemNot.forEach((value, index) => {
    const [id, qty] = value.includes(':') ? value.split(':') : [value, itemNotQty];
    push({
      kind: 'item',
      category: 'appear',
      index,
      polarity: 'have_not',
      values: { value: id, qty: qty || '' },
    });
  });

  const classHave = hasProp(p, 'requires_class') ? splitMulti(propText(p, 'requires_class')) : [];
  if (hasProp(p, 'requires_class') && classHave.length === 0) classHave.push('');
  classHave.forEach((value, index) => {
    push({ kind: 'class', category: 'appear', index, polarity: 'have', values: { value } });
  });
  const classNot = hasProp(p, 'requires_not_class') ? splitMulti(propText(p, 'requires_not_class')) : [];
  if (hasProp(p, 'requires_not_class') && classNot.length === 0) classNot.push('');
  classNot.forEach((value, index) => {
    push({
      kind: 'class',
      category: 'appear',
      index,
      polarity: 'have_not',
      values: { value },
    });
  });

  if (hasProp(p, 'spawn_direction') && propText(p, 'spawn_direction') !== '') {
    push({
      kind: 'facing',
      category: 'map',
      index: 0,
      values: { direction: propText(p, 'spawn_direction') },
    });
  }

  if (propText(p, 'show_on_minimap') === 'false') {
    push({ kind: 'minimap', category: 'map', index: 0, values: {} });
  }

  const voices = hasProp(p, 'vox_intro') ? splitMulti(propText(p, 'vox_intro')) : [];
  if (hasProp(p, 'vox_intro') && voices.length === 0) voices.push('');
  voices.forEach((value, index) => {
    push({ kind: 'intro_voice', category: 'audio', index, values: { file: value } });
  });

  const custom = input.customTileset ?? isCustomTilesetAppearance(propText(p, 'tilesetPath'), propText(p, 'tilesetSourcePath'));
  if (custom) {
    push({
      kind: 'custom_animation',
      category: 'look',
      index: 0,
      values: {
        width: propText(p, 'anim_render_width'),
        height: propText(p, 'anim_render_height'),
        offset_x: propText(p, 'anim_render_offset_x'),
        offset_y: propText(p, 'anim_render_offset_y'),
        frames: propText(p, 'anim_frames'),
        duration: propText(p, 'anim_duration'),
        type: propText(p, 'anim_type') || 'looped',
        blend: propText(p, 'anim_blend_mode') || 'normal',
        alpha: propText(p, 'anim_alpha_mod'),
        color: propText(p, 'anim_color_mod'),
      },
    });
  }

  const { stats, effects } = resolveStatsAndEffects(p, input.fileStats, input.fileEffects);
  stats.forEach((entry, index) => {
    if (!entry.key && !entry.value) return;
    push({
      kind: 'stat',
      category: 'stats',
      index,
      values: { key: entry.key, value: entry.value },
    });
  });
  effects.forEach((fx, index) => {
    const get = (k: string) => fx.find((e) => e.key === k)?.value ?? '';
    push({
      kind: 'visual_effect',
      category: 'stats',
      index,
      values: {
        id: get('id'),
        animation: get('animation'),
        duration: get('duration'),
        requires_status: get('requires_status'),
        requires_not_status: get('requires_not_status'),
        render_above: get('render_above'),
        automatic: get('automatic'),
      },
    });
  });

  return cards.sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (ca !== 0) return ca;
    const ka = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (ka !== 0) return ka;
    if ((a.polarity || '') !== (b.polarity || '')) return (a.polarity || '') < (b.polarity || '') ? -1 : 1;
    return a.index - b.index;
  });
}

/** Build cards from a raw NPC file (for tests and hydration). */
export function cardsFromNpcText(text: string): NpcPropertyCard[] {
  const npc = importNpcText(text || '') as Record<string, unknown>;
  const properties: Record<string, unknown> = {};
  for (const key of [
    'requires_level', 'requires_not_level',
    'requires_currency', 'requires_not_currency',
    'requires_status', 'requires_not_status',
    'requires_item', 'requires_not_item',
    'requires_item_quantity', 'requires_not_item_quantity',
    'requires_class', 'requires_not_class',
    'spawn_direction', 'show_on_minimap', 'vox_intro',
    'tilesetPath', 'tilesetSourcePath',
    'anim_render_width', 'anim_render_height', 'anim_frames', 'anim_duration',
  ]) {
    if (npc[key] !== undefined) properties[key] = npc[key];
  }
  // animations= path is not a custom tileset image
  const fileStats = sectionsFromNpcText(text, 'stats').flat();
  const fileEffects = sectionsFromNpcText(text, 'visual_effect');
  return listNpcPropertyCards({ properties, fileStats, fileEffects, customTileset: false });
}

export function filterPropertyCatalog(
  query: string,
  present: NpcPropertyCard[],
  opts?: { customTileset?: boolean },
): PropertyCatalogEntry[] {
  const q = query.trim().toLowerCase();
  const presentKinds = new Set(present.map((c) => c.kind));
  return PROPERTY_CATALOG.filter((entry) => {
    if (entry.kind === 'custom_animation' && !opts?.customTileset) return false;
    if (entry.singleton && presentKinds.has(entry.kind)) return false;
    if (!q) return true;
    const hay = [entry.label, entry.flareKey, entry.description, ...entry.synonyms].join(' ').toLowerCase();
    return hay.includes(q) || q.split(/\s+/).every((part) => hay.includes(part));
  });
}

/** Apply adding a catalog kind onto properties (returns patch of keys → value|null). */
export function patchAddProperty(
  kind: NpcPropertyKind,
  properties: Record<string, unknown> | undefined,
): Record<string, string | null> {
  const p = properties || {};
  switch (kind) {
    case 'level':
      return { requires_level: '' };
    case 'currency':
      return { requires_currency: '' };
    case 'status': {
      const cur = splitMulti(propText(p, 'requires_status'));
      return { requires_status: [...cur, ''].join('\n') };
    }
    case 'item': {
      const cur = splitMulti(propText(p, 'requires_item'));
      return { requires_item: [...cur, ''].join('\n') };
    }
    case 'class': {
      const cur = splitMulti(propText(p, 'requires_class'));
      return { requires_class: [...cur, ''].join('\n') };
    }
    case 'facing':
      return { spawn_direction: '0' };
    case 'minimap':
      return { show_on_minimap: 'false' };
    case 'intro_voice': {
      const cur = splitMulti(propText(p, 'vox_intro'));
      return { vox_intro: [...cur, ''].join('\n') };
    }
    case 'custom_animation':
      return {};
    case 'stat': {
      const { stats } = resolveStatsAndEffects(p);
      const next = [...stats, { key: '', value: '' }];
      return { npc_stats: JSON.stringify([next]) };
    }
    case 'visual_effect': {
      const { effects } = resolveStatsAndEffects(p);
      const next = [...effects, [{ key: 'id', value: `effect_${effects.length + 1}` }]];
      return { npc_visual_effects: JSON.stringify(next) };
    }
    default:
      return {};
  }
}

/** Remove one card; returns property patch (null = delete key). */
export function patchRemoveCard(
  card: NpcPropertyCard,
  properties: Record<string, unknown> | undefined,
  fileStats?: KeyValue[],
  fileEffects?: KeyValue[][],
): Record<string, string | null> {
  const p = properties || {};

  switch (card.kind) {
    case 'level':
      return { requires_level: null, requires_not_level: null };
    case 'currency':
      return { requires_currency: null, requires_not_currency: null };
    case 'status': {
      const key = card.polarity === 'have_not' ? 'requires_not_status' : 'requires_status';
      const list = splitMulti(propText(p, key));
      const next = list.filter((_, j) => j !== card.index);
      return { [key]: next.length ? next.join('\n') : null };
    }
    case 'item': {
      const key = card.polarity === 'have_not' ? 'requires_not_item' : 'requires_item';
      const qtyKey = card.polarity === 'have_not' ? 'requires_not_item_quantity' : 'requires_item_quantity';
      const list = splitMulti(propText(p, key));
      const next = list.filter((_, j) => j !== card.index);
      return {
        [key]: next.length ? next.join('\n') : null,
        ...(next.length ? {} : { [qtyKey]: null }),
      };
    }
    case 'class': {
      const key = card.polarity === 'have_not' ? 'requires_not_class' : 'requires_class';
      const list = splitMulti(propText(p, key));
      const next = list.filter((_, j) => j !== card.index);
      return { [key]: next.length ? next.join('\n') : null };
    }
    case 'facing':
      return { spawn_direction: null };
    case 'minimap':
      return { show_on_minimap: null };
    case 'intro_voice': {
      const list = splitMulti(propText(p, 'vox_intro'));
      const next = list.filter((_, j) => j !== card.index);
      return { vox_intro: next.length ? next.join('\n') : null };
    }
    case 'custom_animation':
      return {
        anim_render_width: null,
        anim_render_height: null,
        anim_render_offset_x: null,
        anim_render_offset_y: null,
        anim_frames: null,
        anim_duration: null,
        anim_type: null,
        anim_blend_mode: null,
        anim_alpha_mod: null,
        anim_color_mod: null,
        // keep tileset — user asked to clear animation props to default
      };
    case 'stat': {
      const { stats } = resolveStatsAndEffects(p, fileStats, fileEffects);
      const next = stats.filter((_, j) => j !== card.index);
      return { npc_stats: JSON.stringify([next]) };
    }
    case 'visual_effect': {
      const { effects } = resolveStatsAndEffects(p, fileStats, fileEffects);
      const next = effects.filter((_, j) => j !== card.index);
      return { npc_visual_effects: JSON.stringify(next) };
    }
    default:
      return {};
  }
}

/** Update a multi-value list entry at index (newline-joined). */
export function patchListValue(
  key: string,
  index: number,
  nextValue: string,
  properties: Record<string, unknown> | undefined,
): Record<string, string | null> {
  const list = splitMulti(propText(properties, key));
  while (list.length <= index) list.push('');
  list[index] = nextValue;
  const cleaned = list.map((s) => s.trim());
  // keep empty slots so the card remains until ✕
  return { [key]: cleaned.join('\n') };
}

/** Move a status/item/class value between have and have_not keys. */
export function patchPolarity(
  kind: 'status' | 'item' | 'class',
  card: NpcPropertyCard,
  nextHave: boolean,
  properties: Record<string, unknown> | undefined,
): Record<string, string | null> {
  const keys = {
    status: ['requires_status', 'requires_not_status'] as const,
    item: ['requires_item', 'requires_not_item'] as const,
    class: ['requires_class', 'requires_not_class'] as const,
  }[kind];
  const [haveKey, notKey] = keys;
  const have = splitMulti(propText(properties, haveKey));
  const not = splitMulti(propText(properties, notKey));
  const value = card.values.value || '';
  const currentlyHave = card.polarity !== 'have_not';
  if (currentlyHave === nextHave) return {};

  if (currentlyHave) {
    const nextHaveList = have.filter((_, j) => j !== card.index);
    const nextNot = [...not, value];
    return {
      [haveKey]: nextHaveList.length ? nextHaveList.join('\n') : null,
      [notKey]: nextNot.join('\n'),
    };
  }
  const nextNot = not.filter((_, j) => j !== card.index);
  const nextHaveList = [...have, value];
  return {
    [notKey]: nextNot.length ? nextNot.join('\n') : null,
    [haveKey]: nextHaveList.join('\n'),
  };
}
