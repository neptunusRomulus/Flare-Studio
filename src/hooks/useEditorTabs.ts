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
  setTabTick?: (fn?: (() => void)) => void;
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
  currentProjectPath: _currentProjectPath, // Unused - always stale by switchToTab callback time. Use prevTab?.projectPath instead.
  setCurrentProjectPath,
  setMapName: _setMapName,
  setMapWidth: _setMapWidth,
  setMapHeight: _setMapHeight,
  switchToTabHelpersRef
}: UseEditorTabsArgs) => {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const createTabFor = useCallback((name: string, projectPath?: string | null, config?: EditorProjectData | MapConfig | { enemy: MapObject } | null) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const safeConfig = config ? JSON.parse(JSON.stringify(config)) : null;
    const tab: EditorTab = { id, name, projectPath: projectPath ?? null, config: safeConfig };
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
    console.log(`[TAB SWITCH] FROM: ${prevTab?.name} (${prevTab?.id}) TO: ${nextTab?.name} (${nextTab?.id})`);
    try {
      if (editor && prevTab) {
        try {
          await editor.ensureTilesetsLoaded();
        } catch (err) {
          console.warn('Failed to ensure tilesets loaded before switching:', err);
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
    // CRITICAL: Also update the editor's internal currentProjectPath so save operations use the correct path
    if (editor && typeof editor.setCurrentProjectPath === 'function') {
      editor.setCurrentProjectPath(nextTab.projectPath ?? null);
    }
    // Ensure the editor shows a fresh/empty grid for the incoming tab
    try {
      if (editor && typeof (editor as unknown as { clearMapGrid?: () => void }).clearMapGrid === 'function') {
        try { (editor as unknown as { clearMapGrid: () => void }).clearMapGrid(); } catch (_err) { void _err; }
      }
    } catch (_e) { void _e; }

    try { switchToTabHelpersRef.current.setTabTick?.(); } catch (e) { void e; }

    if (nextTab.tabType === 'enemy') {
      return;
    }

    if (nextTab.config && !editor) {
      try {
        const cfgCheck = nextTab.config as EditorProjectData;
        if (nextTab.projectPath && (!cfgCheck.tilesetImages || Object.keys(cfgCheck.tilesetImages || {}).length === 0) && nextTab.name) {
          await switchToTabHelpersRef.current.handleOpenMap(nextTab.projectPath, false, nextTab.name);
          if (editor) switchToTabHelpersRef.current.setupAutoSave(editor);
          return;
        }
      } catch {
        // ignore and fall back to normal restore
      }
    }

    // ALWAYS load from disk when switching tabs - disable config caching to prevent
    // state contamination where the latest tileset appears on all tabs
    if (nextTab.projectPath && nextTab.name) {
      const normalize = (p: string | null | undefined) => (p ? p.replace(/\\/g, '/').toLowerCase() : '');
      const nextNormalized = normalize(nextTab.projectPath);
      const prevNormalized = prevTab ? normalize(prevTab.projectPath) : '';
      const isDifferentProject = nextNormalized !== prevNormalized;
      
      console.log(`[TAB LOAD] Loading from disk: ${nextTab.name}, isDifferentProject=${isDifferentProject}`);
      
      if (isDifferentProject) {
        // Different project - need full project load which resets editor
        await switchToTabHelpersRef.current.handleOpenMap(nextTab.projectPath, false, nextTab.name);
      } else {
        // Same project - load map without resetting editor to preserve UI state (tabs, etc.)
        if (editor && typeof switchToTabHelpersRef.current.loadProjectData === 'function') {
          // Load from disk file directly
          const mapData = await window.electronAPI?.openMapProject?.(nextTab.projectPath, nextTab.name);
          if (mapData) {
            const loaded = await switchToTabHelpersRef.current.loadProjectData(editor, mapData);
            if (loaded) {
              switchToTabHelpersRef.current.setupAutoSave(editor);
              switchToTabHelpersRef.current.updateLayersList();
              switchToTabHelpersRef.current.syncMapObjects();
              try { switchToTabHelpersRef.current.setTabTick?.(); } catch (e) { void e; }
            }
          }
        } else {
          // Fallback to full load if no loadProjectData available
          await switchToTabHelpersRef.current.handleOpenMap(nextTab.projectPath, false, nextTab.name);
        }
      }
      
      if (editor) {
        // Ensure currentProjectPath is set after loading the map
        if (typeof editor.setCurrentProjectPath === 'function') {
          editor.setCurrentProjectPath(nextTab.projectPath ?? null);
        }
      }
    }
  }, [
    activeTabId,
    editor,
    setActiveTabId,
    setCurrentProjectPath,
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
export default useEditorTabs;
