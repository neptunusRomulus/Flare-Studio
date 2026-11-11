import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MomentChatView from './MomentChatView';
import { otherMoment } from '@/editor/roleMoments';
import type { DialogueTree } from '@/types';

const trees: DialogueTree[] = [
  {
    id: 'a', dialogueId: 'a', topic: 'Greeting', responses: ['b'],
    requirements: [{ id: 'r1', type: 'not_status', value: 'met' }],
    dialogues: [
      { id: 'l1', speaker: 'npc', text: 'Welcome, traveler.' },
      { id: 'l2', speaker: 'npc', text: 'Need anything?' },
      { id: 'l3', speaker: 'player', text: 'Just looking.' },
    ],
    rewards: [{ id: 'x', type: 'xp', value: '10' }],
    worldEffects: [{ id: 'e', type: 'set_status', value: 'met' }],
  },
  {
    id: 'b', dialogueId: 'b', topic: 'Work', responses: [], requirements: [],
    dialogues: [{ id: 'l4', speaker: 'player', text: 'Any work?' }], rewards: [], worldEffects: [],
  },
];

describe('MomentChatView', () => {
  it('renders a minimal chat: one avatar per NPC run, meta icons, effect pills, answers and a composer', () => {
    const html = renderToStaticMarkup(
      <MomentChatView trees={trees} visibleTrees={trees} setTrees={() => {}} moment={otherMoment()} npcName="Martigan" />,
    );
    // Avatar fallback initial only on the first bubble of the NPC run (+1 in the composer speaker toggle).
    expect(html.match(/>M<\/span>/g)?.length).toBe(2);
    expect(html).toContain('Welcome, traveler.');
    expect(html).toContain('aria-label="Conditions"');
    expect(html).toContain('+10 XP');
    expect(html).toContain('Any work?');
    expect(html).toContain('justify-end');
    expect(html).toContain('id="chat-topic-b"');
    expect(html).toContain('Type NPC line…');
    expect(html).not.toContain('<textarea rows="1" value="Welcome');
  });
});
