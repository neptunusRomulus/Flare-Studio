/**
 * NPC save without data loss: Studio's modeled NPC fields are merged into the
 * existing npcs/*.txt (if any) instead of replacing it, so keys, sections and
 * dialog components Studio does not model stay as they are.
 */
import { mergeNpcFile, statusStockFromEntries, importNpcText } from '@/adapters/flare/flareAdapter.cjs';

type Props = Record<string, unknown> | undefined;

const text = (v: unknown): string => (Array.isArray(v) ? String(v[0] ?? '') : v == null ? '' : String(v));

/** Property -> Flare key for plain string fields edited in the NPC dialog. */
export const NPC_STRING_FIELDS: Record<string, string> = {
  constant_stock: 'constant_stock',
  random_stock: 'random_stock',
  random_stock_count: 'random_stock_count',
  vendor_requires_status: 'vendor_requires_status',
  vendor_requires_not_status: 'vendor_requires_not_status',
  direction: 'direction',
  show_on_minimap: 'show_on_minimap',
  vendor_ratio_buy: 'vendor_ratio_buy',
  vendor_ratio_sell: 'vendor_ratio_sell',
  vendor_ratio_sell_old: 'vendor_ratio_sell_old',
  craft_constant_stock: 'craft_constant_stock',
  craft_random_stock_count: 'craft_random_stock_count',
  vendor_gamble_buy: 'vendor_gamble_buy',
  vendor_gamble_craft: 'vendor_gamble_craft',
};
/** Repeatable keys whose values contain commas: one Flare line per text line. */
export const NPC_LINE_FIELDS: Record<string, string> = {
  craft_status_stock: 'craft_status_stock',
  craft_random_stock: 'craft_random_stock',
  vendor_tab_enabled: 'vendor_tab_enabled',
};

export type VendorTab = 'buy' | 'sell' | 'craft';
export const VENDOR_TAB_DEFAULTS: Record<VendorTab, boolean> = { buy: true, sell: true, craft: false };
/** vendor_tab_enabled lines -> tab states (later lines win, as in NPC.cpp). */
export function parseVendorTabs(value: string): Record<VendorTab, boolean> {
  const tabs = { ...VENDOR_TAB_DEFAULTS };
  for (const line of String(value || '').split('\n')) {
    const [tab, enabled] = line.split(',').map(s => s.trim().toLowerCase());
    if (tab === 'buy' || tab === 'sell' || tab === 'craft') tabs[tab] = enabled === 'true' || enabled === '1';
  }
  return tabs;
}
/** Only tabs that differ from the engine default are written. */
export function formatVendorTabs(tabs: Record<VendorTab, boolean>): string {
  return (Object.keys(VENDOR_TAB_DEFAULTS) as VendorTab[])
    .filter(tab => tabs[tab] !== VENDOR_TAB_DEFAULTS[tab]).map(tab => `${tab},${tabs[tab]}`).join('\n');
}
/** Repeatable keys entered as a comma/newline list (one Flare line per value). */
export const NPC_LIST_FIELDS: Record<string, string> = {
  vox_intro: 'vox_intro',
};

export type KeyValue = { key: string; value: string };
export type NpcFileUpdate = { fields: Record<string, string | boolean>; dialogueTrees?: unknown[]; sections?: Record<string, KeyValue[][]> };

/** Object property (JSON) -> NPC file section; present property replaces all sections of that name. */
export const NPC_SECTION_FIELDS: Record<string, string> = {
  npc_stats: 'stats',
  npc_visual_effects: 'visual_effect',
};

/** Parse a section property: JSON list of sections, each a list of {key, value}. */
export function parseSectionProperty(value: unknown): KeyValue[][] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Array.isArray).map((entries: unknown[]) => entries
      .filter((e): e is KeyValue => !!e && typeof e === 'object' && 'key' in e)
      .map(e => ({ key: String(e.key ?? ''), value: String(e.value ?? '') })));
  } catch { return []; }
}

/** Sections of that name in an NPC file (raw lines like comments/INCLUDE left out; the merge keeps them). */
export function sectionsFromNpcText(textContent: string, name: string): KeyValue[][] {
  const npc = importNpcText(textContent || '') as { _rawSections?: Array<{ name: string; entries: Array<{ key?: string; value?: string; raw?: string }> }> };
  return (npc._rawSections || []).filter(sec => sec.name === name)
    .map(sec => sec.entries.filter(e => !e.raw && e.key).map(e => ({ key: String(e.key), value: String(e.value ?? '') })));
}

/**
 * Only fields the NPC object actually holds are authoritative ("" clears the key);
 * fields it doesn't hold keep the file's value.
 */
export function npcFileUpdate(name: string, props: Props, resolved: { animations?: string; portrait?: string }): NpcFileUpdate {
  const p = props || {};
  const fields: Record<string, string | boolean> = { name };
  if ('talker' in p || 'vendor' in p || 'questGiver' in p) {
    fields.talker = text(p.talker) === 'true' || text(p.vendor) === 'true' || text(p.questGiver) === 'true';
  }
  if ('vendor' in p) fields.vendor = text(p.vendor) === 'true';
  if (resolved.animations) fields.animations = resolved.animations;
  if (resolved.portrait) fields.portrait = resolved.portrait;
  for (const [prop, key] of Object.entries(NPC_STRING_FIELDS)) if (prop in p) fields[key] = text(p[prop]).trim();
  for (const [prop, key] of Object.entries(NPC_LIST_FIELDS)) {
    if (prop in p) fields[key] = text(p[prop]).split(/[,\n]/).map(s => s.trim()).filter(Boolean).join('\n');
  }
  for (const [prop, key] of Object.entries(NPC_LINE_FIELDS)) {
    if (prop in p) fields[key] = text(p[prop]).split('\n').map(s => s.trim()).filter(Boolean).join('\n');
  }
  // Only a non-empty status stock replaces the file's (an untouched/empty editor value must not wipe it)
  const stock = 'status_stock_entries' in p ? statusStockFromEntries(p.status_stock_entries) : [];
  if (stock.length) fields.status_stock = stock.join('\n');
  const update: NpcFileUpdate = { fields };
  for (const [prop, section] of Object.entries(NPC_SECTION_FIELDS)) {
    if (prop in p) (update.sections ||= {})[section] = parseSectionProperty(p[prop]);
  }
  if ('dialogueTrees' in p) {
    try {
      const raw = p.dialogueTrees;
      const parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
      if (Array.isArray(parsed)) update.dialogueTrees = parsed;
    } catch { /* unreadable trees: keep the file's dialogs */ }
  }
  return update;
}

/** File content to write: merged into the existing file text (or a fresh file when there is none). */
export function npcFileContent(existing: string | null | undefined, update: NpcFileUpdate): string {
  return mergeNpcFile(existing || '', update);
}

/** Project-relative NPC file name (inside npcs/) from the spawn filename. */
export function npcFileBase(filename: string): string {
  return filename.replace(/\\/g, '/').replace(/^npcs\//, '');
}

/** True when an animations/npcs/*.txt is Studio's own one-sprite file for this image (safe to regenerate). */
export function isStudioNpcAnimation(text: string, imageFileName: string): boolean {
  const first = text.replace(/\r/g, '').split('\n').map(l => l.trim()).find(l => l && !l.startsWith('#'));
  return first === `image=images/npcs/${imageFileName}`;
}
