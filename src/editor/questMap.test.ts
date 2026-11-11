import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importNpcText, importQuestText } from '../adapters/flare/flareAdapter.cjs';
import {
  connectorPath,
  deriveQuestGraph,
  layoutQuestGraph,
  locationText,
  npcNodeId,
  parseQuestMapPositions,
  plainStatusName,
  primaryKind,
  questDepths,
  questNodeId,
  serializeQuestMapPositions,
  type QuestMapNpcInput,
  type QuestMapQuestInput,
} from '@/editor/questMap';

const fixture = (path: string) => readFileSync(`tests/fixtures/${path}`, 'utf8');

function quest(id: string, file: string): QuestMapQuestInput {
  const parsed = importQuestText(fixture(`flare-quests/${file}`)) as QuestMapQuestInput;
  return { ...parsed, id };
}

function npc(file: string, locations: QuestMapNpcInput['locations'] = []): QuestMapNpcInput {
  const parsed = importNpcText(fixture(`flare-npcs/${file}`)) as {
    name?: string;
    portrait?: string;
    customProperties: { dialogueTrees?: QuestMapNpcInput['dialogs'] };
  };
  return {
    id: `npcs/${file}`,
    name: parsed.name || file,
    portrait: parsed.portrait,
    dialogs: parsed.customProperties.dialogueTrees || [],
    locations,
  };
}

describe('deriveQuestGraph with flare-game files', () => {
  const quests = [quest('0011_alchemy', '0011_alchemy.txt'), quest('0010_krolan', '0010_krolan.txt'), quest('0000_empyrean', '0000_empyrean.txt')];
  const npcs = [
    npc('florin.txt', [{ mapTitle: 'Perdition Harbor', x: 54, y: 82 }]),
    npc('udana.txt'),
    npc('kayl.txt'),
  ];
  const graph = deriveQuestGraph(quests, npcs);

  it('reads steps and statuses from multi-stage journals', () => {
    const alchemy = graph.quests.find((q) => q.questId === '0011_alchemy')!;
    expect(alchemy.steps).toHaveLength(5);
    expect(alchemy.steps[0]).toMatch(/^1\. Florin requested a sample/);
    expect(alchemy.startStatuses).toEqual(['emp_alchemy_init']);
    expect(alchemy.completeStatus).toBe('emp_alchemy_finish');
    const krolan = graph.quests.find((q) => q.questId === '0010_krolan')!;
    expect(krolan.startStatuses).toEqual(['emp_krolan_init']);
    expect(krolan.stepStatuses).toEqual(['emp_krolan_key', 'emp_krolan_emerald']);
  });

  it('finds who starts and ends a quest from set_status', () => {
    const alchemy = graph.quests.find((q) => q.questId === '0011_alchemy')!;
    expect(alchemy.starters).toEqual(['npcs/florin.txt']);
    expect(alchemy.finishers).toEqual(['npcs/florin.txt']);
    const krolan = graph.quests.find((q) => q.questId === '0010_krolan')!;
    expect(krolan.starters).toEqual(['npcs/udana.txt']);
    expect(krolan.finishers).toEqual(['npcs/udana.txt']);
  });

  it('merges links between the same pair into one labeled connector', () => {
    const edge = graph.edges.find((e) => e.id === [npcNodeId('npcs/florin.txt'), questNodeId('0011_alchemy')].sort().join('|'))!;
    expect(edge.links.map((l) => l.kind)).toEqual(['starts', 'ends']);
    expect(edge.label).toBe('Accepted · Done');
    expect(edge.tooltip).toBe('Starts: emp_alchemy_init\nEnds: emp_alchemy_finish');
    expect(primaryKind(edge.links)).toBe('starts');
  });

  it('marks NPCs that move a quest forward or only talk about it', () => {
    const empyrean = graph.edges.find((e) => e.id === [npcNodeId('npcs/florin.txt'), questNodeId('0000_empyrean')].sort().join('|'))!;
    expect(empyrean.links.some((l) => l.kind === 'advances' && l.status === 'emp_main_info1')).toBe(true);
  });

  it('keeps only NPCs with a link and shows their location', () => {
    const florin = graph.npcs.find((n) => n.npcId === 'npcs/florin.txt')!;
    expect(florin.location).toBe('Perdition Harbor 54,82');
    expect(florin.portrait).toBe('images/portraits/male02.png');
    expect(graph.npcs.find((n) => n.npcId === 'npcs/udana.txt')!.location).toBe('Not placed');
    for (const n of graph.npcs) expect(graph.edges.some((e) => e.from === n.nodeId || e.to === n.nodeId)).toBe(true);
  });
});

describe('quest chains', () => {
  const quests: QuestMapQuestInput[] = [
    { id: 'rats', name: 'Rats', complete_status: 'rats_done', steps: [{ quest_text: 'Kill the rats.', requires_status: 'rats_started' }] },
    { id: 'wolves', name: 'Wolves', complete_status: 'wolves_done', steps: [{ quest_text: 'Hunt wolves.', requires_status: 'wolves_started' }] },
    { id: 'boss', name: 'Boss', complete_status: 'boss_done', steps: [{ quest_text: 'Slay him.', requires_status: 'wolves_done' }] },
  ];
  const npcs: QuestMapNpcInput[] = [
    {
      id: 'npcs/guard.txt',
      name: 'Guard',
      objectId: 7,
      locations: [],
      dialogs: [
        { topic: 'Rats', requirements: [], worldEffects: [{ type: 'set_status', value: 'rats_started' }] },
        { topic: 'Wolves', requirements: [{ type: 'status', value: 'rats_done' }], worldEffects: [{ type: 'set_status', value: 'wolves_started' }] },
        { topic: 'Wolves done', requirements: [{ type: 'status', value: 'wolves_started' }], worldEffects: [{ type: 'set_status', value: 'wolves_done' }] },
      ],
    },
    { id: 'npcs/hunter.txt', name: 'Hunter', locations: [], dialogs: [{ topic: 'Rats?', requirements: [{ type: 'status', value: 'rats_started' }] }] },
    {
      id: 'npcs/cook.txt',
      name: 'Cook',
      locations: [],
      dialogs: [{ topic: 'Done', requirements: [{ type: 'status', value: 'rats_started' }], worldEffects: [{ type: 'set_status', value: 'rats_done' }] }],
    },
  ];
  const graph = deriveQuestGraph(quests, npcs);

  it('links quests through journal and giver requirements', () => {
    const unlocks = graph.edges.filter((e) => e.links.some((l) => l.kind === 'unlocks')).map((e) => `${e.from}>${e.to}`);
    expect(unlocks).toEqual(['quest:rats>quest:wolves', 'quest:wolves>quest:boss']);
    const depths = questDepths(graph);
    expect([depths.get('quest:rats'), depths.get('quest:wolves'), depths.get('quest:boss')]).toEqual([0, 1, 2]);
  });

  it('lays out left to right by dependency', () => {
    const boxes = layoutQuestGraph(graph);
    const x = (id: string) => boxes.find((b) => b.nodeId === id)!.x;
    expect(x('quest:rats')).toBeLessThan(x('quest:wolves'));
    expect(x('quest:wolves')).toBeLessThan(x('quest:boss'));
    expect(x('npc:npcs/guard.txt')).toBeLessThan(x('quest:rats'));
    expect(x('npc:npcs/hunter.txt')).toBeLessThan(x('quest:rats'));
    // End-only NPC sits after the quest it ends.
    expect(x('npc:npcs/cook.txt')).toBeGreaterThan(x('quest:rats'));
    const hunter = graph.edges.find((e) => e.from === 'npc:npcs/hunter.txt')!;
    expect(hunter.links).toEqual([{ kind: 'mentions', status: 'rats_started' }]);
  });

  it('uses saved positions and survives cycles', () => {
    const boxes = layoutQuestGraph(graph, { 'quest:boss': { x: 5, y: 9 } });
    expect(boxes.find((b) => b.nodeId === 'quest:boss')).toMatchObject({ x: 5, y: 9 });
    const cyclic = deriveQuestGraph([
      { id: 'a', name: 'A', complete_status: 'a_done', steps: [{ requires_status: 'b_done' }] },
      { id: 'b', name: 'B', complete_status: 'b_done', steps: [{ requires_status: 'a_done' }] },
    ], []);
    expect(layoutQuestGraph(cyclic)).toHaveLength(2);
  });
});

describe('helpers', () => {
  it('names statuses plainly', () => {
    const pool = ['emp_krolan_init', 'emp_krolan_key', 'emp_krolan_finish'];
    expect(plainStatusName('emp_krolan_init', pool)).toBe('Accepted');
    expect(plainStatusName('emp_krolan_key', pool)).toBe('Key');
    expect(plainStatusName('emp_krolan_finish', pool)).toBe('Done');
    expect(plainStatusName('rats_done')).toBe('Rats done');
  });

  it('formats locations', () => {
    expect(locationText([])).toBe('Not placed');
    expect(locationText([{ mapTitle: 'Town', x: 1, y: 2 }, { mapTitle: 'Cave', x: 3, y: 4 }])).toBe('Town 1,2 +1');
  });

  it('draws connectors between facing sides', () => {
    const a = { nodeId: 'a', x: 0, y: 0, width: 100, height: 40, column: 0 };
    const b = { nodeId: 'b', x: 300, y: 100, width: 100, height: 40, column: 1 };
    const path = connectorPath(b, a);
    expect(path.d.startsWith('M 100 20 C')).toBe(true);
    expect(path.d.endsWith('300 120')).toBe(true);
    expect(path.mid).toEqual({ x: 200, y: 70 });
  });

  it('round-trips the sidecar', () => {
    const text = serializeQuestMapPositions({ 'quest:b': { x: 1.4, y: 2 }, 'npc:a': { x: -3, y: 4.6 } });
    expect(parseQuestMapPositions(text)).toEqual({ 'npc:a': { x: -3, y: 5 }, 'quest:b': { x: 1, y: 2 } });
    expect(parseQuestMapPositions('nope')).toEqual({});
  });
});
