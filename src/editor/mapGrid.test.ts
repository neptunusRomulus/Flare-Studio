import { describe, expect, it } from 'vitest';
import {
  addMapLayer,
  bucketFill,
  canAddLayer,
  deleteMapLayer,
  paintCell,
  pushHistoryState,
  redoIndex,
  sortLayersByPriority,
  undoIndex,
  type MapLayer,
} from './mapGrid';
import { applyStampToGrid, stampFromSelection } from './stampTiles';
import { clipboardFromTiles, pasteTileGrid } from './tileClipboard';

function layer(partial: Partial<MapLayer> & Pick<MapLayer, 'id' | 'type'>): MapLayer {
  return {
    name: partial.name ?? partial.type,
    data: partial.data ?? [0, 0, 0, 0],
    visible: partial.visible ?? true,
    transparency: partial.transparency ?? 1,
    ...partial,
  };
}

describe('paintCell', () => {
  it('writes a gid and refuses points off the map', () => {
    const data = [0, 0, 0, 0];
    expect(paintCell(data, 2, 2, 1, 1, 7)).toBe(true);
    expect(data).toEqual([0, 0, 0, 7]);
    expect(paintCell(data, 2, 2, 2, 0, 9)).toBe(false);
    expect(paintCell(data, 2, 2, 0, -1, 9)).toBe(false);
    expect(data).toEqual([0, 0, 0, 7]);
  });

  it('erases with gid 0', () => {
    const data = [1, 2, 3, 4];
    expect(paintCell(data, 2, 2, 0, 1, 0)).toBe(true);
    expect(data).toEqual([1, 2, 0, 4]);
  });
});

describe('bucketFill', () => {
  it('fills a 4-connected region and leaves diagonal neighbours', () => {
    // 1 1 0
    // 1 0 2
    // 0 2 2
    const data = [1, 1, 0, 1, 0, 2, 0, 2, 2];
    expect(bucketFill(data, 3, 3, 0, 0, 9)).toBe(3);
    expect(data).toEqual([9, 9, 0, 9, 0, 2, 0, 2, 2]);
  });

  it('is a no-op when the start cell already has the new value', () => {
    const data = [1, 1, 1, 1];
    expect(bucketFill(data, 2, 2, 0, 0, 1)).toBe(0);
    expect(data).toEqual([1, 1, 1, 1]);
  });

  it('stays inside an active selection', () => {
    const data = [1, 1, 1, 1, 1, 1];
    const selected = new Set(['0,0', '1,0']);
    expect(bucketFill(data, 3, 2, 0, 0, 8, (x, y) => selected.has(`${x},${y}`))).toBe(2);
    expect(data).toEqual([8, 8, 1, 1, 1, 1]);
  });

  it('returns 0 for a start point off the map', () => {
    const data = [1];
    expect(bucketFill(data, 1, 1, 3, 0, 2)).toBe(0);
  });
});

describe('layers', () => {
  it('rejects a second layer of the same type and sorts by Flare priority', () => {
    const background = layer({ id: 1, type: 'background' });
    expect(canAddLayer([background], 'background')).toBe(false);
    const added = addMapLayer([background], 2, 'Object', 'object', 2, 2);
    expect(added).not.toBeNull();
    expect(added!.layers.map((l) => l.type)).toEqual(['object', 'background']);
    expect(added!.layer.data).toEqual([0, 0, 0, 0]);
    expect(added!.nextId).toBe(3);
    expect(addMapLayer(added!.layers, added!.nextId, 'Object 2', 'object', 2, 2)).toBeNull();

    const sorted = sortLayersByPriority([
      layer({ id: 1, type: 'background' }),
      layer({ id: 2, type: 'npc' }),
      layer({ id: 3, type: 'collision' }),
    ]);
    expect(sorted.map((l) => l.type)).toEqual(['npc', 'collision', 'background']);
  });

  it('will not delete the last layer, and retargets the active layer', () => {
    const layers = [
      layer({ id: 1, type: 'background' }),
      layer({ id: 2, type: 'object' }),
    ];
    expect(deleteMapLayer([layers[0]], 1, 1)).toBeNull();
    expect(deleteMapLayer(layers, 99, 1)).toBeNull();
    const removedActive = deleteMapLayer(layers, 2, 2);
    expect(removedActive).toEqual({ layers: [layers[0]], activeLayerId: 1 });
    const removedOther = deleteMapLayer(layers, 1, 2);
    expect(removedOther).toEqual({ layers: [layers[1]], activeLayerId: 2 });
  });
});

describe('undo and redo history', () => {
  it('paints, stamps or pastes, then walks back and forward through states', () => {
    const start = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    let history = [start.slice()];
    let index = 0;

    const painted = start.slice();
    paintCell(painted, 3, 3, 1, 1, 5);
    ({ history, index } = pushHistoryState(history, index, painted.slice(), 20));

    const stamp = stampFromSelection(
      [
        { x: 0, y: 0, gid: 2 },
        { x: 1, y: 0, gid: 3 },
      ],
      1,
    );
    const stamped = applyStampToGrid(painted, 3, 3, stamp!.tiles, 0, 0);
    ({ history, index } = pushHistoryState(history, index, stamped.slice(), 20));

    const clip = clipboardFromTiles([
      { x: 0, y: 0, gid: 9 },
      { x: 0, y: 1, gid: 8 },
    ]);
    const pasted = pasteTileGrid(stamped, 3, 3, clip!, 2, 1).data;
    ({ history, index } = pushHistoryState(history, index, pasted.slice(), 20));

    expect(history).toHaveLength(4);
    expect(history[index]).toEqual([2, 3, 0, 0, 5, 9, 0, 0, 8]);

    const back1 = undoIndex(index);
    expect(back1).toBe(2);
    index = back1!;
    expect(history[index]).toEqual(stamped);

    const back2 = undoIndex(index);
    index = back2!;
    expect(history[index]).toEqual(painted);
    index = undoIndex(index)!;
    expect(history[index]).toEqual(start);
    expect(undoIndex(index)).toBeNull();

    index = redoIndex(index, history.length)!;
    index = redoIndex(index, history.length)!;
    expect(history[index]).toEqual(stamped);
    index = redoIndex(index, history.length)!;
    expect(history[index]).toEqual(pasted);
    expect(redoIndex(index, history.length)).toBeNull();
  });

  it('drops future states after a new edit and caps the stack', () => {
    let history = [[0], [1], [2]];
    let index = 1; // currently on [1]; [2] is redo
    ({ history, index } = pushHistoryState(history, index, [9], 3));
    expect(history).toEqual([[0], [1], [9]]);
    expect(index).toBe(2);

    ({ history, index } = pushHistoryState(history, index, [8], 3));
    expect(history).toEqual([[1], [9], [8]]);
    expect(index).toBe(2);
  });
});
