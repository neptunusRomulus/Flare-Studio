import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importQuestText, mergeQuestText } from '@/adapters/flare/flareAdapter.cjs';
import {
  addQuestStep,
  alignStepsWithRole,
  applyChipsToStep,
  chipLabel,
  chipTooltip,
  chipsFromStep,
  completeStatusKey,
  joinStatusList,
  splitStatusList,
  createFirstStep,
  filterConditionCatalog,
  reorderQuestSteps,
  stepCardTitle,
  stepStatusKey,
  stepsFromImported,
} from './questSteps';

const krolan = () => readFileSync(new URL('../../tests/fixtures/flare-quests/0010_krolan.txt', import.meta.url), 'utf8');

describe('quest step helpers', () => {
  it('builds readable auto status keys from the quest id and step', () => {
    expect(stepStatusKey('0010_krolan', 1)).toBe('0010_krolan_started');
    expect(stepStatusKey('0010_krolan', 2)).toBe('0010_krolan_step_2');
    expect(completeStatusKey('Krolan Quest')).toBe('krolan_quest_complete');
    expect(splitStatusList('emp_main, emp_done')).toEqual(['emp_main', 'emp_done']);
    expect(joinStatusList(['emp_main', '', 'emp_done'])).toBe('emp_main,emp_done');
  });

  it('titles a card from the journal text the player sees', () => {
    expect(stepCardTitle('Travel to the Perdition Mines and look for Krolan.', 0))
      .toBe('1. Travel to the Perdition Mines and look for Krolan');
    expect(stepCardTitle('', 2)).toBe('3. Step');
  });

  it('round-trips condition chips, including item quantities and labels', () => {
    const step = stepsFromImported([
      {
        quest_text: 'Find the key.',
        requires_status: 'quest_started',
        requires_not_status: 'quest_complete',
        requires_level: '5',
        requires_item: 'gold_key:2',
        requires_not_item: 'fake_key',
        show_status: 'hint_found',
      },
    ])[0];
    const chips = chipsFromStep(step);
    const ctx = {
      questId: 'quest',
      acceptStatus: 'quest_started',
      completeStatus: 'quest_complete',
      itemName: (id: string) => (id === 'gold_key' ? 'Sword' : id),
    };
    expect(chips.map((chip) => chipLabel(chip, ctx))).toEqual([
      'Quest accepted',
      'Not: Quest done',
      'Level 5+',
      'Also: hint found',
      'Has Sword ×2',
      'Not: fake_key',
    ]);
    expect(chipTooltip(chips[0])).toBe('requires_status=quest_started');
    expect(chipTooltip(chips.find((chip) => chip.kind === 'requires_item')!)).toBe('requires_item=gold_key:2');
    const back = applyChipsToStep(step, chips);
    expect(back.requires_item).toBe('gold_key:2');
    expect(back.requires_not_status).toBe('quest_complete');
    expect(back.show_status).toBe('hint_found');
  });

  it('adds a chained step and lines accept / turn-in statuses up with the NPC role', () => {
    const ctx = { questId: 'krolan', acceptStatus: 'emp_krolan_init', completeStatus: 'emp_krolan_finish' };
    const first = [createFirstStep(ctx, 'Talk to Krolan.')];
    expect(first[0].requires_status).toBe('emp_krolan_init');
    expect(first[0].requires_not_status).toBe('emp_krolan_finish');

    const two = addQuestStep(first, ctx);
    expect(two).toHaveLength(2);
    expect(two[0].requires_not_status).toBe('krolan_step_2');
    expect(two[1].requires_status).toBe('krolan_step_2');
    expect(two[1].requires_not_status).toBe('emp_krolan_finish');

    const aligned = alignStepsWithRole(two, {
      acceptStatus: 'new_accept',
      completeStatus: 'new_done',
      previousAccept: 'emp_krolan_init',
      previousComplete: 'emp_krolan_finish',
    }, 'krolan');
    expect(aligned[0].requires_status).toBe('new_accept');
    expect(aligned[1].requires_not_status).toBe('new_done');
    expect(aligned[0].requires_not_status).toBe('krolan_step_2');
  });

  it('reorders without dropping a step and keeps a real journal mergeable', () => {
    const imported = importQuestText(krolan()) as { steps: unknown[] };
    const steps = stepsFromImported(imported.steps);
    const moved = reorderQuestSteps(steps, 0, 2);
    expect(moved.map((step) => step.quest_text)).toEqual([
      steps[1].quest_text,
      steps[2].quest_text,
      steps[0].quest_text,
    ]);
    const merged = mergeQuestText(krolan(), { ...imported, steps: moved });
    expect(merged.indexOf('Use Krolan')).toBeLessThan(merged.indexOf("Krolan's death"));
    expect(merged.indexOf("Krolan's death")).toBeLessThan(merged.indexOf('Travel to the Perdition Mines'));
    expect(filterConditionCatalog('level').map((entry) => entry.kind)).toEqual([
      'requires_level',
      'requires_not_level',
    ]);
  });
});
