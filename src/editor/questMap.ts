/**
 * Quest Map: a read-only graph of quests and the NPCs that start, advance,
 * mention or end them, derived from the real Flare data (dialog set_status /
 * requires_status and quest [quest] blocks). Pure: no React, no file access.
 */
import { stepCardTitle } from '@/editor/questSteps';

export type QuestMapStepInput = {
  quest_text?: string;
  requires_status?: string;
  requires_not_status?: string;
  show_status?: string;
};

export type QuestMapQuestInput = {
  id: string;
  name: string;
  complete_status?: string;
  steps?: QuestMapStepInput[];
  /** Single-step quests stored without steps keep their status here. */
  requires_status?: string;
  quest_text?: string;
};

export type QuestMapDialogInput = {
  topic?: string;
  dialogueId?: string;
  requirements?: Array<{ type: string; value: string }>;
  worldEffects?: Array<{ type: string; value: string }>;
};

export type QuestMapLocation = { mapTitle: string; x: number; y: number };

export type QuestMapNpcInput = {
  /** Stable key, e.g. the NPC file "npcs/florin.txt". */
  id: string;
  name: string;
  /** Raw portrait path as stored (resolved by the view). */
  portrait?: string;
  dialogs: QuestMapDialogInput[];
  locations: QuestMapLocation[];
  /** Map object id on the open map (only these open in the NPC editor). */
  objectId?: number;
};

/** A map event that sets statuses (only start / advance / end links are drawn). */
export type QuestMapEventInput = {
  id: string;
  name: string;
  mapTitle: string;
  /** -1,-1 when not placed. */
  x: number;
  y: number;
  sets: string[];
};

export type QuestMapLinkKind = 'starts' | 'advances' | 'ends' | 'mentions' | 'unlocks';

export type QuestMapLink = { kind: QuestMapLinkKind; status: string };

export type QuestMapEdge = {
  id: string;
  from: string;
  to: string;
  links: QuestMapLink[];
  /** Plain label for the connector. */
  label: string;
  /** Raw keys, one per line (tooltip only). */
  tooltip: string;
};

export type QuestMapQuestCard = {
  nodeId: string;
  questId: string;
  name: string;
  steps: string[];
  startStatuses: string[];
  stepStatuses: string[];
  completeStatus: string;
  starters: string[];
  finishers: string[];
  /** Event ids that start / end the quest. */
  starterEvents: string[];
  finisherEvents: string[];
};

export type QuestMapNpcCard = {
  nodeId: string;
  npcId: string;
  name: string;
  portrait?: string;
  objectId?: number;
  location: string;
  locations: QuestMapLocation[];
};

export type QuestMapEventCard = {
  nodeId: string;
  eventId: string;
  name: string;
  location: string;
  /** Bundled events: how many, and "name · location" per event (tooltip). */
  count?: number;
  details?: string[];
};

export type QuestMapGraph = {
  quests: QuestMapQuestCard[];
  npcs: QuestMapNpcCard[];
  events: QuestMapEventCard[];
  edges: QuestMapEdge[];
};

export const questNodeId = (questId: string) => `quest:${questId}`;
export const npcNodeId = (npcId: string) => `npc:${npcId}`;
export const eventNodeId = (eventId: string) => `event:${eventId}`;

const clean = (value: unknown) => String(value ?? '').trim();

function splitStatuses(value: unknown): string[] {
  return clean(value).split(/[,\n]/).map((part) => part.trim()).filter(Boolean);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function questSteps(quest: QuestMapQuestInput): QuestMapStepInput[] {
  if (quest.steps && quest.steps.length) return quest.steps;
  if (clean(quest.requires_status) || clean(quest.quest_text)) {
    return [{ quest_text: quest.quest_text, requires_status: quest.requires_status }];
  }
  return [];
}

/** "Florin's Shop, 12,40" or "Not placed". */
export function locationText(locations: QuestMapLocation[]): string {
  if (!locations.length) return 'Not placed';
  const first = locations[0];
  const more = locations.length > 1 ? ` +${locations.length - 1}` : '';
  return `${first.mapTitle} ${first.x},${first.y}${more}`;
}

const LAST_WORD_NAMES: Record<string, string> = {
  init: 'accepted',
  start: 'accepted',
  started: 'accepted',
  accept: 'accepted',
  accepted: 'accepted',
  finish: 'done',
  finished: 'done',
  complete: 'done',
  completed: 'done',
  done: 'done',
  rewarded: 'rewarded',
  turnin: 'turned in',
};

function commonPrefixTokens(keys: string[]): number {
  if (keys.length < 2) return 0;
  const split = keys.map((key) => key.split('_'));
  const shortest = Math.min(...split.map((parts) => parts.length));
  let n = 0;
  while (n < shortest - 1 && split.every((parts) => parts[n] === split[0][n])) n += 1;
  return n;
}

/**
 * Plain name for a status key in the context of its quest:
 * emp_krolan_init → "Accepted", emp_krolan_key → "Key".
 */
export function plainStatusName(status: string, questStatuses: string[] = []): string {
  const key = clean(status);
  if (!key) return '';
  const pool = unique([...questStatuses.map(clean), key]);
  const strip = commonPrefixTokens(pool);
  const tokens = key.split('_').slice(strip).filter(Boolean);
  if (!tokens.length) return key;
  const last = tokens[tokens.length - 1].toLowerCase();
  if (LAST_WORD_NAMES[last]) tokens[tokens.length - 1] = LAST_WORD_NAMES[last];
  const text = tokens.join(' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const KIND_ORDER: QuestMapLinkKind[] = ['starts', 'advances', 'ends', 'unlocks', 'mentions'];
const KIND_VERB: Record<QuestMapLinkKind, string> = {
  starts: 'Starts',
  advances: 'Advances',
  ends: 'Ends',
  mentions: 'Talks about',
  unlocks: 'Unlocks',
};

/** Strongest link decides the connector's look. */
export function primaryKind(links: QuestMapLink[]): QuestMapLinkKind {
  for (const kind of KIND_ORDER) if (links.some((link) => link.kind === kind)) return kind;
  return 'mentions';
}

function dialogStatuses(dialog: QuestMapDialogInput) {
  const has: string[] = [];
  const sets: string[] = [];
  for (const req of dialog.requirements || []) if (req.type === 'status') has.push(...splitStatuses(req.value));
  for (const effect of dialog.worldEffects || []) if (effect.type === 'set_status') sets.push(...splitStatuses(effect.value));
  return { has: unique(has), sets: unique(sets) };
}

export function deriveQuestGraph(questsIn: QuestMapQuestInput[], npcsIn: QuestMapNpcInput[], eventsIn: QuestMapEventInput[] = []): QuestMapGraph {
  const quests: QuestMapQuestCard[] = questsIn.map((quest) => {
    const steps = questSteps(quest);
    const completeStatus = clean(quest.complete_status);
    const startStatuses = unique(splitStatuses(steps[0]?.requires_status)).filter((s) => s !== completeStatus);
    const stepStatuses = unique(steps.slice(1).flatMap((step) => splitStatuses(step.requires_status)))
      .filter((s) => s !== completeStatus && !startStatuses.includes(s));
    return {
      nodeId: questNodeId(quest.id),
      questId: quest.id,
      name: clean(quest.name) || quest.id,
      steps: steps.map((step, index) => stepCardTitle(clean(step.quest_text), index)),
      startStatuses,
      stepStatuses,
      completeStatus,
      starters: [],
      finishers: [],
      starterEvents: [],
      finisherEvents: [],
    };
  });

  const edgeMap = new Map<string, QuestMapEdge>();
  const order: string[] = [];
  const addLink = (from: string, to: string, link: QuestMapLink) => {
    const key = [from, to].sort().join('|');
    let edge = edgeMap.get(key);
    if (!edge) {
      edge = { id: key, from, to, links: [], label: '', tooltip: '' };
      edgeMap.set(key, edge);
      order.push(key);
    }
    if (!edge.links.some((l) => l.kind === link.kind && l.status === link.status)) edge.links.push(link);
  };

  const usedNpcs = new Set<string>();
  for (const npc of npcsIn) {
    const dialogs = (npc.dialogs || []).map(dialogStatuses);
    const sets = new Set(dialogs.flatMap((d) => d.sets));
    const has = new Set(dialogs.flatMap((d) => d.has));
    for (const quest of quests) {
      const npcNode = npcNodeId(npc.id);
      const before = quest.nodeId;
      const links: QuestMapLink[] = [];
      for (const status of quest.startStatuses) if (sets.has(status)) links.push({ kind: 'starts', status });
      for (const status of quest.stepStatuses) if (sets.has(status)) links.push({ kind: 'advances', status });
      if (quest.completeStatus && sets.has(quest.completeStatus)) links.push({ kind: 'ends', status: quest.completeStatus });
      if (!links.length) {
        const all = [...quest.startStatuses, ...quest.stepStatuses];
        const mention = all.find((status) => has.has(status));
        if (mention) links.push({ kind: 'mentions', status: mention });
      }
      if (!links.length) continue;
      usedNpcs.add(npc.id);
      for (const link of links) {
        if (link.kind === 'ends') addLink(before, npcNode, link);
        else addLink(npcNode, before, link);
      }
      if (links.some((l) => l.kind === 'starts')) quest.starters.push(npc.id);
      if (links.some((l) => l.kind === 'ends')) quest.finishers.push(npc.id);
    }
  }

  const usedEvents = new Set<string>();
  for (const event of eventsIn) {
    const sets = new Set(event.sets.map(clean));
    const node = eventNodeId(event.id);
    for (const quest of quests) {
      const links: QuestMapLink[] = [];
      for (const status of quest.startStatuses) if (sets.has(status)) links.push({ kind: 'starts', status });
      for (const status of quest.stepStatuses) if (sets.has(status)) links.push({ kind: 'advances', status });
      if (quest.completeStatus && sets.has(quest.completeStatus)) links.push({ kind: 'ends', status: quest.completeStatus });
      if (!links.length) continue;
      usedEvents.add(event.id);
      for (const link of links) {
        if (link.kind === 'ends') addLink(quest.nodeId, node, link);
        else addLink(node, quest.nodeId, link);
      }
      if (links.some((l) => l.kind === 'starts')) quest.starterEvents.push(event.id);
      if (links.some((l) => l.kind === 'ends')) quest.finisherEvents.push(event.id);
    }
  }

  // Quest → quest: B needs A's completion, in its journal or in the dialog that starts it.
  const giverRequires = new Map<string, Set<string>>();
  for (const npc of npcsIn) {
    for (const dialog of (npc.dialogs || []).map(dialogStatuses)) {
      for (const quest of quests) {
        if (!dialog.sets.some((s) => quest.startStatuses.includes(s))) continue;
        const set = giverRequires.get(quest.questId) || new Set<string>();
        dialog.has.forEach((s) => set.add(s));
        giverRequires.set(quest.questId, set);
      }
    }
  }
  for (const a of quests) {
    if (!a.completeStatus) continue;
    for (const b of quests) {
      if (a === b) continue;
      const needs = b.startStatuses.includes(a.completeStatus) || b.stepStatuses.includes(a.completeStatus)
        || giverRequires.get(b.questId)?.has(a.completeStatus);
      if (needs) addLink(a.nodeId, b.nodeId, { kind: 'unlocks', status: a.completeStatus });
    }
  }

  const questByNode = new Map(quests.map((q) => [q.nodeId, q]));
  const edges = order.map((key) => {
    const edge = edgeMap.get(key)!;
    const links = [...edge.links].sort((x, y) => KIND_ORDER.indexOf(x.kind) - KIND_ORDER.indexOf(y.kind));
    const quest = questByNode.get(edge.to) || questByNode.get(edge.from);
    const pool = quest ? [...quest.startStatuses, ...quest.stepStatuses, quest.completeStatus] : [];
    const names = links.map((link) => {
      const owner = link.kind === 'unlocks' ? questByNode.get(edge.from) : quest;
      const ownerPool = owner ? [...owner.startStatuses, ...owner.stepStatuses, owner.completeStatus] : pool;
      return plainStatusName(link.status, ownerPool);
    });
    const shown = unique(names);
    const label = shown.length > 2 ? `${shown.slice(0, 2).join(' · ')} +${shown.length - 2}` : shown.join(' · ');
    const tooltip = links.map((link) => `${KIND_VERB[link.kind]}: ${link.status}`).join('\n');
    return { ...edge, links, label, tooltip };
  });

  const npcs: QuestMapNpcCard[] = npcsIn
    .filter((npc) => usedNpcs.has(npc.id))
    .map((npc) => ({
      nodeId: npcNodeId(npc.id),
      npcId: npc.id,
      name: clean(npc.name) || npc.id,
      portrait: npc.portrait,
      objectId: npc.objectId,
      location: locationText(npc.locations),
      locations: npc.locations,
    }));

  const events: QuestMapEventCard[] = eventsIn
    .filter((event) => usedEvents.has(event.id))
    .map((event) => ({
      nodeId: eventNodeId(event.id),
      eventId: event.id,
      name: clean(event.name) || 'Map event',
      location: event.x >= 0 && event.y >= 0 ? `${event.mapTitle} ${event.x},${event.y}` : `${event.mapTitle} · Not placed`,
    }));

  return { quests, npcs, events, edges };
}

export const QUEST_CARD_WIDTH = 260;
export const NPC_CARD_WIDTH = 210;
export const NPC_CARD_HEIGHT = 64;
export const EVENT_CARD_HEIGHT = 48;
export const MAX_CARD_STEPS = 5;
const COLUMN_GAP = 110;
const ROW_GAP = 28;
const BAND_GAP = 56;
const MAX_SHARED_BAND = 6;

export function questCardHeight(stepCount: number): number {
  const shown = Math.min(stepCount, MAX_CARD_STEPS) + (stepCount > MAX_CARD_STEPS ? 1 : 0);
  // header 40 + list padding 12 + rows + footer 30
  return 40 + 12 + Math.max(1, shown) * 20 + 30;
}

export type QuestMapBox = { nodeId: string; x: number; y: number; width: number; height: number; column: number };
export type QuestMapPositions = Record<string, { x: number; y: number }>;

/** Longest unlock chain before each quest (cycles are cut). */
export function questDepths(graph: QuestMapGraph): Map<string, number> {
  const depth = new Map(graph.quests.map((q) => [q.nodeId, 0]));
  const unlocks = graph.edges.filter((e) => e.links.some((l) => l.kind === 'unlocks'));
  for (let pass = 0; pass < graph.quests.length; pass += 1) {
    let changed = false;
    for (const edge of unlocks) {
      const next = (depth.get(edge.from) ?? 0) + 1;
      if (next > (depth.get(edge.to) ?? 0) && next <= graph.quests.length) {
        depth.set(edge.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return depth;
}

/**
 * Left-to-right layout: NPCs and events that start or talk about a quest sit
 * before it, end-only ones after it. Quests chained by unlocks share a band;
 * unrelated quests get their own band, stacked top to bottom, so each quest
 * stays next to its own NPCs.
 */
export function layoutQuestGraph(graph: QuestMapGraph, saved: QuestMapPositions = {}): QuestMapBox[] {
  const depth = questDepths(graph);
  const questIndex = new Map(graph.quests.map((q, i) => [q.nodeId, i]));

  // Bands: quests connected by unlock edges.
  const parent = new Map(graph.quests.map((q) => [q.nodeId, q.nodeId]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  for (const edge of graph.edges) {
    if (!edge.links.some((l) => l.kind === 'unlocks')) continue;
    const a = find(edge.from);
    const b = find(edge.to);
    if (a !== b) parent.set(b, a);
  }
  // An NPC linked to several quests pulls them into one band (up to a limit),
  // so it sits right next to all of them instead of sending long lines across.
  const bandSize = new Map<string, number>();
  for (const quest of graph.quests) bandSize.set(find(quest.nodeId), (bandSize.get(find(quest.nodeId)) ?? 0) + 1);
  for (const npc of graph.npcs) {
    const quests = unique(graph.edges
      .filter((e) => e.from === npc.nodeId || e.to === npc.nodeId)
      .map((e) => (e.from === npc.nodeId ? e.to : e.from))
      .filter((id) => questIndex.has(id)));
    for (const other of quests.slice(1)) {
      const a = find(quests[0]);
      const b = find(other);
      if (a === b) continue;
      const size = (bandSize.get(a) ?? 1) + (bandSize.get(b) ?? 1);
      if (size > MAX_SHARED_BAND) continue;
      parent.set(b, a);
      bandSize.set(a, size);
    }
  }
  const bandOf = new Map<string, string>();
  for (const quest of graph.quests) bandOf.set(quest.nodeId, find(quest.nodeId));

  const column = new Map<string, number>();
  for (const quest of graph.quests) column.set(quest.nodeId, (depth.get(quest.nodeId) ?? 0) * 2 + 1);
  for (const source of [...graph.npcs, ...graph.events]) {
    const edges = graph.edges.filter((e) => e.from === source.nodeId || e.to === source.nodeId);
    const before: number[] = [];
    const after: number[] = [];
    let firstQuest = '';
    for (const edge of edges) {
      const questNode = edge.from === source.nodeId ? edge.to : edge.from;
      if (!firstQuest || (questIndex.get(questNode) ?? 0) < (questIndex.get(firstQuest) ?? 0)) firstQuest = questNode;
    }
    const band = bandOf.get(firstQuest) ?? firstQuest;
    for (const edge of edges) {
      const questNode = edge.from === source.nodeId ? edge.to : edge.from;
      if ((bandOf.get(questNode) ?? questNode) !== band) continue;
      const d = depth.get(questNode) ?? 0;
      if (edge.links.every((l) => l.kind === 'ends')) after.push(d);
      else before.push(d);
    }
    bandOf.set(source.nodeId, band);
    column.set(source.nodeId, before.length ? Math.min(...before) * 2 : Math.max(0, ...after) * 2 + 2);
  }
  const used = Array.from(new Set(column.values())).sort((a, b) => a - b);
  const compact = new Map(used.map((c, i) => [c, i]));

  const items = [
    ...graph.npcs.map((n, i) => ({ nodeId: n.nodeId, width: NPC_CARD_WIDTH, height: NPC_CARD_HEIGHT, index: i })),
    ...graph.events.map((e, i) => ({ nodeId: e.nodeId, width: NPC_CARD_WIDTH, height: EVENT_CARD_HEIGHT, index: graph.npcs.length + i })),
    ...graph.quests.map((q, i) => ({ nodeId: q.nodeId, width: QUEST_CARD_WIDTH, height: questCardHeight(q.steps.length), index: graph.npcs.length + graph.events.length + i })),
  ];
  const neighbors = new Map<string, string[]>();
  for (const edge of graph.edges) {
    neighbors.set(edge.from, [...(neighbors.get(edge.from) || []), edge.to]);
    neighbors.set(edge.to, [...(neighbors.get(edge.to) || []), edge.from]);
  }

  // Shared column x positions across bands.
  const columnX: number[] = [];
  let x = 0;
  for (let c = 0; c < used.length; c += 1) {
    const width = Math.max(0, ...items.filter((item) => compact.get(column.get(item.nodeId) ?? 0) === c).map((item) => item.width));
    columnX.push(x);
    x += width + COLUMN_GAP;
  }
  const columnWidth = (c: number) => (columnX[c + 1] ?? x) - columnX[c] - COLUMN_GAP;

  const bands: string[] = [];
  for (const quest of graph.quests) {
    const band = bandOf.get(quest.nodeId)!;
    if (!bands.includes(band)) bands.push(band);
  }

  // Lay out each band from y = 0, then wrap bands into side-by-side stacks
  // so the whole map is closer to a screen shape than one tall strip.
  const boxes = new Map<string, QuestMapBox>();
  const bandHeights: number[] = [];
  const bandMembers: string[][] = [];
  const placeBand = (band: string) => {
    let bandHeight = 0;
    const members: string[] = [];
    for (let c = 0; c < used.length; c += 1) {
      const inColumn = items.filter((item) => bandOf.get(item.nodeId) === band && compact.get(column.get(item.nodeId) ?? 0) === c);
      if (!inColumn.length) continue;
      const center = (nodeId: string) => {
        const ys = (neighbors.get(nodeId) || [])
          .filter((n) => bandOf.get(n) === band)
          .map((n) => boxes.get(n)).filter(Boolean).map((b) => b!.y + b!.height / 2);
        return ys.length ? ys.reduce((sum, v) => sum + v, 0) / ys.length : Number.POSITIVE_INFINITY;
      };
      inColumn.sort((a, b) => {
        const ca = center(a.nodeId);
        const cb = center(b.nodeId);
        if (ca !== cb) return ca < cb ? -1 : 1;
        return a.index - b.index;
      });
      let y = 0;
      for (const item of inColumn) {
        boxes.set(item.nodeId, { nodeId: item.nodeId, x: columnX[c] + (columnWidth(c) - item.width) / 2, y, width: item.width, height: item.height, column: c });
        members.push(item.nodeId);
        y += item.height + ROW_GAP;
      }
      bandHeight = Math.max(bandHeight, y - ROW_GAP);
    }
    return { bandHeight, members };
  };
  for (const band of bands) {
    // Second pass orders each column by all its placed neighbors, not just earlier columns.
    placeBand(band);
    const { bandHeight, members } = placeBand(band);
    bandHeights.push(bandHeight);
    bandMembers.push(members);
  }
  const bandWidth = Math.max(1, x - COLUMN_GAP);
  const totalHeight = bandHeights.reduce((sum, h) => sum + h + BAND_GAP, 0);
  const target = Math.max(Math.max(0, ...bandHeights), Math.sqrt((bandWidth * totalHeight * 9) / 16));
  let stackX = 0;
  let stackTop = 0;
  bandHeights.forEach((height, i) => {
    if (stackTop > 0 && stackTop + height > target) {
      stackX += bandWidth + COLUMN_GAP * 1.5;
      stackTop = 0;
    }
    for (const nodeId of bandMembers[i]) {
      const box = boxes.get(nodeId)!;
      boxes.set(nodeId, { ...box, x: box.x + stackX, y: box.y + stackTop });
    }
    stackTop += height + BAND_GAP;
  });

  return items.map((item) => {
    const box = boxes.get(item.nodeId)!;
    const pos = saved[item.nodeId];
    return pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) ? { ...box, x: pos.x, y: pos.y } : box;
  });
}

/** Curved connector between two boxes, leaving and entering on the facing sides. */
export function connectorPath(a: QuestMapBox, b: QuestMapBox): { d: string; mid: { x: number; y: number } } {
  const leftToRight = a.x + a.width / 2 <= b.x + b.width / 2;
  const [s, t] = leftToRight ? [a, b] : [b, a];
  const x1 = s.x + s.width;
  const y1 = s.y + s.height / 2;
  let x2 = t.x;
  const y2 = t.y + t.height / 2;
  // Overlapping columns: connect right side to right side.
  if (x2 < x1) x2 = t.x + t.width;
  const bend = Math.max(40, Math.abs(x2 - x1) / 2);
  const c2x = x2 >= x1 ? x2 - bend : x2 + bend;
  const d = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;
  return { d, mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 } };
}

const BUNDLE_MIN_EVENTS = 3;
const BUNDLE_MIN_LINES = 5;

/**
 * When a quest has many connectors, events that only link to it with the same
 * kind of link (e.g. six events that each advance it) become one "6 events"
 * card with one connector. Details stay in the card's tooltip.
 */
export function bundleEventEdges(graph: QuestMapGraph): QuestMapGraph {
  const edgesOf = new Map<string, QuestMapEdge[]>();
  for (const edge of graph.edges) {
    edgesOf.set(edge.from, [...(edgesOf.get(edge.from) || []), edge]);
    edgesOf.set(edge.to, [...(edgesOf.get(edge.to) || []), edge]);
  }
  const eventByNode = new Map(graph.events.map((e) => [e.nodeId, e]));
  const removedEvents = new Set<string>();
  const removedEdges = new Set<string>();
  const addedEvents: QuestMapEventCard[] = [];
  const addedEdges: QuestMapEdge[] = [];
  const replace = new Map<string, string>();

  for (const quest of graph.quests) {
    const lines = edgesOf.get(quest.nodeId) || [];
    if (lines.length < BUNDLE_MIN_LINES) continue;
    const groups = new Map<QuestMapLinkKind, QuestMapEdge[]>();
    for (const edge of lines) {
      const other = edge.from === quest.nodeId ? edge.to : edge.from;
      const event = eventByNode.get(other);
      if (!event || removedEvents.has(other) || (edgesOf.get(other) || []).length !== 1) continue;
      const kind = primaryKind(edge.links);
      groups.set(kind, [...(groups.get(kind) || []), edge]);
    }
    for (const [kind, group] of groups) {
      if (group.length < BUNDLE_MIN_EVENTS) continue;
      const events = group.map((edge) => eventByNode.get(edge.from === quest.nodeId ? edge.to : edge.from)!);
      const eventId = `bundle:${quest.questId}:${kind}`;
      const nodeId = eventNodeId(eventId);
      const maps = unique(events.map((e) => e.location.replace(/ (-?\d+,-?\d+|· Not placed)$/, '')));
      addedEvents.push({
        nodeId,
        eventId,
        name: `${events.length} events`,
        location: maps.length === 1 ? maps[0] : `${maps.length} maps`,
        count: events.length,
        details: events.map((e) => `${e.name} · ${e.location}`),
      });
      const links: QuestMapLink[] = [];
      for (const edge of group) for (const link of edge.links) if (!links.some((l) => l.kind === link.kind && l.status === link.status)) links.push(link);
      const toQuest = kind !== 'ends';
      const statuses = unique(links.map((l) => l.status));
      const pool = [...quest.startStatuses, ...quest.stepStatuses, quest.completeStatus];
      const names = unique(statuses.map((st) => plainStatusName(st, pool)));
      addedEdges.push({
        id: [nodeId, quest.nodeId].sort().join('|'),
        from: toQuest ? nodeId : quest.nodeId,
        to: toQuest ? quest.nodeId : nodeId,
        links,
        label: names.length > 2 ? `${names.slice(0, 2).join(' · ')} +${names.length - 2}` : names.join(' · '),
        tooltip: links.map((link) => `${KIND_VERB[link.kind]}: ${link.status}`).join('\n'),
      });
      for (const edge of group) removedEdges.add(edge.id);
      for (const event of events) {
        removedEvents.add(event.nodeId);
        replace.set(event.eventId, eventId);
      }
    }
  }
  if (!addedEvents.length) return graph;
  const swap = (ids: string[]) => unique(ids.map((id) => replace.get(id) || id));
  return {
    quests: graph.quests.map((q) => ({ ...q, starterEvents: swap(q.starterEvents), finisherEvents: swap(q.finisherEvents) })),
    npcs: graph.npcs,
    events: [...graph.events.filter((e) => !removedEvents.has(e.nodeId)), ...addedEvents],
    edges: [...graph.edges.filter((e) => !removedEdges.has(e.id)), ...addedEdges],
  };
}

export type QuestMapRoute = { d: string; label: { x: number; y: number } };

type Rect = { x: number; y: number; width: number; height: number };

const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

/** Approximate pill size of a connector label (10px font). */
export function labelSize(label: string): { width: number; height: number } {
  return { width: Math.min(160, Math.round(label.length * 5.6) + 18), height: 18 };
}

/**
 * Connector paths with ports: the lines on one card side are spread along
 * that side in the order of the cards they lead to, so they do not meet in
 * one point. Labels slide along their path to avoid other labels and cards.
 */
export function routeEdges(edges: QuestMapEdge[], boxes: Map<string, QuestMapBox>): Map<string, QuestMapRoute> {
  type End = { edgeId: string; nodeId: string; side: 'left' | 'right'; otherY: number };
  const plans: Array<{ edge: QuestMapEdge; s: QuestMapBox; t: QuestMapBox; tSide: 'left' | 'right' }> = [];
  const ends = new Map<string, End[]>();
  const push = (end: End) => {
    const key = `${end.nodeId}|${end.side}`;
    ends.set(key, [...(ends.get(key) || []), end]);
  };
  for (const edge of edges) {
    const a = boxes.get(edge.from);
    const b = boxes.get(edge.to);
    if (!a || !b) continue;
    const [s, t] = a.x + a.width / 2 <= b.x + b.width / 2 ? [a, b] : [b, a];
    const tSide = t.x >= s.x + s.width ? 'left' : 'right';
    plans.push({ edge, s, t, tSide });
    push({ edgeId: edge.id, nodeId: s.nodeId, side: 'right', otherY: t.y + t.height / 2 });
    push({ edgeId: edge.id, nodeId: t.nodeId, side: tSide, otherY: s.y + s.height / 2 });
  }
  const portY = new Map<string, number>();
  for (const [key, list] of ends) {
    const box = boxes.get(list[0].nodeId)!;
    list.sort((p, q) => p.otherY - q.otherY || (p.edgeId < q.edgeId ? -1 : 1));
    const pad = Math.min(14, box.height / 4);
    list.forEach((end, i) => {
      portY.set(`${key}|${end.edgeId}`, box.y + pad + ((box.height - pad * 2) * (i + 1)) / (list.length + 1));
    });
  }

  const obstacles: Rect[] = Array.from(boxes.values());
  const placed: Rect[] = [];
  const routes = new Map<string, QuestMapRoute>();
  const params = [0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78, 0.15, 0.85];
  for (const { edge, s, t, tSide } of plans) {
    const x1 = s.x + s.width;
    const y1 = portY.get(`${s.nodeId}|right|${edge.id}`) ?? s.y + s.height / 2;
    const x2 = tSide === 'left' ? t.x : t.x + t.width;
    const y2 = portY.get(`${t.nodeId}|${tSide}|${edge.id}`) ?? t.y + t.height / 2;
    const bend = Math.max(40, Math.abs(x2 - x1) / 2);
    const c1x = x1 + bend;
    const c2x = tSide === 'left' ? x2 - bend : x2 + bend;
    const d = `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;
    const at = (k: number) => {
      const u = 1 - k;
      return {
        x: u * u * u * x1 + 3 * u * u * k * c1x + 3 * u * k * k * c2x + k * k * k * x2,
        y: u * u * u * y1 + 3 * u * u * k * y1 + 3 * u * k * k * y2 + k * k * k * y2,
      };
    };
    let best = at(0.5);
    if (edge.label) {
      const size = labelSize(edge.label);
      let bestCost = Number.POSITIVE_INFINITY;
      for (const k of params) {
        const p = at(k);
        const rect = { x: p.x - size.width / 2, y: p.y - size.height / 2, ...size };
        const cost = placed.reduce((sum, r) => sum + overlapArea(rect, r), 0) * 2
          + obstacles.reduce((sum, r) => sum + overlapArea(rect, r), 0);
        if (cost < bestCost) {
          bestCost = cost;
          best = p;
        }
        if (cost === 0) break;
      }
      placed.push({ x: best.x - size.width / 2, y: best.y - size.height / 2, ...size });
    }
    routes.set(edge.id, { d, label: best });
  }
  return routes;
}

/** Studio-only sidecar with dragged card positions (never a Flare file). */
export const QUEST_MAP_SIDECAR = 'content/quest-map.json';

export function parseQuestMapPositions(text: string | null | undefined): QuestMapPositions {
  if (!text) return {};
  try {
    const data = JSON.parse(text) as { positions?: unknown };
    const raw = data && typeof data === 'object' ? (data.positions as Record<string, unknown>) : null;
    if (!raw || typeof raw !== 'object') return {};
    const out: QuestMapPositions = {};
    for (const [key, value] of Object.entries(raw)) {
      const v = value as { x?: unknown; y?: unknown };
      const x = Number(v?.x);
      const y = Number(v?.y);
      if (Number.isFinite(x) && Number.isFinite(y)) out[key] = { x: Math.round(x), y: Math.round(y) };
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeQuestMapPositions(positions: QuestMapPositions): string {
  const sorted: QuestMapPositions = {};
  for (const key of Object.keys(positions).sort()) sorted[key] = { x: Math.round(positions[key].x), y: Math.round(positions[key].y) };
  return `${JSON.stringify({ version: 1, positions: sorted }, null, 2)}\n`;
}
