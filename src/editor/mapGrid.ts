/**
 * Pure map-editor operations used by TileMapEditor: painting a cell,
 * flood-fill, layer add/delete/sort, and the undo/redo history stack.
 * Kept free of canvas and DOM so the behaviour can be unit-tested.
 */

export const LAYER_TYPE_PRIORITY: Record<string, number> = {
  rules: 0,
  actions: 1,
  items: 2,
  npc: 3,
  enemy: 4,
  event: 5,
  collision: 6,
  object: 7,
  background: 8,
};

export type MapLayerType = 'background' | 'object' | 'collision' | 'event' | 'enemy' | 'npc';

export type MapLayer = {
  id: number;
  name: string;
  type: string;
  data: number[];
  visible: boolean;
  transparency?: number;
};

export function cellIndex(width: number, x: number, y: number): number {
  return y * width + x;
}

export function inBounds(width: number, height: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

/** Paint (or erase with gid 0) one cell. Returns false when the point is off the map. */
export function paintCell(
  data: number[],
  width: number,
  height: number,
  x: number,
  y: number,
  gid: number,
): boolean {
  if (!inBounds(width, height, x, y)) return false;
  data[cellIndex(width, x, y)] = gid;
  return true;
}

/**
 * 4-connected flood fill. Optional `inSelection` limits the fill to a
 * selection; when omitted, the whole region of `targetValue` is filled.
 * Returns the number of cells written.
 */
export function bucketFill(
  data: number[],
  width: number,
  height: number,
  startX: number,
  startY: number,
  newValue: number,
  inSelection?: (x: number, y: number) => boolean,
): number {
  if (!inBounds(width, height, startX, startY)) return 0;
  const targetValue = data[cellIndex(width, startX, startY)];
  if (targetValue === newValue) return 0;

  const stack: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
  const visited = new Set<number>();
  let filled = 0;

  while (stack.length > 0) {
    const { x, y } = stack.pop()!;
    const index = cellIndex(width, x, y);
    if (!inBounds(width, height, x, y) || visited.has(index)) continue;
    if (data[index] !== targetValue) continue;
    if (inSelection && !inSelection(x, y)) continue;
    visited.add(index);
    data[index] = newValue;
    filled += 1;
    stack.push({ x: x + 1, y });
    stack.push({ x: x - 1, y });
    stack.push({ x, y: y + 1 });
    stack.push({ x, y: y - 1 });
  }
  return filled;
}

export function sortLayersByPriority<T extends { type: string }>(layers: T[]): T[] {
  return [...layers].sort((a, b) => {
    const pa = LAYER_TYPE_PRIORITY[a.type] ?? 99;
    const pb = LAYER_TYPE_PRIORITY[b.type] ?? 99;
    return pa - pb;
  });
}

/** Flare maps keep a single layer per type (background, object, collision, ...). */
export function canAddLayer(layers: Array<{ type: string }>, type: string): boolean {
  return !layers.some((layer) => layer.type === type);
}

export function addMapLayer(
  layers: MapLayer[],
  nextId: number,
  name: string,
  type: MapLayerType,
  width: number,
  height: number,
): { layers: MapLayer[]; layer: MapLayer; nextId: number } | null {
  if (!canAddLayer(layers, type)) return null;
  const layer: MapLayer = {
    id: nextId,
    name,
    type,
    data: new Array(width * height).fill(0),
    visible: true,
    transparency: 1.0,
  };
  return {
    layers: sortLayersByPriority([...layers, layer]),
    layer,
    nextId: nextId + 1,
  };
}

/** Returns null when the layer is missing or it is the last remaining layer. */
export function deleteMapLayer(
  layers: MapLayer[],
  layerId: number,
  activeLayerId: number | null,
): { layers: MapLayer[]; activeLayerId: number | null } | null {
  if (layers.length <= 1) return null;
  const index = layers.findIndex((layer) => layer.id === layerId);
  if (index === -1) return null;
  const next = layers.filter((layer) => layer.id !== layerId);
  const nextActive =
    activeLayerId === layerId ? (next[0]?.id ?? null) : activeLayerId;
  return { layers: next, activeLayerId: nextActive };
}

export function pushHistoryState<T>(
  history: T[],
  index: number,
  state: T,
  maxSize: number,
): { history: T[]; index: number } {
  const next = history.slice(0, index + 1);
  next.push(state);
  let nextIndex = next.length - 1;
  if (next.length > maxSize) {
    next.shift();
    nextIndex -= 1;
  }
  return { history: next, index: nextIndex };
}

export function undoIndex(index: number): number | null {
  return index > 0 ? index - 1 : null;
}

export function redoIndex(index: number, length: number): number | null {
  return index < length - 1 ? index + 1 : null;
}
