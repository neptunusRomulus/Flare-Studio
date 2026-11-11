import { describe, expect, it } from 'vitest';
import { HELP_SHORTCUTS, HELP_TOPICS, filterHelpShortcuts, filterHelpTopics } from './helpTopics';

describe('help topics', () => {
  it('keeps cards short (max 2 sentences) and ids unique', () => {
    const ids = new Set(HELP_TOPICS.map((t) => t.id));
    expect(ids.size).toBe(HELP_TOPICS.length);
    for (const t of HELP_TOPICS) {
      const sentences = t.text.split(/[.!?](?:\s|$)/).filter((s) => s.trim());
      expect(sentences.length, t.id).toBeLessThanOrEqual(2);
    }
  });

  it('search matches title, text and synonyms, all words required', () => {
    expect(filterHelpTopics('').length).toBe(HELP_TOPICS.length);
    expect(filterHelpTopics('vendor').map((t) => t.id)).toContain('npcs');
    expect(filterHelpTopics('monster').map((t) => t.id)).toEqual(['enemies']);
    expect(filterHelpTopics('FONT size').map((t) => t.id)).toEqual(['display']);
    expect(filterHelpTopics('quest board').map((t) => t.id)).toEqual(['quest-map']);
    expect(filterHelpTopics('zzzz')).toEqual([]);
  });

  it('search filters shortcuts by key or action', () => {
    expect(filterHelpShortcuts('undo').map((s) => s.label)).toEqual(['Undo']);
    expect(filterHelpShortcuts('tab').length).toBe(2);
    expect(filterHelpShortcuts('shortcut').length).toBe(HELP_SHORTCUTS.length);
  });
});
