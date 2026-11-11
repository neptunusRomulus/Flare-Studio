import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import QuestMapView from '@/components/QuestMapView';
import { deriveQuestGraph } from '@/editor/questMap';

describe('QuestMapView', () => {
  const graph = deriveQuestGraph(
    [{ id: 'rats', name: 'Rat Trouble', complete_status: 'rats_done', steps: [{ quest_text: 'Kill the rats. Then return.', requires_status: 'rats_started' }] }],
    [{
      id: 'npcs/guard.txt',
      name: 'Guard',
      locations: [{ mapTitle: 'Town', x: 4, y: 7 }],
      dialogs: [
        { requirements: [], worldEffects: [{ type: 'set_status', value: 'rats_started' }] },
        { requirements: [{ type: 'status', value: 'rats_started' }], worldEffects: [{ type: 'set_status', value: 'rats_done' }] },
      ],
    }],
  );
  const noop = () => {};

  it('renders quest cards, NPC cards and connector labels', () => {
    const html = renderToStaticMarkup(
      <QuestMapView graph={graph} positions={{}} onPositionsChange={noop} onOpenQuest={noop} onOpenNpc={noop} onClose={noop} />,
    );
    expect(html).toContain('Rat Trouble');
    expect(html).toContain('1. Kill the rats');
    expect(html).toContain('Guard');
    expect(html).toContain('Town 4,7');
    expect(html).toContain('Accepted · Done');
    expect(html).toContain('<path');
  });

  it('shows an empty state without quests', () => {
    const html = renderToStaticMarkup(
      <QuestMapView graph={{ quests: [], npcs: [], events: [], edges: [] }} positions={{}} onPositionsChange={noop} onOpenQuest={noop} onOpenNpc={noop} onClose={noop} />,
    );
    expect(html).toContain('No quests yet');
  });
});
