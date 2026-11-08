/** Sidebar layer groups, in display order. Unknown map layer types join the drawing group. */
const GROUPS: string[][] = [
  ['collision', 'object', 'background'],
  ['npc', 'enemy', 'event'],
  ['items', 'status', 'rules'],
  ['gameSettings'],
];

export function layerGroupIndex(type: string | undefined): number {
  const t = type || '';
  const g = GROUPS.findIndex(list => list.includes(t));
  return g === -1 ? 0 : g;
}

/** Sort layers by group (then group order), keeping relative order for unknown types. */
export function groupLayers<T extends { type?: string }>(layers: T[]): T[] {
  const rank = (l: T) => {
    const g = layerGroupIndex(l.type);
    const pos = GROUPS[g].indexOf(l.type || '');
    return g * 100 + (pos === -1 ? 99 : pos);
  };
  return layers.map((l, i) => ({ l, i })).sort((a, b) => rank(a.l) - rank(b.l) || a.i - b.i).map(x => x.l);
}
