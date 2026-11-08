import { describe, expect, it } from 'vitest';
import {
  dialogueSummary,
  dialogueSummaryText,
  questSummary,
  questSummaryText,
  vendorSummary,
  vendorSummaryText,
} from '@/editor/roleSummary';

const trees = JSON.stringify([
  { dialogueId: 'q1_accept', topic: 'The Old Mill', requirements: [{ type: 'status', value: 'met_miller' }], dialogues: [{ text: 'A' }, { text: 'B' }] },
  { dialogueId: 'q1_turnin', topic: 'The Old Mill', dialogues: [{ text: 'C' }] },
  { dialogueId: 'small', topic: 'Small talk', dialogues: [] },
]);

describe('role card summaries', () => {
  it('counts topics and lines from the dialog property', () => {
    const summary = dialogueSummary({ dialogueTrees: trees });
    expect(summary).toEqual({ topics: 3, lines: 3 });
    expect(dialogueSummaryText(summary)).toBe('3 topics · 3 lines');
  });

  it('reads quest name and accept status from the accept topic', () => {
    const summary = questSummary({ dialogueTrees: trees });
    expect(summary).toEqual({ name: 'The Old Mill', acceptStatus: 'met_miller' });
    expect(questSummaryText(summary)).toBe('The Old Mill');
    expect(questSummaryText(null)).toBe('No quest yet');
  });

  it('counts vendor shelves, unlocks and random tables', () => {
    const summary = vendorSummary({
      constant_stock: '1001,1002:3',
      status_stock: 'vip,1003\nquest,1004,1005',
      random_stock: 'loot/chest.txt',
    });
    expect(summary).toEqual({ products: 5, unlocks: 2, random: 1 });
    expect(vendorSummaryText(summary)).toBe('5 products · 2 unlocks · 1 random');
  });

  it('empty vendor and broken dialog data stay calm', () => {
    expect(vendorSummaryText(vendorSummary({}))).toBe('Empty shelf');
    expect(dialogueSummary({ dialogueTrees: 'not json' })).toEqual({ topics: 0, lines: 0 });
    expect(questSummary({ dialogueTrees: 'not json' })).toBeNull();
  });
});
