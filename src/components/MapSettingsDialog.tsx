import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { HelpCircle, X, Save, Trash2, Check } from 'lucide-react';

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
  handleDeleteMap: () => Promise<boolean>;
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
  handleMapResize,
  handleDeleteMap
}: MapSettingsDialogProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const handleConfirmDelete = async () => {
    const success = await handleDeleteMap();
    if (success) {
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-6 w-96">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Map Settings - {mapName}</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="w-8 h-8 p-0"
              aria-label="Close map settings"
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
          <div className="flex items-center justify-between gap-2 mt-6">
            <Tooltip content="Delete Map">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-8 h-8 p-0 text-destructive hover:bg-destructive/10"
                aria-label="Delete map"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </Tooltip>
            <div className="flex-1" />
            <Tooltip content="Save changes">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  handleMapResize();
                  onClose();
                }}
                className="w-8 h-8 p-0"
                aria-label="Save map settings"
              >
                <Save className="w-4 h-4" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50" style={{ zIndex: 60 }}>
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background px-4 py-5 shadow-lg w-64 text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">are you sure?</p>
            <div className="flex items-center gap-3">
              <Button
                variant="default"
                size="icon"
                className="h-10 w-10 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                aria-label="Confirm delete map"
                onClick={handleConfirmDelete}
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full"
                aria-label="Cancel delete map"
                onClick={() => setShowDeleteConfirm(false)}
              >
                <X className="w-4 h-4 text-foreground" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapSettingsDialog;
