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
 * - `reorderClass(index)` – computed className string for the item
 */
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
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        // Determine top/bottom half of the element for directional indicator
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        setDropEdge(e.clientY < midY ? 'top' : 'bottom');
        setOverIdx(index);
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData('text/plain'));
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

  return { dragIdx, overIdx, dropEdge, droppedIdx, getItemDragProps, reorderClass };
}
