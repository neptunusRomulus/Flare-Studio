import { describe, expect, it } from 'vitest';
import type { DialogueTree } from '@/types';
import {
  addCustomMoment,
  applyMomentToTopic,
  assignTopicsToMoments,
  buildMoments,
  matchMoment,
  OTHER_MOMENT_ID,
  topicsForMoment,
} from './roleMoments';
import { stepsFromImported } from './questSteps';

const tree = (id: string, reqs: Array<{ type: 'status' | 'not_status' | 'item'; value: string }>): DialogueTree => ({
  id,
  dialogueId: id,
  topic: id,
  responses: [],
  requirements: reqs.map((req, index) => ({ id: `${id}-${index}`, ...req })),
  dialogues: [],
  rewards: [],
  worldEffects: [],
});

describe('role moments mapping', () => {
  const steps = stepsFromImported([
    { requires_status: 'emp_krolan_init', requires_not_status: 'emp_krolan_key', quest_text: 'Travel to the mines.' },
    { requires_status: 'emp_krolan_key', requires_not_status: 'emp_krolan_emerald', quest_text: 'Search his chest.' },
    { requires_status: 'emp_krolan_emerald', requires_not_status: 'emp_krolan_finish', quest_text: 'Return to Udana.' },
  ]);
  const quest = { questId: 'krolan', acceptStatus: 'emp_krolan_init', completeStatus: 'emp_krolan_finish', oneTimeReward: true };
  const moments = buildMoments({ quest, steps });

  it('builds First meeting, journal steps, Quest done and After from the quest role', () => {
    expect(moments.map((moment) => moment.title)).toEqual([
      'First meeting',
      'Quest given',
      'Search his chest',
      'Return to Udana',
      'Quest done',
      'After',
    ]);
    expect(moments[0].requiresNotStatus).toEqual(['emp_krolan_init']);
    expect(moments[1].requiresStatus).toEqual(['emp_krolan_init']);
    expect(moments.find((moment) => moment.source === 'quest-done')?.key).toBe('emp_krolan_finish');
    expect(moments.find((moment) => moment.source === 'after')?.key).toBe('krolan_rewarded');
  });

  it('lands existing topics in the matching moment and sends unmatched ones to Other', () => {
    const trees = [
      tree('talk-first', [{ type: 'not_status', value: 'emp_krolan_init' }, { type: 'not_status', value: 'emp_krolan_finish' }]),
      tree('krolan-open', [{ type: 'status', value: 'emp_krolan_init' }, { type: 'item', value: '1001' }]),
      tree('krolan-emerald', [{ type: 'status', value: 'emp_krolan_init' }, { type: 'status', value: 'emp_krolan_emerald' }]),
      tree('done-talk', [{ type: 'status', value: 'emp_krolan_finish' }]),
      tree('cave-key', [{ type: 'status', value: 'emp_il_entrance_key' }]),
    ];
    const assignment = assignTopicsToMoments(trees, moments);
    expect(assignment.topicMoment['talk-first']).toBe(moments[0].id);
    expect(assignment.topicMoment['krolan-open']).toBe(moments[1].id);
    expect(assignment.topicMoment['krolan-emerald']).toBe(moments[3].id);
    expect(assignment.topicMoment['done-talk']).toBe(moments.find((moment) => moment.source === 'quest-done')!.id);
    expect(assignment.topicMoment['cave-key']).toBe(OTHER_MOMENT_ID);
    expect(topicsForMoment(trees, assignment, OTHER_MOMENT_ID).map((entry) => entry.dialogueId)).toEqual(['cave-key']);
    expect(topicsForMoment(trees, assignment, moments[1].id)[0].requirements.some((req) => req.type === 'item')).toBe(true);
  });

  it('round-trips a topic through applyMomentToTopic and matchMoment', () => {
    const given = moments.find((moment) => moment.source === 'quest-given')!;
    const original = tree('krolan-open', [{ type: 'status', value: 'old' }, { type: 'item', value: '1001' }]);
    const written = applyMomentToTopic(original, given);
    expect(written.requirements.filter((req) => req.type === 'item')).toEqual([{ id: 'krolan-open-1', type: 'item', value: '1001' }]);
    expect(matchMoment(written.requirements, moments).id).toBe(given.id);

    const other = applyMomentToTopic(written, { id: OTHER_MOMENT_ID, title: 'Other', key: '', requiresStatus: [], requiresNotStatus: [], source: 'other', isOther: true });
    expect(other.requirements.every((req) => req.type !== 'status' && req.type !== 'not_status')).toBe(true);
    expect(matchMoment(other.requirements, moments).isOther).toBe(true);
  });

  it('adds a custom moment with an auto key that is not shown as the title', () => {
    const next = addCustomMoment(moments, 'Udana');
    const added = next[next.length - 1];
    expect(added.title).toBe('Moment 1');
    expect(added.key).toBe('udana_moment_1');
    expect(added.requiresStatus).toEqual(['udana_moment_1']);
    const written = applyMomentToTopic(tree('new-talk', []), added);
    expect(matchMoment(written.requirements, next).id).toBe(added.id);
  });
});
