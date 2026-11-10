import { describe, expect, it } from 'vitest';
import type { DialogueTree } from '@/types';
import {
  applyTopicActions,
  emptyPlayState,
  togglePlayStatus,
  topicIsVisible,
  visibleTopics,
} from './dialogPlay';

const tree = (id: string, patch: Partial<DialogueTree> = {}): DialogueTree => ({
  id,
  dialogueId: id,
  topic: id,
  responses: [],
  requirements: [],
  dialogues: [],
  rewards: [],
  worldEffects: [],
  ...patch,
});

describe('dialog play simulation', () => {
  it('shows a topic only when status, level, item and currency conditions match', () => {
    const quest = tree('krolan', {
      requirements: [
        { id: '1', type: 'status', value: 'emp_krolan_init' },
        { id: '2', type: 'not_status', value: 'emp_krolan_finish' },
        { id: '3', type: 'item', value: '1001:1' },
        { id: '4', type: 'level', value: '3' },
        { id: '5', type: 'currency', value: '10' },
      ],
    });
    const start = emptyPlayState({ level: 1, currency: 0 });
    expect(topicIsVisible(quest, start)).toBe(false);
    const ready = emptyPlayState({
      statuses: ['emp_krolan_init'],
      items: { '1001': 1 },
      level: 5,
      currency: 40,
    });
    expect(topicIsVisible(quest, ready)).toBe(true);
    expect(topicIsVisible(quest, { ...ready, statuses: ['emp_krolan_init', 'emp_krolan_finish'] })).toBe(false);
    expect(visibleTopics([quest, tree('always')], ready).map((entry) => entry.dialogueId)).toEqual(['krolan', 'always']);
  });

  it('applies set/unset status, item, currency and random_status without writing files', () => {
    const topic = tree('turn-in', {
      rewards: [
        { id: 'xp', type: 'xp', value: '50' },
        { id: 'gold', type: 'gold', value: '25' },
        { id: 'sword', type: 'item', value: 'sword' },
      ],
      worldEffects: [
        { id: 'set', type: 'set_status', value: 'emp_krolan_finish' },
        { id: 'clear', type: 'unset_status', value: 'emp_krolan_init' },
      ],
    });
    const after = applyTopicActions(topic, emptyPlayState({ statuses: ['emp_krolan_init'], currency: 5 }));
    expect(after.statuses).toEqual(['emp_krolan_finish']);
    expect(after.currency).toBe(30);
    expect(after.items.sword).toBe(1);

    const rolled = applyTopicActions(
      tree('rand', {
        worldEffects: [
          { id: 'c', type: 'random_status', value: 'clear' },
          { id: 'a', type: 'random_status', value: 'append,alpha' },
          { id: 'b', type: 'random_status', value: 'append,beta' },
          { id: 'r', type: 'random_status', value: 'roll' },
        ],
      }),
      emptyPlayState(),
      () => 0.9,
    );
    expect(rolled.statuses).toEqual(['beta']);
    expect(togglePlayStatus(emptyPlayState(), 'flag', true).statuses).toEqual(['flag']);
  });

  it('hides response-only topics from the offer list', () => {
    expect(topicIsVisible(tree('hidden', { responseOnly: true }), emptyPlayState())).toBe(false);
  });
});
