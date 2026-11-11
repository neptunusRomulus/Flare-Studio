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

export type QuestMapGraph = {
  quests: QuestMapQuestCard[];
  npcs: QuestMapNpcCard[];
  edges: QuestMapEdge[];
};

export const questNodeId = (questId: string) => `quest:${questId}`;
export const npcNodeId = (npcId: string) => `npc:${npcId}`;

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

export function deriveQuestGraph(questsIn: QuestMapQuestInput[], npcsIn: QuestMapNpcInput[]): QuestMapGraph {
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

  return { quests, npcs, edges };
}

export const QUEST_CARD_WIDTH = 260;
export const NPC_CARD_WIDTH = 210;
export const NPC_CARD_HEIGHT = 64;
export const MAX_CARD_STEPS = 5;
const COLUMN_GAP = 110;
const ROW_GAP = 28;

export function questCardHeight(stepCount: number): number {
  const shown = Math.min(stepCount, MAX_CARD_STEPS) + (stepCount > MAX_CARD_STEPS ? 1 : 0);
  return 40 + Math.max(1, shown) * 20 + 30;
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

/** Left-to-right layout: NPCs that start or talk about a quest sit before it, end-only NPCs after it. */
export function layoutQuestGraph(graph: QuestMapGraph, saved: QuestMapPositions = {}): QuestMapBox[] {
  const depth = questDepths(graph);
  const column = new Map<string, number>();
  for (const quest of graph.quests) column.set(quest.nodeId, (depth.get(quest.nodeId) ?? 0) * 2 + 1);
  for (const npc of graph.npcs) {
    const edges = graph.edges.filter((e) => e.from === npc.nodeId || e.to === npc.nodeId);
    const before: number[] = [];
    const after: number[] = [];
    for (const edge of edges) {
      const questNode = edge.from === npc.nodeId ? edge.to : edge.from;
      const d = depth.get(questNode) ?? 0;
      if (edge.links.every((l) => l.kind === 'ends')) after.push(d);
      else before.push(d);
    }
    column.set(npc.nodeId, before.length ? Math.min(...before) * 2 : Math.max(0, ...after) * 2 + 2);
  }
  const used = Array.from(new Set(column.values())).sort((a, b) => a - b);
  const compact = new Map(used.map((c, i) => [c, i]));

  const items = [
    ...graph.npcs.map((n, i) => ({ nodeId: n.nodeId, width: NPC_CARD_WIDTH, height: NPC_CARD_HEIGHT, index: i })),
    ...graph.quests.map((q, i) => ({ nodeId: q.nodeId, width: QUEST_CARD_WIDTH, height: questCardHeight(q.steps.length), index: graph.npcs.length + i })),
  ];
  const neighbors = new Map<string, string[]>();
  for (const edge of graph.edges) {
    neighbors.set(edge.from, [...(neighbors.get(edge.from) || []), edge.to]);
    neighbors.set(edge.to, [...(neighbors.get(edge.to) || []), edge.from]);
  }

  const boxes = new Map<string, QuestMapBox>();
  let x = 0;
  for (let c = 0; c < used.length; c += 1) {
    const inColumn = items.filter((item) => compact.get(column.get(item.nodeId) ?? 0) === c);
    const center = (nodeId: string) => {
      const ys = (neighbors.get(nodeId) || []).map((n) => boxes.get(n)).filter(Boolean).map((b) => b!.y + b!.height / 2);
      return ys.length ? ys.reduce((s, v) => s + v, 0) / ys.length : Number.POSITIVE_INFINITY;
    };
    inColumn.sort((a, b) => {
      const ca = center(a.nodeId);
      const cb = center(b.nodeId);
      if (ca !== cb) return ca < cb ? -1 : 1;
      return a.index - b.index;
    });
    let y = 0;
    const width = Math.max(...inColumn.map((item) => item.width));
    for (const item of inColumn) {
      boxes.set(item.nodeId, { nodeId: item.nodeId, x: x + (width - item.width) / 2, y, width: item.width, height: item.height, column: c });
      y += item.height + ROW_GAP;
    }
    x += width + COLUMN_GAP;
  }
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
