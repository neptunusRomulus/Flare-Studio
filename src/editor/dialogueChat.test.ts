import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import type { DialogueTree } from '@/types';
import {
  addCondition,
  chatBubbleMeta,
  chatResponses,
  conditionChipLabel,
  removeAction,
  removeCondition,
  updateCondition,
} from './dialogueChat';
import { reorderDialogueLines } from './dialogueLines';

const require = createRequire(import.meta.url);
const { importNpcText, exportNpcFile, mergeNpcFile } = require('../adapters/flare/serializers.cjs');

const FIXTURES = path.resolve(__dirname, '../../tests/fixtures/flare-npcs');
const files = fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.txt') && fs.readFileSync(path.join(FIXTURES, f), 'utf8').includes('[dialog]'));
const read = (file: string) => {
  const t = fs.readFileSync(path.join(FIXTURES, file), 'utf8').replace(/\r/g, '');
  return t.endsWith('\n') ? t : `${t}\n`;
};
type Npc = { customProperties: { dialogueTrees: DialogueTree[] } };
const withTrees = (npc: Npc, dialogueTrees: DialogueTree[]) => ({ ...npc, customProperties: { ...npc.customProperties, dialogueTrees } });

describe('chat editor keeps flare-game NPC files byte-identical', () => {
  it.each(files)('%s: touching every chip and line in place changes nothing', (file) => {
    const text = read(file);
    const npc = importNpcText(text) as Npc;
    if (!npc.customProperties.dialogueTrees) return;
    const trees = npc.customProperties.dialogueTrees.map((tree) => {
      let next = tree;
      (tree.requirements || []).forEach((req, i) => { next = updateCondition(next, i, req.value); });
      (tree.dialogues || []).forEach((_, i) => { next = reorderDialogueLines(next, i, i); });
      return next;
    });
    expect(exportNpcFile(withTrees(npc, trees))).toBe(text);
    expect(mergeNpcFile(text, { dialogueTrees: trees })).toBe(text);
  });

  it.each(files)('%s: adding a condition and removing it again restores the file', (file) => {
    const text = read(file);
    const npc = importNpcText(text) as Npc;
    if (!npc.customProperties.dialogueTrees) return;
    const trees = npc.customProperties.dialogueTrees.map((tree) => {
      const added = updateCondition(addCondition(tree, 'level', 'tmp'), (tree.requirements || []).length, '3');
      return removeCondition(added, (added.requirements || []).length - 1);
    });
    expect(exportNpcFile(withTrees(npc, trees))).toBe(text);
  });
});

describe('chat deletes remove only their own line', () => {
  const text = '[dialog]\nid=a\nrequires_status=x\nrequires_level=2\nrequires_not_status=y\nhim=Hi\nreward_xp=5\nset_status=z\nreward_currency=7\nyou=Bye\n';

  it('removes a middle condition without moving the others', () => {
    const npc = importNpcText(text) as Npc;
    const tree = removeCondition(npc.customProperties.dialogueTrees[0], 1);
    expect(exportNpcFile(withTrees(npc, [tree]))).toBe(text.replace('requires_level=2\n', ''));
  });

  it('removes a reward or an effect in place', () => {
    const npc = importNpcText(text) as Npc;
    const tree = npc.customProperties.dialogueTrees[0];
    expect(exportNpcFile(withTrees(npc, [removeAction(tree, 'reward', 0)]))).toBe(text.replace('reward_xp=5\n', ''));
    expect(exportNpcFile(withTrees(npc, [removeAction(tree, 'effect', 0)]))).toBe(text.replace('set_status=z\n', ''));
  });

  it('a new condition is written with the other conditions', () => {
    const npc = importNpcText(text) as Npc;
    const tree = updateCondition(addCondition(npc.customProperties.dialogueTrees[0], 'class'), 3, 'warrior');
    const out = exportNpcFile(withTrees(npc, [tree]));
    expect(out).toContain('requires_class=warrior');
    expect(out.indexOf('requires_class=warrior')).toBeLessThan(out.indexOf('him=Hi'));
  });
});

describe('chat bubble layout', () => {
  it('puts NPC left with the current portrait and player right, avatar only on a new run', () => {
    const lines = [
      { id: '1', speaker: 'npc' as const, text: 'a' },
      { id: '2', speaker: 'npc' as const, text: 'b', portrait: 'images/portraits/sad.png', portraitKey: 'portrait_him' as const },
      { id: '3', speaker: 'player' as const, text: 'c' },
      { id: '4', speaker: 'npc' as const, text: 'd' },
    ];
    expect(chatBubbleMeta(lines, 'images/portraits/npc.png')).toEqual([
      { side: 'left', startsRun: true, portrait: 'images/portraits/npc.png' },
      { side: 'left', startsRun: false, portrait: 'images/portraits/sad.png' },
      { side: 'right', startsRun: true, portrait: '' },
      { side: 'left', startsRun: true, portrait: 'images/portraits/sad.png' },
    ]);
  });

  it('labels answers by the target topic and flags missing targets', () => {
    const trees = [
      { id: 'a', dialogueId: 'a', topic: 'Hi', responses: ['b', 'zz'], requirements: [], dialogues: [], rewards: [], worldEffects: [] },
      { id: 'b', dialogueId: 'b', topic: 'Quest', responses: [], requirements: [], dialogues: [{ id: 'l', speaker: 'player' as const, text: 'Any work?' }], rewards: [], worldEffects: [] },
    ];
    expect(chatResponses(trees[0], trees)).toEqual([
      { id: 'b', label: 'Any work?', missing: false },
      { id: 'zz', label: 'zz', missing: true },
    ]);
    expect(conditionChipLabel({ id: 'r', type: 'not_status', value: 'done' })).toBe('Status is off: done');
  });
});
