import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { EditorProjectData } from '@/editor/TileMapEditor';
import { TileMapEditor } from '@/editor/TileMapEditor';
import type { TileLayer } from '@/types';
import { buildSpawnContent, computeIntermapTarget, extractSpawnIntermapValue, STARTING_MAP_INVALID_NAMES } from '@/editor/mapSpawnUtils';

type MapConfigOptions = {
  editor: TileMapEditor | null;
  setEditor: React.Dispatch<React.SetStateAction<TileMapEditor | null>>;
  canvasRef: RefObject<HTMLCanvasElement>;
  isDarkMode: boolean;
  setupAutoSave: (editor: TileMapEditor) => void;
  updateLayersList: () => void;
  syncMapObjects: () => void;
  showToolbarTemporarily: () => void;
  showBottomToolbarTemporarily: () => void;
  getCreateTabFor: () => ((name: string, projectPath: string | null, config: EditorProjectData) => void) | null;
  getBeforeCreateMap: () => (() => Promise<void>) | null;
  currentProjectPath: string | null;
  setLayers: React.Dispatch<React.SetStateAction<TileLayer[]>>;
  setActiveLayerId: React.Dispatch<React.SetStateAction<number | null>>;
  setStamps: React.Dispatch<React.SetStateAction<import('@/types').Stamp[]>>;
  setSelectedStamp: React.Dispatch<React.SetStateAction<string | null>>;
  setMapObjects: React.Dispatch<React.SetStateAction<import('@/types').MapObject[]>>;
  setHoverCoords: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  setBrushTool: React.Dispatch<React.SetStateAction<'none' | 'move' | 'merge' | 'separate' | 'remove'>>;
  setShowSeparateDialog: React.Dispatch<React.SetStateAction<boolean>>;
  setBrushToSeparate: React.Dispatch<React.SetStateAction<number | null>>;
  setSaveStatus: React.Dispatch<React.SetStateAction<'saving' | 'saved' | 'error' | 'unsaved'>>;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  setHasSelection: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectionCount: React.Dispatch<React.SetStateAction<number>>;
};

const useMapConfig = ({
  editor,
  setEditor,
  canvasRef,
  isDarkMode,
  setupAutoSave,
  updateLayersList,
  syncMapObjects,
  showToolbarTemporarily,
  showBottomToolbarTemporarily,
  getCreateTabFor,
  getBeforeCreateMap,
  currentProjectPath,
  setLayers,
  setActiveLayerId,
  setStamps,
  setSelectedStamp,
  setMapObjects,
  setHoverCoords,
  setBrushTool,
  setShowSeparateDialog,
  setBrushToSeparate,
  setSaveStatus,
  setHasUnsavedChanges,
  setHasSelection,
  setSelectionCount
}: MapConfigOptions) => {
  const [mapWidth, setMapWidth] = useState(0);
  const [mapHeight, setMapHeight] = useState(0);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [showCreateMapDialog, setShowCreateMapDialog] = useState(false);
  const [newMapWidth, setNewMapWidth] = useState(20);
  const [newMapHeight, setNewMapHeight] = useState(15);
  const [newMapName, setNewMapName] = useState('Untitled Map');
  const [createMapError, setCreateMapError] = useState<string | null>(null);
  const [reservedMapNames, setReservedMapNames] = useState<string[]>([]);
  const [newMapStarting, setNewMapStarting] = useState(false);
  const [mapName, setMapName] = useState('Untitled Map');
  const [isStartingMap, setIsStartingMap] = useState(false);
  const [startingMapIntermap, setStartingMapIntermap] = useState<string | null>(null);
  const [isPreparingNewMap, setIsPreparingNewMap] = useState(false);
  const previousMapNameRef = useRef(mapName);

  const writeSpawnFile = useCallback(async (starting: boolean, mapNameOverride?: string) => {
    const effectiveName = mapNameOverride ?? mapName;
    const intermapTarget = computeIntermapTarget(starting, effectiveName);
    if (!currentProjectPath || !window.electronAPI?.updateSpawnFile) {
      setStartingMapIntermap(intermapTarget);
      return;
    }
    const spawnContent = buildSpawnContent(intermapTarget);
    try {
      const success = await window.electronAPI.updateSpawnFile(currentProjectPath, spawnContent);
      if (success) {
        setStartingMapIntermap(intermapTarget);
      }
    } catch (error) {
      console.error('Failed to update spawn file:', error);
    }
  }, [currentProjectPath, mapName]);

  const updateStartingMap = useCallback(
    (nextValue: boolean, options?: { propagate?: boolean; mapNameOverride?: string }) => {
      setIsStartingMap(nextValue);
      if (options?.propagate === false) return;
      void writeSpawnFile(nextValue, options?.mapNameOverride);
    },
    [writeSpawnFile]
  );

  useEffect(() => {
    let cancelled = false;
    const loadSpawnFile = async () => {
      if (!currentProjectPath || !window.electronAPI?.readSpawnFile) {
        if (!cancelled) {
          setStartingMapIntermap(null);
        }
        return;
      }
      try {
        const content = await window.electronAPI.readSpawnFile(currentProjectPath);
        if (!cancelled) {
          setStartingMapIntermap(extractSpawnIntermapValue(content));
        }
      } catch (error) {
        console.warn('Failed to read spawn file:', error);
        if (!cancelled) {
          setStartingMapIntermap(null);
        }
      }
    };
    loadSpawnFile();
    return () => {
      cancelled = true;
    };
  }, [currentProjectPath]);

  useEffect(() => {
    const previous = previousMapNameRef.current;
    if (previous === mapName) {
      return;
    }
    previousMapNameRef.current = mapName;
    if (!isStartingMap) {
      return;
    }
    const previousTarget = computeIntermapTarget(true, previous);
    const nextTarget = computeIntermapTarget(true, mapName);
    if (previousTarget !== nextTarget) {
      updateStartingMap(true, { mapNameOverride: mapName });
    }
  }, [mapName, isStartingMap, updateStartingMap]);

  useEffect(() => {
    if (editor) {
      editor.setMapName(mapName);
    }
  }, [editor, mapName]);

  const handleMapResize = useCallback(() => {
    if (editor?.resizeMap) {
      editor.resizeMap(mapWidth, mapHeight);
    }
  }, [editor, mapWidth, mapHeight]);

  const isDuplicateMapName = useCallback((candidate: string) => {
    // If there's no current project path, skip project-scoped duplicate checks
    if (!currentProjectPath) return false;
    const normalized = candidate.trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    const knownNames = new Set<string>();

    reservedMapNames.forEach((name) => {
      if (name) {
        knownNames.add(name);
      }
    });

    if (mapName.trim()) {
      knownNames.add(mapName.trim().toLowerCase());
    }

    try {
      const stored = localStorage.getItem('recentMaps');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach((entry) => {
            if (entry && typeof entry.name === 'string') {
              const name = entry.name.trim().toLowerCase();
              if (name) {
                knownNames.add(name);
              }
            }
          });
        }
      }
    } catch (error) {
      console.warn('Failed to read recent map names for duplicate check:', error);
    }

    return knownNames.has(normalized);
  }, [mapName, reservedMapNames]);

  const handleOpenCreateMapDialog = useCallback(() => {
    setNewMapWidth(mapWidth > 0 ? mapWidth : 20);
    setNewMapHeight(mapHeight > 0 ? mapHeight : 15);
    setNewMapStarting(isStartingMap);
    setCreateMapError(null);
    setShowCreateMapDialog(true);
  }, [mapWidth, mapHeight, isStartingMap]);

  const hasOpenedCreateMapDialog = useRef(false);
  useEffect(() => {
    if (showCreateMapDialog && !hasOpenedCreateMapDialog.current) {
      setNewMapName('Map Name');
      hasOpenedCreateMapDialog.current = true;
    }
    if (!showCreateMapDialog) {
      hasOpenedCreateMapDialog.current = false;
    }
  }, [showCreateMapDialog, mapName]);

  const handleConfirmCreateMap = useCallback(async () => {
    if (isPreparingNewMap) return;

    const width = Math.max(1, Math.floor(newMapWidth) || 0);
    const height = Math.max(1, Math.floor(newMapHeight) || 0);
    const trimmedName = newMapName.trim();
    const resolvedName = trimmedName ? trimmedName : 'Untitled Map';

    if (isDuplicateMapName(resolvedName) || STARTING_MAP_INVALID_NAMES.has(resolvedName.toLowerCase())) {
      setCreateMapError("There can't be maps that have the same name. Please type another name.");
      return;
    }

    setCreateMapError(null);
    setIsPreparingNewMap(true);

    try {
      setReservedMapNames((prev) => {
        const normalized = resolvedName.trim().toLowerCase();
        if (!normalized || prev.includes(normalized)) {
          return prev;
        }
        return [...prev, normalized];
      });

      setLayers([]);
      setActiveLayerId(null);
      setStamps([]);
      setSelectedStamp(null);
      setMapObjects([]);
      setHoverCoords(null);
      setBrushTool('none');
      setShowSeparateDialog(false);
      setBrushToSeparate(null);
      setSaveStatus('saved');
      setHasUnsavedChanges(false);

      let targetEditor = editor;

      if (!targetEditor && canvasRef.current) {
        targetEditor = new TileMapEditor(canvasRef.current);
        targetEditor.setDarkMode(isDarkMode);
        setupAutoSave(targetEditor);
      }

      if (targetEditor) {
        // --- DEBUG: snapshot tileset state before any save ---
        console.log('[DEBUG:createMap] Step 1 - pre-save snapshot', {
          mapName: (targetEditor as unknown as { mapName?: string }).mapName,
          currentProjectPath,
          layerTabs: (() => {
            try {
              const lt = (targetEditor as unknown as { layerTabs?: Map<string, unknown[]> }).layerTabs;
              if (!lt) return 'no layerTabs';
              const summary: Record<string, unknown> = {};
              for (const [k, tabs] of lt.entries()) {
                summary[k] = tabs.map((t: unknown) => {
                  const tab = t as { id?: number; tileset?: { fileName?: string; image?: unknown } };
                  return { id: tab?.id, fileName: tab?.tileset?.fileName, hasImage: !!tab?.tileset?.image };
                });
              }
              return summary;
            } catch { return 'error reading layerTabs'; }
          })()
        });

        // Always save the current map to disk BEFORE resetting the editor.
        // This persists any imported tilesets so they survive a tab switch back.
        if (currentProjectPath) {
          try {
            if (typeof targetEditor.ensureTilesetsLoaded === 'function') {
              await targetEditor.ensureTilesetsLoaded();
            }
            // Capture project data to check what tilesets will be saved
            const previewData = (targetEditor as unknown as { getProjectData?: () => { tilesetImages?: Record<string, string>; tilesets?: unknown[] } }).getProjectData?.();
            console.log('[DEBUG:createMap] Step 2 - about to saveProjectData', {
              tilesetImageKeys: Object.keys(previewData?.tilesetImages ?? {}),
              tilesetCount: previewData?.tilesets?.length ?? 0,
              targetPath: currentProjectPath
            });
            await targetEditor.saveProjectData(currentProjectPath);
            console.log('[DEBUG:createMap] Step 2 - saveProjectData completed');
          } catch (saveErr) {
            console.warn('[DEBUG:createMap] Step 2 - FAILED to save before create:', saveErr);
          }
        } else {
          console.warn('[DEBUG:createMap] Step 2 - SKIPPED save: currentProjectPath is null/empty');
        }

        // Also call the external before-create hook if wired (e.g. to update tab cache)
        const beforeCreateMap = getBeforeCreateMap();
        console.log('[DEBUG:createMap] Step 3 - beforeCreateMap hook wired?', !!beforeCreateMap);
        if (beforeCreateMap) {
          await beforeCreateMap();
        }

        targetEditor.projectName = resolvedName;

        targetEditor.resetForNewProject();
        targetEditor.setMapName(resolvedName);
        targetEditor.setMapSize(width, height);
        targetEditor.setDarkMode(isDarkMode);
        if (!editor) {
          setEditor(targetEditor);
        }
        // Ensure layers state reflects the newly created map immediately
        try {
          if (typeof targetEditor.getLayers === 'function') {
            const currentLayers = targetEditor.getLayers();
            setLayers([...currentLayers]);
          }
          if (typeof targetEditor.getActiveLayerId === 'function') {
            const activeId = targetEditor.getActiveLayerId();
            setActiveLayerId(activeId);
          }
        } catch (err) {
          console.warn('Failed to populate layers from editor:', err);
        }

        // keep existing update/sync calls for consumers using wrappers
        updateLayersList();
        syncMapObjects();
      }

      setMapWidth(width);
      setMapHeight(height);
      setMapInitialized(true);
      showToolbarTemporarily();
      showBottomToolbarTemporarily();
      setMapName(resolvedName);
      updateStartingMap(newMapStarting, { mapNameOverride: resolvedName });
      setNewMapStarting(newMapStarting);
      setHasSelection(false);
      setSelectionCount(0);
      setCreateMapError(null);
      const createTabFor = getCreateTabFor();
      if (createTabFor) {
        try {
          createTabFor(resolvedName, currentProjectPath ?? null, { name: resolvedName, width, height, tileSize: 64 });
        } catch (e) {
          console.warn('Failed to create tab for new in-project map:', e);
        }
      } else {
        // Defensive warning: createTabFor ref may not be wired yet (mount order/race).
        // In this case the map is still created in-memory but no UI tab will appear.
        console.warn('createTabFor not available when creating new map — tab was not created.');
      }

      if (targetEditor && currentProjectPath) {
        try {
          await targetEditor.saveProjectData(currentProjectPath);
        } catch (e) {
          console.warn('Failed to immediately save new map to disk:', e);
        }
      }

      setShowCreateMapDialog(false);
    } finally {
      setIsPreparingNewMap(false);
    }
  }, [
    canvasRef,
    currentProjectPath,
    editor,
    isDarkMode,
    isDuplicateMapName,
    isPreparingNewMap,
    newMapHeight,
    newMapName,
    newMapStarting,
    newMapWidth,
    setActiveLayerId,
    setBrushToSeparate,
    setBrushTool,
    setHasSelection,
    setHasUnsavedChanges,
    setHoverCoords,
    setLayers,
    setMapObjects,
    setSaveStatus,
    setSelectedStamp,
    setSelectionCount,
    setShowSeparateDialog,
    setStamps,
    getCreateTabFor,
    getBeforeCreateMap,
    setEditor,
    setupAutoSave,
    showBottomToolbarTemporarily,
    showToolbarTemporarily,
    syncMapObjects,
    updateLayersList,
    updateStartingMap
  ]);

  return {
    mapWidth,
    setMapWidth,
    mapHeight,
    setMapHeight,
    mapInitialized,
    setMapInitialized,
    showCreateMapDialog,
    setShowCreateMapDialog,
    newMapWidth,
    setNewMapWidth,
    newMapHeight,
    setNewMapHeight,
    newMapName,
    setNewMapName,
    createMapError,
    setCreateMapError,
    reservedMapNames,
    setReservedMapNames,
    newMapStarting,
    setNewMapStarting,
    mapName,
    setMapName,
    isStartingMap,
    setIsStartingMap,
    startingMapIntermap,
    setStartingMapIntermap,
    isPreparingNewMap,
    handleMapResize,
    handleOpenCreateMapDialog,
    handleConfirmCreateMap,
    updateStartingMap
  };
};

export default useMapConfig;
