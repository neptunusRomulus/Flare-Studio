import { describe, expect, it } from 'vitest';
import { cleanDialogueTreesForSave } from './dialogueTreesClean';
import type { DialogueTree } from '@/types';

describe('cleanDialogueTreesForSave', () => {
  it('drops empty trees and lines and strips editor-only fields', () => {
    const trees = [
      { id: 'a', topic: 'Hi', _expanded: true, requirements: [], dialogues: [{ id: 'l1', speaker: 'npc', text: 'Hello' }, { id: 'l2', speaker: 'player', text: '' }] },
      { id: 'b', topic: '', requirements: [], dialogues: [{ id: 'l3', speaker: 'npc', text: 'x' }] },
    ] as unknown as DialogueTree[];
    const clean = cleanDialogueTreesForSave(trees);
    expect(clean).toHaveLength(1);
    expect(clean[0].dialogues).toHaveLength(1);
    expect(Object.keys(clean[0])).not.toContain('_expanded');
  });
});
