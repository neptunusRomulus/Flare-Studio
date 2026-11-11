/**
 * Open-and-save round trips for Flare files through the real adapters.
 *
 * Normalization:
 * - Newlines become LF. A missing trailing newline may be added.
 * - Byte-identical: no-edit merge/import+export equals the normalized input.
 * - Maps saved through exportMapText/importMapText are semantic only: Studio
 *   may change number formatting and line order, but header keys, layer type
 *   order, and event keys must survive. (tilewidth/tileheight/orientation are
 *   kept when present; the engine does not use the first two.)
 * - Power-menu trees ([tab]/[upgrade]) and engine/*.txt go through
 *   importEngineText/exportEngineText, not mergePowerText.
 *
 * Fixtures under tests/fixtures/ always run. If FLARE_GAME or a sibling
 * ../flare-game tree is present, every matching file in that tree is also
 * opened and saved.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyEnemyFileUpdates,
  exportEngineText,
  exportMapText,
  importEffectText,
  importEngineText,
  importLootText,
  importMapText,
  importPowerText,
  importQuestText,
  mergeEffectText,
  mergeItemText,
  mergeLootText,
  mergeNpcFile,
  mergePowerText,
  mergeQuestText,
  normalizeEnemyText,
} from './flareAdapter.cjs';

const engineSchema = JSON.parse(
  readFileSync(new URL('../../../tests/fixtures/engine-schema/c6772106.json', import.meta.url), 'utf8'),
) as { sections: Record<string, { keys: Record<string, unknown> }> };
const MAP_HEADER_KEYS = new Set(Object.keys(engineSchema.sections['map.header']?.keys || {}));


function lf(text: string): string {
  const out = String(text || '').replace(/\r/g, '');
  return out.endsWith('\n') ? out : `${out}\n`;
}

function fixtureDir(name: string): string {
  return path.resolve(__dirname, '../../../tests/fixtures', name);
}

function listTxt(dir: string): Array<{ file: string; text: string }> {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.txt') || name.endsWith('.pot') || name.endsWith('.fow'))
    .map((name) => ({ file: name, text: readFileSync(path.join(dir, name), 'utf8') }));
}

function findFlareGame(): string | null {
  const candidates = [
    process.env.FLARE_GAME,
    path.resolve(__dirname, '../../../../flare-game'),
    path.resolve(process.cwd(), '../flare-game'),
  ].filter(Boolean) as string[];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'mods'))) return candidate;
  }
  return null;
}

type Kind =
  | 'npc'
  | 'quest'
  | 'loot'
  | 'item'
  | 'power'
  | 'effect'
  | 'enemy'
  | 'map'
  | 'engine-text';

function classify(rel: string): Kind | 'skip' {
  const n = rel.replace(/\\/g, '/').toLowerCase();
  if (n.includes('/powers/trees/') || n.includes('flare-power-trees/')) return 'engine-text';
  if (n.includes('/engine/') || n.includes('flare-engine-files/')) return 'engine-text';
  if (n.includes('/npcs/') || n.includes('/npc/') || n.includes('flare-npcs/')) return 'npc';
  if (n.includes('/enemies/') || n.includes('flare-enemies/')) return 'enemy';
  if (n.includes('/maps/') || n.includes('flare-maps/')) return 'map';
  if (n.includes('/quests/') || n.includes('flare-quests/')) return 'quest';
  if ((n.includes('/loot/') && !n.includes('/engine/loot')) || n.includes('flare-loot/')) return 'loot';
  if (n.includes('/cutscenes/') || n.endsWith('.cutscene.txt') || n.endsWith('.parallax.txt') || n.endsWith('.procgen.txt') || n.endsWith('.fow.txt') || n.endsWith('.pot')) {
    return 'engine-text';
  }
  if (n.includes('/items/') || n.includes('flare-items/') || n.endsWith('.item.txt') || n.endsWith('.types.txt') || n.endsWith('.qualities.txt') || n.endsWith('.sets.txt')) {
    if (n.endsWith('.types.txt') || n.endsWith('.qualities.txt') || n.endsWith('.sets.txt')) return 'engine-text';
    return 'item';
  }
  if (n.includes('/powers/') || n.includes('flare-powers/')) {
    if (n.includes('effect')) return 'effect';
    return 'power';
  }
  if (n.endsWith('.engine.txt') || n.endsWith('tileset.txt') || n.endsWith('.map.txt') || n.endsWith('.npc.txt') || n.endsWith('.enemy.txt') || n.endsWith('.loot.txt') || n.endsWith('.quest.txt') || n.endsWith('.power.txt')) {
    if (n.endsWith('.map.txt')) return 'map';
    if (n.endsWith('.npc.txt')) return 'npc';
    if (n.endsWith('.enemy.txt')) return 'enemy';
    if (n.endsWith('.loot.txt')) return 'loot';
    if (n.endsWith('.quest.txt')) return 'quest';
    if (n.endsWith('.power.txt')) return 'power';
    return 'engine-text';
  }
  return 'skip';
}

function headerKeys(text: string): string[] {
  const keys: string[] = [];
  let inHeader = false;
  for (const raw of lf(text).split('\n')) {
    const line = raw.trim();
    if (line === '[header]') { inHeader = true; continue; }
    if (inHeader && line.startsWith('[') && line.endsWith(']')) break;
    if (inHeader && line && !line.startsWith('#') && line.includes('=')) keys.push(line.slice(0, line.indexOf('=')));
  }
  return keys;
}

function layerTypes(text: string): string[] {
  const types: string[] = [];
  let inLayer = false;
  for (const raw of lf(text).split('\n')) {
    const line = raw.trim();
    if (line.startsWith('[') && line.endsWith(']')) {
      inLayer = line === '[layer]';
      continue;
    }
    if (inLayer && line.startsWith('type=')) types.push(line.slice(5));
  }
  return types;
}

function sectionCount(text: string, section: string): number {
  return lf(text).split('\n').filter((line) => line.trim() === `[${section}]`).length;
}

function sectionKeys(text: string, section: string): string[][] {
  const blocks: string[][] = [];
  let current: string[] | null = null;
  for (const raw of lf(text).split('\n')) {
    const line = raw.trim();
    if (line.startsWith('[') && line.endsWith(']')) {
      if (current) blocks.push(current);
      current = line === `[${section}]` ? [] : null;
      continue;
    }
    if (current && line && !line.startsWith('#') && line.includes('=')) current.push(line.slice(0, line.indexOf('=')));
  }
  if (current) blocks.push(current);
  return blocks;
}

function itemIds(text: string): string[] {
  const ids: string[] = [];
  let inItem = false;
  for (const raw of lf(text).split('\n')) {
    const line = raw.trim();
    if (line.toLowerCase() === '[item]') { inItem = true; continue; }
    if (line.startsWith('[') && line.endsWith(']')) { inItem = false; continue; }
    if (inItem && line.startsWith('id=')) ids.push(line.slice(3).trim());
  }
  return ids;
}

function assertMapSemantic(file: string, original: string, exported: { text: string; errors: string[] }) {
  expect(exported.errors, file).toEqual([]);
  const lostHeader = headerKeys(original).filter(
    (key) => MAP_HEADER_KEYS.has(key) && !headerKeys(exported.text).includes(key),
  );
  expect(lostHeader, file).toEqual([]);
  const origEvents = sectionKeys(original, 'event');
  const expEvents = sectionKeys(exported.text, 'event');
  expect(expEvents.length, file).toBe(origEvents.length);
  origEvents.forEach((keys, index) => {
    const kept = new Set(expEvents[index]);
    const missing = [...new Set(keys)].filter((key) => key !== 'type' && !kept.has(key));
    expect(missing, `${file} event[${index}]`).toEqual([]);
  });
  const origLayers = layerTypes(original);
  const exportedLayers = layerTypes(exported.text).filter((type) => origLayers.includes(type));
  expect(exportedLayers, file).toEqual(origLayers);
  expect(sectionCount(exported.text, 'enemy'), file).toBe(sectionCount(original, 'enemy'));
  expect(sectionCount(exported.text, 'npc'), file).toBe(sectionCount(original, 'npc'));
}

function roundTrip(kind: Kind, text: string): { mode: 'byte' | 'semantic'; out: string; errors?: string[] } {
  const src = lf(text);
  if (kind === 'npc') return { mode: 'byte', out: mergeNpcFile(src, {}) };
  if (kind === 'quest') return { mode: 'byte', out: mergeQuestText(src, importQuestText(src)) };
  if (kind === 'loot') return { mode: 'byte', out: mergeLootText(src, importLootText(src)) };
  if (kind === 'item') {
    let current = src;
    for (const id of itemIds(src)) current = mergeItemText(current, { id });
    if (itemIds(src).length === 0) current = mergeItemText(src, {});
    return { mode: 'byte', out: current };
  }
  if (kind === 'power') return { mode: 'byte', out: mergePowerText(src, importPowerText(src)) };
  if (kind === 'effect') return { mode: 'byte', out: mergeEffectText(src, importEffectText(src)) };
  if (kind === 'enemy') {
    const normalized = normalizeEnemyText(src).text;
    return { mode: 'byte', out: applyEnemyFileUpdates(normalized, {}).text };
  }
  if (kind === 'map') {
    const exported = exportMapText(importMapText(src));
    return { mode: 'semantic', out: exported.text, errors: exported.errors };
  }
  return { mode: 'byte', out: exportEngineText(importEngineText(src)) };
}

function walkTxt(root: string, acc: string[] = []): string[] {
  for (const name of readdirSync(root)) {
    if (name === '.git') continue;
    const full = path.join(root, name);
    const st = statSync(full);
    if (st.isDirectory()) walkTxt(full, acc);
    else if (name.endsWith('.txt') || name.endsWith('.pot')) acc.push(full);
  }
  return acc;
}

const FIXTURE_FOLDERS = [
  'flare-npcs',
  'flare-quests',
  'flare-loot',
  'flare-items',
  'flare-powers',
  'flare-enemies',
  'flare-maps',
  'flare-engine-files',
  'flare-power-trees',
  'export',
];

describe('committed fixture round-trips', () => {
  const fixtures: Array<{ file: string; kind: Kind; text: string }> = [];
  for (const folder of FIXTURE_FOLDERS) {
    for (const entry of listTxt(fixtureDir(folder))) {
      const rel = `${folder}/${entry.file}`;
      const kind = classify(rel);
      if (kind === 'skip') continue;
      fixtures.push({ file: rel, kind, text: entry.text });
    }
  }

  it('covers every main file kind in the committed subset', () => {
    const kinds = new Set(fixtures.map((f) => f.kind));
    expect([...kinds]).toEqual(expect.arrayContaining(['npc', 'quest', 'loot', 'item', 'power', 'effect', 'enemy', 'map', 'engine-text']));
    expect(fixtures.length).toBeGreaterThan(30);
  });

  it('opens and saves every committed fixture without edits', () => {
    expect(fixtures.length).toBeGreaterThan(0);
    for (const fixture of fixtures) {
      const result = roundTrip(fixture.kind, fixture.text);
      if (result.mode === 'semantic') {
        assertMapSemantic(fixture.file, fixture.text, { text: result.out, errors: result.errors || [] });
      } else {
        expect(result.out, fixture.file).toBe(lf(fixture.text));
      }
    }
  });
});

describe('full flare-game tree round-trip', () => {
  const root = findFlareGame();

  it('opens and saves every supported file when FLARE_GAME or ../flare-game is present', () => {
    if (!root) {
      expect(root, 'no flare-game tree; committed fixtures still ran').toBeNull();
      return;
    }
    const files = walkTxt(root);
    const supported = files
      .map((full) => ({ full, rel: path.relative(root, full), kind: classify(path.relative(root, full)) }))
      .filter((entry) => entry.kind !== 'skip') as Array<{ full: string; rel: string; kind: Kind }>;
    expect(supported.length, root).toBeGreaterThan(50);
    const failures: string[] = [];
    for (const entry of supported) {
      const text = readFileSync(entry.full, 'utf8');
      try {
        const result = roundTrip(entry.kind, text);
        if (result.mode === 'semantic') {
          assertMapSemantic(entry.rel, text, { text: result.out, errors: result.errors || [] });
        } else if (result.out !== lf(text)) {
          failures.push(`${entry.kind} ${entry.rel} (in ${lf(text).length} out ${result.out.length})`);
        }
      } catch (err) {
        failures.push(`${entry.kind} ${entry.rel}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
