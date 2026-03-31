import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useDialogsCtx from './useDialogsCtx';
import buildConfirmDialogProps from './buildConfirmDialogProps';
import useEditorRefs from './useEditorRefs';
import useEditorSetup from './useEditorSetup';
import useUndoRedoZoom from './useUndoRedoZoom';
import useTooltip from './useTooltip';
import usePreferences from './usePreferences';
import useDarkModeSync from './useDarkModeSync';
import useAppState from './useAppState';
import useToolbarState from './useToolbarState';
import useMapConfig from './useMapConfig';
import useEditorTabs from './useEditorTabs';
import type { EditorTab } from './useEditorTabs';
import useProjectManager from './useProjectManager';
type ProjectManagerParams = Parameters<typeof useProjectManager>[0];
import useLayerHandlers from './useLayerHandlers';
import useMapHandlers from './useMapHandlers';
import useAppEffects from './useAppEffects';
import useNpcDrag from './useNpcDrag';
import useEventDrag from './useEventDrag';
import useObjectEditing from './useObjectEditing';
import useItems from './useItems';
import useLoadProjectData from './useLoadProjectData';
import useClearLayerHandler from './useClearLayerHandler';
import { normalizeItemsForState } from '@/utils/items';
import { buildConstantStockString } from '@/utils/parsers';
// ItemRole type intentionally not imported — unused in this module
import { toast } from '@/hooks/use-toast';
import useHelpState from './useHelpState';
import useActiveGidCallback from './useActiveGidCallback';
import useHoverGidCallback from './useHoverGidCallback';
import useDeleteActiveTab from './useDeleteActiveTab';
import buildConfirmActionHandlers from './useConfirmActionHandlers';
import useBeforeCreateMap from './useBeforeCreateMap';
import { TileMapEditor } from '@/editor/TileMapEditor';
import type { EditorProjectData } from '@/editor/TileMapEditor';

export default function useAppMainBuilder() {
  const dialogsCtx = useDialogsCtx({});
  type EditorRefsType = ReturnType<typeof useEditorRefs>;
  type EditorSetupType = ReturnType<typeof useEditorSetup>;
  type EditorTabsType = ReturnType<typeof useEditorTabs>;
  type ProjectManagerType = ReturnType<typeof useProjectManager>;
  type ToolbarStateType = ReturnType<typeof useToolbarState>;
  type ProjectManagerView = {
    projectMaps?: string[];
    handleOpenMapFromMapsFolder?: (filename: string) => Promise<void>;
    handleManualSave?: () => Promise<void>;
    refreshProjectMaps?: () => Promise<void>;
    isExporting?: boolean;
    exportProgress?: number;
    isManuallySaving?: boolean;
    saveProgress?: number;
  };

  const editorRefs = useEditorRefs() as EditorRefsType;
  const editorSetup = useEditorSetup(editorRefs.editorOptsRef) as EditorSetupType;
  const { loadProjectData } = useLoadProjectData();
  
  const { isDarkMode, setIsDarkMode, showSidebarToggle, setShowSidebarToggle } = usePreferences();
  useDarkModeSync(isDarkMode, editorSetup.editor as TileMapEditor | null);

  const [showActiveGid, setShowActiveGid] = useState<boolean>(true);

  const appState = useAppState();
  const toolbarState = useToolbarState() as ToolbarStateType;

  const helpState = useHelpState();

  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);

  // Phase 3: Import Review Modal state
  type ImportReviewData = {
    tilesetFileName: string;
    detectedAssets: Array<{
      gid: number;
      sourceX: number;
      sourceY: number;
      width: number;
      height: number;
      confidence?: number;
    }>;
    _meta?: {
      file: File;
      layerType: string;
      tabId: number;
      projectPath?: string | null;
      manualTileWidth?: number;
      manualTileHeight?: number;
      forceGridSlicing?: boolean;
    };
  };

  type AssetOriginPreset = 'top-left' | 'top-center' | 'center' | 'bottom-left' | 'bottom-center';

  const [showImportReview, setShowImportReview] = useState<boolean>(false);
  const [importReviewTileWidth, setImportReviewTileWidth] = useState<number>(64);
  const [importReviewTileHeight, setImportReviewTileHeight] = useState<number>(64);
  const [importReviewOriginPreset, setImportReviewOriginPreset] = useState<AssetOriginPreset>('bottom-center');
  const [importReviewData, setImportReviewData] = useState<ImportReviewData | null>(null);
  
  const itemsHook = useItems({ currentProjectPath, toast, normalizeItemsForState });
  const { itemsList, expandedItemCategories, setExpandedItemCategories, handleOpenItemEdit, handleOpenItemDialog } = itemsHook;
  const [mapsDropdownOpen, setMapsDropdownOpen] = useState(false);
  const [mapsSubOpen, setMapsSubOpen] = useState(false);
  const [mapsDropdownPos, setMapsDropdownPos] = useState<{ left: number; top: number } | null>(null);
  const mapsButtonRef = useRef<HTMLButtonElement | null>(null);
  const mapsPortalRef = useRef<HTMLDivElement | null>(null);

  const {
    editor,
    setEditor,
    canvasRef,
    setupAutoSaveWrapper: setupAutoSave,
    updateLayersListWrapper: updateLayersList,
    updateLayersListRef,
    syncMapObjectsWrapper: syncMapObjects,
    syncMapObjectsRef,
    handlePlaceActorOnMap,
    handleUnplaceActorFromMap,
    handlePlaceEventOnMap,
    handleFillSelection,
    handleDeleteSelection,
    handleClearSelection
  } = editorSetup as EditorSetupType;

  // Wire up active GID callback to track current brush GID
  useActiveGidCallback(editor as TileMapEditor | null, toolbarState.setActiveGidValue);

  // Wire up hover GID callback to track GID under cursor
  useHoverGidCallback(editor as TileMapEditor | null, toolbarState.hoverCoords, toolbarState.setHoverGidValue);

  // Get the REAL syncMapObjects from useMapHandlers - not the wrapper
  // This needs to be before useAppEffects so the ref gets the real function
  const { syncMapObjects: realSyncMapObjects, updateLayersList: realUpdateLayersList } = useMapHandlers({
    editor: editor ?? undefined,
    setMapObjects: appState.setMapObjects,
    setLayers: appState.setLayers,
    setActiveLayerId: appState.setActiveLayerId
  });

  const mapConfig = useMapConfig({
    editor: editor ?? null,
    setEditor,
    canvasRef,
    isDarkMode,
    setupAutoSave,
    updateLayersList,
    syncMapObjects,
    showToolbarTemporarily: toolbarState.showToolbarTemporarily,
    showBottomToolbarTemporarily: toolbarState.showBottomToolbarTemporarily,
    getCreateTabFor: () => (appState.createTabForRef?.current ?? null),
    getBeforeCreateMap: () => (appState.beforeCreateMapRef?.current ?? null),
    currentProjectPath,
    setLayers: appState.setLayers,
    setActiveLayerId: appState.setActiveLayerId,
    setStamps: toolbarState.setStamps,
    setSelectedStamp: () => {},
    setMapObjects: appState.setMapObjects,
    setHoverCoords: toolbarState.setHoverCoords,
    setBrushTool: () => {},
    setShowSeparateDialog: () => {},
    setBrushToSeparate: () => {},
    setSaveStatus: () => {},
    setHasUnsavedChanges: () => {},
    setHasSelection: toolbarState.setHasSelection,
    setSelectionCount: toolbarState.setSelectionCount
  });

  
  const editorTabs = useEditorTabs({
    editor: editor ?? null,
    currentProjectPath,
    setCurrentProjectPath,
    syncMapConfigForTab: mapConfig.syncMapConfigForTab,
    switchToTabHelpersRef: editorRefs.switchToTabHelpersRef
  }) as EditorTabsType;
  const { tabs, activeTabId, setTabs, setActiveTabId, switchToTab, createTabFor, closeEditorTab } = editorTabs as unknown as EditorTabsType;

  // Wire up the before-create-map callback so that when the user creates a new map,
  // the CURRENT map's full state (including any imported tileset images) is saved to
  // disk BEFORE the editor is reset for the new map.
  const { handleBeforeCreateMap: beforeCreateMapFn } = useBeforeCreateMap({
    editor: editor ?? null,
    activeTabId: activeTabId ?? null,
    setTabs: setTabs as React.Dispatch<React.SetStateAction<import('./useEditorTabs').EditorTab[]>>,
    currentProjectPath
  });
  useEffect(() => {
    if (appState.beforeCreateMapRef) {
      appState.beforeCreateMapRef.current = beforeCreateMapFn;
    }
  }, [appState.beforeCreateMapRef, beforeCreateMapFn]);

  const _beforeCreateRunningRef = useRef(false);
  const handleBeforeCreateMap = async () => {
    if (_beforeCreateRunningRef.current) return;
    _beforeCreateRunningRef.current = true;
    try {
      const fn = appState.beforeCreateMapRef?.current;
      if (fn) await fn();
    } finally {
      _beforeCreateRunningRef.current = false;
    }
  };

  useAppEffects({
    createTabForRef: appState.createTabForRef,
    createTabFor,
    beforeCreateMapRef: appState.beforeCreateMapRef,
    handleBeforeCreateMap,
    tabs,
    activeTabId,
    currentProjectPath,
    setActiveTabId,
    updateLayersList: realUpdateLayersList,
    updateLayersListRef,
    syncMapObjects: realSyncMapObjects,
    syncMapObjectsRef,
    setupAutoSaveWrapper: setupAutoSave,
    setTabTick: appState.setTabTick,

    // Editor and toolbar sync (ensure UI tool state is forwarded to the editor)
    editor,
    selectedTool: toolbarState.effectiveSelectedTool,
    selectedBrushTool: toolbarState.selectedBrushTool,
    selectedSelectionTool: toolbarState.effectiveSelectedSelectionTool,
    selectedShapeTool: toolbarState.selectedShapeTool,
    stampMode: toolbarState.stampMode,
    selectedStamp: toolbarState.selectedStamp,
    setSelectionCount: toolbarState.setSelectionCount,
    setHasSelection: toolbarState.setHasSelection
  });
  const { pendingMapConfig, setPendingMapConfig, showWelcome: appShowWelcome } = appState;

  useEffect(() => {
    const pending = pendingMapConfig;
    if (!pending || editor || !canvasRef?.current || appShowWelcome) return;

    const createEditorWithConfig = async () => {
      try {
        const newEditor = new TileMapEditor(canvasRef.current!);
        if (pending.name) newEditor.setMapName((pending as EditorProjectData).name!);
        
        // Set the current project path so tilesets store full paths when imported
        if (currentProjectPath) {
          newEditor.setCurrentProjectPath(currentProjectPath);
        }

        newEditor.setMapSize((pending as EditorProjectData).width ?? 20, (pending as EditorProjectData).height ?? 15);

        try {
          newEditor.loadProjectData(pending as EditorProjectData);
        } catch (err) {
          console.warn('Failed to load project data into new editor:', err);
        }

        // After loading project data, force refresh of tileset palette
        // to ensure imported brushes/tiles display in the sidebar
        try {
          const activeLayerType = typeof newEditor.getActiveLayerType === 'function'
            ? newEditor.getActiveLayerType()
            : null;
          if (activeLayerType && typeof newEditor.updateCurrentTileset === 'function') {
            newEditor.updateCurrentTileset(activeLayerType);
          }
          if (typeof newEditor.refreshTilePalette === 'function') {
            newEditor.refreshTilePalette(true);
          }
        } catch (e) {
          console.warn('Palette refresh after loadProjectData failed:', e);
        }

        try { setupAutoSave(newEditor); } catch (err) { console.warn('Failed to setup autosave:', err); }
        setEditor(newEditor);
        try {
          const restoredLayers = typeof newEditor.getLayers === 'function' ? newEditor.getLayers() : [];
          try { appState.setLayers(Array.isArray(restoredLayers) ? [...restoredLayers] : []); } catch (e) { console.warn('setLayers failed', e); }
          try { appState.setActiveLayerId?.(typeof newEditor.getActiveLayerId === 'function' ? newEditor.getActiveLayerId() : null); } catch (e) { console.warn('setActiveLayerId failed', e); }
        } catch (err) {
          console.warn('Failed to hydrate appState from new editor:', err);
        }
        mapConfig.setMapInitialized(true);
        mapConfig.setShowCreateMapDialog(false);
        toolbarState.showToolbarTemporarily?.();
        toolbarState.showBottomToolbarTemporarily?.();

        setTimeout(() => {
          try { updateLayersList(); } catch (err) { console.warn(err); }
          try { syncMapObjects(); } catch (err) { console.warn(err); }
          try {
            // Re-refresh palette after a small delay to ensure DOM is ready
            const activeLayerType = typeof newEditor.getActiveLayerType === 'function'
              ? newEditor.getActiveLayerType()
              : null;
            if (activeLayerType && typeof newEditor.updateCurrentTileset === 'function') {
              newEditor.updateCurrentTileset(activeLayerType);
            }
            if (typeof newEditor.refreshTilePalette === 'function') {
              newEditor.refreshTilePalette(true);
            }
          } catch (err) { void err; }
          try { newEditor.redraw(); } catch (err) { void err; }
          // Bump tabTick so TilesetPalette re-polls the newly loaded tileset images.
          // This fires after the 150ms delay, giving data-URL images time to decode.
          try { appState.setTabTick((t: number) => (t || 0) + 1); } catch (err) { void err; }
        }, 150);

        setPendingMapConfig(null);
      } catch (error) {
        console.error('Failed to create editor with pending config:', error);
        setPendingMapConfig(null);
        mapConfig.setMapInitialized(false);
      }
    };

    void createEditorWithConfig();
  }, [pendingMapConfig, editor, canvasRef, appShowWelcome, setupAutoSave, mapConfig, updateLayersList, syncMapObjects, setEditor, setPendingMapConfig, toolbarState, appState, currentProjectPath]);
  const { handleUndo, handleRedo, handleZoomIn, handleZoomOut, handleResetZoom } = useUndoRedoZoom({ editor, updateLayersList, syncMapObjects });

  const { tooltip, showTooltipWithDelay, hideTooltip } = useTooltip({ toolbarRef: toolbarState.toolbarContainerRef, canvasRef });

  // Ensure editor always has the current canvas element reference. React may replace the
  // canvas DOM node during re-renders; when that happens the editor must rebind its
  // event listeners to the new canvas via `updateCanvas` otherwise mouse events will
  // not be received and dragging/painting will fail.
  useEffect(() => {
    if (!editor || !canvasRef?.current) return;
    try {
      editor.updateCanvas(canvasRef.current);
    } catch (e) {
      console.warn('Failed to update editor canvas reference', e);
    }
  }, [editor, canvasRef]);

  const [showClearLayerDialog, setShowClearLayerDialog] = useState(false);
  const { handleClearLayerClose, handleClearLayerConfirm } = useClearLayerHandler({
    editor,
    setSelectedBrushTool: toolbarState.setSelectedBrushTool,
    setShowClearLayerDialog
  });

  const projectManager = useProjectManager({
    editor,
    tabs,
    activeTabId,
    currentProjectPath,
    mapName: mapConfig.mapName,
    mapObjects: appState.mapObjects,
    buildConstantStockString,
    toast,
    refreshProjectMaps: undefined,
    setIsOpeningProject: appState.setIsOpeningProject,
    setCurrentProjectPath,
    startingMapIntermap: mapConfig.startingMapIntermap,
    setStartingMapIntermap: mapConfig.setStartingMapIntermap,
    setTabs,
    setActiveTabId,
    setEditor,
    setPendingMapConfig: appState.setPendingMapConfig,
    setMapName: mapConfig.setMapName,
    setNewMapName: mapConfig.setNewMapName,
    setMapWidth: mapConfig.setMapWidth,
    setMapHeight: mapConfig.setMapHeight,
    setMapInitialized: mapConfig.setMapInitialized,
    setNewMapStarting: mapConfig.setNewMapStarting,
    updateStartingMap: mapConfig.updateStartingMap,
    setLayers: appState.setLayers,
    setActiveLayerId: appState.setActiveLayerId,
    setStamps: toolbarState.setStamps,
    setMapObjects: appState.setMapObjects,
    setHoverCoords: toolbarState.setHoverCoords,
    setReservedMapNames: mapConfig.setReservedMapNames,
    setHasSelection: toolbarState.setHasSelection,
    setSelectionCount: toolbarState.setSelectionCount,
    setHasUnsavedChanges: () => {},
    setSaveStatus: () => {},
    setCreateMapError: mapConfig.setCreateMapError,
    setShowCreateMapDialog: mapConfig.setShowCreateMapDialog,
    setShowWelcome: appState.setShowWelcome,
    setNewMapWidth: mapConfig.setNewMapWidth,
    setNewMapHeight: mapConfig.setNewMapHeight,
    showToolbarTemporarily: toolbarState.showToolbarTemporarily,
    showBottomToolbarTemporarily: toolbarState.showBottomToolbarTemporarily
  } as ProjectManagerParams);

  const {
    handleFileUpload,
    handleSetActiveLayer,
    handleToggleLayerVisibility,
    handleLayerTransparencyChange
  } = useLayerHandlers({
    editor,
    layers: appState.layers,
    setLayers: appState.setLayers,
    setActiveLayerId: appState.setActiveLayerId,
    setItemsList: itemsHook.setItemsList,
    normalizeItemsForState,
    currentProjectPath,
    updateLayersList
  });

  const { handleNpcDragStart, handleNpcDragEnd } = useNpcDrag({ editor, setDraggingNpcId: appState.setDraggingNpcId });

  const { handleEventDragStart, handleEventDragEnd } = useEventDrag({ editor, setDraggingEventId: appState.setDraggingEventId });

  const handleOpenEventDialog = useCallback((location?: { x: number; y: number } | null) => {
    appState.setEditingEventId(null);
    appState.setEventDialogLocation(location ?? null);
    appState.setEventDialogOpen(true);
  }, [appState]);

  const handleEditEvent = useCallback((eventId: number) => {
    appState.setEditingEventId(eventId);
    appState.setEventDialogLocation(null);
    appState.setEventDialogOpen(true);
  }, [appState]);

  // Wire canvas double-click on events to open the edit dialog
  useEffect(() => {
    if (editor && typeof (editor as any).setEventEditCallback === 'function') {
      (editor as any).setEventEditCallback((eventId: number) => {
        handleEditEvent(eventId);
      });
      return () => {
        (editor as any).setEventEditCallback(null);
      };
    }
  }, [editor, handleEditEvent]);

  const objectEditing = useObjectEditing({ 
    editor: editor ?? undefined, 
    syncMapObjects: realSyncMapObjects,
    createTabFor, 
    switchToTab, 
    currentProjectPath 
  });

  // Wire canvas click on objects to open the edit dialog
  useEffect(() => {
    if (editor && typeof (editor as any).setObjectEditCallback === 'function') {
      (editor as any).setObjectEditCallback((objectId: number) => {
        if (objectEditing && objectEditing.handleEditObject) {
          objectEditing.handleEditObject(objectId);
        }
      });
      return () => {
        (editor as any).setObjectEditCallback(null);
      };
    }
  }, [editor, objectEditing]);

  useEffect(() => {
  }, [appState.mapObjects]);

  useEffect(() => {
  }, [appState.activeLayerId]);

  const activeLayer = useMemo(() => appState.layers.find((layer) => layer.id === appState.activeLayerId) ?? null, [appState.activeLayerId, appState.layers]);

  // Confirmation state for tileset tab deletion
  type ConfirmPayload = { layerType: string; tabId: number };
  type ConfirmActionType = null | { type: 'removeBrush' | 'removeTileset' | 'removeTab'; payload?: number | ConfirmPayload };
  const [confirmAction, setConfirmAction] = useState<ConfirmActionType>(null);
  const [tabToDelete, setTabToDelete] = useState<ConfirmPayload | null>(null);
  const confirmPayloadRef = useRef<ConfirmPayload | null>(null);

  // Hook to handle tileset tab deletion with confirmation
  const { handleDeleteActiveTab: handleDeleteTilesetTab } = useDeleteActiveTab({
    editor,
    activeLayer,
    toast,
    confirmPayloadRef,
    setTabToDelete,
    setConfirmAction
  });

  // Handlers for the confirmation dialog
  const { onCancel, onConfirm } = buildConfirmActionHandlers({
    confirmAction,
    tabToDelete,
    confirmPayloadRef,
    editor,
    setTabTick: appState.setTabTick,
    setTabToDelete,
    setConfirmAction
  });

  const isNpcLayer = activeLayer?.type === 'npc';
  const isEnemyLayer = activeLayer?.type === 'enemy';
  const isRulesLayer = activeLayer?.type === 'rules';
  const isItemsLayer = activeLayer?.type === 'items';

  const handleToggleBrushTool = useCallback((tool: 'move' | 'merge' | 'separate' | 'remove') => {
    toolbarState.setBrushTool((current) => (current === tool ? 'none' : tool));
    toolbarState.showBrushToolbarTemporarily();
  }, [toolbarState]);

  const uiHelpers = useMemo(() => ({
    tooltip,
    toolbarRef: toolbarState.toolbarContainerRef,
    canvasRef
  }), [tooltip, canvasRef, toolbarState.toolbarContainerRef]);

  const projectManagerRecord = projectManager as ProjectManagerType;

  useEffect(() => {
    const switchToTabHelpersRef = editorRefs.switchToTabHelpersRef;
    if (!switchToTabHelpersRef) return;

    switchToTabHelpersRef.current = {
      handleOpenMap: async (...args: unknown[]) => {
        const manager = projectManager as ProjectManagerType;
        if (manager && typeof manager.handleOpenMap === 'function') {
          const [projectDir, createTab, mapName] = args as [string, boolean | undefined, string | undefined];
          await manager.handleOpenMap(projectDir, createTab, mapName);
        }
      },
      loadProjectData: async (...args: unknown[]) => {
        try {
          return await (loadProjectData as (...inner: unknown[]) => Promise<boolean>)(...(args as unknown[]));
        } catch (e) {
          console.warn('switchToTab loadProjectData helper failed', e);
          return false;
        }
      },
      setupAutoSave: (editorInstance: unknown) => {
          try {
            setupAutoSave(editorInstance as TileMapEditor);
          } catch (e) {
            console.warn('setupAutoSave helper error:', e);
          }
        },
      syncMapObjects: () => void syncMapObjects(),
      updateLayersList: () => void updateLayersList()
      ,
      setTabTick: (_fn?: (() => void)) => {
        try { appState.setTabTick((t: number) => (t || 0) + 1); } catch (e) { void e; }
      }
    };
  }, [editorRefs, projectManager, setupAutoSave, syncMapObjects, updateLayersList, appState, loadProjectData]);

  const handleCreateNewMap = (config: { name?: string; width?: number; height?: number; isStartingMap?: boolean } , projectPath?: string | null) => {
    try {
      if (projectPath) {
        // The project folder and its initial map file were already created on disk by
        // Electron (via createMapProject). Open it directly so that the editor name,
        // tabs, and all state are derived from what's on disk.
        // This avoids the stale-React-state bug where `newMapName` hadn't updated
        // yet when `handleConfirmCreateMap` was called, which previously caused the
        // editor to initialise with the default name "Untitled Map" — eventually
        // writing an unwanted "Untitled_Map.json" into the project folder.
        const manager = projectManager as ProjectManagerType;
        if (manager && typeof manager.handleOpenMap === 'function') {
          void manager.handleOpenMap(projectPath);
        }
        if (typeof appState.setShowWelcome === 'function') appState.setShowWelcome(false);
        return;
      }

      // Fallback path (no projectPath — e.g. pure-web mode or legacy callers):
      // set the dialog state and confirm synchronously. We still call setNewMapName
      // here for consistency, but this path is not used in the normal Electron flow.
      setCurrentProjectPath(null);
      if (typeof mapConfig.setNewMapWidth === 'function') mapConfig.setNewMapWidth(config.width ?? 20);
      if (typeof mapConfig.setNewMapHeight === 'function') mapConfig.setNewMapHeight(config.height ?? 15);
      if (typeof mapConfig.setNewMapName === 'function') mapConfig.setNewMapName(config.name ?? 'Map Name');
      if (typeof mapConfig.setNewMapStarting === 'function') mapConfig.setNewMapStarting(Boolean(config.isStartingMap));
      if (typeof mapConfig.setShowCreateMapDialog === 'function') mapConfig.setShowCreateMapDialog(false);
      if (typeof mapConfig.handleConfirmCreateMap === 'function') {
        // call confirm to create map state
        void mapConfig.handleConfirmCreateMap();
      }
      if (typeof appState.setShowWelcome === 'function') appState.setShowWelcome(false);
    } catch {
      // ignore
    }
  };

  type AssembledSidebar = Record<string, unknown> | null;

  const [showSettings, setShowSettings] = useState(false);
  const [showMapSettingsOnly, setShowMapSettingsOnly] = useState(false);

  // --- Context menu handlers for duplicate / delete ---

  const handleDuplicateObject = useCallback((objectId: number) => {
    if (!editor) return;
    const objects = typeof editor.getMapObjects === 'function' ? editor.getMapObjects() : [];
    const source = objects.find((o: MapObject) => o.id === objectId);
    if (!source) return;
    const newObj = editor.addMapObject(source.type === 'npc' ? 'enemy' : (source.type as 'event' | 'enemy'), -1, -1, source.width ?? 1, source.height ?? 1);
    if (newObj && typeof editor.updateMapObject === 'function') {
      editor.updateMapObject(newObj.id, {
        name: `${source.name || source.type} (copy)`,
        type: source.type,
        category: source.category,
        x: -1,
        y: -1,
        wander_radius: source.wander_radius,
        properties: { ...(source.properties || {}) },
      });
    }
    if (typeof realSyncMapObjects === 'function') realSyncMapObjects();
  }, [editor, realSyncMapObjects]);

  const handleDeleteObject = useCallback((objectId: number) => {
    if (!editor || typeof editor.removeMapObject !== 'function') return;
    editor.removeMapObject(objectId);
    if (typeof realSyncMapObjects === 'function') realSyncMapObjects();
  }, [editor, realSyncMapObjects]);

  const handleDuplicateEvent = useCallback((eventId: number) => {
    if (!editor) return;
    const objects = typeof editor.getMapObjects === 'function' ? editor.getMapObjects() : [];
    const source = objects.find((o: MapObject) => o.id === eventId);
    if (!source) return;
    const srcX = source.x ?? -1;
    const srcY = source.y ?? -1;
    const newObj = editor.addMapObject('event', srcX, srcY, source.width ?? 1, source.height ?? 1);
    if (newObj && typeof editor.updateMapObject === 'function') {
      editor.updateMapObject(newObj.id, {
        name: `${source.name || 'Event'} (copy)`,
        activate: source.activate,
        hotspot: source.hotspot,
        tooltip: source.tooltip,
        intermap: source.intermap,
        loot: source.loot,
        soundfx: source.soundfx,
        mapmod: source.mapmod,
        repeat: source.repeat,
        properties: { ...(source.properties || {}) },
        x: srcX,
        y: srcY,
      });
    }
    if (typeof realSyncMapObjects === 'function') realSyncMapObjects();
  }, [editor, realSyncMapObjects]);

  const handleDeleteEvent = useCallback((eventId: number) => {
    if (!editor || typeof editor.removeMapObject !== 'function') return;
    editor.removeMapObject(eventId);
    if (typeof realSyncMapObjects === 'function') realSyncMapObjects();
  }, [editor, realSyncMapObjects]);

  const handleReorderActors = useCallback((fromIndex: number, toIndex: number) => {
    if (!editor || typeof editor.reorderMapObjects !== 'function') return;
    // Map filtered actor indices to full objects array indices
    const actorTypes = isNpcLayer ? ['npc'] : isEnemyLayer ? ['enemy'] : [];
    const allObjects = editor.getMapObjects();
    const actorIndices = allObjects.reduce<number[]>((acc, obj, i) => {
      if (actorTypes.includes(obj.type)) acc.push(i);
      return acc;
    }, []);
    if (fromIndex < actorIndices.length && toIndex < actorIndices.length) {
      editor.reorderMapObjects(actorIndices[fromIndex], actorIndices[toIndex]);
      if (typeof realSyncMapObjects === 'function') realSyncMapObjects();
    }
  }, [editor, isNpcLayer, isEnemyLayer, realSyncMapObjects]);

  const handleReorderEvents = useCallback((fromIndex: number, toIndex: number) => {
    if (!editor || typeof editor.reorderMapObjects !== 'function') return;
    const allObjects = editor.getMapObjects();
    const eventIndices = allObjects.reduce<number[]>((acc, obj, i) => {
      if (obj.type === 'event') acc.push(i);
      return acc;
    }, []);
    if (fromIndex < eventIndices.length && toIndex < eventIndices.length) {
      editor.reorderMapObjects(eventIndices[fromIndex], eventIndices[toIndex]);
      if (typeof realSyncMapObjects === 'function') realSyncMapObjects();
    }
  }, [editor, realSyncMapObjects]);

  const handleDuplicateItem = useCallback(async (item: { id: number; name: string; category: string; filePath: string; fileName: string }) => {
    if (!currentProjectPath) return;
    try {
      let nextId = item.id + 1;
      if (window.electronAPI?.getNextItemId) {
        const idResult = await window.electronAPI.getNextItemId(currentProjectPath);
        if (idResult.success) nextId = idResult.nextId;
      }
      // Read original item data then create a copy
      let itemData: Record<string, unknown> = {};
      if (window.electronAPI?.readItemFile) {
        const readResult = await window.electronAPI.readItemFile(item.filePath);
        if (readResult.success && readResult.data) itemData = readResult.data;
      }
      if (window.electronAPI?.createItemFile) {
        const createResult = await window.electronAPI.createItemFile(currentProjectPath, {
          name: `${item.name} (copy)`,
          id: nextId,
          category: item.category,
        });
        if (createResult.success && createResult.filePath && window.electronAPI?.writeItemFile) {
          await window.electronAPI.writeItemFile(createResult.filePath, { ...itemData, id: nextId, name: `${item.name} (copy)` });
        }
      }
      await itemsHook.refreshItemsList(currentProjectPath);
      toast({ title: 'Item Duplicated', description: `${item.name} has been duplicated.` });
    } catch (err) {
      console.error('Failed to duplicate item:', err);
      toast({ title: 'Error', description: 'Failed to duplicate item.', variant: 'destructive' });
    }
  }, [currentProjectPath, itemsHook, toast]);

  const handleDeleteItem = useCallback(async (item: { id: number; name: string; filePath: string }) => {
    if (!currentProjectPath) return;
    try {
      if (window.electronAPI?.deleteItemFile) {
        const result = await window.electronAPI.deleteItemFile(item.filePath);
        if (result.success) {
          await itemsHook.refreshItemsList(currentProjectPath);
          toast({ title: 'Item Deleted', description: `${item.name} has been deleted.` });
        } else {
          toast({ title: 'Error', description: result.error || 'Failed to delete item.', variant: 'destructive' });
        }
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
      toast({ title: 'Error', description: 'Failed to delete item file.', variant: 'destructive' });
    }
  }, [currentProjectPath, itemsHook, toast]);

  const sidebarDeps = useMemo(() => {
    const projectMapsList = (projectManagerRecord as ProjectManagerView)?.projectMaps ?? [];
    const handleOpenMapFromMapsFolderFn =
      typeof (projectManagerRecord as ProjectManagerView)?.handleOpenMapFromMapsFolder === 'function'
        ? (projectManagerRecord as ProjectManagerView).handleOpenMapFromMapsFolder!
        : async () => undefined;
    const handleManualSaveFn =
      typeof (projectManagerRecord as ProjectManagerView)?.handleManualSave === 'function'
        ? (projectManagerRecord as ProjectManagerView).handleManualSave!
        : async () => undefined;
    const refreshProjectMapsFn =
      typeof (projectManagerRecord as ProjectManagerView)?.refreshProjectMaps === 'function'
        ? (projectManagerRecord as ProjectManagerView).refreshProjectMaps!
        : async () => undefined;
    const isExportingValue = Boolean((projectManagerRecord as ProjectManagerView)?.isExporting);
    const exportProgressValue =
      typeof (projectManagerRecord as ProjectManagerView)?.exportProgress === 'number'
        ? (projectManagerRecord as ProjectManagerView).exportProgress!
        : 0;
    const isManuallySavingValue = Boolean((projectManagerRecord as ProjectManagerView)?.isManuallySaving);
    const saveProgressValue =
      typeof (projectManagerRecord as ProjectManagerView)?.saveProgress === 'number'
        ? (projectManagerRecord as ProjectManagerView).saveProgress!
        : 0;

    return {
      leftCollapsed: appState.leftCollapsed,
      actors: {
        isNpcLayer,
        isEnemyLayer,
        actorEntries: (() => {
          const filtered = isNpcLayer 
            ? appState.mapObjects.filter((obj) => obj.type === 'npc')
            : isEnemyLayer
            ? appState.mapObjects.filter((obj) => obj.type === 'enemy')
            : [];
          return filtered;
        })(),
        draggingNpcId: appState.draggingNpcId,
        handleEditObject: objectEditing.handleEditObject,
        handleDuplicateObject,
        handleDeleteObject,
        handleReorderActors,
        setNpcHoverTooltip: appState.setNpcHoverTooltip,
        handleNpcDragStart,
        handleNpcDragEnd,
        handleOpenActorDialog: objectEditing.handleOpenActorDialog,
      },
      events: {
        isEventLayer: activeLayer?.type === 'event',
        eventEntries: activeLayer?.type === 'event' ? appState.mapObjects.filter((obj) => obj.type === 'event') : [],
        draggingEventId: appState.draggingEventId,
        handleEditEvent,
        handleDuplicateEvent,
        handleDeleteEvent,
        handleReorderEvents,
        setEventHoverTooltip: appState.setNpcHoverTooltip,
        handleEventDragStart,
        handleEventDragEnd,
        handleOpenEventDialog,
      },
      rules: {
        isRulesLayer,
        rulesList: [],
        handleAddRule: () => {},
      },
      items: {
        isItemsLayer,
        itemsList: itemsList,
        expandedItemCategories,
        setExpandedItemCategories,
        handleOpenItemEdit: handleOpenItemEdit,
        handleDuplicateItem,
        handleDeleteItem,
        handleOpenItemDialog: handleOpenItemDialog,
      },
      tileset: {
        layers: appState.layers,
        activeLayerId: appState.activeLayerId,
        hoveredLayerId: appState.hoveredLayerId,
        layersPanelExpanded: appState.layersPanelExpanded,
        setLayersPanelExpanded: appState.setLayersPanelExpanded,
        setHoveredLayerId: appState.setHoveredLayerId,
        handleSetActiveLayer,
        handleToggleLayerVisibility,
        handleLayerTransparencyChange,
        showTooltipWithDelay,
        hideTooltip,
        uiHelpers,
        editor,
        activeLayer,
        tabTick: appState.tabTick,
        setTabTick: appState.setTabTick,
        brushTool: toolbarState.brushTool,
        isCollisionLayer: activeLayer?.type === 'collision',
        handleFileUpload,
        handleToggleBrushTool,
        handleDeleteActiveTab: handleDeleteTilesetTab,
        toast,
        handleOpenActorDialog: objectEditing.handleOpenActorDialog,
        stampsState: {
          stamps: toolbarState.stamps,
          selectedStamp: toolbarState.selectedStamp,
          stampMode: toolbarState.stampMode
        },
        currentProjectPath,
        onShowImportReview: (data: unknown) => {
          const parsedData = data as ImportReviewData;
          const defaultWidth = parsedData?._meta?.manualTileWidth ?? 64;
          const defaultHeight = parsedData?._meta?.manualTileHeight ?? 64;
          console.log('[useAppMainBuilder] DEBUG: onShowImportReview called with:', {
            tilesetFileName: parsedData?.tilesetFileName,
            detectedAssetCount: parsedData?.detectedAssets?.length,
            defaultWidth,
            defaultHeight,
            layerType: parsedData?._meta?.layerType,
            tabId: parsedData?._meta?.tabId
          });
          setImportReviewTileWidth(defaultWidth);
          setImportReviewTileHeight(defaultHeight);
          setImportReviewOriginPreset('bottom-center');
          setImportReviewData(parsedData);
          setShowImportReview(true);
          console.log('[useAppMainBuilder] DEBUG: Import review modal state set to true');
        },
        isExporting: isExportingValue,
        exportProgress: exportProgressValue,
        mapsButtonRef,
        mapsDropdownOpen,
        mapsDropdownPos,
        mapsPortalRef,
        mapsSubOpen,
        projectMaps: projectMapsList,
        setMapsSubOpen,
        setMapsDropdownOpen,
        setMapsDropdownPos,
        handleOpenCreateMapDialog: mapConfig.handleOpenCreateMapDialog,
        handleOpenMapFromMapsFolder: handleOpenMapFromMapsFolderFn,
        handleManualSave: handleManualSaveFn,
        isManuallySaving: isManuallySavingValue,
        saveProgress: saveProgressValue,
        isPreparingNewMap: mapConfig.isPreparingNewMap,
        refreshProjectMaps: refreshProjectMapsFn
      },
      layers: {
        layers: appState.layers,
        activeLayerId: appState.activeLayerId,
        hoveredLayerId: appState.hoveredLayerId,
        layersPanelExpanded: appState.layersPanelExpanded,
        setLayersPanelExpanded: appState.setLayersPanelExpanded,
        setHoveredLayerId: appState.setHoveredLayerId,
        handleSetActiveLayer,
        handleToggleLayerVisibility,
        handleLayerTransparencyChange,
        showTooltipWithDelay,
        hideTooltip,
        uiHelpers,
        leftCollapsed: appState.leftCollapsed
      }
    };
  }, [
    appState.layers,
    appState.activeLayerId,
    appState.hoveredLayerId,
    appState.layersPanelExpanded,
    appState.setLayersPanelExpanded,
    appState.setHoveredLayerId,
    handleSetActiveLayer,
    handleToggleLayerVisibility,
    handleLayerTransparencyChange,
    showTooltipWithDelay,
    hideTooltip,
    uiHelpers,
    appState.leftCollapsed,
    isNpcLayer,
    isEnemyLayer,
    appState.mapObjects,
    appState.draggingNpcId,
    appState.draggingEventId,
    appState.setNpcHoverTooltip,
    handleNpcDragStart,
    handleNpcDragEnd,
    handleReorderActors,
    handleEventDragStart,
    handleEventDragEnd,
    handleReorderEvents,
    isRulesLayer,
    isItemsLayer,
    itemsList,
    expandedItemCategories,
    setExpandedItemCategories,
    editor,
    activeLayer,
    appState.tabTick,
    appState.setTabTick,
    toolbarState.brushTool,
    handleFileUpload,
    handleToggleBrushTool,
    handleDeleteTilesetTab,
    toolbarState.stamps,
    toolbarState.selectedStamp,
    toolbarState.stampMode,
    mapsDropdownOpen,
    mapsSubOpen,
    mapsDropdownPos,
    setMapsDropdownPos,
    mapsButtonRef,
    mapsPortalRef,
    currentProjectPath,
    mapConfig.handleOpenCreateMapDialog,
    mapConfig.isPreparingNewMap,
    setShowSettings,
    objectEditing,
    handleOpenItemEdit,
    handleOpenItemDialog,
    projectManagerRecord,
    setShowImportReview,
    setImportReviewData,
    setImportReviewTileWidth,
    setImportReviewTileHeight,
    setImportReviewOriginPreset
  ]);
  const handleCloseSettings = useCallback(() => setShowSettings(false), []);
  const handleCloseMapSettings = useCallback(() => setShowMapSettingsOnly(false), []);
  const handleMapResize = useCallback(() => {
    mapConfig.handleMapResize();
    if (activeTabId) {
      setTabs((prev: EditorTab[]) =>
        prev.map((t) => t.id === activeTabId ? { ...t, name: mapConfig.mapName } : t)
      );
    }
  }, [mapConfig, activeTabId, setTabs]);
  const handleDeleteMap = useCallback(async (): Promise<boolean> => {
    if (!currentProjectPath || !mapConfig.mapName) return false;
    try {
      const result = await window.electronAPI?.deleteMap?.(currentProjectPath, mapConfig.mapName);
      if (result?.success) {
        // Clear spawn.txt reference if this was the starting map
        if (mapConfig.isStartingMap) {
          mapConfig.updateStartingMap(false);
        }
        if (activeTabId) closeEditorTab(activeTabId);
        return true;
      }
      return false;
    } catch (e) {
      console.warn('handleDeleteMap failed', e);
      return false;
    }
  }, [currentProjectPath, mapConfig, activeTabId, closeEditorTab]);

  function buildAppMainCtxFromSidebar(assembledSidebar: AssembledSidebar): Record<string, unknown> {
    const sb = (assembledSidebar ?? {}) as Record<string, unknown>;

    const defaultEditor = editor ?? null;

    const defaultActors = {
      isNpcLayer: false,
      isEnemyLayer: false,
      actorEntries: [],
      draggingNpcId: null,
      handleEditObject: () => {},
      handleDuplicateObject: () => {},
      handleDeleteObject: () => {},
      setNpcHoverTooltip: () => {},
      handleNpcDragStart: () => {},
      handleNpcDragEnd: () => {},
      handleReorderActors: () => {},
      handleOpenActorDialog: () => {}
    };

    const defaultRules = { isRulesLayer: false, rulesList: [], handleAddRule: () => {} };

    const defaultItems = {
      isItemsLayer: false,
      itemsList: [],
      expandedItemCategories: new Set(),
      setExpandedItemCategories: () => {},
      handleOpenItemEdit: () => {},
      handleDuplicateItem: () => {},
      handleDeleteItem: () => {},
      handleOpenItemDialog: () => {}
    };

    const defaultEvents = {
      isEventLayer: false,
      eventEntries: [],
      draggingEventId: null,
      handleEditEvent: () => {},
      handleDuplicateEvent: () => {},
      handleDeleteEvent: () => {},
      setEventHoverTooltip: () => {},
      handleEventDragStart: () => {},
      handleEventDragEnd: () => {},
      handleReorderEvents: () => {},
      handleOpenEventDialog: () => {}
    };

    const defaultLayers = {
      layers: [],
      activeLayerId: null,
      hoveredLayerId: null,
      layersPanelExpanded: false,
      setLayersPanelExpanded: () => {},
      setHoveredLayerId: () => {},
      handleSetActiveLayer: () => {},
      handleToggleLayerVisibility: () => {},
      handleLayerTransparencyChange: () => {},
      showTooltipWithDelay: () => {},
      hideTooltip: () => {},
      uiHelpers: undefined,
      leftCollapsed: false
    };

    const defaultTileset = {
      editor: defaultEditor,
      activeLayer: null,
      tabTick: 0,
      setTabTick: () => {},
      brushTool: 'none',
      isCollisionLayer: false,
      handleFileUpload: () => {},
      handleToggleBrushTool: () => {},
      handleDeleteActiveTab: () => {},
      toast: undefined,
      handleOpenActorDialog: () => {},
      stampsState: undefined,
      onShowImportReview: (data: unknown) => {
        const parsedData = data as ImportReviewData;
        const defaultWidth = parsedData?._meta?.manualTileWidth ?? 64;
        const defaultHeight = parsedData?._meta?.manualTileHeight ?? 64;
        setImportReviewTileWidth(defaultWidth);
        setImportReviewTileHeight(defaultHeight);
        setImportReviewOriginPreset('bottom-center');
        setImportReviewData(parsedData);
        setShowImportReview(true);
      }
    };

    const pmForDefaults = projectManager as ProjectManagerView;
    
    const defaultControls = {
      mapsButtonRef: { current: null } as React.RefObject<HTMLButtonElement>,
      mapsDropdownOpen: false,
      mapsDropdownPos: null,
      mapsPortalRef: { current: null } as React.RefObject<HTMLDivElement>,
      mapsSubOpen: false,
      currentProjectPath: currentProjectPath,
      projectMaps: (projectManager as ProjectManagerView)?.projectMaps ?? [] as string[],
      setMapsSubOpen: setMapsSubOpen,
      setMapsDropdownOpen: setMapsDropdownOpen,
      setMapsDropdownPos: setMapsDropdownPos,
      handleOpenCreateMapDialog: () => { if (typeof mapConfig.setShowCreateMapDialog === 'function') mapConfig.setShowCreateMapDialog(true); },
      handleOpenMapFromMapsFolder: async (filename?: string) => { try { if (pmForDefaults?.handleOpenMapFromMapsFolder && currentProjectPath && filename) await pmForDefaults.handleOpenMapFromMapsFolder(filename); } catch (e) { console.warn(e); } },
      handleManualSave: async () => { if (pmForDefaults?.handleManualSave) await pmForDefaults.handleManualSave(); },
      isManuallySaving: false,
      isPreparingNewMap: false,
      hasUnsavedChanges: false,
      setShowSettings: setShowSettings,
      refreshProjectMaps: async () => { if (pmForDefaults?.refreshProjectMaps) await pmForDefaults.refreshProjectMaps(); },
      uiHelpers: undefined,
      toast: undefined
    } as unknown as Record<string, unknown>;

    return {
      showWelcome: appState.showWelcome,
      handleCreateNewMap: handleCreateNewMap,
      handleOpenMap: (projectPath?: string) => { try { const manager = projectManager as ProjectManagerType; if (manager && typeof manager.handleOpenMap === 'function' && typeof projectPath === 'string') void manager.handleOpenMap(projectPath); } catch (e) { console.warn(e); } },
      isDarkMode,
      titleBarProps: {
        tabs: tabs ?? [],
        activeTabId: activeTabId ?? null,
        onSwitchTab: (id: string) => { void switchToTab(id); },
        onOpenMapSettings: () => setShowMapSettingsOnly(true),
        onCloseEnemyTab: () => {},
        onCreateNewMap: () => { if (typeof mapConfig.setShowCreateMapDialog === 'function') mapConfig.setShowCreateMapDialog(true); },
        saveStatus: 'saved',
        lastSaveTime: 0,
        onMinimize: () => {
          try { window?.electronAPI?.minimize?.(); } catch (e) { console.warn('Minimize failed', e); }
        },
        onMaximize: () => {
          try { window?.electronAPI?.maximize?.(); } catch (e) { console.warn('Maximize failed', e); }
        },
        onClose: () => {
          try { window?.electronAPI?.close?.(); } catch (e) { console.warn('Close failed', e); }
        },
        flareIconUrl: ''
      },
      showSidebarToggle,
      leftCollapsed: appState.leftCollapsed,
      handleSidebarToggle: () => {},
      actors: sb['actors'] ?? defaultActors,
      rules: sb['rules'] ?? defaultRules,
      items: sb['items'] ?? defaultItems,
      events: sb['events'] ?? defaultEvents,
      tileset: {
        ...defaultTileset,
        ...(sb['tileset'] ?? {})
      },
      layersObj: sb['layersObj'] ?? {
        ...defaultLayers,
        layers: appState.layers,
        activeLayerId: appState.activeLayerId,
        hoveredLayerId: appState.hoveredLayerId,
        setLayersPanelExpanded: defaultLayers.setLayersPanelExpanded,
        setHoveredLayerId: defaultLayers.setHoveredLayerId,
        handleSetActiveLayer: defaultLayers.handleSetActiveLayer,
        handleToggleLayerVisibility: defaultLayers.handleToggleLayerVisibility,
        handleLayerTransparencyChange: defaultLayers.handleLayerTransparencyChange,
        showTooltipWithDelay: defaultLayers.showTooltipWithDelay,
        hideTooltip: defaultLayers.hideTooltip,
        uiHelpers: defaultLayers.uiHelpers,
        leftCollapsed: appState.leftCollapsed
      },
      exportStatus: (sb['maps'] as Record<string, unknown> | undefined)?.['exportStatus'] ?? { isExporting: false, exportProgress: 0 },
      controls: (() => {
        const provided = ((sb['maps'] as Record<string, unknown> | undefined)?.['controls'] as Record<string, unknown> | undefined) ?? undefined;
        if (!provided) return defaultControls;
        const merged: Record<string, unknown> = { ...(defaultControls as Record<string, unknown>) };
        Object.keys(provided).forEach((k) => {
          const val = (provided as Record<string, unknown>)[k];
          if (val !== undefined) merged[k] = val;
        });
        return merged;
      })(),
      showSettings,
      handleCloseSettings,
      setIsDarkMode,
      editor: defaultEditor,
      syncMapObjectsWrapper: syncMapObjects,
      showActiveGid,
      setShowActiveGid,
      setShowSidebarToggle,
      showCreateMapDialog: mapConfig.showCreateMapDialog,
      setShowCreateMapDialog: mapConfig.setShowCreateMapDialog,
      newMapName: mapConfig.newMapName,
      setNewMapName: mapConfig.setNewMapName,
      newMapWidth: mapConfig.newMapWidth,
      setNewMapWidth: mapConfig.setNewMapWidth,
      newMapHeight: mapConfig.newMapHeight,
      setNewMapHeight: mapConfig.setNewMapHeight,
      newMapStarting: mapConfig.newMapStarting,
      setNewMapStarting: mapConfig.setNewMapStarting,
      createMapError: mapConfig.createMapError,
      setCreateMapError: mapConfig.setCreateMapError,
      isPreparingNewMap: mapConfig.isPreparingNewMap,
      handleConfirmCreateMap: mapConfig.handleConfirmCreateMap,
      showMapSettingsOnly,
      handleCloseMapSettings,
      handleDeleteMap,
      mapName: mapConfig.mapName,
      setMapName: mapConfig.setMapName,
      mapWidth: mapConfig.mapWidth,
      setMapWidth: mapConfig.setMapWidth,
      mapHeight: mapConfig.mapHeight,
      setMapHeight: mapConfig.setMapHeight,
      isStartingMap: mapConfig.isStartingMap,
      updateStartingMap: mapConfig.updateStartingMap,
      handleMapResize: handleMapResize,
      showClearLayerDialog,
      handleClearLayerClose,
      handleClearLayerConfirm,
      eventDialogOpen: appState.eventDialogOpen,
      setEventDialogOpen: appState.setEventDialogOpen,
      eventDialogLocation: appState.eventDialogLocation,
      setEventDialogLocation: appState.setEventDialogLocation,
      editingEventId: appState.editingEventId,
      setEditingEventId: appState.setEditingEventId,
      confirmDialogProps: buildConfirmDialogProps({ confirmAction, setConfirmAction, onCancel, onConfirm }),
      showHelp: helpState.showHelp,
      activeHelpTab: helpState.activeHelpTab,
      setActiveHelpTab: helpState.setActiveHelpTab,
      handleHelpClose: () => { if (typeof helpState.setShowHelp === 'function') helpState.setShowHelp(false); },
      topBarProps: {
        toolbarExpanded: toolbarState.toolbarExpanded,
        containerRef: toolbarState.toolbarContainerRef,
        onMouseEnter: toolbarState.handleToolbarMouseEnter,
        onMouseLeave: toolbarState.handleToolbarMouseLeave,
        onFocus: toolbarState.handleToolbarFocus,
        onBlur: toolbarState.handleToolbarBlur,
        handleUndo,
        handleRedo,
        handleZoomIn,
        handleZoomOut,
        handleResetZoom
      },
      canvasCtx: {
        editor: editor,
        canvasRef,
        draggingNpcId: appState.draggingNpcId,
        setDraggingNpcId: appState.setDraggingNpcId,
        draggingEventId: appState.draggingEventId,
        setDraggingEventId: appState.setDraggingEventId,
        tipsMinimized: appState.tipsMinimized,
        setTipsMinimized: appState.setTipsMinimized,
        setShowHelp: helpState.setShowHelp,
        isEnemyTabActive: false,
        mapWidth: mapConfig.mapWidth,
        mapHeight: mapConfig.mapHeight,
        handlePlaceActorOnMap: handlePlaceActorOnMap ?? (() => {}),
        handlePlaceEventOnMap: handlePlaceEventOnMap ?? (() => {}),
        mapInitialized: mapConfig.mapInitialized,
        handleOpenCreateMapDialog: mapConfig.handleOpenCreateMapDialog,
        isPreparingNewMap: mapConfig.isPreparingNewMap,
        hoverCoords: toolbarState.hoverCoords,
        showActiveGid: showActiveGid,
        activeGidValue: toolbarState.activeGidValue,
        hoverGidValue: toolbarState.hoverGidValue,
        npcDeletePopup: appState.npcDeletePopup,
        setNpcDeletePopup: appState.setNpcDeletePopup,
        handleUnplaceActorFromMap: handleUnplaceActorFromMap ?? (() => {}),
        npcHoverTooltip: appState.npcHoverTooltip,
        uiHelpers: { tooltip, toolbarRef: toolbarState.toolbarContainerRef, canvasRef },
        hasSelection: toolbarState.hasSelection,
        selectionCount: toolbarState.selectionCount,
        handleFillSelection: handleFillSelection ?? (() => {}),
        handleDeleteSelection: handleDeleteSelection ?? (() => {}),
        handleClearSelection: handleClearSelection ?? (() => {}),
        leftTransitioning: appState.leftTransitioning,

        // bottom toolbar wiring
        bottomToolbarExpanded: toolbarState.bottomToolbarExpanded,
        setBottomToolbarNode: toolbarState.setBottomToolbarNode,
        handleBottomToolbarMouseEnter: toolbarState.handleBottomToolbarMouseEnter,
        handleBottomToolbarMouseLeave: toolbarState.handleBottomToolbarMouseLeave,
        handleBottomToolbarFocus: toolbarState.handleBottomToolbarFocus,
        handleBottomToolbarBlur: toolbarState.handleBottomToolbarBlur,
        selectedTool: toolbarState.effectiveSelectedTool,
        handleSelectTool: toolbarState.setSelectedTool,
        showBrushOptions: toolbarState.showBrushOptions,
        handleShowBrushOptions: toolbarState.handleShowBrushOptions,
        handleHideBrushOptions: toolbarState.handleHideBrushOptions,
        selectedBrushTool: toolbarState.selectedBrushTool,
        setSelectedBrushTool: toolbarState.setSelectedBrushTool,
        showTooltipWithDelayFn: showTooltipWithDelay,
        hideTooltipFn: hideTooltip,
        setShowClearLayerDialog: setShowClearLayerDialog,
        showSelectionOptions: toolbarState.showSelectionOptions,
        handleShowSelectionOptions: toolbarState.handleShowSelectionOptions,
        handleHideSelectionOptions: toolbarState.handleHideSelectionOptions,
        selectedSelectionTool: toolbarState.effectiveSelectedSelectionTool,
        setSelectedSelectionTool: toolbarState.setSelectedSelectionTool,
        showShapeOptions: toolbarState.showShapeOptions,
        handleShowShapeOptions: toolbarState.handleShowShapeOptions,
        handleHideShapeOptions: toolbarState.handleHideShapeOptions,
        selectedShapeTool: toolbarState.selectedShapeTool,
        setSelectedShapeTool: toolbarState.setSelectedShapeTool,
        stampMode: toolbarState.stampMode,
        setStampMode: toolbarState.setStampMode,
        newStampName: toolbarState.newStampName,
        setNewStampName: toolbarState.setNewStampName,
        handleCreateStamp: () => { if (typeof toolbarState.setShowStampDialog === 'function') toolbarState.setShowStampDialog(true); },
        stamps: toolbarState.stamps ?? [],
        selectedStamp: toolbarState.selectedStamp,
        handleStampSelect: (id: string | null) => { if (typeof toolbarState.setSelectedStamp === 'function') toolbarState.setSelectedStamp(id); },
        handleDeleteStamp: () => {}
      },
      bottomToolbarProps: {
        bottomToolbarExpanded: toolbarState.bottomToolbarExpanded,
        setBottomToolbarNode: toolbarState.setBottomToolbarNode,
        handleBottomToolbarMouseEnter: toolbarState.handleBottomToolbarMouseEnter,
        handleBottomToolbarMouseLeave: toolbarState.handleBottomToolbarMouseLeave,
        handleBottomToolbarFocus: toolbarState.handleBottomToolbarFocus,
        handleBottomToolbarBlur: toolbarState.handleBottomToolbarBlur,
        selectedTool: toolbarState.effectiveSelectedTool,
        handleSelectTool: toolbarState.setSelectedTool,
        showBrushOptions: toolbarState.showBrushOptions,
        handleShowBrushOptions: toolbarState.handleShowBrushOptions,
        handleHideBrushOptions: toolbarState.handleHideBrushOptions,
        selectedBrushTool: toolbarState.selectedBrushTool,
        setSelectedBrushTool: toolbarState.setSelectedBrushTool,
        showTooltipWithDelay: showTooltipWithDelay,
        hideTooltip: hideTooltip,
        setShowClearLayerDialog: setShowClearLayerDialog,
        showSelectionOptions: toolbarState.showSelectionOptions,
        handleShowSelectionOptions: toolbarState.handleShowSelectionOptions,
        handleHideSelectionOptions: toolbarState.handleHideSelectionOptions,
        selectedSelectionTool: toolbarState.effectiveSelectedSelectionTool,
        setSelectedSelectionTool: toolbarState.setSelectedSelectionTool,
        showShapeOptions: toolbarState.showShapeOptions,
        handleShowShapeOptions: toolbarState.handleShowShapeOptions,
        handleHideShapeOptions: toolbarState.handleHideShapeOptions,
        selectedShapeTool: toolbarState.selectedShapeTool,
        setSelectedShapeTool: toolbarState.setSelectedShapeTool,
        stampMode: toolbarState.stampMode,
        setStampMode: toolbarState.setStampMode,
        newStampName: toolbarState.newStampName,
        setNewStampName: toolbarState.setNewStampName,
        handleCreateStamp: () => { if (typeof toolbarState.setShowStampDialog === 'function') toolbarState.setShowStampDialog(true); },
        stamps: toolbarState.stamps ?? [],
        selectedStamp: toolbarState.selectedStamp,
        handleStampSelect: (id: string | null) => { if (typeof toolbarState.setSelectedStamp === 'function') toolbarState.setSelectedStamp(id); },
        handleDeleteStamp: () => {},
        stampsState: { stamps: toolbarState.stamps, selectedStamp: toolbarState.selectedStamp, stampMode: toolbarState.stampMode, newStampName: toolbarState.newStampName }
      },
      enemyPanelProps: {},
      dialogsCtx: (() => {
        const dialogCtx = {
          ...(dialogsCtx as Record<string, unknown>),
          // Actor dialog state and handlers
          actorDialogState: objectEditing.actorDialogState,
          setActorDialogState: objectEditing.setActorDialogState,
          actorDialogError: objectEditing.actorDialogError,
          setActorDialogError: objectEditing.setActorDialogError,
          handleOpenActorDialog: objectEditing.handleOpenActorDialog,
          handleCloseActorDialog: objectEditing.handleCloseActorDialog,
          handleActorFieldChange: objectEditing.handleActorFieldChange,
          handleActorRoleToggle: objectEditing.handleActorRoleToggle,
          handleActorTilesetBrowse: objectEditing.handleActorTilesetBrowse,
          handleActorPortraitBrowse: objectEditing.handleActorPortraitBrowse,
          handleActorSubmit: objectEditing.handleActorSubmit,
          // Item dialog state and handlers
          itemDialogState: itemsHook.itemDialogState,
          setItemDialogState: itemsHook.setItemDialogState,
          itemDialogError: itemsHook.itemDialogError,
          setItemDialogError: itemsHook.setItemDialogError,
          pendingDuplicateItem: itemsHook.pendingDuplicateItem,
          setPendingDuplicateItem: itemsHook.setPendingDuplicateItem,
          handleCloseItemDialog: itemsHook.handleCloseItemDialog,
          handleItemFieldChange: itemsHook.handleItemFieldChange,
          handleItemSubmit: itemsHook.handleItemSubmit,
          handleConfirmDuplicateItem: itemsHook.handleConfirmDuplicateItem,
          clearPendingDuplicate: () => itemsHook.setPendingDuplicateItem(null),
        // Phase 3: Import Review Modal
        showImportReview,
        setShowImportReview,
        importReviewData,
        setImportReviewData,
        importReviewTileWidth,
        setImportReviewTileWidth,
        importReviewTileHeight,
        setImportReviewTileHeight,
        importReviewOriginPreset,
        setImportReviewOriginPreset,
        handleImportReviewConfirm: (
          profile: { id: string },
          options?: { tileWidth: number; tileHeight: number; originPreset: AssetOriginPreset }
        ) => {
          const meta = importReviewData?._meta;
          const effectiveTileWidth = options?.tileWidth ?? importReviewTileWidth;
          const effectiveTileHeight = options?.tileHeight ?? importReviewTileHeight;
          const effectiveOriginPreset = options?.originPreset ?? importReviewOriginPreset;
          const hasTileSizeChange =
            effectiveTileWidth !== (meta?.manualTileWidth ?? 64) ||
            effectiveTileHeight !== (meta?.manualTileHeight ?? 64);

          const resolveOrigin = (
            asset: { sourceX: number; sourceY: number; width: number; height: number },
            preset: AssetOriginPreset
          ) => {
            switch (preset) {
              case 'top-left':
                return { originX: asset.sourceX, originY: asset.sourceY };
              case 'top-center':
                return { originX: asset.sourceX + Math.floor(asset.width / 2), originY: asset.sourceY };
              case 'center':
                return {
                  originX: asset.sourceX + Math.floor(asset.width / 2),
                  originY: asset.sourceY + Math.floor(asset.height / 2)
                };
              case 'bottom-left':
                return { originX: asset.sourceX, originY: asset.sourceY + asset.height };
              case 'bottom-center':
              default:
                return { originX: asset.sourceX + Math.floor(asset.width / 2), originY: asset.sourceY + asset.height };
            }
          };

          const resetImportReviewState = () => {
            setShowImportReview(false);
            setImportReviewData(null);
            setImportReviewTileWidth(64);
            setImportReviewTileHeight(64);
            setImportReviewOriginPreset('bottom-center');
          };
          
          if (editor && meta && meta.file && hasTileSizeChange) {
            // Re-import with selected fixed-grid tile size.
            editor.importBrushImageToLayerTab(
              meta.layerType,
              meta.tabId,
              meta.file,
              meta.projectPath ?? undefined,
              undefined,
              undefined,
              effectiveTileWidth,
              effectiveTileHeight,
              true
            ).then(() => {
              console.log('[useAppMainBuilder] DEBUG: Re-import succeeded, refreshing tab state');
              // Keep the same tab active and force React palette refresh.
              try {
                if (typeof editor.setActiveLayerTab === 'function') {
                  editor.setActiveLayerTab(meta.layerType, meta.tabId);
                  console.log('[useAppMainBuilder] DEBUG: Set active layer tab to', { layerType: meta.layerType, tabId: meta.tabId });
                }
              } catch (e) { console.error('[useAppMainBuilder] ERROR setting active tab:', e); void e; }
              try { appState.setTabTick((t: number) => (t || 0) + 1); console.log('[useAppMainBuilder] DEBUG: Incremented tabTick'); } catch (e) { void e; }

              // Pull fresh detected assets from the just re-imported tab.
              let refreshedDetectedAssets: Array<{ gid: number; sourceX: number; sourceY: number; width: number; height: number; confidence?: number }> = [];
              try {
                const tabs = typeof editor.getLayerTabs === 'function' ? editor.getLayerTabs(meta.layerType) : [];
                const tab = tabs.find((t) => t.id === meta.tabId);
                if (tab?.detectedTiles && typeof tab.detectedTiles === 'object') {
                  refreshedDetectedAssets = Array.from(
                    tab.detectedTiles as Map<number, { sourceX: number; sourceY: number; width: number; height: number }>
                  ).map(([gid, data]) => ({
                    gid,
                    sourceX: data.sourceX,
                    sourceY: data.sourceY,
                    width: data.width,
                    height: data.height,
                    confidence: 0.95
                  }));
                }
              } catch (e) { void e; }

              // Update modal state with refreshed assets for consistency.
              setImportReviewData((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  detectedAssets: refreshedDetectedAssets,
                  _meta: prev._meta
                    ? {
                        ...prev._meta,
                        manualTileWidth: effectiveTileWidth,
                        manualTileHeight: effectiveTileHeight,
                        forceGridSlicing: true
                      }
                    : prev._meta
                };
              });

              // Rebuild profile assets from refreshed detections so saved data matches re-import.
              const profileToSave = {
                ...profile,
                assets: refreshedDetectedAssets.map((asset, idx) => ({
                  ...resolveOrigin(asset, effectiveOriginPreset),
                  id: `asset_${idx + 1}`,
                  profileId: profile.id,
                  name: `Asset ${idx + 1}`,
                  sourceX: asset.sourceX,
                  sourceY: asset.sourceY,
                  width: asset.width,
                  height: asset.height,
                  anchorX: 1,
                  anchorY: 1,
                  footprintWidth: 1,
                  footprintHeight: 1,
                  category: 'ground',
                  detectionConfidence: asset.confidence ?? 0.95,
                  userVerified: true,
                  createdAt: new Date().toISOString()
                })),
                lastModified: new Date().toISOString()
              };

              // After re-import succeeds, proceed to save profile
              toast({
                title: 'Re-imported with new tile size',
                description: `Tileset re-sliced at ${effectiveTileWidth}x${effectiveTileHeight} (${refreshedDetectedAssets.length} assets).`
              });
              
              // Save profile to project
              if (window.electronAPI?.saveTilesetProfiles) {
                const profilesToSave = { [profile.id]: profileToSave };
                console.log('[useAppMainBuilder] DEBUG: Saving tileset profile after re-import:', {
                  profileId: profile.id,
                  tilesetFileName: importReviewData?.tilesetFileName,
                  assetCount: profileToSave.assets?.length,
                  projectPath: currentProjectPath
                });
                window.electronAPI.saveTilesetProfiles(currentProjectPath || '', profilesToSave).then(result => {
                  if (result.success) {
                    console.log('[useAppMainBuilder] DEBUG: Tileset profile saved successfully');
                    toast({
                      title: 'Profile Saved',
                      description: `Asset definitions for ${importReviewData?.tilesetFileName} have been saved.`
                    });
                    resetImportReviewState();
                  } else {
                    console.error('[useAppMainBuilder] ERROR: Failed to save tileset profile:', result.error);
                    toast({
                      title: 'Save Failed',
                      description: result.error || 'Failed to save tileset profile',
                      variant: 'destructive'
                    });
                  }
                });
              }
            }).catch((err: unknown) => {
              toast({
                title: 'Re-import Failed',
                description: `Failed to re-import with tile size ${effectiveTileWidth}x${effectiveTileHeight}: ${String(err)}`,
                variant: 'destructive'
              });
            });
          } else {
            console.log('[useAppMainBuilder] DEBUG: No tile size change, saving profile in default flow');
            // Save profile to project (default flow)
            if (editor && window.electronAPI?.saveTilesetProfiles) {
              const profilesToSave = { [profile.id]: profile };
              console.log('[useAppMainBuilder] DEBUG: Saving tileset profile (default flow):', {
                profileId: profile.id,
                tilesetFileName: importReviewData?.tilesetFileName,
                assetCount: profile.assets?.length,
                projectPath: currentProjectPath
              });
              window.electronAPI.saveTilesetProfiles(currentProjectPath || '', profilesToSave).then(result => {
                if (result.success) {
                  console.log('[useAppMainBuilder] DEBUG: Tileset profile saved successfully (default flow)');
                  toast({
                    title: 'Profile Saved',
                    description: `Asset definitions for ${importReviewData?.tilesetFileName} have been saved.`
                  });
                  resetImportReviewState();
                } else {
                  console.error('[useAppMainBuilder] ERROR: Failed to save tileset profile (default flow):', result.error);
                  toast({
                    title: 'Save Failed',
                    description: result.error || 'Failed to save tileset profile',
                    variant: 'destructive'
                  });
                }
              });
            } else {
              // Fallback: just close the modal
              toast({
                title: 'Profile Confirmed',
                description: 'Asset definitions have been confirmed (profile persistence not available).'
              });
              resetImportReviewState();
            }
          }
        },
        handleImportReviewCancel: () => {
          setShowImportReview(false);
          setImportReviewData(null);
          setImportReviewTileWidth(64);
          setImportReviewTileHeight(64);
          setImportReviewOriginPreset('bottom-center');
        }
        } as Record<string, unknown>;
        return dialogCtx;
      })(),
      // Flatten dialog properties to top level for dialog containers
      actorDialogState: objectEditing.actorDialogState,
      setActorDialogState: objectEditing.setActorDialogState,
      actorDialogError: objectEditing.actorDialogError,
      setActorDialogError: objectEditing.setActorDialogError,
      handleOpenActorDialog: objectEditing.handleOpenActorDialog,
      handleCloseActorDialog: objectEditing.handleCloseActorDialog,
      handleActorFieldChange: objectEditing.handleActorFieldChange,
      handleActorRoleToggle: objectEditing.handleActorRoleToggle,
      handleActorTilesetBrowse: objectEditing.handleActorTilesetBrowse,
      handleActorPortraitBrowse: objectEditing.handleActorPortraitBrowse,
      handleActorSubmit: objectEditing.handleActorSubmit,
      canUseTilesetDialog: typeof window !== 'undefined' && !!window.electronAPI?.selectTilesetFile,
      itemDialogState: itemsHook.itemDialogState,
      setItemDialogState: itemsHook.setItemDialogState,
      itemDialogError: itemsHook.itemDialogError,
      setItemDialogError: itemsHook.setItemDialogError,
      pendingDuplicateItem: itemsHook.pendingDuplicateItem,
      setPendingDuplicateItem: itemsHook.setPendingDuplicateItem,
      handleCloseItemDialog: itemsHook.handleCloseItemDialog,
      handleItemFieldChange: itemsHook.handleItemFieldChange,
      handleItemSubmit: itemsHook.handleItemSubmit,
      handleConfirmDuplicateItem: itemsHook.handleConfirmDuplicateItem,
      clearPendingDuplicate: () => itemsHook.setPendingDuplicateItem(null),
      tooltip: null
    } as Record<string, unknown>;
  }

  // Note: When state (showImportReview, importReviewData) changes, this hook triggers a re-render
  // which causes SidebarProvider to re-render, which calls buildAppMainCtxFromSidebar again
  // with fresh state, so the context automatically gets the updated values
  
  return { sidebarDeps, buildAppMainCtxFromSidebar };
}

