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
      onDragLeave={() => {
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
