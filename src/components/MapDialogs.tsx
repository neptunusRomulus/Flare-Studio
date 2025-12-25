import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

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
  return (
    <>
      <Dialog
        open={showCreateMapDialog}
        onOpenChange={(open) => {
          setShowCreateMapDialog(open);
          if (!open) {
            setCreateMapError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Map</DialogTitle>
            <DialogDescription>
              Set the name, dimensions, and starting status for your new map.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showHeroEditDialog} onOpenChange={setShowHeroEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Hero Position</DialogTitle>
            <DialogDescription>
              Set the hero spawn position on the map.
            </DialogDescription>
          </DialogHeader>

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

          <DialogFooter>
            <Button variant="outline" onClick={handleHeroEditCancel}>
              Cancel
            </Button>
            <Button onClick={() => heroEditData && handleHeroEditConfirm(heroEditData.currentX, heroEditData.currentY)}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MapDialogs;
