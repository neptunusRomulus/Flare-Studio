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

describe('map events', () => {
  it('reads status-setting events from a flare-game map and links them to quests', async () => {
    const { questMapEventsFromMapText, questMapEventsFromObjects } = await import('@/editor/questMapEvents');
    const events = questMapEventsFromMapText(fixture('flare-maps/book_of_the_dead.txt'), 'maps/book_of_the_dead.txt');
    expect(events.map((e) => [e.name, e.mapTitle, e.x, e.y, e.sets.join(',')])).toEqual([
      ['Book of the Dead', 'Book of the Dead', 4, 25, 'emp_main_init'],
      ['Book of the Dead', 'Book of the Dead', 4, 20, 'emp_main_underworld'],
    ]);
    const graph = deriveQuestGraph([quest('0000_empyrean', '0000_empyrean.txt')], [], events);
    const empyrean = graph.quests[0];
    expect(empyrean.starterEvents).toEqual([events[0].id]);
    expect(events[0].id).toMatch(/^maps\/book_of_the_dead\.txt#\d+$/);
    expect(graph.events.map((e) => e.location)).toEqual(['Book of the Dead 4,25', 'Book of the Dead 4,20']);
    const advance = graph.edges.find((e) => e.from === `event:${events[1].id}`)!;
    expect(advance.links).toEqual([{ kind: 'advances', status: 'emp_main_underworld' }]);

    const live = questMapEventsFromObjects([
      { id: 3, type: 'event', name: 'Event', x: 2, y: 5, properties: { set_status: ['a_started', 'b'] } },
      { id: 4, type: 'event', x: -1, y: -1, properties: { tooltip: 'Gate', set_status: 'a_done' } },
      { id: 5, type: 'npc', properties: { set_status: 'a_started' } },
      { id: 6, type: 'event', properties: {} },
    ], '__current_map__', 'Town');
    expect(live.map((e) => [e.id, e.name, e.x, e.sets.join(',')])).toEqual([
      ['__current_map__#3', 'Map event', 2, 'a_started,b'],
      ['__current_map__#4', 'Gate', -1, 'a_done'],
    ]);
    const g2 = deriveQuestGraph([{ id: 'a', name: 'A', complete_status: 'a_done', steps: [{ requires_status: 'a_started' }] }], [], live);
    expect(g2.events.map((e) => e.location)).toEqual(['Town 2,5', 'Town · Not placed']);
    expect(layoutQuestGraph(g2).map((b) => b.nodeId)).toContain('event:__current_map__#4');
  });
});

describe('crowded quests', () => {
  const quest: QuestMapQuestInput = {
    id: 'nasu', name: 'Nasu', complete_status: 'nasu_done',
    steps: [{ requires_status: 'nasu_init' }, { requires_status: 'nasu_a' }, { requires_status: 'nasu_b' }, { requires_status: 'nasu_c' }],
  };
  const ev = (id: string, sets: string, x = 1) => ({ id, name: `Lever ${id}`, mapTitle: 'Fort Nasu', x, y: 2, sets: [sets] });
  const events = [ev('s', 'nasu_init'), ev('a', 'nasu_a'), ev('b', 'nasu_b', 3), ev('c', 'nasu_c'), ev('e', 'nasu_done')];

  it('bundles parallel event lines into one counted card', async () => {
    const { bundleEventEdges } = await import('@/editor/questMap');
    const graph = deriveQuestGraph([quest], [], events);
    expect(graph.edges).toHaveLength(5);
    const bundled = bundleEventEdges(graph);
    expect(bundled.edges).toHaveLength(3);
    const card = bundled.events.find((e) => e.count)!;
    expect(card).toMatchObject({ name: '3 events', location: 'Fort Nasu', count: 3 });
    expect(card.details).toEqual(['Lever a · Fort Nasu 1,2', 'Lever b · Fort Nasu 3,2', 'Lever c · Fort Nasu 1,2']);
    const edge = bundled.edges.find((e) => e.from === card.nodeId)!;
    expect(edge.label).toBe('A · B +1');
    expect(edge.tooltip).toBe('Advances: nasu_a\nAdvances: nasu_b\nAdvances: nasu_c');
    expect(layoutQuestGraph(bundled)).toHaveLength(4);
    // Few lines: nothing to bundle.
    expect(bundleEventEdges(deriveQuestGraph([quest], [], events.slice(0, 4)))).toEqual(deriveQuestGraph([quest], [], events.slice(0, 4)));
  });

  it('spreads ports along a card side and keeps labels apart', async () => {
    const { routeEdges, labelSize } = await import('@/editor/questMap');
    const graph = deriveQuestGraph([quest], [], events);
    const boxes = new Map(layoutQuestGraph(graph).map((b) => [b.nodeId, b]));
    const routes = routeEdges(graph.edges, boxes);
    const questBox = boxes.get('quest:nasu')!;
    const ends = graph.edges
      .filter((e) => e.to === 'quest:nasu')
      .map((e) => Number(routes.get(e.id)!.d.trim().split(/[ ,]+/).pop()));
    expect(new Set(ends).size).toBe(ends.length);
    for (const y of ends) expect(y > questBox.y && y < questBox.y + questBox.height).toBe(true);
    const rects = graph.edges.map((e) => {
      const p = routes.get(e.id)!.label;
      const size = labelSize(e.label);
      return { x: p.x - size.width / 2, y: p.y - size.height / 2, ...size };
    });
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i];
        const b = rects[j];
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap).toBe(false);
      }
    }
  });
});

describe('shared NPCs', () => {
  it('keeps the quests of a multi-quest NPC together next to it', () => {
    const q = (id: string) => ({ id, name: id, complete_status: `${id}_done`, steps: [{ quest_text: id, requires_status: `${id}_init` }] });
    const starts = (...ids: string[]) => ids.map((id) => ({ requirements: [], worldEffects: [{ type: 'set_status', value: `${id}_init` }] }));
    const graph = deriveQuestGraph([q('a'), q('b'), q('c')], [
      { id: 'npcs/x.txt', name: 'X', locations: [], dialogs: starts('a', 'c') },
      { id: 'npcs/y.txt', name: 'Y', locations: [], dialogs: starts('b') },
    ]);
    const boxes = new Map(layoutQuestGraph(graph).map((b) => [b.nodeId, b]));
    const mid = (id: string) => boxes.get(id)!.y + boxes.get(id)!.height / 2;
    // A and C share a band: C sits right under A, with B elsewhere.
    const a = boxes.get('quest:a')!;
    const c = boxes.get('quest:c')!;
    expect(c.x).toBe(a.x);
    expect(c.y).toBe(a.y + a.height + 28);
    expect(Math.abs(mid('npc:npcs/x.txt') - mid('quest:c'))).toBeLessThan(200);
  });
});
