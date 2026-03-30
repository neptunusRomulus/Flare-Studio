import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { HelpCircle, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';

type HeroEditData = {
  currentX: number;
  currentY: number;
  mapWidth: number;
  mapHeight: number;
  onConfirm: (x: number, y: number) => void;
};

type MapDialogsProps = {
  showCreateMapDialog: boolean;
  setShowCreateMapDialog: (open: boolean) => void;
  newMapName: string;
  setNewMapName: (value: string) => void;
  newMapWidth: number;
  setNewMapWidth: (value: number) => void;
  newMapHeight: number;
  setNewMapHeight: (value: number) => void;
  newMapStarting: boolean;
  setNewMapStarting: (value: boolean) => void;
  createMapError: string | null;
  setCreateMapError: (value: string | null) => void;
  isPreparingNewMap: boolean;
  handleConfirmCreateMap: () => void;
  showHeroEditDialog: boolean;
  setShowHeroEditDialog: (open: boolean) => void;
  heroEditData: HeroEditData | null;
  setHeroEditData: (value: HeroEditData | null) => void;
  handleHeroEditCancel: () => void;
  handleHeroEditConfirm: (x: number, y: number) => void;
};

const MapDialogs = ({
  showCreateMapDialog,
  setShowCreateMapDialog,
  newMapName,
  setNewMapName,
  newMapWidth,
  setNewMapWidth,
  newMapHeight,
  setNewMapHeight,
  newMapStarting,
  setNewMapStarting,
  createMapError,
  setCreateMapError,
  isPreparingNewMap,
  handleConfirmCreateMap,
  showHeroEditDialog,
  setShowHeroEditDialog,
  heroEditData,
  setHeroEditData,
  handleHeroEditCancel,
  handleHeroEditConfirm
}: MapDialogsProps) => {
  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useDraggableResizable({ id: 'create_map', initialWidth: 420, initialHeight: 350, minWidth: 350, minHeight: 300 });

  const {
    position: heroPosition,
    size: heroSize,
    dialogRef: heroDialogRef,
    handleHeaderMouseDown: handleHeroHeaderMouseDown,
    handleResizeMouseDown: handleHeroResizeMouseDown,
  } = useDraggableResizable({ id: 'hero_edit', initialWidth: 380, initialHeight: 320, minWidth: 320, minHeight: 280 });

  return (
    <>
      {showCreateMapDialog && createPortal(
        <div 
          ref={dialogRef}
          className="bg-background border border-border/70 rounded-lg flex flex-col shadow-xl"
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
            zIndex: 50,
            pointerEvents: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="flex items-center justify-between p-4 border-b border-border cursor-move select-none"
            onMouseDown={handleHeaderMouseDown}
          >
            <h3 className="font-semibold">Create Map</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowCreateMapDialog(false);
                setCreateMapError(null);
              }}
              className="w-6 h-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Map Name
              </label>
              <Input
                value={newMapName}
                onChange={(e) => {
                  setNewMapName(e.target.value);
                  if (createMapError) {
                    setCreateMapError(null);
                  }
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                }}
                placeholder="Enter map name"
                autoFocus
              />
              {createMapError && (
                <p className="mt-1 text-xs text-red-500">{createMapError}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Width (tiles)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={newMapWidth}
                  onChange={(e) => setNewMapWidth(Math.max(1, Number.parseInt(e.target.value, 10) || 0))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Height (tiles)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={newMapHeight}
                  onChange={(e) => setNewMapHeight(Math.max(1, Number.parseInt(e.target.value, 10) || 0))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <label htmlFor="starting-map-checkbox" className="text-sm font-medium text-muted-foreground">
                  Starting Map
                </label>
                <Tooltip content="If this map is the map that players will start the game then mark this option">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
                </Tooltip>
              </div>
              <input
                id="starting-map-checkbox"
                type="checkbox"
                className="h-4 w-4 rounded border border-border accent-orange-500"
                checked={newMapStarting}
                onChange={(e) => setNewMapStarting(e.target.checked)}
                aria-checked={newMapStarting}
                aria-label="Set this map as the starting map"
              />
            </div>
          </div>

          <div className="flex gap-2 p-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateMapDialog(false);
                setCreateMapError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmCreateMap}
              disabled={isPreparingNewMap}
              className="flex items-center gap-2"
            >
              {isPreparingNewMap ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create</span>
              )}
            </Button>
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-40 hover:opacity-100 transition-opacity flex items-end justify-end"
            title="Drag to resize"
          >
            <div className="w-1.5 h-1.5 bg-foreground/40 rounded-sm m-1" />
          </div>
        </div>,
        document.body
      )}

      {showHeroEditDialog && createPortal(
        <div 
          ref={heroDialogRef}
          className="bg-background border border-border/70 rounded-lg flex flex-col shadow-xl"
          style={{
            position: 'fixed',
            left: `${heroPosition.x}px`,
            top: `${heroPosition.y}px`,
            width: `${heroSize.width}px`,
            height: `${heroSize.height}px`,
            zIndex: 50,
            pointerEvents: 'auto',
          }}
        >
          {/* Header */}
          <div
            onMouseDown={handleHeroHeaderMouseDown}
            className="flex items-center justify-between px-4 py-3 border-b border-border cursor-move select-none bg-muted/30"
          >
            <h2 className="text-lg font-semibold">Edit Hero Position</h2>
            <button
              onClick={() => {
                setShowHeroEditDialog(false);
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4">
            <p className="text-sm text-muted-foreground mb-4">
              Set the hero spawn position on the map.
            </p>

            {heroEditData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">X Position</label>
                    <Input
                      type="number"
                      min={0}
                      max={heroEditData.mapWidth - 1}
                      defaultValue={heroEditData.currentX}
                      onChange={(e) => {
                        const newX = parseInt(e.target.value);
                        if (!Number.isNaN(newX)) {
                          setHeroEditData({
                            ...heroEditData,
                            currentX: newX
                          });
                        }
                      }}
                    />
                    <span className="text-xs text-gray-500">
                      (0 - {heroEditData.mapWidth - 1})
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Y Position</label>
                    <Input
                      type="number"
                      min={0}
                      max={heroEditData.mapHeight - 1}
                      defaultValue={heroEditData.currentY}
                      onChange={(e) => {
                        const newY = parseInt(e.target.value);
                        if (!Number.isNaN(newY)) {
                          setHeroEditData({
                            ...heroEditData,
                            currentY: newY
                          });
                        }
                      }}
                    />
                    <span className="text-xs text-gray-500">
                      (0 - {heroEditData.mapHeight - 1})
                    </span>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  Current position: ({heroEditData.currentX}, {heroEditData.currentY})
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 p-4 border-t border-border">
            <Button 
              variant="outline" 
              onClick={handleHeroEditCancel}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => heroEditData && handleHeroEditConfirm(heroEditData.currentX, heroEditData.currentY)}
            >
              Confirm
            </Button>
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={handleHeroResizeMouseDown}
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-40 hover:opacity-100 transition-opacity flex items-end justify-end"
            title="Drag to resize"
          >
            <div className="w-1.5 h-1.5 bg-foreground/40 rounded-sm m-1" />
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default MapDialogs;
