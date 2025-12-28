import React, { useRef, useEffect, useState, useMemo } from 'react';
import { TileMapEditor } from './editor/TileMapEditor';
import type { EditorProjectData } from './editor/TileMapEditor';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import WelcomeScreen from './components/WelcomeScreen';
// UI helpers like Button/Badge/Tooltip are imported in the components that use them.
import ClearLayerDialog from '@/components/ClearLayerDialog';
import EngineSettingsDialog from '@/components/EngineSettingsDialog';
import HelpDialog from '@/components/HelpDialog';
import MapSettingsDialog from '@/components/MapSettingsDialog';
import EditorArea from '@/components/EditorArea';
import AppShell from '@/components/AppShell';
import useTitleBarProps from './hooks/useTitleBarProps';
import ConfirmActionDialog from '@/components/ConfirmActionDialog';
import AppSidebar from '@/components/AppSidebar';
import DialogsContainer from '@/components/DialogsContainer';
import buildConfirmDialogProps from './hooks/buildConfirmDialogProps';
import buildDialogsCtx from './hooks/useDialogsCtx';
import useMapsDropdown from './hooks/useMapsDropdown';
// Sidebar child components are now rendered inside AppSidebar
import { TileLayer, MapObject } from './types';
import type { ItemRole } from './editor/itemRoles';
import { GAME_TRIGGER_OPTIONS, PLAYER_TRIGGER_OPTIONS } from './editor/ruleOptions';
import type { RuleStartType } from './editor/ruleOptions';
import useHelpState from './hooks/useHelpState';
import useMapConfig from './hooks/useMapConfig';
import useObjectEditing from './hooks/useObjectEditing';
import useProjectSession from './hooks/useProjectSession';
import useProjectIO from './hooks/useProjectIO';
import useDialogs from './hooks/useDialogs';
import { buildConstantStockString } from './utils/parsers';
import useToolbarState from './hooks/useToolbarState';
import useAutosave from './hooks/useAutosave';
import useToolbarHandlers from './hooks/useToolbarHandlers';
import useToolbarVisibility from './hooks/useToolbarVisibility';
import useTooltip from './hooks/useTooltip';
import useVendorState from './hooks/useVendorState';
import useEditorTabs from './hooks/useEditorTabs';
import useEditorState from './hooks/useEditorState';
import usePreferences from './hooks/usePreferences';
import useEditorIpc from './hooks/useEditorIpc';
import useHoverAndSelection from './hooks/useHoverAndSelection';
import useUndoRedoZoom from './hooks/useUndoRedoZoom';
import useCreateMap from './hooks/useCreateMap';
import useBeforeCreateMap from './hooks/useBeforeCreateMap';
import useGetters from './hooks/useGetters';
import useProjectLoader from './hooks/useProjectLoader';
import useActorManagement from './hooks/useActorManagement';
import useNpcDrag from './hooks/useNpcDrag';
import useLayerHandlers from './hooks/useLayerHandlers';
import useConfirmations from './hooks/useConfirmations';
import useObjectDialogHandlers from './hooks/useObjectDialogHandlers';
import useAbilityDialog from './hooks/useAbilityDialog';
import useCanvasDoubleClick from './hooks/useCanvasDoubleClick';
import useBottomToolbarProps from './hooks/useBottomToolbarProps';
import useBrushActions from './hooks/useBrushActions';
import useEditorCanvasCtx from './hooks/useEditorCanvasCtx';
import useSidebarProps from './hooks/useSidebarProps';
import useWindowControls from './hooks/useWindowControls';
import useSidebarToggle from './hooks/useSidebarToggle';
import useClearLayerHandler from './hooks/useClearLayerHandler';
import useDialogCloseHandlers from './hooks/useDialogCloseHandlers';
import useEnemyTabHandlers from './hooks/useEnemyTabHandlers';
import useDarkModeSync from './hooks/useDarkModeSync';
import useBrushToolDomSync from './hooks/useBrushToolDomSync';
import useEditorOptionsRef from './hooks/useEditorOptionsRef';
import useActiveGidCallback from './hooks/useActiveGidCallback';
import useBeforeUnload from './hooks/useBeforeUnload';
import flareIconUrl from '/flare-ico.png?url';
// removed unused imports moved into hooks

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
import useBrushToolbar from './hooks/useBrushToolbar';

function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const editorOptsRef = useRef<Record<string, unknown> | null>(null);
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
  } = useEditorState(editorOptsRef);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const handleManualSaveRef = useRef<(() => Promise<void>) | undefined>(undefined);
  // Editor tabs
  const [pendingEnemyTabCloseId, setPendingEnemyTabCloseId] = useState<string | null>(null);
  const switchToTabHelpersRef = useRef({
    handleOpenMap: async (_projectDir: string, _createTab?: boolean, _mapName?: string) => {},
    loadProjectData: async (_editor: TileMapEditor, _mapConfig: EditorProjectData) => false,
    setupAutoSave: (_editor: TileMapEditor) => {},
    syncMapObjects: () => {},
    updateLayersList: () => {},
  });

  // Session is now stored per-project in .flare-session.json
  // Load session when a project is opened (handled in handleOpenMap)
  // Save session effect is defined after currentProjectPath state (see below)

  // Keep a stable reference to editor active GID even if the value isn't rendered
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activeGid, setActiveGid] = useState<string>('(none)');
  
  // Show/hide Active GID indicator (user preference)
  const [showActiveGid, setShowActiveGid] = useState<boolean>(true);
  // Left sidebar collapsed (icon-strip) state
  // Start expanded by default; users can toggle during the session
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(false);
  // transient flag during sidebar open/close animation to reduce canvas flicker
  const [leftTransitioning, setLeftTransitioning] = useState<boolean>(false);
  const [layers, setLayers] = useState<TileLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<number | null>(null);
  const [showAddLayerDropdown, setShowAddLayerDropdown] = useState(false);
  // Layers panel expand/collapse state
  const [layersPanelExpanded, setLayersPanelExpanded] = useState(false);
  // Individual layer hover state
  const [hoveredLayerId, setHoveredLayerId] = useState<number | null>(null);
  const [tipsMinimized, setTipsMinimized] = useState(false);
  // Force refresh counter to trigger re-render when editor-managed tabs change
  const [tabTick, setTabTick] = useState(0);
  const toolbarState = useToolbarState();
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
    setSelectedTool,
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
    setShowStampDialog,
    newStampName,
    setNewStampName,
    brushTool,
    setBrushTool,
    showSeparateDialog,
    setShowSeparateDialog,
    brushToSeparate,
    setBrushToSeparate
  } = toolbarState;

  // local brush toolbar helpers (fallback hook) used by handlers and other hooks
  const { showBrushToolbarTemporarily: showBrushToolbarTemporarilyFallback } = useBrushToolbar();

  const [pendingMapConfig, setPendingMapConfig] = useState<EditorProjectData | null>(null);
  const canUseTilesetDialog = !!editor;
  const {
    handleSelectTool,
    handleToggleBrushTool,
    handleCreateStamp,
    handleStampSelect,
    handleDeleteStamp,
    handleSeparateBrush,
    confirmSeparateBrush
  } = useToolbarHandlers({
    editor,
    setSelectedTool,
    showBottomToolbarTemporarily,
    setBrushTool,
    showBrushToolbarTemporarily: showBrushToolbarTemporarilyFallback,
    newStampName,
    setNewStampName,
    setShowStampDialog,
    setStampMode,
    selectedStamp,
    setSelectedStamp,
    setBrushToSeparate,
    setShowSeparateDialog,
    brushToSeparate
  });

  const stampsState = {
    stamps,
    setStamps,
    selectedStamp,
    setSelectedStamp,
    stampMode,
    setStampMode,
    setShowStampDialog,
    newStampName,
    setNewStampName,
    handleCreateStamp,
    handleStampSelect,
    handleDeleteStamp,
    handleSeparateBrush,
    confirmSeparateBrush
  };
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

  // When true, we're in the middle of opening an existing project
  // and should avoid creating a blank editor instance.
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  
  const { tooltip, showTooltipWithDelay: showTooltipWithDelayFn, hideTooltip: hideTooltipFn } = useTooltip({ toolbarRef, canvasRef });

  const uiHelpers = {
    tooltip,
    showTooltipWithDelay: showTooltipWithDelayFn,
    hideTooltip: hideTooltipFn,
    toolbarRef,
    canvasRef
  };

  // NPC drag-drop state
  const [draggingNpcId, setDraggingNpcId] = useState<number | null>(null);

  // NPC hover tooltip state (follows cursor)
  const [npcHoverTooltip, setNpcHoverTooltip] = useState<{ x: number; y: number } | null>(null);

  // NPC delete confirmation popup state
  const [npcDeletePopup, setNpcDeletePopup] = useState<{
    npcId: number;
    screenX: number;
    screenY: number;
  } | null>(null);

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

  const createTabForRef = useRef<((name: string, projectPath: string | null, config: EditorProjectData) => void) | null>(null);
  const beforeCreateMapRef = useRef<(() => Promise<void>) | null>(null);
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

  useEffect(() => {
    createTabForRef.current = createTabFor;
  }, [createTabFor]);
  // before-create-map behavior extracted to a hook
  const { handleBeforeCreateMap } = useBeforeCreateMap({ editor, activeTabId, setTabs, currentProjectPath });

  useEffect(() => {
    beforeCreateMapRef.current = handleBeforeCreateMap;
  }, [handleBeforeCreateMap]);

  useProjectSession({ tabs, activeTabId, currentProjectPath });

  useEffect(() => {
    if (tabs.length > 0 && !activeTabId) {
      if (currentProjectPath) {
        const normalizedProjectPath = currentProjectPath.replace(/\\/g, '/').toLowerCase();
        const projectTabs = tabs.filter(t => {
          const normalizedTabPath = t.projectPath?.replace(/\\/g, '/').toLowerCase() || '';
          return normalizedTabPath === normalizedProjectPath;
        });
        if (projectTabs.length > 0) {
          console.log('Auto-selecting first project tab:', projectTabs[0].name);
          setActiveTabId(projectTabs[0].id);
        }
      } else if (tabs.length > 0) {
        console.log('Auto-selecting first available tab:', tabs[0].name);
        setActiveTabId(tabs[0].id);
      }
    }
  }, [activeTabId, currentProjectPath, setActiveTabId, tabs]);
  
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
    toast
    ,
    handleManualSave: async () => { if (handleManualSaveRef.current) await handleManualSaveRef.current(); },
    updateLayersList: updateLayersListWrapper,
    syncMapObjects: syncMapObjectsWrapper,
    setMapInitialized,
    setMapName
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

  // Sync tool selection with editor
  useEffect(() => {
    if (editor && selectedTool === 'brush') {
      // Map selectedBrushTool to editor tool types
      const toolMap: {[key: string]: 'brush' | 'eraser' | 'bucket'} = {
        'brush': 'brush',
        'bucket': 'bucket',
        'eraser': 'eraser'
      };
      const editorTool = toolMap[selectedBrushTool] || 'brush';
      editor.setCurrentTool(editorTool);
    } else if (editor && selectedTool === 'selection') {
      // Set the editor to selection mode and update selection tool
      const selectionToolMap: {[key: string]: 'rectangular' | 'magic-wand' | 'same-tile' | 'circular'} = {
        'rectangular': 'rectangular',
        'magic-wand': 'magic-wand',
        'same-tile': 'same-tile',
        'circular': 'circular'
      };
      const editorSelectionTool = selectionToolMap[selectedSelectionTool] || 'rectangular';
      editor.setCurrentSelectionTool(editorSelectionTool);
    } else if (editor && selectedTool === 'shape') {
      // Set the editor to shape mode and update shape tool
      const shapeToolMap: {[key: string]: 'rectangle' | 'circle' | 'line'} = {
        'rectangle': 'rectangle',
        'circle': 'circle',
        'line': 'line'
      };
      const editorShapeTool = shapeToolMap[selectedShapeTool] || 'rectangle';
      editor.setCurrentShapeTool(editorShapeTool);
    } else if (editor && selectedTool === 'eyedropper') {
      // Set the editor to eyedropper mode
      editor.setEyedropperTool();
    } else if (editor && selectedTool === 'stamp') {
      // Set the editor to stamp mode
      editor.setStampTool();
    }
  }, [editor, selectedTool, selectedBrushTool, selectedSelectionTool, selectedShapeTool]);

  // Stamp mode synchronization
  useEffect(() => {
    if (!editor || selectedTool !== 'stamp') return;
    editor.setCurrentStampMode(stampMode);
  }, [editor, selectedTool, stampMode]);

  // Stamp selection synchronization
  useEffect(() => {
    if (!editor || selectedTool !== 'stamp') return;
    editor.setActiveStamp(selectedStamp);
  }, [editor, selectedTool, selectedStamp]);

  // Track selection state
  useEffect(() => {
    if (!editor) return;

    const updateSelection = () => {
      const selection = editor.getSelection();
      const hasActiveSelection = editor.hasActiveSelection();
      setSelectionCount(selection.length);
      setHasSelection(hasActiveSelection);
    };

    // Poll selection state (could be optimized with callbacks)
    const intervalId = setInterval(updateSelection, 100);

    return () => clearInterval(intervalId);
  }, [editor, setSelectionCount, setHasSelection]);

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
  }, [showAddLayerDropdown]);

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

  // Keep a ref to handleOpenMap so IPC listeners can call the latest implementation
  useEffect(() => { handleOpenMapRef.current = handleOpenMap; }, [handleOpenMap]);

  useEffect(() => {
    switchToTabHelpersRef.current = {
      handleOpenMap,
      loadProjectData,
      setupAutoSave: setupAutoSaveWrapper,
      syncMapObjects,
      updateLayersList,
    };
  }, [handleOpenMap, loadProjectData, setupAutoSaveWrapper, syncMapObjects, updateLayersList]);
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

  const { handleEnemyTabCloseDecision, handleEnemyTabSave } = useEnemyTabHandlers({
    closeEditorTab,
    setPendingEnemyTabCloseId,
    handleUpdateObject,
    setTabs,
    activeTabId
  });

  

  

  // Assemble EditorCanvas props via a hook to keep the JSX area concise.
  const { ctx: editorCanvasCtx } = useEditorCanvasCtx({
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
    handleDeleteStamp
  });

  const bottomToolbarProps = useBottomToolbarProps({
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
    showTooltipWithDelay: showTooltipWithDelayFn,
    hideTooltip: hideTooltipFn,
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
    stampsState
  });

  const { actors, rules, items, tileset, layersObj, exportStatus, controls } = useSidebarProps({
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
    refreshProjectMaps
  });

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

  const dialogsCtx = buildDialogsCtx({
    showSeparateDialog,
    setShowSeparateDialog,
    confirmSeparateBrush,
    vendorState: {
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
      vendorStockSelection
    },
    vendorHandlers: {
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
    },
    showRuleDialog,
    ruleDialogStep,
    ruleDialogError,
    ruleNameInput,
    setRuleNameInput,
    ruleStartType,
    setRuleStartType,
    ruleTriggerId,
    setRuleTriggerId,
    ruleActionSelection,
    setRuleActionSelection,
    availableRuleTriggers,
    onRuleClose: handleRuleClose,
    handleSaveRule,
    showAbilityDialog,
    abilityNameInput,
    setAbilityNameInput,
    handleCloseAbilityDialog,
    handleCreateAbility,
    actorDialogState,
    actorDialogError,
    canUseTilesetDialog,
    handleCloseActorDialog,
    handleActorFieldChange,
    handleActorRoleToggle,
    handleActorTilesetBrowse,
    handleActorPortraitBrowse,
    handleActorSubmit,
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
    handleSaveItemEdit,
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
    setShowDialogueTreeDialog,
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
    closeExportSuccess: () => setShowExportSuccess(false)
  });

  return (
    <>
      {showWelcome ? (
        <WelcomeScreen 
          onCreateNewMap={handleCreateNewMap}
          onOpenMap={handleOpenMap}
          isDarkMode={isDarkMode}
        />
      ) : (
        <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      <AppShell
        titleBarProps={titleBarProps}
        sidebarToggleProps={{
          show: showSidebarToggle,
          leftCollapsed,
          onToggle: handleSidebarToggle
        }}
      />

      <main className="flex flex-1 min-h-0">
        <AppSidebar
          leftCollapsed={leftCollapsed}
          actors={actors}
          rules={rules}
          items={items}
          tileset={tileset}
          layers={layersObj}
          exportStatus={exportStatus}
          controls={controls}
        />

        <EngineSettingsDialog
          open={showSettings}
          onClose={handleCloseSettings}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          editor={editor}
          autoSaveEnabled={autoSaveEnabled}
          setAutoSaveEnabledState={setAutoSaveEnabledState}
          showActiveGid={showActiveGid}
          setShowActiveGid={setShowActiveGid}
          showSidebarToggle={showSidebarToggle}
          setShowSidebarToggle={setShowSidebarToggle}
        />

        <MapSettingsDialog
          open={showMapSettingsOnly}
          onClose={handleCloseMapSettings}
          mapName={mapName}
          setMapName={setMapName}
          mapWidth={mapWidth}
          setMapWidth={setMapWidth}
          mapHeight={mapHeight}
          setMapHeight={setMapHeight}
          isStartingMap={isStartingMap}
          updateStartingMap={updateStartingMap}
          handleMapResize={handleMapResize}
        />
        <ClearLayerDialog
          open={showClearLayerDialog}
          onClose={handleClearLayerClose}
          onConfirm={handleClearLayerConfirm}
        />

        <ConfirmActionDialog {...confirmDialogProps} />

        <HelpDialog
          open={showHelp}
          activeTab={activeHelpTab}
          setActiveTab={setActiveHelpTab}
          onClose={handleHelpClose}
        />

        {/* Center Area */}
        <EditorArea
          topBarProps={{
            toolbarExpanded,
            containerRef: toolbarContainerRef,
            onMouseEnter: handleToolbarMouseEnter,
            onMouseLeave: handleToolbarMouseLeave,
            onFocus: handleToolbarFocus,
            onBlur: handleToolbarBlur,
            handleUndo,
            handleRedo,
            handleZoomIn,
            handleZoomOut,
            handleResetZoom
          }}
          canvasCtx={editorCanvasCtx}
          bottomToolbarProps={bottomToolbarProps}
          enemyPanelProps={{
            isEnemyActive: isEnemyTabActive,
            enemy: (activeTab?.config as EnemyTabConfig | null)?.enemy,
            showCloseConfirm: pendingEnemyTabCloseId === activeTabId,
            onCloseDecision: handleEnemyTabCloseDecision,
            onSave: handleEnemyTabSave
          }}
        />
      </main>
      
      <Toaster />

      {/* Centralized dialogs container */}
      <DialogsContainer ctx={dialogsCtx} />

      {/* Custom Tooltip */}
      {tooltip && (
        <div
          className={`custom-tooltip ${tooltip.visible ? 'visible' : ''} ${tooltip.fadeOut ? 'fade-out' : ''}`}
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          {tooltip.content}
        </div>
      )}
        </div>
      )}
    </>
  );
}

export default App;
