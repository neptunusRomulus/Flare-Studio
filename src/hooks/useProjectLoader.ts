import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { EditorProjectData, TileMapEditor } from '../editor/TileMapEditor';
import type { TileLayer, MapObject, Stamp } from '../types';
import { computeIntermapTarget, extractSpawnIntermapValue } from '../editor/mapSpawnUtils';

type EditorTab = { id: string; name: string; projectPath?: string | null; config?: EditorProjectData | import('../editor/mapConfig').MapConfig | { enemy: MapObject } | null };

type Params = {
  editor: TileMapEditor | null;
  tabs: EditorTab[];
  activeTabId: string | null | undefined;
  refreshProjectMaps?: () => Promise<void> | void;
  setIsOpeningProject: Dispatch<SetStateAction<boolean>>;
  setCurrentProjectPath: Dispatch<SetStateAction<string | null>>;
  startingMapIntermap: string | null;
  setStartingMapIntermap: (s: string | null) => void;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setEditor: (e: TileMapEditor | null) => void;
  setPendingMapConfig: Dispatch<SetStateAction<EditorProjectData | null>>;
  setMapName: Dispatch<SetStateAction<string>>;
  setNewMapName: Dispatch<SetStateAction<string>>;
  setMapWidth: Dispatch<SetStateAction<number>>;
  setMapHeight: Dispatch<SetStateAction<number>>;
  setMapInitialized: Dispatch<SetStateAction<boolean>>;
  setNewMapStarting: Dispatch<SetStateAction<boolean>>;
  updateStartingMap: (isStarting: boolean, opts?: { propagate?: boolean }) => void;
  setLayers: Dispatch<SetStateAction<TileLayer[]>>;
  setActiveLayerId: Dispatch<SetStateAction<number | null>>;
  setStamps: Dispatch<SetStateAction<Stamp[]>>;
  setMapObjects: Dispatch<SetStateAction<MapObject[]>>;
  setHoverCoords: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  setReservedMapNames: Dispatch<SetStateAction<string[]>>;
  setHasSelection: Dispatch<SetStateAction<boolean>>;
  setSelectionCount: Dispatch<SetStateAction<number>>;
  setHasUnsavedChanges: Dispatch<SetStateAction<boolean>>;
  setSaveStatus: Dispatch<SetStateAction<any>>;
  setCreateMapError: Dispatch<SetStateAction<string | null>>;
  setShowCreateMapDialog: Dispatch<SetStateAction<boolean>>;
  setShowWelcome: Dispatch<SetStateAction<boolean>>;
  setNewMapWidth: Dispatch<SetStateAction<number>>;
  setNewMapHeight: Dispatch<SetStateAction<number>>;
  showToolbarTemporarily: () => void;
  showBottomToolbarTemporarily: () => void;
};

export default function useProjectLoader(params: Params) {
  const {
    editor,
    tabs,
    activeTabId,
    refreshProjectMaps,
    setIsOpeningProject,
    setCurrentProjectPath,
    startingMapIntermap,
    setStartingMapIntermap,
    setTabs,
    setActiveTabId,
    setEditor,
    setPendingMapConfig,
    setMapName,
    setNewMapName,
    setMapWidth,
    setMapHeight,
    setMapInitialized,
    setNewMapStarting,
    updateStartingMap,
    setLayers,
    setActiveLayerId,
    setStamps,
    setMapObjects,
    setHoverCoords,
    setReservedMapNames,
    setHasSelection,
    setSelectionCount,
    setHasUnsavedChanges,
    setSaveStatus,
    setCreateMapError,
    setShowCreateMapDialog,
    setShowWelcome,
    showToolbarTemporarily,
    showBottomToolbarTemporarily
  } = params;

  // include new map width/height setters if provided
  const { setNewMapWidth, setNewMapHeight } = params;

  const handleOpenMap = useCallback(async (projectDir: string, _createTab: boolean = false, mapName?: string) => {
    try {
      setIsOpeningProject(true);
      setCurrentProjectPath(projectDir);

      let spawnIntermapTarget = startingMapIntermap;
      if (window.electronAPI?.readSpawnFile) {
        try {
          const spawnContent = await window.electronAPI.readSpawnFile(projectDir);
          spawnIntermapTarget = extractSpawnIntermapValue(spawnContent);
          setStartingMapIntermap(spawnIntermapTarget);
        } catch (error) {
          console.warn('Failed to read spawn file:', error);
          spawnIntermapTarget = null;
          setStartingMapIntermap(null);
        }
      } else {
        spawnIntermapTarget = null;
        setStartingMapIntermap(null);
      }

      let maps: string[] = [];
      if (window.electronAPI?.listMaps) {
        try {
          const listed: string[] = await window.electronAPI.listMaps(projectDir);
          maps = [...listed];
        } catch (e) {
          console.warn('Failed to list maps:', e);
          maps = [];
        }
      }

      if (maps.length === 0) {
        if (typeof refreshProjectMaps === 'function') refreshProjectMaps();
        setMapInitialized(false);
        setEditor(null);
        setPendingMapConfig(null);
        setMapName('');
          setNewMapName((prev: string) => (typeof prev === 'string' && prev.trim() ? prev : 'Map Name'));
        updateStartingMap(false);
        setNewMapStarting(false);
        setMapWidth(0);
        setMapHeight(0);
        setActiveLayerId(null);
        setLayers([]);
        setStamps([]);
        setMapObjects([]);
        setHoverCoords(null);
        setReservedMapNames([]);
        setHasSelection(false);
        setSelectionCount(0);
        setHasUnsavedChanges(false);
        setSaveStatus('saved');
        setCreateMapError(null);
        setNewMapWidth((prev: number) => (typeof prev === 'number' && prev > 0 ? prev : 20));
        setNewMapHeight((prev: number) => (typeof prev === 'number' && prev > 0 ? prev : 15));
        setShowWelcome(false);
        setShowCreateMapDialog(true);
        return;
      }

      await (typeof refreshProjectMaps === 'function' ? refreshProjectMaps() : Promise.resolve());

      let savedSession: { tabs: EditorTab[]; activeTabId: string | null } | null = null;
      if (window.electronAPI?.readSession) {
        try {
          savedSession = await window.electronAPI.readSession(projectDir);
          console.log('Loaded session from project:', savedSession?.tabs?.length || 0, 'tabs');
        } catch (e) {
          console.warn('Failed to load session from project:', e);
        }
      }

      const normalizedProjectDir = projectDir.replace(/\\/g, '/').toLowerCase();
      let tabToActivate: string | null = null;

      setTabs((prevTabs: EditorTab[]) => {
        const existingTabNames = new Set(
          prevTabs
            .filter(t => t.projectPath && t.projectPath.replace(/\\/g, '/').toLowerCase() === normalizedProjectDir)
            .map(t => t.name)
        );

        const otherProjectTabs = prevTabs.filter(t => {
          const normalizedPath = t.projectPath?.replace(/\\/g, '/').toLowerCase() || '';
          return normalizedPath !== normalizedProjectDir;
        });

        const restoredTabs: EditorTab[] = [];
        if (savedSession?.tabs) {
          for (const savedTab of savedSession.tabs) {
            const mapExists = maps.some(m => {
              const mapBaseName = m.replace(/\.(txt|json)$/i, '').toLowerCase();
              return mapBaseName === savedTab.name.toLowerCase();
            });
            if (mapExists && !existingTabNames.has(savedTab.name)) {
              restoredTabs.push({ id: savedTab.id, name: savedTab.name, projectPath: projectDir, config: null });
              existingTabNames.add(savedTab.name);
              console.log('Restored tab from session:', savedTab.name);
            }
          }
        }

        const newTabs: EditorTab[] = [];
        for (const mapFileName of maps) {
          const mapNameFromFile = mapFileName.replace(/\.(txt|json)$/i, '');
          if (!existingTabNames.has(mapNameFromFile)) {
            const tabId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9) + '_' + mapNameFromFile;
            newTabs.push({ id: tabId, name: mapNameFromFile, projectPath: projectDir, config: null });
            console.log('Creating new tab for map:', mapNameFromFile);
          }
        }

        const allProjectTabs = [...restoredTabs, ...newTabs];

        if (savedSession?.activeTabId && allProjectTabs.some(t => t.id === savedSession.activeTabId)) {
          tabToActivate = savedSession.activeTabId;
        } else if (allProjectTabs.length > 0) {
          tabToActivate = allProjectTabs[0].id;
        }

        console.log('Final tabs for project:', allProjectTabs.map(t => t.name), 'activating:', tabToActivate);

        return [...otherProjectTabs, ...allProjectTabs];
      });

      if (tabToActivate) setActiveTabId(tabToActivate);

      if (window.electronAPI?.openMapProject) {
        const mapConfig = await (window.electronAPI.openMapProject as (path: string, mapName?: string) => Promise<EditorProjectData | null>)(projectDir, mapName);
        if (mapConfig) {
          const resolvedName = mapConfig.name?.trim() ? mapConfig.name.trim() : 'Untitled Map';
          const starting = Boolean(mapConfig.isStartingMap);
          setMapName(resolvedName);
          setNewMapName(resolvedName);
          const sanitizedTarget = computeIntermapTarget(true, resolvedName);
          const mapIsStarting = spawnIntermapTarget ? sanitizedTarget === spawnIntermapTarget : starting;
          updateStartingMap(mapIsStarting, { propagate: false });
          setNewMapStarting(mapIsStarting);
          if (mapIsStarting && sanitizedTarget && spawnIntermapTarget !== sanitizedTarget) {
            setStartingMapIntermap(sanitizedTarget);
            spawnIntermapTarget = sanitizedTarget;
          }
          setMapWidth(mapConfig.width ?? 20);
          setMapHeight(mapConfig.height ?? 15);
          setMapInitialized(true);
          showToolbarTemporarily();
          showBottomToolbarTemporarily();
          setShowWelcome(false);
          setShowCreateMapDialog(false);
          if (editor) {
            if (activeTabId) {
              const prevTab: EditorTab | undefined = tabs.find(t => t.id === activeTabId);
              if (prevTab) {
                try {
                  if (prevTab.projectPath) {
                    await editor.saveProjectData(prevTab.projectPath);
                  } else {
                    await editor.ensureTilesetsLoaded();
                    const snapshot = await editor.getProjectData();
                    const safeSnapshot = JSON.parse(JSON.stringify(snapshot));
                    setTabs((prev: EditorTab[]) => prev.map((t: EditorTab) => t.id === prevTab.id ? { ...t, config: safeSnapshot } : t));
                    console.log('Snapshot saved into prevTab.config before opening project:', { prevTabId: prevTab.id, snapshotKeys: Object.keys(safeSnapshot || {}) });
                  }
                } catch (err) {
                  console.warn('Failed to persist current editor before opening project:', err);
                }
              }
            }
            setEditor(null);
          }
          setPendingMapConfig(mapConfig);
        }
      } else {
        console.log('Opening map project:', projectDir);
      }
    } catch (error) {
      console.error('Error opening map project:', error);
    } finally {
      setIsOpeningProject(false);
    }
  }, [
    editor,
    tabs,
    activeTabId,
    refreshProjectMaps,
    setIsOpeningProject,
    setCurrentProjectPath,
    startingMapIntermap,
    setStartingMapIntermap,
    setTabs,
    setActiveTabId,
    setEditor,
    setPendingMapConfig,
    setMapName,
    setNewMapName,
    setMapWidth,
    setMapHeight,
    setMapInitialized,
    setNewMapStarting,
    updateStartingMap,
    setLayers,
    setActiveLayerId,
    setStamps,
    setMapObjects,
    setHoverCoords,
    setReservedMapNames,
    setHasSelection,
    setSelectionCount,
    setHasUnsavedChanges,
    setSaveStatus,
    setCreateMapError,
    setShowCreateMapDialog,
    setShowWelcome,
    setNewMapWidth,
    setNewMapHeight,
    showToolbarTemporarily,
    showBottomToolbarTemporarily
  ]);

  return { handleOpenMap };
}
