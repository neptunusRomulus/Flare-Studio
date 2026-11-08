import { describe, expect, it } from 'vitest';
import {
  buildQuestFlowTrees,
  questAcceptDialogueId,
  questClaimedStatus,
  questFlowFromLegacy,
  questTurnInDialogueId,
  readQuestFlowTrees,
  type QuestFlowInput,
} from './questFlow';
import type { DialogueTree } from '@/types';
import { exportNpcFile } from '@/adapters/flare/flareAdapter.cjs';

const base: QuestFlowInput = {
  questId: 'old_mill',
  questName: 'The Old Mill',
  acceptStatus: 'mill_started',
  completeStatus: 'mill_complete',
  prereqStatus: 'met_miller',
  turnInMode: 'accept',
  oneTimeReward: true,
  acceptLine: 'Bring me the key.',
  turnInLine: 'You found it!',
  xp: '150',
  currency: '40',
  items: [{ id: '1001', quantity: '2' }, { id: '', quantity: '1' }],
};

describe('buildQuestFlowTrees', () => {
  it('writes accept status, prereq, and a journal-safe open condition', () => {
    const [accept] = buildQuestFlowTrees(base);
    expect(accept.dialogueId).toBe(questAcceptDialogueId('old_mill'));
    expect(accept.topic).toBe('The Old Mill');
    expect(accept.requirements).toEqual([
      expect.objectContaining({ type: 'status', value: 'met_miller' }),
      expect.objectContaining({ type: 'not_status', value: 'mill_complete' }),
    ]);
    expect(accept.worldEffects).toEqual([expect.objectContaining({ type: 'set_status', value: 'mill_started' })]);
    expect(accept.dialogues[0].text).toBe('Bring me the key.');
  });

  it('turn-in sets complete and gives xp/currency/items', () => {
    const trees = buildQuestFlowTrees(base);
    const turnIn = trees.find((tree) => tree.dialogueId === questTurnInDialogueId('old_mill'))!;
    expect(turnIn.requirements).toEqual([
      expect.objectContaining({ type: 'status', value: 'mill_started' }),
      expect.objectContaining({ type: 'not_status', value: 'mill_complete' }),
    ]);
    expect(turnIn.worldEffects).toEqual([expect.objectContaining({ type: 'set_status', value: 'mill_complete' })]);
    expect(turnIn.rewards).toEqual([
      expect.objectContaining({ type: 'xp', value: '150' }),
      expect.objectContaining({ type: 'gold', value: '40' }),
      expect.objectContaining({ type: 'item', value: '1001', quantity: 2 }),
    ]);
  });

  it('objective-complete mode gates on complete and prevents repeat rewards', () => {
    const trees = buildQuestFlowTrees({ ...base, turnInMode: 'complete' });
    const turnIn = trees.find((tree) => tree.dialogueId === questTurnInDialogueId('old_mill'))!;
    expect(turnIn.requirements).toEqual([
      expect.objectContaining({ type: 'status', value: 'mill_complete' }),
      expect.objectContaining({ type: 'not_status', value: questClaimedStatus('old_mill') }),
    ]);
    expect(turnIn.worldEffects).toEqual([expect.objectContaining({ type: 'set_status', value: questClaimedStatus('old_mill') })]);
  });

  it('is repeatable when the guard is off', () => {
    const trees = buildQuestFlowTrees({ ...base, oneTimeReward: false });
    expect(trees[0].requirements.every((req) => req.type !== 'not_status')).toBe(true);
    const turnIn = trees.find((tree) => tree.dialogueId === questTurnInDialogueId('old_mill'))!;
    expect(turnIn.requirements.every((req) => req.type !== 'not_status')).toBe(true);
  });

  it('keeps hand-made lines, portraits and unmanaged effects', () => {
    const existing: DialogueTree[] = [
      {
        id: 'x',
        dialogueId: questAcceptDialogueId('old_mill'),
        topic: 'Old',
        responses: [],
        requirements: [{ id: 'r', type: 'item', value: '15' }],
        dialogues: [
          { id: 'l1', speaker: 'npc', text: 'Old line', voice: 'voice.ogg' },
          { id: 'l2', speaker: 'player', text: 'Extra line' },
        ],
        rewards: [],
        worldEffects: [{ id: 'e', type: 'sound', value: 'bell.ogg' }],
      },
    ];
    const [accept] = buildQuestFlowTrees(base, existing);
    expect(accept.dialogues[0]).toEqual(expect.objectContaining({ id: 'l1', text: 'Bring me the key.', voice: 'voice.ogg' }));
    expect(accept.dialogues[1]).toEqual(expect.objectContaining({ id: 'l2', text: 'Extra line' }));
    expect(accept.requirements).toContainEqual(expect.objectContaining({ type: 'item', value: '15' }));
    expect(accept.worldEffects).toEqual([
      expect.objectContaining({ type: 'sound', value: 'bell.ogg' }),
      expect.objectContaining({ type: 'set_status', value: 'mill_started' }),
    ]);
  });

  it('updates in place instead of duplicating topics', () => {
    const first = buildQuestFlowTrees(base);
    const second = buildQuestFlowTrees({ ...base, acceptLine: 'New line' }, first);
    expect(second).toHaveLength(2);
    expect(second[0].dialogues[0].text).toBe('New line');
  });

  it('serializes to real Flare dialog keys', () => {
    const text = exportNpcFile({
      name: 'Miller',
      customProperties: { dialogueTrees: buildQuestFlowTrees(base) },
    });
    const accept = text.split('[dialog]')[1] || '';
    const turnIn = text.split('[dialog]')[2] || '';
    expect(accept).toContain('topic=The Old Mill');
    expect(accept).toContain('requires_status=met_miller');
    expect(accept).toContain('requires_not_status=mill_complete');
    expect(accept).toContain('set_status=mill_started');
    expect(accept).toContain('him=Bring me the key.');
    expect(turnIn).toContain('topic=The Old Mill (turn in)');
    expect(turnIn).toContain('set_status=mill_complete');
    expect(turnIn).toContain('reward_xp=150');
    expect(turnIn).toContain('reward_currency=40');
    expect(turnIn).toContain('reward_item=1001:2');
  });
});

describe('readQuestFlowTrees', () => {
  it('round-trips the form values', () => {
    const found = readQuestFlowTrees(buildQuestFlowTrees(base))!;
    expect(found).toEqual(expect.objectContaining({
      questId: 'old_mill',
      questName: 'The Old Mill',
      acceptStatus: 'mill_started',
      completeStatus: 'mill_complete',
      prereqStatus: 'met_miller',
      turnInMode: 'accept',
      oneTimeReward: true,
      acceptLine: 'Bring me the key.',
      turnInLine: 'You found it!',
      xp: '150',
      currency: '40',
      items: [{ id: '1001', quantity: '2' }],
    }));
  });

  it('detects a claimed objective-complete quest', () => {
    const found = readQuestFlowTrees(buildQuestFlowTrees({ ...base, turnInMode: 'complete' }))!;
    expect(found.turnInMode).toBe('complete');
    expect(found.completeStatus).toBe('mill_complete');
    expect(found.oneTimeReward).toBe(true);
  });

  it('returns null for NPCs without quest topics', () => {
    expect(readQuestFlowTrees([])).toBeNull();
  });
});

describe('questFlowFromLegacy', () => {
  it('migrates the old Studio-only props', () => {
    const flow = questFlowFromLegacy('Miller Bob', { requires: 'met_miller', set: 'mill_started', loot: 'a,b,1001' });
    expect(flow.prereqStatus).toBe('met_miller');
    expect(flow.acceptStatus).toBe('mill_started');
    expect(flow.items).toEqual([{ id: '1001', quantity: '1' }]);
  });
});
