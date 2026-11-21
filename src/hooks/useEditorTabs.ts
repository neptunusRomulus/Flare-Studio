import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { MapObject } from '@/types';
import type { EditorProjectData, TileMapEditor } from '@/editor/TileMapEditor';
import type { MapConfig } from '@/editor/mapConfig';
import { resolveSaveMapName } from '@/editor/mapSaveName';
import { isTypingOrDialogTarget, matchEditorTabCycleShortcut, nextEditorTabId } from '@/editor/tabCycle';
import { exportFlareTextFiles } from '@/flare/manualSaveExport';

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
  /** Called after a same-project tab switch to keep mapConfig state in sync. */
  syncMapConfigForTab?: (name: string, width: number, height: number) => void;
  switchToTabHelpersRef: MutableRefObject<SwitchToTabHelpers>;
};

const useEditorTabs = ({
  editor,
  currentProjectPath: _currentProjectPath, // Unused - always stale by switchToTab callback time. Use prevTab?.projectPath instead.
  setCurrentProjectPath,
  syncMapConfigForTab,
  switchToTabHelpersRef
}: UseEditorTabsArgs) => {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const createTabFor = useCallback((name: string, projectPath?: string | null, config?: EditorProjectData | MapConfig | { enemy: MapObject } | null) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const safeConfig = config ? JSON.parse(JSON.stringify(config)) : null;
    const isEnemyTab = safeConfig && typeof safeConfig === 'object' && !Array.isArray(safeConfig) && 'enemy' in safeConfig;
    const tab: EditorTab = {
      id,
      name,
      projectPath: projectPath ?? null,
      config: safeConfig,
      tabType: isEnemyTab ? 'enemy' : undefined
    };
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
    const editor = editorRef.current;
    const tabs = tabsRef.current;
    const activeTabId = activeTabIdRef.current;
    if (tabId === activeTabId) return;
    const prevTab = tabs.find(t => t.id === activeTabId);
    const nextTab = tabs.find(t => t.id === tabId);
    console.log(`[TAB SWITCH] FROM: ${prevTab?.name} (${prevTab?.id}) TO: ${nextTab?.name} (${nextTab?.id})`);
    let persistOk = !editor || !prevTab;
    try {
      if (editor && prevTab) {
        try {
          await editor.ensureTilesetsLoaded();
        } catch (err) {
          console.warn('Failed to ensure tilesets loaded before switching:', err);
        }

        const editorName = typeof editor.getMapName === 'function' ? editor.getMapName() : undefined;
        const persistName = resolveSaveMapName(editorName, prevTab.name);
        if (prevTab.projectPath) {
          const saved = await editor.saveProjectData(prevTab.projectPath, persistName ? { mapName: persistName } : undefined);
          if (saved !== false) {
            const exported = await exportFlareTextFiles(editor, prevTab.projectPath);
            if (exported) {
              editor.markAsFullySaved?.();
              persistOk = true;
            } else {
              // JSON was written but the Flare map text was not — keep the crash backup.
              persistOk = true;
            }
          }
        } else if (typeof editor.getProjectData === 'function') {
          const snapshot = await editor.getProjectData();
          const safeSnapshot = JSON.parse(JSON.stringify(snapshot));
          setTabs((prev) => prev.map((t) => t.id === prevTab.id ? { ...t, config: safeSnapshot } : t));
          persistOk = true;
        }
        if (persistOk && typeof editor.cancelPendingAutoSave === 'function') {
          editor.cancelPendingAutoSave();
        }
      }
    } catch (e) {
      console.warn('Error during tab switch save:', e);
      persistOk = false;
    }
    if (editor && prevTab && !persistOk) {
      console.error('Aborting tab switch: the current map could not be saved. The new NPC/objects stay in memory on this tab.');
      return;
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

    // Block auto-save for the entire clear→load window so that a periodic timer cannot
    // fire between clearMapGrid() and loadProjectData() and overwrite the previously-saved
    // map file with an empty grid (the root-cause of "paintings gone after tab switch").
    type EditorWithTabSwitch = { setTabSwitching?: (v: boolean) => void };
    const editorWithSwitch = editor as unknown as EditorWithTabSwitch;
    editorWithSwitch.setTabSwitching?.(true);

    try {
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
                // Keep mapConfig state in sync with the newly-loaded tab so that
                // handleMapResize / MapSettingsDialog always operate on the correct map.
                const loadedName = (mapData as { name?: string }).name?.trim() || nextTab.name;
                const loadedWidth = typeof (mapData as { width?: number }).width === 'number' ? (mapData as { width: number }).width : 20;
                const loadedHeight = typeof (mapData as { height?: number }).height === 'number' ? (mapData as { height: number }).height : 15;
                syncMapConfigForTab?.(loadedName, loadedWidth, loadedHeight);
                switchToTabHelpersRef.current.setupAutoSave(editor);
                switchToTabHelpersRef.current.updateLayersList();
                switchToTabHelpersRef.current.syncMapObjects();
                try { switchToTabHelpersRef.current.setTabTick?.(); } catch (e) { void e; }
              }
            } else {
              // File not found for this tab. Update the editor's map name so that any
              // subsequent save (manual or auto) targets THIS tab's file rather than the
              // previously-loaded map's file. Without this fix the editor keeps the old
              // mapName (e.g. "Map 1") and SAVE-SYNC writes the current layer data into
              // the wrong JSON, causing painting from one map to bleed into another.
              console.warn(`[TAB SWITCH] Map file not found for tab "${nextTab.name}" — updating mapName to prevent cross-map save contamination`);
              if (typeof editor.setMapName === 'function') {
                editor.setMapName(nextTab.name);
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
    } finally {
      // Always unblock auto-save when the tab switch completes (or fails).
      editorWithSwitch.setTabSwitching?.(false);
    }
  }, [
    setActiveTabId,
    setCurrentProjectPath,
    setTabs,
    syncMapConfigForTab,
    switchToTabHelpersRef
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = matchEditorTabCycleShortcut(event);
      if (!direction) return;
      if (isTypingOrDialogTarget(event.target)) return;
      const nextId = nextEditorTabId(tabsRef.current, activeTabIdRef.current, direction);
      if (!nextId) return;
      event.preventDefault();
      event.stopPropagation();
      void switchToTab(nextId);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [switchToTab]);

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
