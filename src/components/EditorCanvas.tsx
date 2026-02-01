import React from 'react';
import CanvasTips from '@/components/CanvasTips';
import MapInitOverlay from '@/components/MapInitOverlay';
import MapHoverDisplay from '@/components/MapHoverDisplay';
import NpcDeletePopup from '@/components/NpcDeletePopup';
import NpcHoverTooltip from '@/components/NpcHoverTooltip';
import SelectionInfo from '@/components/SelectionInfo';
import BottomToolbar from '@/components/BottomToolbar';
import type { TileMapEditor } from '@/editor/TileMapEditor';

type BottomToolbarProps = React.ComponentProps<typeof BottomToolbar>;

type EditorContext = {
  editor: TileMapEditor | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  draggingNpcId: number | null;
  setDraggingNpcId: (id: number | null) => void;
  tipsMinimized: boolean;
  setTipsMinimized: (v: boolean) => void;
  setShowHelp: (v: boolean) => void;
  isEnemyTabActive: boolean;
  mapWidth: number;
  mapHeight: number;
  handlePlaceActorOnMap: (objectId: number, x?: number, y?: number) => void;
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
};

type Props = {
  ctx: EditorContext;
  bottomToolbarProps: BottomToolbarProps;
};

export default function EditorCanvas(props: Props) {
  const { ctx, bottomToolbarProps } = props;
  const {
    editor,
    canvasRef,
    draggingNpcId,
    setDraggingNpcId,
    tipsMinimized,
    setTipsMinimized,
    setShowHelp,
    isEnemyTabActive,
    mapWidth,
    mapHeight,
    handlePlaceActorOnMap,
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

  return (
    <div
      className={`bg-gray-100 flex-1 min-h-0 flex overflow-hidden relative ${draggingNpcId ? 'ring-2 ring-orange-500 ring-inset' : ''}`}
          onDragOver={(e) => {
        if (draggingNpcId && editor) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const canvas = canvasRef.current;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            editor.setNpcDragHover(canvasX, canvasY);
          }
        }
      }}
      onDragLeave={() => { if (draggingNpcId && editor) editor.clearNpcDragHover(); }}
      onDrop={(e) => {
        e.preventDefault();
        const npcIdStr = e.dataTransfer.getData('npc-id');
        if (!npcIdStr || !editor) return;
        const npcId = parseInt(npcIdStr, 10);
        if (isNaN(npcId)) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const mapCoords = editor.screenToTile(canvasX, canvasY);
        if (mapCoords && mapCoords.x >= 0 && mapCoords.x < mapWidth && mapCoords.y >= 0 && mapCoords.y < mapHeight) {
          handlePlaceActorOnMap(npcId, mapCoords.x, mapCoords.y);
        }
        editor.clearNpcDragHover();
        setDraggingNpcId(null);
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

      <SelectionInfo hasSelection={hasSelection} selectionCount={selectionCount} handleFillSelection={handleFillSelection} handleDeleteSelection={handleDeleteSelection} handleClearSelection={handleClearSelection} />

          <BottomToolbar {...bottomToolbarProps} />
    </div>
  );
}
