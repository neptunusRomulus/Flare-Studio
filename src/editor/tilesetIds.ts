/**
 * Export id offsets. Global id = offset + localId - 1.
 * Def-sliced tilesets keep their Flare tile ids (offset 1) unless those ids
 * collide with an earlier def tileset; then they are shifted past the used range.
 * Grid tilesets follow after the highest used id, in order.
 */
export function assignExportOffsets(tilesets: Array<{ count: number; defIds?: number[] | null }>): number[] {
  const used = new Set<number>();
  let maxUsed = 0;
  const offsets = new Array<number>(tilesets.length).fill(0);
  tilesets.forEach((t, i) => {
    if (!t.defIds || t.defIds.length === 0) return;
    const clash = t.defIds.some((id) => used.has(id));
    const offset = clash ? maxUsed + 1 : 1;
    offsets[i] = offset;
    for (const id of t.defIds) {
      const g = offset + id - 1;
      used.add(g);
      if (g > maxUsed) maxUsed = g;
    }
  });
  tilesets.forEach((t, i) => {
    if (t.defIds && t.defIds.length > 0) return;
    offsets[i] = maxUsed + 1;
    maxUsed += Math.max(1, t.count);
  });
  return offsets;
}
