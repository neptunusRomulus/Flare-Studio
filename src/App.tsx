import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import useTitleBarProps from './hooks/useTitleBarProps';
import buildConfirmDialogProps from './hooks/buildConfirmDialogProps';
import useActorDialogCtx from './hooks/useActorDialogCtx';
import useItemDialogCtx from './hooks/useItemDialogCtx';
import useObjectDialogCtx from './hooks/useObjectDialogCtx';
import useVendorDialogCtx from './hooks/useVendorDialogCtx';
import useMapsDropdown from './hooks/useMapsDropdown';
import { MapObject } from './types';
import type { ItemRole } from './editor/itemRoles';
import { GAME_TRIGGER_OPTIONS, PLAYER_TRIGGER_OPTIONS } from './editor/ruleOptions';
import type { RuleStartType } from './editor/ruleOptions';
import useHelpState from './hooks/useHelpState';
import useMapConfig from './hooks/useMapConfig';
import useObjectEditing from './hooks/useObjectEditing';
import useProjectSession from './hooks/useProjectSession';
import useProjectIO from './hooks/useProjectIO';
import useProjectLoader from './hooks/useProjectLoader';
import useDialogs from './hooks/useDialogs';
import useDialogsCtx from './hooks/useDialogsCtx';
import { buildConstantStockString } from './utils/parsers';
import useToolbarSetup from './hooks/useToolbarSetup';
import useAutosave from './hooks/useAutosave';
import useToolbarVisibility from './hooks/useToolbarVisibility';
import useTooltip from './hooks/useTooltip';
import useVendorState from './hooks/useVendorState';
import useEditorTabs from './hooks/useEditorTabs';
import useEditorSetup from './hooks/useEditorSetup';
import useSwitchToTabHelpers from './hooks/useSwitchToTabHelpers';
import usePreferences from './hooks/usePreferences';
import useEditorIpc from './hooks/useEditorIpc';
import useHoverAndSelection from './hooks/useHoverAndSelection';
import useUndoRedoZoom from './hooks/useUndoRedoZoom';
import useCreateMap from './hooks/useCreateMap';
import useBeforeCreateMap from './hooks/useBeforeCreateMap';
import useGetters from './hooks/useGetters';
import useActorManagement from './hooks/useActorManagement';
import useNpcDrag from './hooks/useNpcDrag';
import useLayerHandlers from './hooks/useLayerHandlers';
import useConfirmations from './hooks/useConfirmations';
import useObjectDialogHandlers from './hooks/useObjectDialogHandlers';
import useAbilityDialog from './hooks/useAbilityDialog';
import useCanvasDoubleClick from './hooks/useCanvasDoubleClick';
import useBrushActions from './hooks/useBrushActions';
import useEditorAreaProps from './hooks/useEditorAreaProps';
import useWindowControls from './hooks/useWindowControls';
import useSidebarToggle from './hooks/useSidebarToggle';
import useClearLayerHandler from './hooks/useClearLayerHandler';
import useDialogCloseHandlers from './hooks/useDialogCloseHandlers';
import useEnemyEditing from './hooks/useEnemyEditing';
import useDarkModeSync from './hooks/useDarkModeSync';
import useBrushToolDomSync from './hooks/useBrushToolDomSync';
import useEditorOptionsRef from './hooks/useEditorOptionsRef';
import useActiveGidCallback from './hooks/useActiveGidCallback';
import useBeforeUnload from './hooks/useBeforeUnload';
import flareIconUrl from '/flare-ico.png?url';

type EnemyTabConfig = { enemy: MapObject };

import useItems from './hooks/useItems';
import { normalizeItemsForState as normalizeItemsHelper } from './utils/items';
import useVendorDialogs from './hooks/useVendorDialogs';
import useRuleHandlers from './hooks/useRuleHandlers';
import useObjectDialogClose from './hooks/useObjectDialogClose';
import useEditingBrowseHandlers from './hooks/useEditingBrowseHandlers';
import useLoadProjectData from './hooks/useLoadProjectData';
import useManualSave from './hooks/useManualSave';
import useDeleteActiveTab from './hooks/useDeleteActiveTab';
import useSettingsHandlers from './hooks/useSettingsHandlers';
import useMapHandlers from './hooks/useMapHandlers';
import useBrushActionListener from './hooks/useBrushActionListener';
import buildConfirmActionHandlers from './hooks/useConfirmActionHandlers';
import useAppEffects from './hooks/useAppEffects';
import AppMain from './components/AppMain';
// useAppMainCtx was used earlier; appCtx is now built inline in the provider
import { ToolbarProvider } from './context/ToolbarContext';
import { SidebarProvider } from './context/SidebarContext';
import { AppProvider } from './context/AppContext';
import useAppState from './hooks/useAppState';
import buildAppMainCtx from './hooks/useAppMainCtx';
import useEditorToolSync from './hooks/useEditorToolSync';
import useEditorRefs from './hooks/useEditorRefs';

function App() {
  const {
    showWelcome,
    setShowWelcome,
    activeGid,
    setActiveGid,
    showActiveGid,
    setShowActiveGid,
    leftCollapsed,
    setLeftCollapsed,
    leftTransitioning,
    setLeftTransitioning,
    layers,
    setLayers,
    activeLayerId,
    setActiveLayerId,
    showAddLayerDropdown,
    setShowAddLayerDropdown,
    layersPanelExpanded,
    setLayersPanelExpanded,
    hoveredLayerId,
    setHoveredLayerId,
    tipsMinimized,
    setTipsMinimized,
    tabTick,
    setTabTick,
    pendingMapConfig,
    setPendingMapConfig,
    isOpeningProject,
    setIsOpeningProject,
    draggingNpcId,
    setDraggingNpcId,
    npcHoverTooltip,
    setNpcHoverTooltip,
    npcDeletePopup,
    setNpcDeletePopup,
    createTabForRef,
    beforeCreateMapRef
  } = useAppState();
  const { editorOptsRef, handleManualSaveRef, switchToTabHelpersRef } = useEditorRefs();
  const {
    editor,
    setEditor,
    canvasRef,
    updateLayersListRef,
    syncMapObjectsRef,
    setupAutoSaveWrapper,
    updateLayersListWrapper,
    syncMapObjectsWrapper,
    handlePlaceActorOnMap,
    handleUnplaceActorFromMap,
    handleFillSelection,
    handleClearSelection,
    handleDeleteSelection
  } = useEditorSetup(editorOptsRef);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  // Editor tabs
  

  // Session is now stored per-project in .flare-session.json
  // Load session when a project is opened (handled in handleOpenMap)
  // Save session effect is defined after currentProjectPath state (see below)

  // App UI toolbar state moved to a reusable hook
  const { toolbarState, stampsState, handleSelectTool, handleToggleBrushTool, handleCreateStamp, handleStampSelect, handleDeleteStamp, handleSeparateBrush, confirmSeparateBrush } = useToolbarSetup({ editor });

  const {
    toolbarControls,
    brushToolbarControls,
    bottomToolbarControls,
    toolbarExpanded,
    toolbarContainerRef,
    handleToolbarMouseEnter,
    handleToolbarMouseLeave,
    handleToolbarFocus,
    handleToolbarBlur,
    bottomToolbarExpanded,
    setBottomToolbarNode,
    handleBottomToolbarMouseEnter,
    handleBottomToolbarMouseLeave,
    handleBottomToolbarFocus,
    handleBottomToolbarBlur,
    showToolbarTemporarily,
    showBottomToolbarTemporarily,
    selectedTool,
    selectedBrushTool,
    setSelectedBrushTool,
    selectedSelectionTool,
    setSelectedSelectionTool,
    selectedShapeTool,
    setSelectedShapeTool,
    hoverCoords,
    setHoverCoords,
    selectionCount,
    setSelectionCount,
    hasSelection,
    setHasSelection,
    showBrushOptions,
    handleShowBrushOptions,
    handleHideBrushOptions,
    showSelectionOptions,
    handleShowSelectionOptions,
    handleHideSelectionOptions,
    showShapeOptions,
    handleShowShapeOptions,
    handleHideShapeOptions,
    stamps,
    setStamps,
    selectedStamp,
    setSelectedStamp,
    stampMode,
    setStampMode,
    newStampName,
    setNewStampName,
    brushTool,
    setBrushTool,
    showSeparateDialog,
    setShowSeparateDialog,
    setBrushToSeparate
  } = toolbarState;

  const canUseTilesetDialog = !!editor;
  const {
    showClearLayerDialog,
    setShowClearLayerDialog,
    confirmAction,
    setConfirmAction,
    setTabToDelete,
    confirmPayloadRef
  } = useConfirmations();
  
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
  const {
    showHelp,
    setShowHelp,
    activeHelpTab,
    setActiveHelpTab
  } = useHelpState();

  const {
    showVendorStockDialog,
    setShowVendorStockDialog,
    vendorStockSelection,
    setVendorStockSelection,
    showVendorUnlockDialog,
    setShowVendorUnlockDialog,
    vendorUnlockEntries,
    setVendorUnlockEntries,
    showVendorRandomDialog,
    setShowVendorRandomDialog,
    vendorRandomSelection,
    setVendorRandomSelection,
    vendorRandomCount,
    setVendorRandomCount
  } = useVendorState();
  
  const { isDarkMode, setIsDarkMode, showSidebarToggle, setShowSidebarToggle } = usePreferences();
  
  // Autosave state moved to hook
  const {
    autoSaveEnabled,
    setAutoSaveEnabled: setAutoSaveEnabledState,
    isManuallySaving,
    setIsManuallySaving,
    saveStatus,
    setSaveStatus,
    lastSaveTime,
    setLastSaveTime,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    
  } = useAutosave({ manualSaveRef: handleManualSaveRef });

  
  
  const { tooltip, showTooltipWithDelay: showTooltipWithDelayFn, hideTooltip: hideTooltipFn } = useTooltip({ toolbarRef, canvasRef });

  const uiHelpers = {
    tooltip,
    showTooltipWithDelay: showTooltipWithDelayFn,
    hideTooltip: hideTooltipFn,
    toolbarRef,
    canvasRef
  };

  // Reference `activeGid` so linters don't mark it as unused (value consumed elsewhere)
  useEffect(() => { void activeGid; }, [activeGid]);

  

  // Hero position edit dialog state moved to useDialogs

  const {
    showObjectDialog,
    setShowObjectDialog,
    editingObject,
    setEditingObject,
    objectValidationErrors,
    setObjectValidationErrors,
    mapObjects,
    setMapObjects,
    showDeleteNpcConfirm,
    setShowDeleteNpcConfirm,
    showDeleteEnemyConfirm,
    setShowDeleteEnemyConfirm,
    actorDialogState,
    setActorDialogState,
    actorDialogError,
    setActorDialogError,
    handleOpenActorDialog,
    handleEditObject,
    handleUpdateObject,
    handleCloseActorDialog,
    showDialogueTreeDialog,
    setShowDialogueTreeDialog,
    dialogueTrees,
    setDialogueTrees,
    activeDialogueTab,
    setActiveDialogueTab,
    dialogueTabToDelete,
    setDialogueTabToDelete
  } = useObjectEditing();

  const {
    showAbilityDialog,
    abilityNameInput,
    setAbilityNameInput,
    handleCloseAbilityDialog,
    handleCreateAbility
  } = useAbilityDialog();

  
  const { getCreateTabFor, getBeforeCreateMap } = useGetters({ createTabForRef, beforeCreateMapRef });
  const {
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
    setReservedMapNames,
    newMapStarting,
    setNewMapStarting,
    mapName,
    setMapName,
    isStartingMap,
    startingMapIntermap,
    setStartingMapIntermap,
    isPreparingNewMap,
    handleMapResize,
    handleOpenCreateMapDialog,
    handleConfirmCreateMap,
    updateStartingMap
  } = useMapConfig({
    editor,
    setEditor,
    canvasRef,
    isDarkMode,
    setupAutoSave: setupAutoSaveWrapper,
    updateLayersList: updateLayersListWrapper,
    syncMapObjects: syncMapObjectsWrapper,
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
  });
  const {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    activeTab,
    isEnemyTabActive,
    createTabFor,
    closeEditorTab,
    switchToTab
  } = useEditorTabs({
    editor,
    currentProjectPath,
    setCurrentProjectPath,
    setMapName,
    setMapWidth,
    setMapHeight,
    switchToTabHelpersRef
  });
  // before-create-map behavior extracted to a hook
  const { handleBeforeCreateMap } = useBeforeCreateMap({ editor, activeTabId, setTabs, currentProjectPath });

  useProjectSession({ tabs, activeTabId, currentProjectPath });
  
  // Rules list for the Rules layer (UI-only for now; persistence will be added later).
  const [rulesList, setRulesList] = useState<Array<{ id: string; name: string; startType: RuleStartType; triggerId: string }>>([]);
  const {
    showRuleDialog,
    openRuleDialog,
    closeRuleDialog,
    ruleDialogStep,
    setRuleDialogStep,
    ruleDialogError,
    setRuleDialogError,
    showSettings,
    setShowSettings,
    showMapSettingsOnly,
    setShowMapSettingsOnly,
    showHeroEditDialog,
    setShowHeroEditDialog,
    heroEditData,
    setHeroEditData,
    handleHeroEditConfirm,
    handleHeroEditCancel
  } = useDialogs();
  // Extracted handlers (moved out of JSX)
  const { handleCloseSettings, handleCloseMapSettings, handleHelpClose } = useSettingsHandlers({ setShowSettings, setShowMapSettingsOnly, setShowHelp });

  const { handleSidebarToggle } = useSidebarToggle({ editor, setLeftTransitioning, setLeftCollapsed });
  const { handleClearLayerClose, handleClearLayerConfirm } = useClearLayerHandler({ editor, setSelectedBrushTool, setShowClearLayerDialog });
  const { handleMinimize, handleMaximize, handleClose } = useWindowControls();
  
  // ability dialog state moved to useAbilityDialog
  const [ruleNameInput, setRuleNameInput] = useState('');
  const [ruleStartType, setRuleStartType] = useState<RuleStartType | null>(null);
  const [ruleTriggerId, setRuleTriggerId] = useState<string>('');
  const [ruleActionSelection, setRuleActionSelection] = useState<{ groupId: string; actionId: string } | null>(null);
  const { handleRuleClose, handleDialogueClose } = useDialogCloseHandlers({
    closeRuleDialog,
    setRuleDialogError,
    setRuleDialogStep,
    setRuleStartType,
    setRuleTriggerId,
    setRuleActionSelection,
    setShowDialogueTreeDialog,
    setDialogueTabToDelete
  });
  // Items list for display
  
  // Expanded item categories for accordion
  const [expandedItemCategories, setExpandedItemCategories] = useState<Set<ItemRole>>(new Set());

  const normalizeItemsForState = normalizeItemsHelper;

  const { toast } = useToast();

  const {
    isExporting,
    exportProgress,
    showExportSuccess,
    setShowExportSuccess,
    showOverwriteDialog,
    handleOverwriteConfirm,
    handleOverwriteCancel,
    projectMaps,
    refreshProjectMaps,
    handleOpenMapFromMapsFolder
  } = useProjectIO({
    editor,
    currentProjectPath,
    mapName,
    startingMapIntermap,
    mapObjects,
    buildConstantStockString,
    toast,
    handleManualSave: async () => { if (handleManualSaveRef.current) await handleManualSaveRef.current(); },
    updateLayersList: updateLayersListWrapper,
    syncMapObjects: syncMapObjectsWrapper,
    setMapInitialized,
    setMapName
  });

  const { handleOpenMap } = useProjectLoader({
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
    setNewMapWidth,
    setNewMapHeight,
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
  });

  // Stable ref for manual save handler: referenced by project IO and autosave hooks.

  // Items state & handlers moved to hook
  const {
    itemsList,
    setItemsList,
    itemDialogState,
    itemDialogError,
    pendingDuplicateItem,
    setPendingDuplicateItem,
    handleOpenItemDialog,
    handleCloseItemDialog,
    handleItemFieldChange,
    handleItemSubmit,
    handleConfirmDuplicateItem,
    showItemEditDialog,
    editingItem,
    handleOpenItemEdit,
    handleCloseItemEdit,
    handleSaveItemEdit,
    updateEditingItemField
  } = useItems({ currentProjectPath, toast, normalizeItemsForState });
  // projectMaps now provided by useProjectIO
  const {
    mapsDropdownOpen,
    setMapsDropdownOpen,
    mapsButtonRef,
    mapsDropdownPos,
    mapsPortalRef,
    mapsSubOpen,
    setMapsSubOpen
  } = useMapsDropdown();
  // (selectedMapTxt removed — we call editor.loadFlareMapTxt when available)

  // refreshProjectMaps and handleOpenMapFromMapsFolder are declared later (after helpers they depend on)

  const { syncMapObjects, updateLayersList: updateLayersListFromHook } = useMapHandlers({ editor, setMapObjects, setLayers, setActiveLayerId });

  useEffect(() => {
    syncMapObjectsRef.current = syncMapObjects;
  }, [syncMapObjects, syncMapObjectsRef]);

  // Keep 'toast' referenced to avoid unused variable errors while toasts are suppressed.
  // This creates a stable noop reference that will never show UI.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _noopToast = toast;
    return () => {
      // no-op cleanup
    };
  }, [toast]);

  useDarkModeSync(isDarkMode, editor);
  useActiveGidCallback(editor, setActiveGid);

  

  useToolbarVisibility({
    showWelcome,
    mapInitialized,
    toolbar: toolbarControls,
    brushToolbar: brushToolbarControls,
    bottomToolbar: bottomToolbarControls
  });
  // Editor-instantiation is now handled by `useEditorState` hook.

  useHoverAndSelection({ editor, setHoverCoords, setSelectionCount, setHasSelection });

  useEditorToolSync({
    editor,
    selectedTool,
    selectedBrushTool,
    selectedSelectionTool,
    selectedShapeTool,
    stampMode,
    selectedStamp,
    setSelectionCount,
    setHasSelection
  });

  // Layer management functions
  const updateLayersList = updateLayersListFromHook;

  useEffect(() => {
    updateLayersListRef.current = updateLayersList;
  }, [updateLayersList, updateLayersListRef]);

  useEditorOptionsRef(editorOptsRef, {
    autoSaveEnabled,
    setAutoSaveEnabled: setAutoSaveEnabledState,
    currentProjectPath,
    isDarkMode,
    showWelcome,
    isOpeningProject,
    pendingMapConfig,
    mapInitialized,
    mapWidth,
    mapHeight,
    handleSelectTool,
    setSelectedBrushTool,
    setStamps,
    setMapObjects,
    setNpcDeletePopup,
    setHeroEditData,
    setShowHeroEditDialog,
    setSaveStatus,
    setHasUnsavedChanges,
    setLastSaveTime,
    updateLayersListRef,
    syncMapObjectsRef
  }, [
    autoSaveEnabled,
    setAutoSaveEnabledState,
    currentProjectPath,
    isDarkMode,
    showWelcome,
    isOpeningProject,
    pendingMapConfig,
    mapInitialized,
    mapWidth,
    mapHeight,
    handleSelectTool,
    setSelectedBrushTool,
    setStamps,
    setMapObjects,
    setNpcDeletePopup,
    setHeroEditData,
    setShowHeroEditDialog,
    setSaveStatus,
    setHasUnsavedChanges,
    setLastSaveTime,
    updateLayersListRef,
    syncMapObjectsRef
  ]);

  useEffect(() => {
    if (editor) {
      updateLayersList();
    }
  }, [editor, updateLayersList]);

  useEffect(() => {
    syncMapObjects();
  }, [syncMapObjects]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (_event: MouseEvent) => {
      if (showAddLayerDropdown) {
        setShowAddLayerDropdown(false);
      }
    };

    if (showAddLayerDropdown) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showAddLayerDropdown, setShowAddLayerDropdown]);

  // Icon helper functions were moved into toolbar components.

  // Brush management handlers
  // Removed unused handlers: handleMergeBrushes, handleCancelMerge

  // Brush management handlers are provided by useToolbarHandlers.

  // Brush actions moved to a hook
  const { removeBrush: handleRemoveBrush, reorderBrush: handleBrushReorder } = useBrushActions({ editor, setConfirmAction });

  // Object management handlers
  // Object edit/update behavior provided by `useObjectEditing` hook

  const {
    handleActorFieldChange,
    handleActorRoleToggle,
    handleActorTilesetBrowse,
    handleActorPortraitBrowse,
    handleActorSubmit
  } = useActorManagement({
    editor,
    actorDialogState,
    setActorDialogState,
    setActorDialogError,
    currentProjectPath,
    handleCloseActorDialog,
    handleEditObject,
    syncMapObjects
  });

  // Item handlers moved to `useItems` hook (see src/hooks/useItems.ts)

  const { handleAddRule, handleSaveRule } = useRuleHandlers({
    openRuleDialog,
    closeRuleDialog,
    rulesListLength: rulesList.length,
    ruleNameInput,
    setRuleNameInput,
    ruleStartType,
    setRuleDialogError,
    setRuleStartType,
    setRuleTriggerId,
    setRuleActionSelection,
    setRuleDialogStep,
    setRulesList
  });

  

  // Item edit/create handlers moved to `useItems` hook (see src/hooks/useItems.ts)



  

  const { handleNpcDragStart, handleNpcDragEnd } = useNpcDrag({ editor, setDraggingNpcId });

  const { handleObjectDialogClose } = useObjectDialogClose({ setShowObjectDialog, setEditingObject, setObjectValidationErrors, setShowDeleteNpcConfirm, setShowDeleteEnemyConfirm });



  const { handleObjectDialogSave, updateEditingObjectProperty, updateEditingObjectBoolean, getEditingObjectProperty } = useObjectDialogHandlers({
    editingObject,
    setEditingObject,
    setObjectValidationErrors,
    currentProjectPath,
    handleUpdateObject
  });

  const { handleEditingTilesetBrowse, handleEditingPortraitBrowse } = useEditingBrowseHandlers({ updateEditingObjectProperty });

  // Vendor dialog handlers moved to hook
  const {
    handleOpenVendorStockDialog,
    handleOpenVendorUnlockDialog,
    handleOpenVendorRandomDialog,
    handleToggleVendorStockItem,
    handleVendorStockQtyChange,
    handleSaveVendorStock,
    handleAddVendorUnlockRequirement,
    handleUpdateVendorUnlockRequirement,
    handleToggleVendorUnlockItem,
    handleVendorUnlockQtyChange,
    handleRemoveVendorUnlockRequirement,
    handleSaveVendorUnlock,
    handleToggleVendorRandomItem,
    handleVendorRandomFieldChange,
    handleRandomCountChange,
    handleSaveVendorRandom
  } = useVendorDialogs({
    editingObject,
    setEditingObject,
    vendorStockSelection,
    setVendorStockSelection,
    vendorUnlockEntries,
    setVendorUnlockEntries,
    vendorRandomSelection,
    setVendorRandomSelection,
    vendorRandomCount,
    setVendorRandomCount,
    setShowVendorStockDialog,
    setShowVendorUnlockDialog,
    setShowVendorRandomDialog
  });

  

  // Hero edit handlers moved to useDialogs
  useCanvasDoubleClick({ editor, canvasRef, handleEditObject });

  useBrushToolDomSync(brushTool);

  // Listen for brush actions emitted from editor via custom events
  useBrushActionListener({ onSeparate: handleSeparateBrush, onRemove: handleRemoveBrush, onReorder: handleBrushReorder });

  // Helper function to load project data into editor
  const { loadProjectData } = useLoadProjectData();

  // Project-load editor creation is now managed inside `useEditorState`.

  const { handleFileUpload, handleSetActiveLayer, handleToggleLayerVisibility, handleLayerTransparencyChange } = useLayerHandlers({
    editor,
    layers,
    setLayers,
    setActiveLayerId,
    setItemsList,
    normalizeItemsForState,
    currentProjectPath,
    updateLayersList
  });

  const { handleUndo, handleRedo, handleZoomIn, handleZoomOut, handleResetZoom } = useUndoRedoZoom({ editor, updateLayersList, syncMapObjects });

  

  const { handleManualSave } = useManualSave({ editor, currentProjectPath, setIsManuallySaving, setLastSaveTime, manualSaveRef: handleManualSaveRef });

  // Keep stable refs to the handlers so we can register IPC listeners once
  // and still call the latest handler implementations without re-registering.
  const handleOpenMapRef = useRef<typeof handleOpenMap | null>(null);
  const handleUndoRef = useRef<(() => void) | undefined>(undefined);
  const handleRedoRef = useRef<(() => void) | undefined>(undefined);

  
  useEffect(() => { handleUndoRef.current = handleUndo; }, [handleUndo]);
  useEffect(() => { handleRedoRef.current = handleRedo; }, [handleRedo]);

  // Maps management moved into useProjectIO hook

  // minimap toggle handed inline where needed; removed unused handler

  const { handleCreateNewMap } = useCreateMap({
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
  });

  

  // Keep a ref to handleOpenMap so IPC listeners can call the latest implementation
  useEffect(() => { handleOpenMapRef.current = handleOpenMap; }, [handleOpenMap]);

  useSwitchToTabHelpers(switchToTabHelpersRef, {
    handleOpenMap,
    loadProjectData,
    setupAutoSave: setupAutoSaveWrapper,
    syncMapObjects,
    updateLayersList,
  });
  // Register Electron IPC/menu & close-confirm listeners via hook
  useEditorIpc({
    handleManualSaveRef,
    handleOpenMapRef,
    handleUndoRef,
    handleRedoRef,
    setShowWelcome,
    setMapInitialized,
    setEditor,
    setMapWidth,
    setMapHeight,
    setShowCreateMapDialog,
    hasUnsavedChanges
  });

  useBeforeUnload(hasUnsavedChanges);

  useAppEffects({
    createTabForRef,
    createTabFor,
    beforeCreateMapRef,
    handleBeforeCreateMap,
    tabs,
    activeTabId,
    currentProjectPath,
    setActiveTabId,
    toast,
    editor,
    selectedTool,
    selectedBrushTool,
    selectedSelectionTool,
    selectedShapeTool,
    stampMode,
    selectedStamp,
    setSelectionCount,
    setHasSelection,
    updateLayersList,
    updateLayersListRef,
    syncMapObjects,
    syncMapObjectsRef,
    showAddLayerDropdown,
    setShowAddLayerDropdown,
    loadProjectData,
    setupAutoSaveWrapper,
    handleOpenMap,
    handleUndo,
    handleRedo,
    handleOpenMapRef,
    handleUndoRef,
    handleRedoRef,
    switchToTabHelpersRef
  });



  

  

  const activeLayer = useMemo(() => {
    return layers.find((layer) => layer.id === activeLayerId) ?? null;
  }, [layers, activeLayerId]);
  const { handleDeleteActiveTab } = useDeleteActiveTab({ editor, activeLayer, toast, confirmPayloadRef, setTabToDelete, setConfirmAction });

  const isCollisionLayer = activeLayer?.type === 'collision';
  const isNpcLayer = activeLayer?.type === 'npc';
  const isEnemyLayer = activeLayer?.type === 'enemy';
  const isItemsLayer = activeLayer?.type === 'items';
  const isRulesLayer = activeLayer?.type === 'rules';

  const availableRuleTriggers = ruleStartType ? (ruleStartType === 'player' ? PLAYER_TRIGGER_OPTIONS : GAME_TRIGGER_OPTIONS) : [];

  const actorEntries = useMemo(() => {
    if (isNpcLayer) {
      return mapObjects.filter((obj) => obj.type === 'npc');
    }
    if (isEnemyLayer) {
      return mapObjects.filter((obj) => obj.type === 'enemy');
    }
    return [];
  }, [mapObjects, isNpcLayer, isEnemyLayer]);

  const {
    pendingEnemyTabCloseId,
    setPendingEnemyTabCloseId,
    handleEnemyTabCloseDecision,
    handleEnemyTabSave
  } = useEnemyEditing({
    closeEditorTab,
    handleUpdateObject,
    setTabs,
    activeTabId
  });

  

  

  // Assemble Editor-area props via a focused hook to keep App.tsx small
  const { topBarProps, canvasCtx, bottomToolbarProps, enemyPanelProps } = useEditorAreaProps({
    editor,
    canvasRef,
    draggingNpcId,
    setDraggingNpcId,
    tipsMinimized,
    setTipsMinimized,
    setShowHelp,
    isEnemyTabActive,
    mapWidth,
    mapHeight,
    handlePlaceActorOnMap,
    mapInitialized,
    handleOpenCreateMapDialog,
    isPreparingNewMap,
    hoverCoords,
    showActiveGid,
    npcDeletePopup,
    setNpcDeletePopup,
    handleUnplaceActorFromMap,
    npcHoverTooltip,
    uiHelpers,
    stampsState,
    hasSelection,
    selectionCount,
    handleFillSelection,
    handleDeleteSelection,
    handleClearSelection,
    leftTransitioning,
    bottomToolbarExpanded,
    setBottomToolbarNode,
    handleBottomToolbarMouseEnter,
    handleBottomToolbarMouseLeave,
    handleBottomToolbarFocus,
    handleBottomToolbarBlur,
    selectedTool,
    handleSelectTool,
    showBrushOptions,
    handleShowBrushOptions,
    handleHideBrushOptions,
    selectedBrushTool,
    setSelectedBrushTool,
    showTooltipWithDelayFn,
    hideTooltipFn,
    setShowClearLayerDialog,
    showSelectionOptions,
    handleShowSelectionOptions,
    handleHideSelectionOptions,
    selectedSelectionTool,
    setSelectedSelectionTool,
    showShapeOptions,
    handleShowShapeOptions,
    handleHideShapeOptions,
    selectedShapeTool,
    setSelectedShapeTool,
    stampMode,
    setStampMode,
    newStampName,
    setNewStampName,
    handleCreateStamp,
    stamps,
    selectedStamp,
    handleStampSelect,
    handleDeleteStamp,
    toolbarExpanded,
    toolbarContainerRef,
    handleToolbarMouseEnter,
    handleToolbarMouseLeave,
    handleToolbarFocus,
    handleToolbarBlur,
    handleUndo,
    handleRedo,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    enemy: (activeTab?.config as EnemyTabConfig | null)?.enemy,
    pendingEnemyTabCloseId,
    activeTabId,
    handleEnemyTabCloseDecision,
    handleEnemyTabSave
  });

  // assembledSidebar will be provided by SidebarProvider below

  const titleBarProps = useTitleBarProps({
    tabs,
    activeTabId,
    switchToTab,
    setShowMapSettingsOnly,
    setPendingEnemyTabCloseId,
    setShowCreateMapDialog,
    saveStatus: (saveStatus ?? 'unsaved') as 'saving' | 'saved' | 'error' | 'unsaved',
    lastSaveTime: lastSaveTime ?? 0,
    handleMinimize,
    handleMaximize,
    handleClose,
    flareIconUrl
  });

  const { onCancel: confirmOnCancel, onConfirm: confirmOnConfirm } = buildConfirmActionHandlers({
    confirmAction,
    tabToDelete: undefined,
    confirmPayloadRef,
    editor,
    setTabTick,
    setTabToDelete,
    setConfirmAction
  });

  const confirmDialogProps = buildConfirmDialogProps({ confirmAction, setConfirmAction, onCancel: confirmOnCancel, onConfirm: confirmOnConfirm });

  const actorDialogCtx = useActorDialogCtx({
    actorDialogState,
    actorDialogError,
    canUseTilesetDialog,
    handleCloseActorDialog,
    handleActorFieldChange,
    handleActorRoleToggle,
    handleActorTilesetBrowse,
    handleActorPortraitBrowse,
    handleActorSubmit
  });

  const itemDialogCtx = useItemDialogCtx({
    itemDialogState,
    itemDialogError,
    pendingDuplicateItem,
    handleCloseItemDialog,
    handleItemFieldChange,
    handleItemSubmit,
    handleConfirmDuplicateItem,
    clearPendingDuplicate: () => setPendingDuplicateItem(null),
    showItemEditDialog,
    editingItem,
    updateEditingItemField,
    handleCloseItemEdit,
    handleSaveItemEdit
  });

  const objectDialogCtx = useObjectDialogCtx({
    showObjectDialog,
    editingObject,
    objectValidationErrors,
    setEditingObject,
    handleObjectDialogClose,
    handleObjectDialogSave,
    updateEditingObjectProperty,
    updateEditingObjectBoolean,
    getEditingObjectProperty,
    editor,
    syncMapObjects,
    handleEditingTilesetBrowse,
    handleEditingPortraitBrowse,
    handleOpenVendorStockDialog,
    handleOpenVendorUnlockDialog,
    handleOpenVendorRandomDialog,
    setDialogueTrees,
    setActiveDialogueTab,
    setShowDialogueTreeDialog,
    showDeleteNpcConfirm,
    setShowDeleteNpcConfirm,
    showDeleteEnemyConfirm,
    setShowDeleteEnemyConfirm
  });

  const vendorDialogCtx = useVendorDialogCtx({
    itemsList,
    showVendorUnlockDialog,
    setShowVendorUnlockDialog,
    vendorUnlockEntries,
    showVendorRandomDialog,
    setShowVendorRandomDialog,
    vendorRandomSelection,
    vendorRandomCount,
    showVendorStockDialog,
    setShowVendorStockDialog,
    vendorStockSelection,
    handleUpdateVendorUnlockRequirement,
    handleRemoveVendorUnlockRequirement,
    handleToggleVendorUnlockItem,
    handleVendorUnlockQtyChange,
    handleAddVendorUnlockRequirement,
    handleSaveVendorUnlock,
    handleToggleVendorRandomItem,
    handleVendorRandomFieldChange,
    handleRandomCountChange,
    handleSaveVendorRandom,
    handleToggleVendorStockItem,
    handleVendorStockQtyChange,
    handleSaveVendorStock
  });

  const dialogsCtx = useDialogsCtx({
    showSeparateDialog,
    setShowSeparateDialog,
    confirmSeparateBrush,
    ...vendorDialogCtx,
    showRuleDialog,
    openRuleDialog,
    closeRuleDialog,
    ruleDialogStep,
    setRuleDialogStep,
    ruleDialogError,
    setRuleDialogError,
    ruleTriggerId,
    setRuleTriggerId,
    ruleActionSelection,
    setRuleActionSelection,
    handleRuleClose,
    handleSaveRule,
    showAbilityDialog,
    abilityNameInput,
    setAbilityNameInput,
    handleCloseAbilityDialog,
    handleCreateAbility,
    ...actorDialogCtx,
    ...itemDialogCtx,
    ...objectDialogCtx,
    showDeleteNpcConfirm,
    setShowDeleteNpcConfirm,
    showDeleteEnemyConfirm,
    setShowDeleteEnemyConfirm,
    showDialogueTreeDialog,
    dialogueTrees,
    setDialogueTrees,
    activeDialogueTab,
    setActiveDialogueTab,
    dialogueTabToDelete,
    setDialogueTabToDelete,
    onDialogueClose: handleDialogueClose,
    showCreateMapDialog,
    setShowCreateMapDialog,
    newMapName,
    setNewMapName,
    newMapWidth,
    setNewMapWidth,
    newMapHeight,
    setNewMapHeight,
    newMapStarting,
    setNewMapStarting,
    createMapError,
    setCreateMapError,
    isPreparingNewMap,
    handleConfirmCreateMap,
    showHeroEditDialog,
    setShowHeroEditDialog,
    heroEditData,
    setHeroEditData,
    handleHeroEditCancel,
    handleHeroEditConfirm,
    showOverwriteDialog,
    handleOverwriteConfirm,
    handleOverwriteCancel,
    showExportSuccess,
    closeExportSuccess: () => setShowExportSuccess(false),
    availableRuleTriggers
  });

  // appCtx will be built inside SidebarProvider's render function so it can use assembledSidebar

  

  return (
    <ToolbarProvider value={{ ...toolbarState, stampsState }}>
      <SidebarProvider deps={{
        isNpcLayer,
        isEnemyLayer,
        actorEntries,
        draggingNpcId,
        handleEditObject,
        setNpcHoverTooltip,
        handleNpcDragStart,
        handleNpcDragEnd,
        handleOpenActorDialog,
        isRulesLayer,
        rulesList,
        handleAddRule,
        isItemsLayer,
        itemsList,
        expandedItemCategories,
        setExpandedItemCategories,
        handleOpenItemEdit,
        handleOpenItemDialog,
        editor,
        activeLayer,
        tabTick,
        setTabTick,
        brushTool,
        isCollisionLayer,
        handleFileUpload,
        handleToggleBrushTool,
        handleDeleteActiveTab,
        toast,
        handleOpenActorDialogForTileset: handleOpenActorDialog,
        stampsState,
        layers,
        activeLayerId,
        hoveredLayerId,
        layersPanelExpanded,
        setLayersPanelExpanded,
        setHoveredLayerId,
        handleSetActiveLayer,
        handleToggleLayerVisibility,
        handleLayerTransparencyChange,
        showTooltipWithDelay: showTooltipWithDelayFn,
        hideTooltip: hideTooltipFn,
        uiHelpers,
        leftCollapsed,
        isExporting,
        exportProgress,
        mapsButtonRef,
        mapsDropdownOpen,
        mapsDropdownPos,
        mapsPortalRef,
        mapsSubOpen,
        currentProjectPath,
        projectMaps,
        setMapsSubOpen,
        setMapsDropdownOpen,
        handleOpenCreateMapDialog,
        handleOpenMapFromMapsFolder,
        handleManualSave,
        isManuallySaving,
        isPreparingNewMap,
        hasUnsavedChanges,
        setShowSettings,
        refreshProjectMaps,
      }}>
        {(assembledSidebar) => {
          const { actors, rules, items, layersObj } = assembledSidebar.actors;
          const { tileset } = assembledSidebar.tileset;
          const { exportStatus, controls } = assembledSidebar.maps;

          const appCtxBuilt = buildAppMainCtx({
            showWelcome,
            handleCreateNewMap,
            handleOpenMap,
            isDarkMode,
            titleBarProps,
            showSidebarToggle,
            leftCollapsed,
            handleSidebarToggle,
            actors,
            rules,
            items,
            tileset,
            layersObj,
            exportStatus,
            controls,
            showSettings,
            handleCloseSettings,
            setIsDarkMode,
            editor,
            autoSaveEnabled,
            setAutoSaveEnabledState,
            showActiveGid,
            setShowActiveGid,
            setShowSidebarToggle,
            showMapSettingsOnly,
            handleCloseMapSettings,
            mapName,
            setMapName,
            mapWidth,
            setMapWidth,
            mapHeight,
            setMapHeight,
            isStartingMap,
            updateStartingMap,
            handleMapResize,
            showClearLayerDialog,
            handleClearLayerClose,
            handleClearLayerConfirm,
            confirmDialogProps,
            showHelp,
            activeHelpTab,
            setActiveHelpTab,
            handleHelpClose,
            topBarProps,
            canvasCtx,
            bottomToolbarProps,
            enemyPanelProps,
            dialogsCtx,
            tooltip
          });

          return (
            <AppProvider value={appCtxBuilt}>
              <AppMain />
            </AppProvider>
          );
        }}
      </SidebarProvider>
    </ToolbarProvider>
  );
}

export default App;
