import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applyEnemyFileUpdates,
  exportMapText,
  importEffectText,
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

const fixtureDir = (name: string) => new URL(`../../../tests/fixtures/${name}/`, import.meta.url);

function fixtureFiles(name: string): Array<{ file: string; text: string }> {
  const dir = fixtureDir(name);
  return readdirSync(dir)
    .filter((file) => file.endsWith('.txt'))
    .map((file) => ({ file, text: readFileSync(new URL(file, dir), 'utf8') }));
}

function itemIds(text: string): string[] {
  const ids: string[] = [];
  let inItem = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.toLowerCase() === '[item]') { inItem = true; continue; }
    if (line.startsWith('[') && line.endsWith(']')) { inItem = false; continue; }
    if (inItem && line.startsWith('id=')) ids.push(line.slice(3).trim());
  }
  return ids;
}

function headerKeys(text: string): string[] {
  const keys: string[] = [];
  let inHeader = false;
  for (const raw of text.split('\n')) {
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
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('[') && line.endsWith(']')) {
      inLayer = line === '[layer]';
      continue;
    }
    if (inLayer && line.startsWith('type=')) types.push(line.slice(5));
  }
  return types;
}

function sectionKeys(text: string, section: string): string[][] {
  const blocks: string[][] = [];
  let current: string[] | null = null;
  for (const raw of text.split('\n')) {
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

describe('flare-game fixture round-trips', () => {
  it('merges NPC, quest, loot, item, power and effect fixtures without edits', () => {
    for (const { file, text } of fixtureFiles('flare-npcs')) {
      expect(mergeNpcFile(text, {}), file).toBe(text);
    }
    for (const { file, text } of fixtureFiles('flare-quests')) {
      expect(mergeQuestText(text, importQuestText(text)), file).toBe(text);
    }
    for (const { file, text } of fixtureFiles('flare-loot')) {
      expect(mergeLootText(text, importLootText(text)), file).toBe(text);
    }
    for (const { file, text } of fixtureFiles('flare-items')) {
      let current = text;
      for (const id of itemIds(text)) {
        const next = mergeItemText(current, { id });
        expect(next, `${file} id=${id}`).toBe(current);
        current = next;
      }
    }
    for (const { file, text } of fixtureFiles('flare-powers')) {
      if (file === 'effects.txt') {
        expect(mergeEffectText(text, importEffectText(text)), file).toBe(text);
      } else {
        expect(mergePowerText(text, importPowerText(text)), file).toBe(text);
      }
    }
    for (const { file, text } of fixtureFiles('flare-enemies')) {
      expect(normalizeEnemyText(text).text, file).toBe(text);
      expect(applyEnemyFileUpdates(text, {}).text, file).toBe(text);
    }
  });

  it('keeps map header keys, event keys and layer order on fixture export', () => {
    for (const { file, text } of fixtureFiles('flare-maps')) {
      const exported = exportMapText(importMapText(text));
      expect(exported.errors, file).toEqual([]);
      const lostHeader = headerKeys(text).filter((key) => !headerKeys(exported.text).includes(key));
      expect(lostHeader, file).toEqual([]);
      const origEvents = sectionKeys(text, 'event');
      const expEvents = sectionKeys(exported.text, 'event');
      expect(expEvents.length, file).toBe(origEvents.length);
      origEvents.forEach((keys, index) => {
        const kept = new Set(expEvents[index]);
        const missing = [...new Set(keys)].filter((key) => key !== 'type' && !kept.has(key));
        expect(missing, `${file} event[${index}]`).toEqual([]);
      });
      const origLayers = layerTypes(text);
      const exportedLayers = layerTypes(exported.text).filter((type) => origLayers.includes(type));
      expect(exportedLayers, file).toEqual(origLayers);
    }
  });
});
