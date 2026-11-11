/**
 * Project-wide index of powers, effects and story flags, built from raw Flare
 * text files. Pure: the caller reads the files.
 */
import { blockFirst, blockRecord, parseSectionFile } from './sectionFile';

export type ProjectFile = { path: string; text: string };

export type PowerKind = 'skill' | 'monster' | 'item' | 'trap';
export type EffectKind = 'buff' | 'debuff';

export type UsedByKind = 'enemy' | 'item' | 'event' | 'npc' | 'power' | 'skill_tree' | 'class';
export type UsedBy = { kind: UsedByKind; name: string; path: string; key: string };

export type PowerEntry = {
  id: string;
  name: string;
  path: string;
  blockIndex: number;
  /** Own keys plus keys from INCLUDE files (own keys win). */
  keys: Record<string, string[]>;
  includes?: string[];
};

export type EffectEntry = PowerEntry;

export type EffectUse = UsedBy & { magnitude: string; duration: string };

export type FlagUsage = { setBy: string[]; readBy: string[] };

export type PowerProject = {
  powers: PowerEntry[];
  effects: EffectEntry[];
  powerUsedBy: Record<string, UsedBy[]>;
  effectUsedBy: Record<string, EffectUse[]>;
  flags: Record<string, FlagUsage>;
};

const SET_FLAG_KEYS = new Set(['set_status', 'unset_status', 'complete_status', 'defeat_status', 'pickup_status', 'random_status']);
const READ_FLAG_KEYS = new Set([
  'requires_status', 'requires_not_status', 'invincible_requires_status', 'invincible_requires_not_status',
  'vendor_requires_status', 'vendor_requires_not_status', 'procgen_reset_status', 'show_status',
]);
export const STORY_FLAG_KEYS = new Set([...SET_FLAG_KEYS, ...READ_FLAG_KEYS]);

/** Power keys that point at another power: value is "id" or "id,chance". */
const POWER_LINK_KEYS = ['pre_power', 'post_power', 'wall_power', 'expire_power', 'buff_party_power_id'];
/** Power keys that point at an effect: "id,magnitude,duration[,chance]". */
export const EFFECT_LINK_KEYS = ['post_effect', 'post_effect_src'];

const firstToken = (value: string) => value.split(',')[0].trim();
const baseName = (path: string) => path.replace(/^.*\//, '').replace(/\.txt$/i, '');
const isPowerFile = (path: string) => /^powers\//i.test(path) && !/^powers\/(effects\.txt|trees\/|base\/)/i.test(path);
const isEffectFile = (path: string) => /^powers\/effects\.txt$/i.test(path);

function lines(text: string): Array<{ section: string; key: string; value: string; sectionName: string }> {
  const out: Array<{ section: string; key: string; value: string; sectionName: string }> = [];
  let section = '';
  let sectionName = '';
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^\[([^\]=]+)\]$/);
    if (m) {
      section = m[1].toLowerCase();
      sectionName = '';
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === 'name' || key === 'topic' || key === 'title') sectionName = sectionName || value;
    out.push({ section, key, value, sectionName });
  }
  return out;
}

function fileTitle(text: string, path: string): string {
  for (const entry of lines(text)) if ((!entry.section || entry.section === 'header') && (entry.key === 'name' || entry.key === 'title')) return entry.value;
  return baseName(path);
}

function push<T>(map: Record<string, T[]>, id: string, value: T) {
  if (!id) return;
  (map[id] = map[id] || []).push(value);
}

function addFlag(flags: Record<string, FlagUsage>, key: string, value: string, source: string) {
  const role = SET_FLAG_KEYS.has(key) ? 'setBy' : 'readBy';
  for (const part of value.split(',')) {
    const flag = part.trim();
    if (!flag || /^\d+$/.test(flag)) continue;
    const usage = (flags[flag] = flags[flag] || { setBy: [], readBy: [] });
    if (!usage[role].includes(source)) usage[role].push(source);
  }
}

export function buildPowerProject(files: ProjectFile[]): PowerProject {
  const powers: PowerEntry[] = [];
  const effects: EffectEntry[] = [];
  const powerUsedBy: Record<string, UsedBy[]> = {};
  const effectUsedBy: Record<string, EffectUse[]> = {};
  const flags: Record<string, FlagUsage> = {};

  const textByPath = new Map(files.map((file) => [file.path.replace(/\\/g, '/').replace(/^\/+/, ''), file.text || '']));
  const includedKeys = (paths: string[]): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    for (const inc of paths) {
      for (const entry of lines(textByPath.get(inc) || '')) (out[entry.key] = out[entry.key] || []).push(entry.value);
    }
    return out;
  };

  for (const file of files) {
    const path = file.path.replace(/\\/g, '/').replace(/^\/+/, '');
    const text = file.text || '';
    if (isPowerFile(path) || isEffectFile(path)) {
      const section = isEffectFile(path) ? 'effect' : 'power';
      parseSectionFile(text, section).blocks.forEach((block, blockIndex) => {
        if (!block.id) return;
        const own = blockRecord(block);
        const keys = { ...includedKeys(block.includes), ...own };
        const entry = { id: block.id, name: blockFirst(block, 'name') || keys.name?.[0] || block.id, path, blockIndex, keys, includes: block.includes };
        (section === 'effect' ? effects : powers).push(entry);
      });
    }
    const title = fileTitle(text, path);
    for (const { section, key, value, sectionName } of lines(text)) {
      if (STORY_FLAG_KEYS.has(key)) addFlag(flags, key, value, section && section !== 'header' && sectionName && sectionName !== title ? `${title} · ${sectionName}` : title);
      if (/^enemies\//i.test(path) && (key === 'power' || key === 'passive_powers')) {
        const ids = key === 'power' ? [value.split(',')[1]?.trim() || ''] : value.split(',').map((v) => v.trim());
        ids.forEach((id) => push(powerUsedBy, id, { kind: 'enemy', name: title, path, key }));
      } else if (/^items\//i.test(path) && key === 'power' && section === 'item') {
        push(powerUsedBy, firstToken(value), { kind: 'item', name: sectionName || title, path, key });
      } else if (/^maps\//i.test(path) && key === 'power' && section === 'event') {
        push(powerUsedBy, firstToken(value), { kind: 'event', name: `${title}${sectionName ? ` · ${sectionName}` : ''}`, path, key });
      } else if (/^npcs\//i.test(path) && key === 'power') {
        push(powerUsedBy, firstToken(value), { kind: 'npc', name: title, path, key });
      } else if (/^powers\/trees\//i.test(path) && key === 'id' && section === 'power') {
        push(powerUsedBy, value, { kind: 'skill_tree', name: baseName(path), path, key });
      } else if (/^engine\/classes\.txt$/i.test(path) && (key === 'powers' || key === 'actionbar')) {
        value.split(',').map((v) => v.trim()).filter((v) => v && v !== '0')
          .forEach((id) => push(powerUsedBy, id, { kind: 'class', name: sectionName || 'Class', path, key }));
      }
    }
  }

  for (const power of powers) {
    const source = { kind: 'power' as const, name: power.name, path: power.path };
    for (const key of POWER_LINK_KEYS) {
      for (const value of power.keys[key] || []) push(powerUsedBy, firstToken(value), { ...source, key });
    }
    for (const key of EFFECT_LINK_KEYS) {
      for (const value of power.keys[key] || []) {
        const [id, magnitude = '', duration = ''] = value.split(',').map((v) => v.trim());
        push(effectUsedBy, id, { ...source, key, magnitude, duration });
      }
    }
    for (const value of power.keys.remove_effect || []) {
      value.split(',').map((v) => v.trim()).filter((v) => v && !/^\d+$/.test(v))
        .forEach((id) => push(effectUsedBy, id, { ...source, key: 'remove_effect', magnitude: '', duration: '' }));
    }
  }

  return { powers, effects, powerUsedBy, effectUsedBy, flags };
}
