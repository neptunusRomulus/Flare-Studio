import { describe, it, expect } from 'vitest';
import { SharedSlotMap, mergeSharedSlotLists, slotGroup } from './sharedSlots';
import { normalizeSlotKey, findSlotForCellKey, clearSlotCells } from './slotCells';
import { assignExportOffsets } from './tilesetIds';

const tab = (id: number, fileName?: string) => ({ id, tileset: fileName ? { fileName } : undefined });

describe('shared slots', () => {
  it('background and object see one list; collision stays separate', () => {
    const m = new SharedSlotMap<number[]>();
    m.set('background', [1, 2]);
    expect(m.get('object')).toEqual([1, 2]);
    m.set('collision', [9]);
    expect(m.get('collision')).toEqual([9]);
    expect(slotGroup('object')).toBe('background');
    expect(Array.from(m.keys()).sort()).toEqual(['background', 'collision']);
  });

  it('cells on each layer resolve to their own slot in the shared list', () => {
    const shared = [tab(1, 'background_tab1_grass.png'), tab(2, 'object_tab2_trees.png')];
    expect(findSlotForCellKey(shared, 'grass.png')?.id).toBe(1);   // background cell
    expect(findSlotForCellKey(shared, 'trees.png')?.id).toBe(2);   // object cell
  });

  it('save/load roundtrip keeps one list under background', () => {
    const m = new SharedSlotMap<ReturnType<typeof tab>[]>();
    m.set('background', [tab(1, 'a.png')]);
    m.get('object')!.push(tab(2, 'b.png'));
    const saved = JSON.parse(JSON.stringify(Object.fromEntries(m.entries())));
    expect(Object.keys(saved)).toEqual(['background']);
    const back = new SharedSlotMap<ReturnType<typeof tab>[]>(Object.entries(saved));
    expect(back.get('object')!.map(t => t.id)).toEqual([1, 2]);
  });

  it('migrates old per-layer lists, deduping the same image', () => {
    const r = mergeSharedSlotLists(
      { background: [tab(1, 'background_tab1_grass.png'), tab(2, 'walls.png')], object: [tab(3, 'object_tab3_grass.png'), tab(4, 'trees.png'), tab(5)] },
      { background: 2, object: 4 },
      normalizeSlotKey,
    );
    expect(r.layerTabs!.background.map(t => t.id)).toEqual([1, 2, 4]);
    expect(r.layerTabs!.object).toBeUndefined();
    expect(r.dropped).toEqual([3, 5]);
    expect(r.active).toEqual({ background: 2 });
    // object cells painted with the dropped duplicate still resolve (same image)
    expect(findSlotForCellKey(r.layerTabs!.background, 'object_tab3_grass.png')?.id).toBe(1);
  });

  it('export ids are consistent for both layers', () => {
    const shared = ['grass.png', 'trees.png'];
    const offsets = assignExportOffsets(shared.map(() => ({ count: 16 })));
    const off = new Map(shared.map((f, i) => [f, offsets[i]]));
    const gid = (key: string, local: number) => off.get(normalizeSlotKey(key)!)! + local - 1;
    expect(gid('background_tab1_grass.png', 3)).toBe(3);   // background layer cell
    expect(gid('trees.png', 3)).toBe(19);                  // object layer cell
    expect(gid('grass.png', 3)).toBe(gid('background_tab1_grass.png', 3)); // same slot, same id on either layer
  });

  it('deleting a slot erases its cells on both layers', () => {
    const removed = [tab(1, 'grass.png')];
    const bgData = [5, 6], bgKeys: Array<string | null> = ['grass.png', 'walls.png'];
    const objData = [7], objKeys: Array<string | null> = ['background_tab1_grass.png'];
    clearSlotCells(bgData, bgKeys, removed);
    clearSlotCells(objData, objKeys, removed);
    expect(bgData).toEqual([0, 6]);
    expect(objData).toEqual([0]);
  });
});
