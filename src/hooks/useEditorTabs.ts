import { useCallback, useMemo, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { MapObject } from '@/types';
import type { EditorProjectData, TileMapEditor } from '@/editor/TileMapEditor';
import type { MapConfig } from '@/editor/mapConfig';

export type EditorTab = {
  id: string;
  name: string;
  projectPath?: string | null;
  config?: EditorProjectData | MapConfig | { enemy: MapObject } | null;
  tabType?: 'map' | 'enemy';
};

type SwitchToTabHelpers = {
  handleOpenMap: (projectDir: string, createTab?: boolean, mapName?: string) => Promise<void>;
  loadProjectData: (editor: TileMapEditor, mapConfig: EditorProjectData) => Promise<boolean>;
  setupAutoSave: (editor: TileMapEditor) => void;
  syncMapObjects: () => void;
  updateLayersList: () => void;
};

type UseEditorTabsArgs = {
  editor: TileMapEditor | null;
  currentProjectPath: string | null;
  setCurrentProjectPath: (path: string | null) => void;
  setMapName: (name: string) => void;
  setMapWidth: (width: number) => void;
  setMapHeight: (height: number) => void;
  switchToTabHelpersRef: MutableRefObject<SwitchToTabHelpers>;
};

const useEditorTabs = ({
  editor,
  currentProjectPath,
  setCurrentProjectPath,
  setMapName,
  setMapWidth,
  setMapHeight,
  switchToTabHelpersRef
}: UseEditorTabsArgs) => {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const createTabFor = useCallback((name: string, projectPath?: string | null, config?: EditorProjectData | MapConfig | { enemy: MapObject } | null) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const safeConfig = config ? JSON.parse(JSON.stringify(config)) : null;
    const tab: EditorTab = { id, name, projectPath: projectPath ?? null, config: safeConfig };
    console.log('Creating tab:', { id, name, projectPath, hasConfig: !!safeConfig });
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(id);
    setCurrentProjectPath(projectPath ?? null);
    return tab;
  }, [setActiveTabId, setCurrentProjectPath, setTabs]);

  const closeEditorTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const index = prev.findIndex((tab) => tab.id === tabId);
      if (index === -1) return prev;
      const nextTabs = prev.filter((tab) => tab.id !== tabId);
      if (activeTabId === tabId) {
        const fallback = nextTabs[index] ?? nextTabs[index - 1] ?? nextTabs[0] ?? null;
        const nextActiveId = fallback?.id ?? null;
        setActiveTabId(nextActiveId);
        setCurrentProjectPath(fallback?.projectPath ?? null);
      }
      return nextTabs;
    });
  }, [activeTabId, setActiveTabId, setCurrentProjectPath, setTabs]);

  const switchToTab = useCallback(async (tabId: string) => {
    if (tabId === activeTabId) return;
    const prevTab = tabs.find(t => t.id === activeTabId);
    const nextTab = tabs.find(t => t.id === tabId);
    try {
      if (editor && prevTab) {
        try {
          await editor.ensureTilesetsLoaded();
          const snapshot = await editor.getProjectData();
          const safeSnapshot = JSON.parse(JSON.stringify(snapshot));
          setTabs((prev) => prev.map(t => t.id === prevTab.id ? { ...t, config: safeSnapshot } : t));
          console.log('Snapshot saved into prevTab.config during tab switch:', { tabId: prevTab.id, snapshotKeys: Object.keys(safeSnapshot || {}) });
        } catch (err) {
          console.warn('Failed to snapshot tab before switching:', err);
        }

        if (prevTab.projectPath) {
          try {
            await editor.saveProjectData(prevTab.projectPath);
          } catch (e) {
            console.warn('Failed to save to disk before switching tabs:', e);
          }
        }
      }
    } catch (e) {
      console.warn('Error during tab switch save:', e);
    }

    if (!nextTab) {
      setActiveTabId(null);
      return;
    }

    setActiveTabId(tabId);
    setCurrentProjectPath(nextTab.projectPath ?? null);

    if (nextTab.tabType === 'enemy') {
      return;
    }

    if (nextTab.config && !editor) {
      try {
        const cfgCheck = nextTab.config as EditorProjectData;
        if (nextTab.projectPath && (!cfgCheck.tilesetImages || Object.keys(cfgCheck.tilesetImages || {}).length === 0) && nextTab.name) {
          console.log('In-memory config missing tileset images and no editor; preferring disk open for tab', tabId, nextTab.name);
          await switchToTabHelpersRef.current.handleOpenMap(nextTab.projectPath, false, nextTab.name);
          if (editor) switchToTabHelpersRef.current.setupAutoSave(editor);
          return;
        }
      } catch {
        // ignore and fall back to normal restore
      }
    }

    if (nextTab.config) {
      console.log('Switching to tab with in-memory config, attempting to restore for tab:', tabId, { hasProjectPath: !!nextTab.projectPath, configKeys: Object.keys(nextTab.config || {}) });
      try {
        if (editor) {
          console.log('Restoring config into existing editor for tab:', tabId);
          editor.clearLocalStorageBackup();
          const cfg = nextTab.config as EditorProjectData;

          if (cfg.name) {
            editor.setMapName(cfg.name);
            setMapName(cfg.name);
          }
          if (cfg.width && cfg.height) {
            editor.setMapSize(cfg.width ?? 20, cfg.height ?? 15);
            setMapWidth(cfg.width ?? 20);
            setMapHeight(cfg.height ?? 15);
          }

          type EditorWithExtras = TileMapEditor & Partial<{
            setTilesetImages: (images: Record<string, string>) => void;
            tilesetImages: Record<string, string>;
            ensureTilesetsLoaded: (timeout?: number) => Promise<void>;
            getActiveLayerType: () => string | null;
            updateCurrentTileset: (t: unknown) => void;
            refreshTilePalette: (force?: boolean) => void;
            redraw: () => void;
          }>;

          const ed = editor as EditorWithExtras;
          type EditorMutable = EditorWithExtras & { tilesetImages?: Record<string, string> };
          const edMutable = ed as EditorMutable;

          try {
            if (cfg.tilesetImages && Object.keys(cfg.tilesetImages).length > 0) {
              if (typeof ed.setTilesetImages === 'function') {
                ed.setTilesetImages(cfg.tilesetImages);
              } else {
                // eslint-disable-next-line react-hooks/immutability
                edMutable.tilesetImages = { ...(edMutable.tilesetImages || {}), ...JSON.parse(JSON.stringify(cfg.tilesetImages)) };
              }
              console.log('Applied tilesetImages to editor for tab', tabId, Object.keys(cfg.tilesetImages));
            } else {
              console.log('No tilesetImages present in config for tab', tabId);
            }
          } catch (e) {
            console.warn('Failed to apply tilesetImages into editor:', e);
          }

          try {
            await new Promise(r => setTimeout(r, 150));
            if (currentProjectPath && window.electronAPI?.discoverTilesetImages) {
              const discovered = await window.electronAPI.discoverTilesetImages(currentProjectPath);
              const discoveredImages = discovered?.tilesetImages || {};
              if (Object.keys(discoveredImages).length > 0) {
                const cfgNames = new Set<string>();
                if (cfg.tilesets && Array.isArray(cfg.tilesets)) {
                  for (const t of cfg.tilesets) {
                    if (t.fileName) cfgNames.add(t.fileName);
                    if (t.sourcePath) {
                      const s = String(t.sourcePath);
                      const parts = s.split(/[\\/]/);
                      const maybe = parts[parts.length - 1];
                      if (maybe) cfgNames.add(maybe);
                    }
                  }
                }

                const toApply: Record<string, string> = {};
                for (const name of Object.keys(discoveredImages)) {
                  if (cfgNames.has(name)) {
                    toApply[name] = discoveredImages[name];
                  }
                }
                if (Object.keys(toApply).length > 0) {
                  if (typeof ed.setTilesetImages === 'function') {
                    ed.setTilesetImages(toApply);
                    console.log('Applied discovered project tileset images for tab', tabId, Object.keys(toApply));
                  } else {
                    // eslint-disable-next-line react-hooks/immutability
                    edMutable.tilesetImages = { ...(edMutable.tilesetImages || {}), ...toApply };
                    console.log('Attached discovered project tileset images to editor.tilesetImages for tab', tabId, Object.keys(toApply));
                  }
                }

                try {
                  if (cfg.tilesets && Array.isArray(cfg.tilesets)) {
                    const missing = cfg.tilesets.filter((t) => t.fileName && !toApply[t.fileName]);
                    if (missing.length > 0) {
                      for (const t of missing) {
                        if (t.sourcePath && window.electronAPI?.readFileAsDataUrl) {
                          try {
                            const dataUrl = await window.electronAPI.readFileAsDataUrl(t.sourcePath);
                            if (dataUrl) {
                              if (typeof ed.setTilesetImages === 'function') {
                                ed.setTilesetImages({ [t.fileName]: dataUrl });
                              } else {
                                // eslint-disable-next-line react-hooks/immutability
                                edMutable.tilesetImages = { ...(edMutable.tilesetImages || {}), [t.fileName]: dataUrl };
                              }
                            }
                          } catch (e) {
                            console.warn('Failed to read sourcePath tileset image:', t.sourcePath, e);
                          }
                        }
                      }
                    }
                  }
                } catch (e) {
                  console.warn('Failed to fill missing tileset images from sourcePath:', e);
                }
              }
            }
          } catch (e) {
            console.warn('Failed to discover or apply project tileset images:', e);
          }

          const loaded = await switchToTabHelpersRef.current.loadProjectData(editor, cfg);
          if (loaded) {
            switchToTabHelpersRef.current.setupAutoSave(editor);
            switchToTabHelpersRef.current.updateLayersList();
            switchToTabHelpersRef.current.syncMapObjects();
          }
        }
      } catch (e) {
        console.warn('Failed to load config into editor for tab switch:', e);
      }
      return;
    }

    if (nextTab.projectPath && nextTab.name) {
      await switchToTabHelpersRef.current.handleOpenMap(nextTab.projectPath, false, nextTab.name);
      if (editor) {
        switchToTabHelpersRef.current.setupAutoSave(editor);
        switchToTabHelpersRef.current.updateLayersList();
        switchToTabHelpersRef.current.syncMapObjects();
      }
    }
  }, [
    activeTabId,
    currentProjectPath,
    editor,
    setActiveTabId,
    setCurrentProjectPath,
    setMapHeight,
    setMapName,
    setMapWidth,
    setTabs,
    switchToTabHelpersRef,
    tabs
  ]);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || null, [tabs, activeTabId]);
  const isEnemyTabActive = !!activeTab && activeTab.tabType === 'enemy';

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    activeTab,
    isEnemyTabActive,
    createTabFor,
    closeEditorTab,
    switchToTab
  };
};

export type { EditorTab };
export default useEditorTabs;
