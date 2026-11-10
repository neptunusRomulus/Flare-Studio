import { useState, useCallback, useRef } from 'react';
import type { DragEvent } from 'react';

/**
 * Lightweight hook for HTML5 drag-and-drop list reordering with animations.
 *
 * Returns:
 * - `dragIdx`   – index of the item currently being dragged (or null)
 * - `overIdx`   – index of the current drop-target item (or null)
 * - `dropEdge`  – 'top' | 'bottom' depending on cursor position within item
 * - `droppedIdx`– index that just received a drop (flashes briefly, then null)
 * - `getItemDragProps(index)` – spread onto each list-item element
 * - `getItemDropProps(index)` – drop-target half only (item drags elsewhere, handle reorders)
 * - `startReorder(e, index)` / `endReorder()` – for a dedicated drag handle
 * - `reorderClass(index)` – computed className string for the item
 */
/**
 * Map-placement drags carry their own payload (npc-id / event-id) and must not be treated
 * as reorder drags by the list rows they pass over.
 */
function isPlacementDrag(dataTransfer: DataTransfer): boolean {
  const types = Array.from(dataTransfer.types);
  return types.includes('npc-id') || types.includes('event-id');
}

/** Reorder drags carry their source index in text/plain; other drags (map placement) leave it empty. */
function reorderIndexFrom(dataTransfer: DataTransfer): number {
  const raw = dataTransfer.getData('text/plain').trim();
  if (!raw || !/^\d+$/.test(raw)) return NaN;
  return Number(raw);
}

export default function useListReorder<T>(
  items: T[],
  idOf: (item: T) => string | number,
  onReorder: (fromIndex: number, toIndex: number) => void,
) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [dropEdge, setDropEdge] = useState<'top' | 'bottom' | null>(null);
  const [droppedIdx, setDroppedIdx] = useState<number | null>(null);
  const dragCounter = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getItemDragProps = useCallback(
    (index: number) => ({
      draggable: true,
      onDragStart: (e: DragEvent) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
        // Tiny delay so the browser captures the element before we style it
        requestAnimationFrame(() => setDragIdx(index));
      },
      onDragEnd: () => {
        setDragIdx(null);
        setOverIdx(null);
        setDropEdge(null);
        dragCounter.current = 0;
      },
      onDragEnter: (e: DragEvent) => {
        if (isPlacementDrag(e.dataTransfer)) return;
        e.preventDefault();
        dragCounter.current += 1;
        setOverIdx(index);
      },
      onDragLeave: () => {
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) {
          dragCounter.current = 0;
          setOverIdx((prev) => (prev === index ? null : prev));
          setDropEdge(null);
        }
      },
      onDragOver: (e: DragEvent) => {
        if (isPlacementDrag(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        // Determine top/bottom half of the element for directional indicator
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        setDropEdge(e.clientY < midY ? 'top' : 'bottom');
        setOverIdx(index);
      },
      onDrop: (e: DragEvent) => {
        if (isPlacementDrag(e.dataTransfer)) return;
        e.preventDefault();
        const from = reorderIndexFrom(e.dataTransfer);
        if (!Number.isNaN(from) && from !== index) {
          onReorder(from, index);
          // Flash the landed item
          setDroppedIdx(index);
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setDroppedIdx(null), 500);
        }
        setDragIdx(null);
        setOverIdx(null);
        setDropEdge(null);
        dragCounter.current = 0;
      },
    }),
    [onReorder],
  );

  /**
   * Drop half only: for lists where the item itself drags elsewhere (e.g. onto the map)
   * and a separate handle starts the reorder. Drop props never make the item draggable.
   */
  const getItemDropProps = useCallback(
    (index: number) => ({
      onDragEnter: (e: DragEvent) => {
        if (isPlacementDrag(e.dataTransfer)) return;
        e.preventDefault();
        dragCounter.current += 1;
        setOverIdx(index);
      },
      onDragLeave: () => {
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) {
          dragCounter.current = 0;
          setOverIdx((prev) => (prev === index ? null : prev));
          setDropEdge(null);
        }
      },
      onDragOver: (e: DragEvent) => {
        if (isPlacementDrag(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        setDropEdge(e.clientY < midY ? 'top' : 'bottom');
        setOverIdx(index);
      },
      onDrop: (e: DragEvent) => {
        if (isPlacementDrag(e.dataTransfer)) return;
        e.preventDefault();
        const from = reorderIndexFrom(e.dataTransfer);
        if (!Number.isNaN(from) && from !== index) {
          onReorder(from, index);
          setDroppedIdx(index);
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setDroppedIdx(null), 500);
        }
        setDragIdx(null);
        setOverIdx(null);
        setDropEdge(null);
        dragCounter.current = 0;
      },
    }),
    [onReorder],
  );

  /** Reorder start for a dedicated handle; the handle must stop the event from reaching its parent. */
  const startReorder = useCallback((e: DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    requestAnimationFrame(() => setDragIdx(index));
  }, []);

  const endReorder = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
    setDropEdge(null);
    dragCounter.current = 0;
  }, []);

  /** Pre-built class string for drag/drop visual feedback. */
  const reorderClass = useCallback(
    (index: number): string => {
      const parts: string[] = [];
      // Smooth transitions for all animated properties
      parts.push('transition-all duration-200 ease-in-out');
      if (dragIdx === index) {
        // The item being dragged – shrink & ghost it
        parts.push('opacity-30 scale-95');
      }
      if (overIdx === index && dragIdx !== null && dragIdx !== index) {
        // Drop-target indicator – inset box-shadow so layout is never affected
        if (dropEdge === 'top') {
          parts.push('shadow-[inset_0_2px_0_0_rgb(249,115,22)]');
        } else {
          parts.push('shadow-[inset_0_-2px_0_0_rgb(249,115,22)]');
        }
      }
      if (droppedIdx === index) {
        // Flash animation after drop
        parts.push('animate-reorder-flash');
      }
      return parts.join(' ');
    },
    [dragIdx, overIdx, dropEdge, droppedIdx],
  );

  return { dragIdx, overIdx, dropEdge, droppedIdx, getItemDragProps, getItemDropProps, startReorder, endReorder, reorderClass };
}
