import React from 'react';
import CanvasTips from '@/components/CanvasTips';
import MapInitOverlay from '@/components/MapInitOverlay';
import MapHoverDisplay from '@/components/MapHoverDisplay';
import NpcDeletePopup from '@/components/NpcDeletePopup';
import NpcHoverTooltip from '@/components/NpcHoverTooltip';
import SelectionInfo from '@/components/SelectionInfo';
import BottomToolbar from '@/components/BottomToolbar';
import {
  CellContextMenu,
  CellContextMenuContent,
  CellContextMenuItem,
  useContextMenu,
} from '@/components/contextMenu';
import type { TileMapEditor } from '@/editor/TileMapEditor';

type BottomToolbarProps = React.ComponentProps<typeof BottomToolbar>;

type EditorContext = {
  editor: TileMapEditor | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  draggingNpcId: number | null;
  setDraggingNpcId: (id: number | null) => void;
  draggingEventId: string | null;
  setDraggingEventId: (id: string | null) => void;
  tipsMinimized: boolean;
  setTipsMinimized: (v: boolean) => void;
  setShowHelp: (v: boolean) => void;
  isEnemyTabActive: boolean;
  mapWidth: number;
  mapHeight: number;
  handlePlaceActorOnMap: (objectId: number, x?: number, y?: number) => void;
  handlePlaceEventOnMap: (eventId: string, x: number, y: number) => void;
  mapInitialized: boolean;
  handleOpenCreateMapDialog: () => void;
  isPreparingNewMap: boolean;
  hoverCoords: { x: number; y: number } | null;
  showActiveGid: boolean;
  activeGidValue: string;
  hoverGidValue: string;
  npcDeletePopup: { npcId: number; screenX: number; screenY: number } | null;
  setNpcDeletePopup: (v: { npcId: number; screenX: number; screenY: number } | null) => void;
  handleUnplaceActorFromMap: (objectId: number) => void;
  npcHoverTooltip: { x: number; y: number } | null;
  uiHelpers?: {
    showTooltipWithDelay: (text: React.ReactNode, target: HTMLElement) => void;
    hideTooltip: () => void;
    toolbarRef: React.RefObject<HTMLDivElement>;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    tooltip?: unknown;
  };
  stampsState?: unknown;
  hasSelection: boolean;
  selectionCount: number;
  handleFillSelection: () => void;
  handleDeleteSelection: () => void;
  handleClearSelection: () => void;
  leftTransitioning: boolean;
  isDarkMode: boolean;
};

type Props = {
  ctx: EditorContext;
  bottomToolbarProps: BottomToolbarProps;
  isDarkMode: boolean;
};

export default function EditorCanvas(props: Props) {
  const { ctx, bottomToolbarProps, isDarkMode } = props;
  const canvasAreaRef = React.useRef<HTMLDivElement | null>(null);
  const {
    editor,
    canvasRef,
    draggingNpcId,
    setDraggingNpcId,
    draggingEventId,
    setDraggingEventId,
    tipsMinimized,
    setTipsMinimized,
    setShowHelp,
    isEnemyTabActive,
    mapWidth,
    mapHeight,
    handlePlaceActorOnMap,
    handlePlaceEventOnMap,
    mapInitialized,
    handleOpenCreateMapDialog,
    isPreparingNewMap,
    hoverCoords,
    showActiveGid,
    activeGidValue,
    hoverGidValue,
    npcDeletePopup,
    setNpcDeletePopup,
    handleUnplaceActorFromMap,
    npcHoverTooltip,
    hasSelection,
    selectionCount,
    handleFillSelection,
    handleDeleteSelection,
    handleClearSelection,
    leftTransitioning
  } = ctx;

  const [cursorScreenPos, setCursorScreenPos] = React.useState<{x: number, y: number} | null>(null);
  const [ctrlCursorTileCoords, setCtrlCursorTileCoords] = React.useState<{x: number, y: number} | null>(null);
  const [isCtrlHeld, setIsCtrlHeld] = React.useState(false);
  const [minimapHoverCoords, setMinimapHoverCoords] = React.useState<{x: number, y: number} | null>(null);
  const [minimapTooltipFadeOut, setMinimapTooltipFadeOut] = React.useState(false);
  const minimapFadeTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        console.log('[EditorCanvas] Ctrl/Meta key down detected');
        setIsCtrlHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ControlLeft' || e.code === 'ControlRight' || e.code === 'MetaLeft' || e.code === 'MetaRight') {
        console.log('[EditorCanvas] Ctrl/Meta key up detected');
        setIsCtrlHeld(false);
      }
    };
    const handleBlur = () => setIsCtrlHeld(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Cleanup minimap fade timeout on unmount
  React.useEffect(() => {
    return () => {
      if (minimapFadeTimeoutRef.current !== null) {
        window.clearTimeout(minimapFadeTimeoutRef.current);
      }
    };
  }, []);

  // Context menu state
  const contextMenu = useContextMenu();

  // Ensure the editor is bound to the current canvas element. React may replace the canvas
  // node during re-renders; call `editor.updateCanvas` when the DOM node is present so the
  // editor rebinds its mouse events to the live canvas.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (!editor || !canvasRef?.current) return;
    try {
      editor.updateCanvas(canvasRef.current);
    } catch (e) {
      console.warn('EditorCanvas: failed to update editor canvas reference', e);
    }
  }, [editor, (canvasRef as any)?.current]);

  // Set up cell right-click context menu callback
  React.useEffect(() => {
    if (!editor) {
      return;
    }

    const handleCellRightClick = (cellX: number, cellY: number, screenX: number, screenY: number) => {
      contextMenu.setCellCoords({ x: cellX, y: cellY });
      contextMenu.openAtPosition(screenX, screenY);
    };

    editor.setCellRightClickCallback(handleCellRightClick);

    return () => {
      editor.setCellRightClickCallback(null);
    };
  }, [editor, contextMenu]);

  return (
    <div
      ref={canvasAreaRef}
      className={`bg-gray-100 flex-1 min-h-0 flex overflow-hidden relative ${draggingNpcId || draggingEventId ? 'ring-2 ring-orange-500 ring-inset' : ''}`}
      onMouseMove={(e) => {
        setCursorScreenPos({ x: e.clientX, y: e.clientY });
        
        // Compute tile coordinates from cursor position
        if (editor && canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          const canvasX = e.clientX - rect.left;
          const canvasY = e.clientY - rect.top;
          const tileCoords = editor.screenToTile(canvasX, canvasY);
          if (tileCoords) {
            setCtrlCursorTileCoords(tileCoords);
          } else {
            setCtrlCursorTileCoords(null);
          }
          
          // Check if mouse is over minimap and compute hover coordinates
          const minimapBounds = editor.getLastMiniMapBounds();
          if (minimapBounds) {
            if (canvasX >= minimapBounds.x && canvasX <= minimapBounds.x + minimapBounds.w &&
                canvasY >= minimapBounds.y && canvasY <= minimapBounds.y + minimapBounds.h) {
              // Mouse is over minimap, compute which cell is hovered
              const relX = canvasX - minimapBounds.x;
              const relY = canvasY - minimapBounds.y;
              
              // Get minimap zoom and mode from editor
              const minimapZoom = editor.getMinimapZoom();
              const minimapMode = editor.getMinimapMode();
              
              // Calculate tile pixel size and offsets same as minimap rendering
              let tilePixel = 1;
              let offsetX = 0;
              let offsetY = 0;
              let mapPixelWidth = 0;
              let mapPixelHeight = 0;
              
              if (minimapMode === 'isometric') {
                const maxTileWidth = Math.floor(minimapBounds.w * 2 / (mapWidth + mapHeight)) || 1;
                const maxTileHeight = Math.floor(minimapBounds.h * 4 / (mapWidth + mapHeight)) || 1;
                tilePixel = Math.max(1, Math.min(maxTileWidth, maxTileHeight)) * minimapZoom;
                
                mapPixelWidth = (mapWidth + mapHeight) * (tilePixel / 2);
                mapPixelHeight = (mapWidth + mapHeight) * (tilePixel / 4);
                offsetX = minimapBounds.w / 2 - (mapWidth - mapHeight) * (tilePixel / 4);
                offsetY = minimapBounds.h / 2 - (mapWidth + mapHeight) * (tilePixel / 8);
              } else {
                const maxTileWidth = Math.floor(minimapBounds.w / mapWidth) || 1;
                const maxTileHeight = Math.floor(minimapBounds.h / mapHeight) || 1;
                tilePixel = Math.max(1, Math.min(maxTileWidth, maxTileHeight)) * minimapZoom;
                
                mapPixelWidth = mapWidth * tilePixel;
                mapPixelHeight = mapHeight * tilePixel;
                offsetX = Math.floor((minimapBounds.w - mapPixelWidth) / 2);
                offsetY = Math.floor((minimapBounds.h - mapPixelHeight) / 2);
              }
              
              // Subtract offset to get position within rendered content
              const contentX = relX - offsetX;
              const contentY = relY - offsetY;
              
              // Calculate cell based on mode
              let cellX = 0, cellY = 0;
              if (minimapMode === 'isometric') {
                // For isometric, convert from screen coordinates to tile coordinates
                cellX = Math.floor((contentX / (tilePixel / 2) + contentY / (tilePixel / 4)) / 2);
                cellY = Math.floor((contentY / (tilePixel / 4) - contentX / (tilePixel / 2)) / 2);
              } else {
                // For orthogonal, simple division
                cellX = Math.floor(contentX / tilePixel);
                cellY = Math.floor(contentY / tilePixel);
              }
              
              if (cellX >= 0 && cellX < mapWidth && cellY >= 0 && cellY < mapHeight) {
                const newCoords = { x: cellX, y: cellY };
                setMinimapHoverCoords(newCoords);
                setMinimapTooltipFadeOut(false);
                editor.setMinimapHoverCoords(newCoords);
                
                // Clear any existing fade timeout
                if (minimapFadeTimeoutRef.current !== null) {
                  window.clearTimeout(minimapFadeTimeoutRef.current);
                  minimapFadeTimeoutRef.current = null;
                }
              } else {
                setMinimapHoverCoords(null);
                editor.setMinimapHoverCoords(null);
              }
            } else {
              setMinimapHoverCoords(null);
              editor.setMinimapHoverCoords(null);
            }
          }
        }
      }}
      onDragOver={(e) => {
        if (editor && canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          const canvasX = e.clientX - rect.left;
          const canvasY = e.clientY - rect.top;

          if (draggingNpcId) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            editor.setNpcDragHover(canvasX, canvasY);
          } else if (draggingEventId) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            editor.setEventDragHover(canvasX, canvasY);
          }
        }
      }}
      onMouseLeave={() => {
        setCursorScreenPos(null);
        setCtrlCursorTileCoords(null);
        
        // Fade out minimap tooltip
        setMinimapTooltipFadeOut(true);
        if (minimapFadeTimeoutRef.current !== null) {
          window.clearTimeout(minimapFadeTimeoutRef.current);
        }
        minimapFadeTimeoutRef.current = window.setTimeout(() => {
          setMinimapHoverCoords(null);
          if (editor) {
            editor.setMinimapHoverCoords(null);
          }
          setMinimapTooltipFadeOut(false);
          minimapFadeTimeoutRef.current = null;
        }, 300); // Match fade animation duration
      }}
      onDragLeave={() => {
        setCursorScreenPos(null);
        setCtrlCursorTileCoords(null);
        if (draggingNpcId && editor) editor.clearNpcDragHover();
        if (draggingEventId && editor) editor.clearEventDragHover();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas || !editor) return;

        // Handle NPC drop
        const npcIdStr = e.dataTransfer.getData('npc-id');
        if (npcIdStr) {
          const npcId = parseInt(npcIdStr, 10);
          if (!isNaN(npcId)) {
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            const mapCoords = editor.screenToTile(canvasX, canvasY);
            if (mapCoords && mapCoords.x >= 0 && mapCoords.x < mapWidth && mapCoords.y >= 0 && mapCoords.y < mapHeight) {
              handlePlaceActorOnMap(npcId, mapCoords.x, mapCoords.y);
            }
          }
          editor.clearNpcDragHover();
          setDraggingNpcId(null);
          return;
        }

        // Handle Event drop
        const eventIdStr = e.dataTransfer.getData('event-id');
        if (eventIdStr) {
          const rect = canvas.getBoundingClientRect();
          const canvasX = e.clientX - rect.left;
          const canvasY = e.clientY - rect.top;
          const mapCoords = editor.screenToTile(canvasX, canvasY);
          if (mapCoords && mapCoords.x >= 0 && mapCoords.x < mapWidth && mapCoords.y >= 0 && mapCoords.y < mapHeight) {
            handlePlaceEventOnMap(eventIdStr, mapCoords.x, mapCoords.y);
          }
          editor.clearEventDragHover();
          setDraggingEventId(null);
        }
      }}
    >
      <CanvasTips
        tipsMinimized={tipsMinimized}
        setTipsMinimized={setTipsMinimized}
        setShowHelp={setShowHelp}
        isEnemyTabActive={isEnemyTabActive}
      />

      <canvas
        ref={canvasRef}
        id="mapCanvas"
        className={`tile-canvas flex-1 canvas-fade ${leftTransitioning ? 'during-sidebar-transition' : ''}`}
      />

      <MapInitOverlay mapInitialized={mapInitialized} handleOpenCreateMapDialog={handleOpenCreateMapDialog} isPreparingNewMap={isPreparingNewMap} />

      <MapHoverDisplay hoverCoords={hoverCoords} showActiveGid={showActiveGid} activeGidValue={activeGidValue} hoverGidValue={hoverGidValue} isEnemyTabActive={isEnemyTabActive} />

      <NpcDeletePopup npcDeletePopup={npcDeletePopup} onConfirm={handleUnplaceActorFromMap} onCancel={() => setNpcDeletePopup(null)} />

      <NpcHoverTooltip npcHoverTooltip={npcHoverTooltip} />

      <SelectionInfo
        editor={editor}
        canvasRef={canvasRef}
        containerRef={canvasAreaRef}
        hasSelection={hasSelection}
        selectionCount={selectionCount}
        handleFillSelection={handleFillSelection}
        handleDeleteSelection={handleDeleteSelection}
        handleClearSelection={handleClearSelection}
      />

      {contextMenu.isOpen && contextMenu.cellCoords && contextMenu.position ? (
        <div
          className="fixed z-[100] px-2 py-1 bg-black/90 text-white text-xs rounded shadow-lg pointer-events-none flex items-center gap-1.5"
          style={{ left: contextMenu.position.x + 12, top: contextMenu.position.y - 30 }}
        >
          <span>{contextMenu.cellCoords.x}, {contextMenu.cellCoords.y}</span>
        </div>
      ) : isCtrlHeld && cursorScreenPos && ctrlCursorTileCoords ? (
         <div
           className="fixed z-[100] px-2 py-1 bg-black/90 text-white text-xs rounded shadow-lg pointer-events-none flex items-center gap-1.5"
           style={{ left: cursorScreenPos.x + 12, top: cursorScreenPos.y - 30 }}
         >
           <span>{`${ctrlCursorTileCoords.x}, ${ctrlCursorTileCoords.y}`}</span>
         </div>
      ) : null}

      {minimapHoverCoords ? (
        <div
          className={`fixed z-[100] px-2 py-1 bg-black/90 text-white text-xs rounded shadow-lg pointer-events-none flex items-center gap-1.5 transition-opacity duration-300 ${minimapTooltipFadeOut ? 'opacity-0' : 'opacity-100'}`}
          style={{ 
            left: (cursorScreenPos?.x ?? 0) + 12, 
            top: (cursorScreenPos?.y ?? 0) - 30 
          }}
        >
          <span>{`${minimapHoverCoords.x}, ${minimapHoverCoords.y}`}</span>
        </div>
      ) : null}

      <CellContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={contextMenu.close}
        isDarkMode={isDarkMode}
      >
        <CellContextMenuContent>
          <CellContextMenuItem
            label="Item 1"
            onClick={() => {
              console.log('Context menu item 1 clicked at', contextMenu.cellCoords);
              contextMenu.close();
            }}
          />
          <CellContextMenuItem
            label="Item 2"
            onClick={() => {
              console.log('Context menu item 2 clicked at', contextMenu.cellCoords);
              contextMenu.close();
            }}
          />
        </CellContextMenuContent>
      </CellContextMenu>

          <BottomToolbar {...bottomToolbarProps} />
    </div>
  );
}
