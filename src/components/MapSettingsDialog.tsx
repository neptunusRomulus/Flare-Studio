import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { HelpCircle, X, Save, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import { emptyMapPresentation, type MapPresentation } from '@/editor/studioDrafts';
import { MapPresentationFields } from '@/components/studio/studioEditors';
import { AnchoredConfirm } from '@/components/ui/inline-confirm';
import ResizeHandle from '@/components/ResizeHandle';
import { toast } from '@/hooks/use-toast';
import { renameIfNameChanged } from '@/editor/identityFromName';

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
  editor?: TileMapEditor | null;
  projectPath?: string | null;
  currentMapFileId?: string;
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
  handleDeleteMap,
  editor,
  projectPath = null,
  currentMapFileId = '',
}: MapSettingsDialogProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [presentation, setPresentation] = useState<MapPresentation>(() => emptyMapPresentation());
  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useDraggableResizable({ id: 'map_settings', initialWidth: 460, initialHeight: 640, minWidth: 400, minHeight: 420 });
  
  const openedRef = useRef({ name: mapName, fileId: currentMapFileId });

  useEffect(() => {
    if (!open) return;
    openedRef.current = { name: mapName, fileId: currentMapFileId };
    // Capture name/file only when the dialog opens, not while the user types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !editor?.getMapPresentation) return;
    setPresentation(editor.getMapPresentation());
  }, [open, editor]);

  const handleConfirmDelete = async () => {
    const success = await handleDeleteMap();
    if (success) {
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  const saveSettings = async () => {
    const nextName = mapName.trim();
    const opened = openedRef.current;
    if (nextName && projectPath && opened.fileId && nextName !== opened.name.trim()) {
      const result = await renameIfNameChanged(projectPath, 'map', opened.fileId, nextName);
      if (!result.ok) {
        toast({ title: 'Could not rename the map', description: result.error, variant: 'destructive' });
        return;
      }
    }
    editor?.setMapPresentation?.(presentation);
    handleMapResize();
    onClose();
  };

  if (!open) return null;

  const dialogContent = (
    <>
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
          className="flex justify-between items-center p-4 border-b border-border cursor-move select-none"
          onMouseDown={handleHeaderMouseDown}
        >
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

        <div className="flex-1 overflow-y-auto space-y-4 p-4">
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
          <MapPresentationFields value={presentation} onChange={setPresentation} />
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
                onClick={() => { void saveSettings(); }}
                className="w-8 h-8 p-0"
                aria-label="Save map settings"
              >
                <Save className="w-4 h-4" />
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* Resize handle */}
        <ResizeHandle onMouseDown={handleResizeMouseDown} />
      </div>
      <AnchoredConfirm open={showDeleteConfirm} onCancel={() => setShowDeleteConfirm(false)} onConfirm={handleConfirmDelete} />
    </>
  );

  return createPortal(dialogContent, document.body);
};

export default MapSettingsDialog;
