import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import useProjectManager from './useProjectManager';
type ProjectManagerParams = Parameters<typeof useProjectManager>[0];
import useLayerHandlers from './useLayerHandlers';
import useAppEffects from './useAppEffects';
import useNpcDrag from './useNpcDrag';
import useObjectEditing from './useObjectEditing';
import useItems from './useItems';
import useLoadProjectData from './useLoadProjectData';
import useClearLayerHandler from './useClearLayerHandler';
import { normalizeItemsForState } from '@/utils/items';
import { buildConstantStockString } from '@/utils/parsers';
// ItemRole type intentionally not imported — unused in this module
import { toast } from '@/hooks/use-toast';
import useHelpState from './useHelpState';
import useDeleteActiveTab from './useDeleteActiveTab';
import buildConfirmActionHandlers from './useConfirmActionHandlers';
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

  const [autoSaveEnabled, setAutoSaveEnabledState] = useState<boolean>(false);
  const [autoSaveIntervalMs, setAutoSaveIntervalMs] = useState<number>(5000);
  const [autoSaveDebounceMs, setAutoSaveDebounceMs] = useState<number>(2000);
  const [showActiveGid, setShowActiveGid] = useState<boolean>(true);

  const appState = useAppState();
  const toolbarState = useToolbarState() as ToolbarStateType;

  const helpState = useHelpState();

  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
  
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
    handleFillSelection,
    handleDeleteSelection,
    handleClearSelection
  } = editorSetup as EditorSetupType;

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
    setMapObjects: () => {},
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
    setMapName: mapConfig.setMapName,
    setMapWidth: mapConfig.setMapWidth,
    setMapHeight: mapConfig.setMapHeight,
    switchToTabHelpersRef: editorRefs.switchToTabHelpersRef
  }) as EditorTabsType;
  const { tabs, activeTabId, setTabs, setActiveTabId, switchToTab, createTabFor } = editorTabs as unknown as EditorTabsType;

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
    updateLayersList,
    updateLayersListRef,
    syncMapObjects,
    syncMapObjectsRef,
    setupAutoSaveWrapper: setupAutoSave,
    setTabTick: appState.setTabTick,

    // Editor and toolbar sync (ensure UI tool state is forwarded to the editor)
    editor,
    selectedTool: toolbarState.selectedTool,
    selectedBrushTool: toolbarState.selectedBrushTool,
    selectedSelectionTool: toolbarState.selectedSelectionTool,
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

        try { newEditor.clearLocalStorageBackup?.(); } catch (err) { void err; }
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
        }, 150);

        setPendingMapConfig(null);
      } catch (error) {
        console.error('Failed to create editor with pending config:', error);
        setPendingMapConfig(null);
        mapConfig.setMapInitialized(false);
      }
    };

    void createEditorWithConfig();
  }, [pendingMapConfig, editor, canvasRef, appShowWelcome, setupAutoSave, mapConfig, updateLayersList, syncMapObjects, setEditor, setPendingMapConfig, toolbarState, appState]);
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
  }, [editor, canvasRef?.current]);

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
    setMapObjects: () => {},
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

  const objectEditing = useObjectEditing({ editor: null, syncMapObjects, createTabFor, switchToTab, currentProjectPath });

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
      setCurrentProjectPath(projectPath ?? null);
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
      leftCollapsed: appState.leftCollapsed,
      isNpcLayer,
      isEnemyLayer,
      actorEntries: appState.mapObjects,
      draggingNpcId: appState.draggingNpcId,
      handleEditObject: objectEditing.handleEditObject,
      setNpcHoverTooltip: appState.setNpcHoverTooltip,
      handleNpcDragStart,
      handleNpcDragEnd,
      handleOpenActorDialog: objectEditing.handleOpenActorDialog,
      isRulesLayer,
      rulesList: [],
      handleAddRule: () => {},
      isItemsLayer,
      itemsList: itemsList,
      expandedItemCategories,
      setExpandedItemCategories,
      handleOpenItemEdit: handleOpenItemEdit,
      handleOpenItemDialog: handleOpenItemDialog,
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
      handleOpenActorDialogForTileset: objectEditing.handleOpenActorDialog,
      stampsState: {
        stamps: toolbarState.stamps,
        selectedStamp: toolbarState.selectedStamp,
        stampMode: toolbarState.stampMode
      },
      isExporting: isExportingValue,
      exportProgress: exportProgressValue,
      mapsButtonRef,
      mapsDropdownOpen,
      mapsDropdownPos,
      mapsPortalRef,
      mapsSubOpen,
      currentProjectPath,
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
      hasUnsavedChanges: false,
      setShowSettings,
      refreshProjectMaps: refreshProjectMapsFn
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
    appState.setNpcHoverTooltip,
    handleNpcDragStart,
    handleNpcDragEnd,
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
    tabs,
    activeTabId,
    setTabs,
    setActiveTabId,
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
    projectManagerRecord
  ]);
  const handleCloseSettings = useCallback(() => setShowSettings(false), []);

  function buildAppMainCtxFromSidebar(assembledSidebar: AssembledSidebar): Record<string, unknown> {
    const sb = (assembledSidebar ?? {}) as Record<string, unknown>;

    const defaultEditor = editor ?? null;

    const defaultActors = {
      isNpcLayer: false,
      isEnemyLayer: false,
      actorEntries: [],
      draggingNpcId: null,
      handleEditObject: () => {},
      setNpcHoverTooltip: () => {},
      handleNpcDragStart: () => {},
      handleNpcDragEnd: () => {},
      handleOpenActorDialog: () => {}
    };

    const defaultRules = { isRulesLayer: false, rulesList: [], handleAddRule: () => {} };

    const defaultItems = {
      isItemsLayer: false,
      itemsList: [],
      expandedItemCategories: new Set(),
      setExpandedItemCategories: () => {},
      handleOpenItemEdit: () => {},
      handleOpenItemDialog: () => {}
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
      stampsState: undefined
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
        onOpenMapSettings: () => {},
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
      tileset: sb['tileset'] ?? defaultTileset,
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
      autoSaveEnabled,
      setAutoSaveEnabledState,
      autoSaveIntervalMs,
      setAutoSaveIntervalMs,
      autoSaveDebounceMs,
      setAutoSaveDebounceMs,
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
      showMapSettingsOnly: false,
      handleCloseMapSettings: () => {},
      mapName: mapConfig.mapName,
      setMapName: mapConfig.setMapName,
      mapWidth: mapConfig.mapWidth,
      setMapWidth: mapConfig.setMapWidth,
      mapHeight: mapConfig.mapHeight,
      setMapHeight: mapConfig.setMapHeight,
      isStartingMap: mapConfig.isStartingMap,
      updateStartingMap: mapConfig.updateStartingMap,
      handleMapResize: mapConfig.handleMapResize,
      showClearLayerDialog,
      handleClearLayerClose,
      handleClearLayerConfirm,
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
        tipsMinimized: appState.tipsMinimized,
        setTipsMinimized: appState.setTipsMinimized,
        setShowHelp: helpState.setShowHelp,
        isEnemyTabActive: false,
        mapWidth: mapConfig.mapWidth,
        mapHeight: mapConfig.mapHeight,
        handlePlaceActorOnMap: handlePlaceActorOnMap ?? (() => {}),
        mapInitialized: mapConfig.mapInitialized,
        handleOpenCreateMapDialog: mapConfig.handleOpenCreateMapDialog,
        isPreparingNewMap: mapConfig.isPreparingNewMap,
        hoverCoords: toolbarState.hoverCoords,
        showActiveGid: showActiveGid,
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
        selectedTool: toolbarState.selectedTool,
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
        selectedSelectionTool: toolbarState.selectedSelectionTool,
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
        selectedTool: toolbarState.selectedTool,
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
        selectedSelectionTool: toolbarState.selectedSelectionTool,
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
      dialogsCtx,
      tooltip: null
    } as Record<string, unknown>;
  }

  return { sidebarDeps, buildAppMainCtxFromSidebar };
}
