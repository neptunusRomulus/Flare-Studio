/**
 * Sidebar target groups: several real layers shown as ONE sidebar row with a target switch (UI-only merge).
 * Map = Ground/Object/Collision, Entities = NPC/Enemy/Event.
 */
import { MAP_TARGETS, MAP_TARGET_LABEL, MAP_TAB_HELP } from '@/components/mapTargets';

export type TargetGroupId = 'map' | 'entities' | 'content';
export type TargetGroup = {
  id: TargetGroupId;
  label: string;
  targets: string[];
  labels: Record<string, string>;
  help: string;
  /** false: not map layers; mini icons only select the target (no visibility/opacity). */
  hasVisibility?: boolean;
};

export const MAP_GROUP: TargetGroup = { id: 'map', label: 'Map', targets: MAP_TARGETS, labels: MAP_TARGET_LABEL, help: MAP_TAB_HELP };
export const ENTITY_GROUP: TargetGroup = {
  id: 'entities',
  label: 'Entities',
  targets: ['npc', 'enemy', 'event'],
  labels: { npc: 'NPC', enemy: 'Enemy', event: 'Event' },
  help: 'Press Tab to switch between NPC, Enemy and Event while the Entities layer is selected.',
};
export const CONTENT_GROUP: TargetGroup = {
  id: 'content',
  label: 'Content',
  targets: ['items', 'status', 'rules'],
  labels: { items: 'Items', status: 'Statuses', rules: 'Quests' },
  help: 'Press Tab to switch between Items, Statuses and Quests while the Content layer is selected.',
  hasVisibility: false,
};
export const TARGET_GROUPS: TargetGroup[] = [MAP_GROUP, ENTITY_GROUP, CONTENT_GROUP];

export function groupOfType(t: string | null | undefined): TargetGroup | null {
  return (t && TARGET_GROUPS.find(g => g.targets.includes(t))) || null;
}

export function cycleInGroup(g: TargetGroup, cur: string, reverse = false): string {
  const i = Math.max(0, g.targets.indexOf(cur));
  const n = g.targets.length;
  return g.targets[(i + (reverse ? n - 1 : 1)) % n];
}

/** Tab cycles targets only inside the group of the active layer, never from text fields/dialogs. */
export function tabTargetFor(e: { key: string; shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean }, activeType: string | null | undefined,
  target: { tagName?: string; isContentEditable?: boolean; closest?: (s: string) => unknown } | null): string | null {
  if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey) return null;
  const g = groupOfType(activeType);
  if (!g || !activeType) return null;
  if (target) {
    const tag = (target.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return null;
    if (typeof target.closest === 'function' && target.closest('[role="dialog"],[role="alertdialog"]')) return null;
  }
  return cycleInGroup(g, activeType, !!e.shiftKey);
}

export type SidebarEntry<L> = { kind: 'layer'; layer: L } | { kind: 'group'; group: TargetGroup; targets: L[] };
/** Collapse each group's layers into one entry at the position of its first layer. */
export function collapseTargetGroups<L extends { type?: string }>(layers: L[]): Array<SidebarEntry<L>> {
  const out: Array<SidebarEntry<L>> = [];
  const placed = new Set<string>();
  for (const l of layers) {
    const g = groupOfType(l.type);
    if (!g) { out.push({ kind: 'layer', layer: l }); continue; }
    if (placed.has(g.id)) continue;
    const targets = g.targets.map(t => layers.find(x => x.type === t)).filter(Boolean) as L[];
    out.push({ kind: 'group', group: g, targets });
    placed.add(g.id);
  }
  return out;
}

const last: Record<string, string> = { map: 'background', entities: 'npc', content: 'items' };
export function rememberGroupTarget(g: TargetGroup, t: string): void { last[g.id] = t; }
export function lastGroupTarget(g: TargetGroup): string { return last[g.id] ?? g.targets[0]; }

/** Normalise a dragged tile rectangle (any corner order) into x,y,width,height clamped to the map. */
export function normalizeTileRect(a: { x: number; y: number }, b: { x: number; y: number }, mapW: number, mapH: number): { x: number; y: number; width: number; height: number } {
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max - 1, v));
  const x1 = clamp(Math.min(a.x, b.x), mapW), x2 = clamp(Math.max(a.x, b.x), mapW);
  const y1 = clamp(Math.min(a.y, b.y), mapH), y2 = clamp(Math.max(a.y, b.y), mapH);
  return { x: x1, y: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 };
}

/** Main layers shown at the top of the right dock. */
export const MAIN_LAYERS: Array<{ id: string; label: string }> = [
  { id: 'map', label: 'Map' },
  { id: 'entities', label: 'Entities' },
  { id: 'content', label: 'Content' },
  { id: 'gameSettings', label: 'Game Settings' },
];

/** Main layer of a real layer type (unknown non-group types count as Map, like the old sidebar grouping). */
export function mainLayerOf(type: string | null | undefined): string | null {
  if (!type) return null;
  if (type === 'gameSettings') return 'gameSettings';
  return groupOfType(type)?.id ?? 'map';
}

/** Real layer id to activate for a main layer: the group's last-used target, else its first existing target. */
export function mainLayerTargetId(main: string, layers: Array<{ id: number; type: string }>): number | null {
  if (main === 'gameSettings') return layers.find(l => l.type === 'gameSettings')?.id ?? null;
  const g = TARGET_GROUPS.find(x => x.id === main);
  if (!g) return null;
  const want = lastGroupTarget(g);
  const l = layers.find(x => x.type === want) ?? g.targets.map(t => layers.find(x => x.type === t)).find(Boolean);
  return l ? l.id : null;
}
