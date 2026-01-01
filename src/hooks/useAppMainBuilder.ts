import { useCallback, useState } from 'react';
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
import useHelpState from './useHelpState';

export default function useAppMainBuilder() {
  const dialogsCtx = useDialogsCtx({});
  const editorRefs = useEditorRefs();
  const editorSetup = useEditorSetup(editorRefs.editorOptsRef);
  
  const { isDarkMode, setIsDarkMode, showSidebarToggle, setShowSidebarToggle } = usePreferences();
  useDarkModeSync(isDarkMode, (editorSetup as unknown as Record<string, unknown>)['editor'] as any);

  const [autoSaveEnabled, setAutoSaveEnabledState] = useState<boolean>(false);
  const [showActiveGid, setShowActiveGid] = useState<boolean>(true);

  const appState = useAppState();
  const toolbarState = useToolbarState();

  const helpState = useHelpState();

  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);

  const {
    editor,
    setEditor,
    canvasRef,
    setupAutoSaveWrapper: setupAutoSave,
    updateLayersListWrapper: updateLayersList,
    syncMapObjectsWrapper: syncMapObjects,
    handlePlaceActorOnMap,
    handleUnplaceActorFromMap,
    handleFillSelection,
    handleDeleteSelection,
    handleClearSelection
  } = editorSetup as unknown as Record<string, any>;

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
    setCurrentProjectPath: setCurrentProjectPath,
    setMapName: mapConfig.setMapName,
    setMapWidth: mapConfig.setMapWidth,
    setMapHeight: mapConfig.setMapHeight,
    switchToTabHelpersRef: (editorRefs as any).switchToTabHelpersRef
  });

  const { tabs, activeTabId, setTabs, setActiveTabId } = editorTabs as unknown as Record<string, any>;
  
  const { handleUndo, handleRedo, handleZoomIn, handleZoomOut, handleResetZoom } = useUndoRedoZoom({ editor, updateLayersList, syncMapObjects });

  const { tooltip, showTooltipWithDelay, hideTooltip } = useTooltip({ toolbarRef: (editorRefs as any).toolbarRef, canvasRef });

  const [showClearLayerDialog, setShowClearLayerDialog] = useState(false);

  const projectManager = useProjectManager({
    editor,
    tabs,
    activeTabId,
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
  } as unknown as Record<string, unknown>);

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
  const handleCloseSettings = useCallback(() => setShowSettings(false), []);

  function buildAppMainCtxFromSidebar(assembledSidebar: AssembledSidebar): Record<string, unknown> {
    const sb = (assembledSidebar ?? {}) as Record<string, unknown>;

    const defaultEditor = (editorSetup as unknown as Record<string, unknown>)['editor'] ?? null;

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

    const defaultControls = {
      mapsButtonRef: { current: null } as React.RefObject<HTMLButtonElement>,
      mapsDropdownOpen: false,
      mapsDropdownPos: null,
      mapsPortalRef: { current: null } as React.RefObject<HTMLDivElement>,
      mapsSubOpen: false,
      currentProjectPath: currentProjectPath,
      projectMaps: (projectManager as any)?.projectMaps ?? [] as string[],
      setMapsSubOpen: ((_v: boolean) => {}) as unknown as React.Dispatch<React.SetStateAction<boolean>>,
      setMapsDropdownOpen: ((_v: boolean) => {}) as unknown as React.Dispatch<React.SetStateAction<boolean>>,
      handleOpenCreateMapDialog: () => { if (typeof mapConfig.setShowCreateMapDialog === 'function') mapConfig.setShowCreateMapDialog(true); },
      handleOpenMapFromMapsFolder: async (filename?: string) => { try { if ((projectManager as any)?.handleOpenMapFromMapsFolder && currentProjectPath && filename) await (projectManager as any).handleOpenMapFromMapsFolder(filename); } catch (e) { console.warn(e); } },
      handleManualSave: async () => { if ((projectManager as any)?.handleManualSave) await (projectManager as any).handleManualSave(); },
      isManuallySaving: false,
      isPreparingNewMap: false,
      hasUnsavedChanges: false,
      setShowSettings: setShowSettings,
      refreshProjectMaps: async () => { if ((projectManager as any)?.refreshProjectMaps) await (projectManager as any).refreshProjectMaps(); },
      uiHelpers: undefined,
      toast: undefined
    } as unknown as Record<string, unknown>;

    return {
      showWelcome: appState.showWelcome,
      handleCreateNewMap: handleCreateNewMap,
      handleOpenMap: (projectPath?: string) => { try { if ((projectManager as any)?.handleOpenMap) void (projectManager as any).handleOpenMap(projectPath); } catch (e) { console.warn(e); } },
      isDarkMode,
      titleBarProps: {
        tabs: tabs ?? [],
        activeTabId: activeTabId ?? null,
        onSwitchTab: (id: string | number) => { try { if (typeof setActiveTabId === 'function') setActiveTabId(id); } catch (e) {} },
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
      showClearLayerDialog: false,
      handleClearLayerClose: () => {},
      handleClearLayerConfirm: () => {},
      confirmDialogProps: buildConfirmDialogProps({ confirmAction: null, setConfirmAction: () => {} }),
      showHelp: false,
      activeHelpTab: 0,
      setActiveHelpTab: () => {},
      handleHelpClose: () => {},
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
        uiHelpers: { tooltip, toolbarRef: (editorRefs as any).toolbarRef, canvasRef },
        stampsState: toolbarState.stampsState,
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
        handleCreateStamp: toolbarState.handleCreateStamp ?? (() => {}),
        stamps: toolbarState.stamps ?? [],
        selectedStamp: toolbarState.selectedStamp,
        handleStampSelect: toolbarState.handleStampSelect ?? (() => {}),
        handleDeleteStamp: toolbarState.handleDeleteStamp ?? (() => {})
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
        handleCreateStamp: toolbarState.handleCreateStamp ?? (() => {}),
        stamps: toolbarState.stamps ?? [],
        selectedStamp: toolbarState.selectedStamp,
        handleStampSelect: toolbarState.handleStampSelect ?? (() => {}),
        handleDeleteStamp: toolbarState.handleDeleteStamp ?? (() => {}),
        stampsState: toolbarState.stampsState
      },
      enemyPanelProps: {},
      dialogsCtx,
      tooltip: null
    } as Record<string, unknown>;
  }

  return { buildAppMainCtxFromSidebar };
}
