import { useState, useCallback } from 'react';
import type { CellContextMenuPosition } from './CellContextMenu';

export interface UseContextMenuReturn {
  isOpen: boolean;
  position: CellContextMenuPosition | null;
  openAtPosition: (x: number, y: number) => void;
  close: () => void;
  cellCoords: { x: number; y: number } | null;
  setCellCoords: (coords: { x: number; y: number } | null) => void;
}

/**
 * useContextMenu
 * 
 * Hook to manage context menu state including position and cell coordinates.
 * 
 * Usage:
 * ```tsx
 * const contextMenu = useContextMenu();
 * 
 * const handleRightClick = (screenX: number, screenY: number, cellX: number, cellY: number) => {
 *   contextMenu.setCellCoords({ x: cellX, y: cellY });
 *   contextMenu.openAtPosition(screenX, screenY);
 * };
 * 
 * return (
 *   <>
 *     <CellContextMenu
 *       isOpen={contextMenu.isOpen}
 *       position={contextMenu.position}
 *       onClose={contextMenu.close}
 *     >
 *       {contextMenu.cellCoords && (
 *         <div>Cell: {contextMenu.cellCoords.x}, {contextMenu.cellCoords.y}</div>
 *       )}
 *     </CellContextMenu>
 *   </>
 * );
 * ```
 */
export const useContextMenu = (): UseContextMenuReturn => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<CellContextMenuPosition | null>(null);
  const [cellCoords, setCellCoords] = useState<{ x: number; y: number } | null>(null);

  const openAtPosition = useCallback((x: number, y: number) => {
    console.log('[useContextMenu] openAtPosition called with:', { x, y });
    setPosition({ x, y });
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    console.log('[useContextMenu] close called');
    setIsOpen(false);
    // Reset position after close animation
    setTimeout(() => {
      setPosition(null);
      setCellCoords(null);
    }, 150);
  }, []);

  return {
    isOpen,
    position,
    openAtPosition,
    close,
    cellCoords,
    setCellCoords,
  };
};
