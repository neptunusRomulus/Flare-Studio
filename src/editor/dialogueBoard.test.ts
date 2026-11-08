import { describe, expect, it } from 'vitest';
import { boardWarningCount, buildDialogueBoard } from '@/editor/dialogueBoard';
import type { DialogueTree } from '@/types';

const tree = (dialogueId: string, topic: string, extra: Partial<DialogueTree> = {}): DialogueTree => ({
  id: `${dialogueId}-id`,
  dialogueId,
  topic,
  responses: [],
  requirements: [],
  dialogues: [{ id: `${dialogueId}-line`, speaker: 'npc', text: 'Hello' }],
  rewards: [],
  worldEffects: [],
  ...extra,
});

describe('dialogue story board', () => {
  it('resolves response targets to topic names', () => {
    const cards = buildDialogueBoard([
      tree('a', 'Greeting', { responses: ['b'] }),
      tree('b', 'Tasks'),
    ]);
    expect(cards[0].links).toEqual([{ dialogueId: 'b', label: 'Tasks' }]);
    expect(cards[1].orphan).toBe(false);
  });

  it('warns about missing targets, duplicate ids and empty topics', () => {
    const cards = buildDialogueBoard([
      tree('a', 'Greeting', { responses: ['ghost'] }),
      tree('a', 'Copy', { dialogues: [] }),
      tree('', 'No id'),
    ]);
    expect(cards[0].warnings).toEqual(['Duplicate dialogue id', 'Missing target: ghost']);
    expect(cards[1].warnings).toContain('No lines yet');
    expect(cards[2].warnings).toContain('No dialogue id');
    expect(boardWarningCount(cards)).toBeGreaterThan(3);
  });

  it('marks unreferenced topics as orphans but keeps response-only nodes quiet', () => {
    const cards = buildDialogueBoard([
      tree('a', 'Root'),
      tree('b', 'Child'),
      tree('c', 'Hidden', { responseOnly: true }),
    ]);
    expect(cards.map((card) => card.orphan)).toEqual([true, true, false]);
  });
});
