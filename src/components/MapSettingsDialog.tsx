import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { HelpCircle, X } from 'lucide-react';

type MapSettingsDialogProps = {
  open: boolean;
  onClose: () => void;
  mapName: string;
  setMapName: (value: string) => void;
  mapWidth: number;
  setMapWidth: (value: number) => void;
  mapHeight: number;
  setMapHeight: (value: number) => void;
  isStartingMap: boolean;
  updateStartingMap: (nextValue: boolean) => void;
  handleMapResize: () => void;
};

const MapSettingsDialog = ({
  open,
  onClose,
  mapName,
  setMapName,
  mapWidth,
  setMapWidth,
  mapHeight,
  setMapHeight,
  isStartingMap,
  updateStartingMap,
  handleMapResize
}: MapSettingsDialogProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-6 w-96">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Map Settings — {mapName}</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-8 h-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Map Name</label>
            <Input
              type="text"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              placeholder="Enter map name"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Map Width</label>
            <Input
              type="number"
              value={mapWidth}
              onChange={(e) => setMapWidth(Number(e.target.value))}
              min="1"
              max="100"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Map Height</label>
            <Input
              type="number"
              value={mapHeight}
              onChange={(e) => setMapHeight(Number(e.target.value))}
              min="1"
              max="100"
              className="w-full"
            />
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
            <div className="flex items-center gap-2">
              <label htmlFor="starting-map-checkbox-modal" className="text-sm font-medium text-muted-foreground">
                Starting Map
              </label>
              <Tooltip content="If this map is the map that players will start the game then mark this option">
                <HelpCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
              </Tooltip>
            </div>
            <input
              id="starting-map-checkbox-modal"
              type="checkbox"
              className="h-4 w-4 rounded border border-border accent-orange-500"
              checked={isStartingMap}
              onChange={(e) => updateStartingMap(e.target.checked)}
              aria-checked={isStartingMap}
              aria-label="Set this map as the starting map"
            />
          </div>
          <div className="flex gap-2 mt-6">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleMapResize();
                onClose();
              }}
              className="flex-1"
            >
              Apply Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapSettingsDialog;
