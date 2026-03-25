import { useCallback } from 'react';
import type { MapConfig } from '../editor/mapConfig';
import type { EditorProjectData } from '../editor/TileMapEditor';
import type { Dispatch, SetStateAction } from 'react';
import type { TileLayer, MapObject, Stamp } from '../types';
import type { TileMapEditor } from '../editor/TileMapEditor';

type Params = {
  updateStartingMap: (isStarting: boolean, opts?: { propagate?: boolean }) => void;
  setNewMapName: Dispatch<SetStateAction<string>>;
  setNewMapStarting: Dispatch<SetStateAction<boolean>>;
  setMapWidth: Dispatch<SetStateAction<number>>;
  setMapHeight: Dispatch<SetStateAction<number>>;
  setNewMapWidth: Dispatch<SetStateAction<number>>;
  setNewMapHeight: Dispatch<SetStateAction<number>>;
  setMapInitialized: (b: boolean) => void;
  setLayers: Dispatch<SetStateAction<TileLayer[]>>;
  setActiveLayerId: Dispatch<SetStateAction<number | null>>;
  setStamps: Dispatch<SetStateAction<Stamp[]>>;
  setMapObjects: Dispatch<SetStateAction<MapObject[]>>;
  setHoverCoords: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  setHasSelection: Dispatch<SetStateAction<boolean>>;
  setSelectionCount: Dispatch<SetStateAction<number>>;
  setPendingMapConfig: Dispatch<SetStateAction<MapConfig | EditorProjectData | null>>;
  setEditor: Dispatch<SetStateAction<TileMapEditor | null>>;
  setCreateMapError: Dispatch<SetStateAction<string | null>>;
  setShowCreateMapDialog: Dispatch<SetStateAction<boolean>>;
  setShowWelcome: Dispatch<SetStateAction<boolean>>;
  setCurrentProjectPath: Dispatch<SetStateAction<string | null>>;
};

export default function useCreateMap(params: Params) {
  const {
    updateStartingMap,
    setNewMapName,
    setNewMapStarting,
    setMapWidth,
    setMapHeight,
    setNewMapWidth,
    setNewMapHeight,
    setMapInitialized,
    setLayers,
    setActiveLayerId,
    setStamps,
    setMapObjects,
    setHoverCoords,
    setHasSelection,
    setSelectionCount,
    setPendingMapConfig,
    setEditor,
    setCreateMapError,
    setShowCreateMapDialog,
    setShowWelcome,
    setCurrentProjectPath
  } = params;

  const handleCreateNewMap = useCallback((config: MapConfig, newProjectPath?: string) => {
    try {
      if (newProjectPath && window.electronAPI?.clearCrashBackup) {
        void window.electronAPI.clearCrashBackup(newProjectPath);
      }
    } catch (e) {
      console.warn('Failed to clear project crash backup', e);
    }
    setCurrentProjectPath(newProjectPath ?? null);
    updateStartingMap(Boolean(config.isStartingMap), { propagate: false });
    setNewMapName('Map Name');
    setNewMapStarting(Boolean(config.isStartingMap));
    setMapWidth(0);
    setMapHeight(0);
    setNewMapWidth(config.width);
    setNewMapHeight(config.height);
    setMapInitialized(false);
    setLayers([]);
    setActiveLayerId(null);
    setStamps([]);
    setMapObjects([]);
    setHoverCoords(null);
    setHasSelection(false);
    setSelectionCount(0);
    setPendingMapConfig(null);
    setEditor(null);
    setCreateMapError(null);
    setShowCreateMapDialog(false);
    setShowWelcome(false);
  }, [
    updateStartingMap,
    setNewMapName,
    setNewMapStarting,
    setMapWidth,
    setMapHeight,
    setNewMapWidth,
    setNewMapHeight,
    setMapInitialized,
    setLayers,
    setActiveLayerId,
    setStamps,
    setMapObjects,
    setHoverCoords,
    setHasSelection,
    setSelectionCount,
    setPendingMapConfig,
    setEditor,
    setCreateMapError,
    setShowCreateMapDialog,
    setShowWelcome,
    setCurrentProjectPath
  ]);

  return { handleCreateNewMap };
}
