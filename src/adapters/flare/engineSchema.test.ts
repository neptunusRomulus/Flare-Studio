import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { ENGINE_TARGET } from '@/flare/engineTarget';
import {
  applyEnemyFileUpdates,
  exportMapText,
  importMapText,
  mergeEffectText,
  mergeItemText,
  mergeLootText,
  mergeNpcFile,
  mergePowerText,
  mergeQuestText,
  normalizeEnemyText,
} from './flareAdapter.cjs';

const require = createRequire(import.meta.url);
const { findEngine, extractSchema } = require('../../../tools/extract-engine-schema.cjs');
const { parseFlareEntries, groupRepeats } = require('../../../tools/flareFileKeys.cjs');

const SNAPSHOT_PATH = path.resolve(
  __dirname,
  '../../../tests/fixtures/engine-schema/c6772106.json',
);

type SchemaKey = {
  rawType?: string;
  repeatable?: boolean;
  list?: boolean;
  ignored?: boolean;
  deprecated?: boolean;
  shape?: unknown[];
};

type Schema = {
  engine: { commit: string | null; version: string };
  sections: Record<string, { keys: Record<string, SchemaKey> }>;
};

const schema = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as Schema;

function fixtureFiles(name: string): Array<{ file: string; text: string }> {
  const dir = path.resolve(__dirname, '../../../tests/fixtures', name);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith('.txt') || file.endsWith('.pot') || file.endsWith('.fow'))
    .map((file) => ({ file: `${name}/${file}`, text: readFileSync(path.join(dir, file), 'utf8') }));
}

/** Studio file kind + [section] → schema section id. */
function schemaSection(kind: string, section: string): string | string[] | null {
  const s = (section || '').toLowerCase();
  if (kind === 'map') {
    if (s === 'header' || s === '') return 'map.header';
    if (s === 'layer') return 'layer';
    if (s === 'enemy' || s === 'enemygroup') return 'enemygroup';
    if (s === 'npc') return 'map.npc';
    if (s === 'event') return 'event';
    if (s === 'settings') return 'settings';
    if (s === 'chunks') return 'chunks';
    return null;
  }
  if (kind === 'npc') {
    if (s === 'dialog') return 'dialog';
    if (s === 'visual_effect') return 'visual_effect';
    if (s === 'stats') return 'stats';
    return 'npc';
  }
  if (kind === 'quest') return s === 'quest' ? 'quest' : 'quest';
  if (kind === 'loot') return s === 'loot' ? 'loot' : 'loot';
  if (kind === 'item') {
    if (s === 'quality') return 'quality';
    if (s === 'type') return 'type';
    if (s === 'set') return 'set';
    if (s === 'settings') return 'item.settings';
    if (s === 'option' || s === 'bonuses') return s;
    return 'item';
  }
  if (kind === 'itemset') return s === 'settings' ? 'item.settings' : 'set';
  if (kind === 'itemtype') return s === 'settings' ? 'item.settings' : 'type';
  if (kind === 'itemquality') return s === 'settings' ? 'item.settings' : 'quality';
  if (kind === 'power') return s === 'effect' ? 'effect' : 'power';
  if (kind === 'effect') return 'effect';
  if (kind === 'enemy') {
    if (s === 'npc') return 'npc';
    if (s === 'dialog') return 'dialog';
    if (s === 'visual_effect') return 'visual_effect';
    if (s === 'render_layers') return 'render_layers';
    if (s === 'animation_slots') return 'animation_slots';
    return 'stats';
  }
  if (kind === 'engine') return s && schema.sections[s] ? s : 'engine';
  if (kind === 'parallax') return 'parallax';
  if (kind === 'cutscene') return s === 'vscroll' ? 'vscroll' : s === 'scene' ? 'scene' : 'cutscene';
  if (kind === 'fow') return s ? `fow.${s}` : 'fow.header';
  if (kind === 'procgen') return s === 'chunks' ? 'chunks' : 'settings';
  if (kind === 'tileset') return 'tileset';
  return null;
}

function lookupKey(kind: string, section: string, key: string): SchemaKey | null {
  const target = schemaSection(kind, section);
  if (!target) return null;
  const names = Array.isArray(target) ? target : [target];
  // NPC [dialog] falls through to EventManager::loadEventComponent for any other key.
  if ((kind === 'npc' || kind === 'enemy') && (section || '').toLowerCase() === 'dialog') {
    names.push('event');
  }
  for (const name of names) {
    const found = schema.sections[name]?.keys[key];
    if (found) return found;
  }
  return null;
}

function allowsRepeat(meta: SchemaKey): boolean {
  return !!(meta.repeatable || meta.list);
}

function valueOk(meta: SchemaKey, value: string): boolean {
  const raw = (meta.rawType || '').toLowerCase();
  const trimmed = value.trim();
  if (!raw) return true;
  const boolOnly = /^\s*bool\s*$/.test(raw) || raw === 'bool';
  const isBoolType = /(^|[,(])\s*bool\s*([,)]|$)/.test(raw) && !/string|filename|predefined/.test(raw) && !raw.includes('[');
  if (boolOnly || (isBoolType && !raw.includes('list') && !raw.includes('repeatable'))) {
    return /^(true|false)$/i.test(trimmed);
  }
  const intLike = /^(int|item_id|power_id|icon_id)$/;
  if (intLike.test(raw.trim())) return /^-?\d+$/.test(trimmed);
  if (raw.trim() === 'float') return /^-?\d+(?:\.\d+)?$/.test(trimmed);
  if (raw.trim() === 'duration') return /^\d+(?:ms|s)?$/i.test(trimmed);
  return true;
}

type Case = { kind: string; file: string; text: string };

function cases(): Case[] {
  const out: Case[] = [];
  const push = (kind: string, files: Array<{ file: string; text: string }>) => {
    for (const file of files) out.push({ kind, ...file });
  };
  push('npc', fixtureFiles('flare-npcs'));
  push('quest', fixtureFiles('flare-quests'));
  push('loot', fixtureFiles('flare-loot'));
  push('item', fixtureFiles('flare-items'));
  for (const file of fixtureFiles('export')) {
    if (file.file.endsWith('.sets.txt')) push('itemset', [file]);
    else if (file.file.endsWith('.types.txt')) push('itemtype', [file]);
    else if (file.file.endsWith('.qualities.txt')) push('itemquality', [file]);
    else if (/item|unique/.test(file.file) && file.file.endsWith('.txt')) push('item', [file]);
  }
  push('power', fixtureFiles('flare-powers').filter((f) => f.file.includes('effect') === false || f.file.endsWith('powers.txt')));
  push('effect', fixtureFiles('flare-powers').filter((f) => f.file.includes('effect') || f.file.endsWith('effects.txt')));
  push('enemy', fixtureFiles('flare-enemies'));
  push('map', fixtureFiles('flare-maps'));
  for (const file of fixtureFiles('export')) {
    if (file.file.endsWith('.quest.txt')) push('quest', [file]);
    else if (file.file.endsWith('.loot.txt')) push('loot', [file]);
    else if (file.file.endsWith('.effect.txt')) push('effect', [file]);
    else if (file.file.endsWith('.cutscene.txt')) push('cutscene', [file]);
    else if (file.file.endsWith('.parallax.txt')) push('parallax', [file]);
    else if (file.file.endsWith('.fow.txt') || file.file.endsWith('.fow')) push('fow', [file]);
    else if (file.file.endsWith('.procgen.txt')) push('procgen', [file]);
    else if (file.file.endsWith('.engine.txt')) push('engine', [file]);
  }
  return out;
}

function asText(value: string | { text: string }): string {
  return typeof value === 'string' ? value : value.text;
}

function emit(kind: string, text: string): string {
  const src = text.endsWith('\n') ? text : `${text}\n`;
  if (kind === 'npc') return mergeNpcFile(src, {});
  if (kind === 'quest') return mergeQuestText(src, { name: '', completeStatus: '', steps: [] });
  if (kind === 'loot') return mergeLootText(src, {});
  if (kind === 'item' || kind === 'itemset' || kind === 'itemtype' || kind === 'itemquality') {
    return mergeItemText(src, {});
  }
  if (kind === 'power') return mergePowerText(src, []);
  if (kind === 'effect') return mergeEffectText(src, []);
  if (kind === 'enemy') return asText(applyEnemyFileUpdates(asText(normalizeEnemyText(src)), {}));
  if (kind === 'map') return asText(exportMapText(importMapText(src)));
  return src;
}

describe('engine schema snapshot', () => {
  it('matches the documented flare-engine target commit and has NPC/event/item keys', () => {
    expect(schema.engine.version).toBe(ENGINE_TARGET.version);
    if (schema.engine.commit) {
      expect(schema.engine.commit).toBe(ENGINE_TARGET.commit);
    }
    expect(schema.sections.npc.keys.name).toBeTruthy();
    expect(schema.sections.event.keys.set_status).toBeTruthy();
    expect(schema.sections.item.keys.id).toBeTruthy();
    expect(schema.sections['map.header'].keys.width).toBeTruthy();
    expect(schema.sections['map.header'].keys.tilewidth?.ignored).toBe(true);
  });

  it('is regenerated from flare-engine source when the tree is available', (ctx) => {
    const engine = findEngine();
    if (!engine) {
      expect(engine).toBeNull();
      return;
    }
    const fresh = extractSchema(engine);
    if (fresh.engine.version !== schema.engine.version) {
      ctx.skip(
        `local flare-engine is ${fresh.engine.version}, snapshot targets ${schema.engine.version}`,
      );
    }
    expect(fresh.engine.version).toBe(schema.engine.version);
    expect(JSON.stringify(fresh.sections)).toBe(JSON.stringify(schema.sections));
  });
});

describe('Studio serializers only emit keys the engine reads', () => {
  const samples = cases();
  it('has fixture cases for the main file kinds', () => {
    const kinds = new Set(samples.map((c) => c.kind));
    expect([...kinds].sort()).toEqual(expect.arrayContaining(['npc', 'quest', 'item', 'power', 'enemy', 'map', 'loot']));
  });

  it('emits only schema keys, with legal repeats and value shapes', () => {
    const unknown: string[] = [];
    const badRepeat: string[] = [];
    const badValue: string[] = [];

    for (const sample of samples) {
      let out = sample.text;
      try {
        out = emit(sample.kind, sample.text);
      } catch (err) {
        unknown.push(`${sample.file}: emit threw ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
      const inputKeys = new Set(parseFlareEntries(sample.text).map((entry: { section: string; key: string }) => `${entry.section}\0${entry.key}`));
      const entries = parseFlareEntries(out);
      for (const entry of entries) {
        const meta = lookupKey(sample.kind, entry.section, entry.key);
        if (!meta) {
          const inherited = inputKeys.has(`${entry.section}\0${entry.key}`);
          if (inherited) continue; // merge keeps unknown keys; that is intentional
          unknown.push(`${sample.file}: [${entry.section || 'root'}] ${entry.key}=${JSON.stringify(entry.value)}`);
          continue;
        }
        if (!valueOk(meta, entry.value)) {
          badValue.push(`${sample.file}: [${entry.section}] ${entry.key}=${JSON.stringify(entry.value)} (expected ${meta.rawType})`);
        }
      }
      const inputRepeats = new Map(
        groupRepeats(parseFlareEntries(sample.text)).map((repeat: { section: string; key: string; count: number }) => [
          `${repeat.section}\0${repeat.key}`,
          repeat.count,
        ]),
      );
      for (const repeat of groupRepeats(entries)) {
        const meta = lookupKey(sample.kind, repeat.section, repeat.key);
        if (!meta || allowsRepeat(meta) || meta.ignored) continue;
        const before = inputRepeats.get(`${repeat.section}\0${repeat.key}`) || 1;
        if (repeat.count > before) {
          badRepeat.push(`${sample.file}: [${repeat.section}] ${repeat.key} appears ${repeat.count} times (was ${before}) but schema is ${meta.rawType || 'singular'}`);
        }
      }
    }

    expect(unknown, `Unknown keys (engine does not read these):\n${unknown.join('\n')}`).toEqual([]);
    expect(badRepeat, `Illegal repeats:\n${badRepeat.join('\n')}`).toEqual([]);
    expect(badValue, `Value shape mismatches:\n${badValue.join('\n')}`).toEqual([]);
  });
});
