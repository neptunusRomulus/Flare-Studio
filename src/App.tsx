import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { TileMapEditor } from './editor/TileMapEditor';
import type { EditorProjectData } from './editor/TileMapEditor';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import WelcomeScreen from './components/WelcomeScreen';
// UI helpers like Button/Badge/Tooltip are imported in the components that use them.
import EnemyTabPanel from '@/components/EnemyTabPanel';
import ClearLayerDialog from '@/components/ClearLayerDialog';
import EngineSettingsDialog from '@/components/EngineSettingsDialog';
import HelpDialog from '@/components/HelpDialog';
import MapSettingsDialog from '@/components/MapSettingsDialog';
import TopBar from '@/components/TopBar';
import AppShell from '@/components/AppShell';
import ConfirmActionDialog from '@/components/ConfirmActionDialog';
import AppSidebar from '@/components/AppSidebar';
import EditorCanvas from '@/components/EditorCanvas';
import DialogsContainer from '@/components/DialogsContainer';
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
import useProjectLoader from './hooks/useProjectLoader';
import useActorManagement from './hooks/useActorManagement';
import useNpcDrag from './hooks/useNpcDrag';
import useLayerHandlers from './hooks/useLayerHandlers';
import useConfirmations from './hooks/useConfirmations';
import useObjectDialogHandlers from './hooks/useObjectDialogHandlers';
import useAbilityDialog from './hooks/useAbilityDialog';
import useBrushActions from './hooks/useBrushActions';
import useEditorCanvasCtx from './hooks/useEditorCanvasCtx';
import useSidebarProps from './hooks/useSidebarProps';
import flareIconUrl from '/flare-ico.png?url';
// removed unused imports moved into hooks

type EnemyTabConfig = { enemy: MapObject };

import useItems from './hooks/useItems';
import { normalizeItemsForState as normalizeItemsHelper } from './utils/items';
import useVendorDialogs from './hooks/useVendorDialogs';

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
    brushToolbarExpanded,
    setBrushToolbarNode,
    showToolbarTemporarily,
    showBottomToolbarTemporarily,
    showBrushToolbarTemporarily,
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
    showBrushToolbarTemporarily,
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
    tabToDelete,
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
  const getCreateTabFor = useCallback(() => createTabForRef.current, []);
  const getBeforeCreateMap = useCallback(() => beforeCreateMapRef.current, []);
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

  const handleBeforeCreateMap = useCallback(async () => {
    if (!editor || !activeTabId) {
      return;
    }

    try {
      await editor.ensureTilesetsLoaded();
      const snapshot = await editor.getProjectData();
      const safeSnapshot = JSON.parse(JSON.stringify(snapshot));
      setTabs((prev) => prev.map(t => t.id === activeTabId ? { ...t, config: safeSnapshot } : t));
      if (currentProjectPath) {
        await editor.saveProjectData(currentProjectPath);
      }
    } catch (err) {
      console.warn('Failed to snapshot current tab before creating a new map:', err);
    }
  }, [editor, activeTabId, setTabs, currentProjectPath]);

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
  // ability dialog state moved to useAbilityDialog
  const [ruleNameInput, setRuleNameInput] = useState('');
  const [ruleStartType, setRuleStartType] = useState<RuleStartType | null>(null);
  const [ruleTriggerId, setRuleTriggerId] = useState<string>('');
  const [ruleActionSelection, setRuleActionSelection] = useState<{ groupId: string; actionId: string } | null>(null);
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

  const syncMapObjects = useCallback(() => {
    if (editor) {
      setMapObjects(editor.getMapObjects());
    } else {
      setMapObjects([]);
    }
  }, [editor, setMapObjects]);

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

  // Handle dark mode toggle
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Update editor dark mode if it exists
    if (editor) {
      editor.setDarkMode(isDarkMode);
    }
    
    // Save to localStorage
    localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode, editor]);

  // Wire editor activeGid updates into React state
  useEffect(() => {
    if (!editor) return;
    const cb = (gid: number) => {
      setActiveGid(gid > 0 ? gid.toString() : '(none)');
    };
    editor.setActiveGidCallback(cb);
    return () => {
      // remove callback when editor changes/unmounts
      editor.setActiveGidCallback(null);
    };
  }, [editor]);

  

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
  const updateLayersList = useCallback(() => {
    if (editor) {
      const currentLayers = editor.getLayers();
      setLayers([...currentLayers]); // Create a new array to ensure React detects changes
      const activeId = editor.getActiveLayerId();
      setActiveLayerId(activeId);
      syncMapObjects();
    }
  }, [editor, syncMapObjects]);

  useEffect(() => {
    updateLayersListRef.current = updateLayersList;
  }, [updateLayersList, updateLayersListRef]);

  // Populate `editorOptsRef.current` with callbacks/state the hook needs.
  useEffect(() => {
    editorOptsRef.current = {
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
      // helper refs
      updateLayersListRef,
      syncMapObjectsRef
    };
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

  const handleAddRule = useCallback(() => {
    setRuleDialogError(null);
    setRuleStartType(null);
    setRuleTriggerId('');
    setRuleActionSelection(null);
    setRuleNameInput(`Rule ${rulesList.length + 1}`);
    setRuleDialogStep('start');
    openRuleDialog();
  }, [rulesList.length, openRuleDialog, setRuleDialogStep, setRuleDialogError, setRuleStartType, setRuleTriggerId, setRuleActionSelection, setRuleNameInput]);

  const handleSaveRule = useCallback(() => {
    const trimmedName = ruleNameInput.trim();
    if (!ruleStartType) {
      setRuleDialogError('Select how this rule starts.');
      return;
    }

    const availableOptions = ruleStartType === 'player' ? PLAYER_TRIGGER_OPTIONS : GAME_TRIGGER_OPTIONS;
    if (!trimmedName) {
      setRuleDialogError('Rule name is required.');
      return;
    }
    if (!ruleTriggerId || !availableOptions.some(option => option.id === ruleTriggerId)) {
      setRuleDialogError('Select a start trigger.');
      return;
    }

    setRulesList((prev) => [
      ...prev,
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        name: trimmedName,
        startType: ruleStartType,
        triggerId: ruleTriggerId
      }
    ]);
    closeRuleDialog();
    setRuleDialogError(null);
    setRuleNameInput('');
    setRuleStartType(null);
    setRuleTriggerId('');
    setRuleActionSelection(null);
  }, [ruleNameInput, ruleStartType, ruleTriggerId, closeRuleDialog, setRuleDialogError, setRulesList, setRuleNameInput, setRuleStartType, setRuleTriggerId, setRuleActionSelection]);

  

  // Item edit/create handlers moved to `useItems` hook (see src/hooks/useItems.ts)



  

  const { handleNpcDragStart, handleNpcDragEnd } = useNpcDrag({ editor, setDraggingNpcId });

  const handleObjectDialogClose = useCallback(() => {
    setShowObjectDialog(false);
    setEditingObject(null);
    setObjectValidationErrors([]);
    setShowDeleteNpcConfirm(false);
    setShowDeleteEnemyConfirm(false);
  }, [setEditingObject, setObjectValidationErrors, setShowDeleteEnemyConfirm, setShowDeleteNpcConfirm, setShowObjectDialog]);



  const { handleObjectDialogSave, updateEditingObjectProperty, updateEditingObjectBoolean, getEditingObjectProperty } = useObjectDialogHandlers({
    editingObject,
    setEditingObject,
    setObjectValidationErrors,
    currentProjectPath,
    handleUpdateObject
  });

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

  const handleEditingTilesetBrowse = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electronAPI?.selectTilesetFile) {
      return;
    }

    try {
      const selected = await window.electronAPI.selectTilesetFile();
      if (selected) {
        updateEditingObjectProperty('tilesetPath', selected);
      }
    } catch (error) {
      console.error('Failed to select tileset for editing object:', error);
    }
  }, [updateEditingObjectProperty]);

  const handleEditingPortraitBrowse = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electronAPI?.selectTilesetFile) {
      return;
    }

    try {
      const selected = await window.electronAPI.selectTilesetFile();
      if (selected) {
        // Convert to data URL to avoid file:// protocol security restrictions
        if (window.electronAPI.readFileAsDataURL) {
          const dataUrl = await window.electronAPI.readFileAsDataURL(selected);
          if (dataUrl) {
            updateEditingObjectProperty('portraitPath', dataUrl);
          } else {
            updateEditingObjectProperty('portraitPath', selected);
          }
        } else {
          updateEditingObjectProperty('portraitPath', selected);
        }
      }
    } catch (error) {
      console.error('Failed to select portrait for editing object:', error);
    }
  }, [updateEditingObjectProperty]);

  // Hero edit handlers moved to useDialogs

  // Canvas double-click handler for editing objects
  useEffect(() => {
    if (!editor || !canvasRef.current) return;

    const handleCanvasDoubleClick = (_event: MouseEvent) => {
      console.log('Double-click detected on canvas');
      
      // Get current active layer to check if it's an interactive layer
      const activeLayer = editor.getActiveLayer();
      console.log('Active layer:', activeLayer);
      
      if (!activeLayer) {
        console.log('No active layer found');
        return;
      }
      
      // Only allow double-click editing on interactive layers
      const interactiveLayers = ['enemy', 'npc', 'object', 'event', 'background'];
      if (!interactiveLayers.includes(activeLayer.type)) {
        console.log(`Layer type '${activeLayer.type}' is not interactive, skipping double-click`);
        return;
      }
      
      // Get hover coordinates from editor
      const hoverCoords = editor.getHoverCoordinates();
      console.log('Hover coordinates:', hoverCoords);
      
      if (hoverCoords) {
        // Check if there's an object at this position
        const objects = editor.getMapObjects();
        const objectsAtPosition = editor.getObjectsAtPosition(hoverCoords.x, hoverCoords.y);
        console.log('All objects:', objects.length);
        console.log('Objects at hover position:', objectsAtPosition);
        
        const objectAtPosition = objects.find(obj => 
          obj.x === hoverCoords.x && obj.y === hoverCoords.y
        );
        
        console.log('Object at position (find method):', objectAtPosition);
        
        if (objectAtPosition) {
          console.log(`Opening edit dialog for object ID: ${objectAtPosition.id}`);
          handleEditObject(objectAtPosition.id);
        } else {
          console.log('No object found at hover position');
        }
      }
    };

    const canvas = canvasRef.current;
    canvas.addEventListener('dblclick', handleCanvasDoubleClick);

    return () => {
      canvas.removeEventListener('dblclick', handleCanvasDoubleClick);
    };
  }, [editor, handleEditObject, canvasRef]);

  // Effect to handle brush tool state changes
  useEffect(() => {
    console.log(`Brush tool changed to: ${brushTool}`);
    const brushToolElement = document.querySelector('[data-brush-tool]');
    if (brushToolElement) {
      brushToolElement.setAttribute('data-brush-tool', brushTool);
      console.log(`Updated existing data-brush-tool attribute to: ${brushTool}`);
    } else {
      // Create the brush tool state element if it doesn't exist
      const stateElement = document.createElement('div');
      stateElement.setAttribute('data-brush-tool', brushTool);
      stateElement.style.display = 'none';
      document.body.appendChild(stateElement);
      console.log(`Created new data-brush-tool element with value: ${brushTool}`);
    }
  }, [brushTool]);

  // Effect to listen for brush events from the editor
  useEffect(() => {
    const handleBrushAction = (event: CustomEvent) => {
      const { action, tileIndex } = event.detail;
      switch (action) {
        // Removed select/deselect cases as selectedBrushes state is gone
        case 'separate':
          handleSeparateBrush(tileIndex);
          break;
        case 'remove':
          handleRemoveBrush(tileIndex);
          break;
        case 'drop':
          if (event.detail.from && event.detail.to) {
            handleBrushReorder(event.detail.from, event.detail.to);
          }
          break;
        default:
          break;
      }
    };

    document.addEventListener('brushAction', handleBrushAction as EventListener);
    
    return () => {
      document.removeEventListener('brushAction', handleBrushAction as EventListener);
    };
  }, [handleSeparateBrush, handleRemoveBrush, handleBrushReorder]);

  // Helper function to load project data into editor
  const loadProjectData = useCallback(async (newEditor: TileMapEditor, mapConfig: EditorProjectData) => {
    try {
      // Set projectName from loaded project data if available
      if (mapConfig.name) {
        newEditor.projectName = mapConfig.name;
      }
      console.log('=== LOAD PROJECT DATA DEBUG ===');
      console.log('Map config received:', {
        name: mapConfig.name,
        tilesets: mapConfig.tilesets ? mapConfig.tilesets.length : 0,
        tilesetImages: mapConfig.tilesetImages ? Object.keys(mapConfig.tilesetImages).length : 0,
        layers: mapConfig.layers ? mapConfig.layers.length : 0
      });

      // Debug the map config structure in detail
      console.log('Map config full structure:', mapConfig);
      
      // Debug layer data
      const layers = mapConfig.layers || [];
      console.log('Layers from config:', layers.map(l => ({
        type: l.type,
        name: l.name,
        dataLength: l.data?.length || 0,
        hasNonZeroData: l.data?.some((d) => d !== 0) || false
      })));

      // Load the complete project data into the editor
      // The editor's loadProjectData handles everything: it sets this.tileLayers directly
      // from projectData.layers, so we don't need to manually create layers with addLayer()
      console.log('=== CALLING EDITOR loadProjectData ===');
      newEditor.loadProjectData(mapConfig);
      
      console.log('Project data loading completed');
      return true;
    } catch (error) {
      console.error('Error loading project data:', error);
      return false;
    }
  }, []);

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

  

  const handleManualSave = useCallback(async () => {
    if (!editor) return;
    setIsManuallySaving(true);
    try {
      if (window.electronAPI && currentProjectPath) {
        const success = await editor.saveProjectData(currentProjectPath);
        await new Promise(resolve => setTimeout(resolve, 300));
        if (success) {
          setLastSaveTime(Date.now());
          // toast suppressed: Project saved to disk
        } else {
          // toast suppressed: Failed to save the project to disk
        }
      } else {
  editor.forceSave();
  await new Promise(resolve => setTimeout(resolve, 500));
  // toast suppressed: Saved to local backup
      }
    } catch (error) {
      console.error('Save error:', error);
      // toast suppressed: Failed to save your map
    } finally {
      setIsManuallySaving(false);
    }
  }, [editor, currentProjectPath, setIsManuallySaving, setLastSaveTime]);

  // Keep stable refs to the handlers so we can register IPC listeners once
  // and still call the latest handler implementations without re-registering.
  const handleOpenMapRef = useRef<typeof handleOpenMap | null>(null);
  const handleUndoRef = useRef<(() => void) | undefined>(undefined);
  const handleRedoRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => { handleManualSaveRef.current = handleManualSave; }, [handleManualSave]);
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

  // Handle browser beforeunload event (for web version)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = ''; // Required for Chrome
        return ''; // Required for some browsers
      }
      return undefined;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const handleMinimize = () => {
    if (window.electronAPI?.minimize) {
      window.electronAPI.minimize();
    } else {
      console.log('Minimize clicked - Electron API not available');
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI?.maximize) {
      window.electronAPI.maximize();
    } else {
      console.log('Maximize clicked - Electron API not available');
    }
  };

  const handleClose = () => {
    if (window.electronAPI?.close) {
      window.electronAPI.close();
    } else {
      console.log('Close clicked - Electron API not available');
    }
  };

  

  const activeLayer = useMemo(() => {
    return layers.find((layer) => layer.id === activeLayerId) ?? null;
  }, [layers, activeLayerId]);

  const handleDeleteActiveTab = useCallback(() => {
    if (!editor) {
      toast({ title: 'No editor', description: 'Editor is not initialized yet.', variant: 'destructive' });
      return;
    }
    const layerType = activeLayer?.type;
    if (!layerType) {
      toast({ title: 'No active layer', description: 'Please select a layer first.', variant: 'destructive' });
      return;
    }
    const activeTabId = editor.getActiveLayerTabId ? editor.getActiveLayerTabId(layerType) : null;
    if (typeof activeTabId !== 'number' || activeTabId === null) {
      toast({ title: 'No tab selected', description: 'There is no active tileset tab to delete for this layer.', variant: 'destructive' });
      return;
    }
    const payload = { layerType, tabId: activeTabId };
    confirmPayloadRef.current = payload;
    setTabToDelete(payload);
    setConfirmAction({ type: 'removeTab', payload });
  }, [activeLayer?.type, editor, setConfirmAction, setTabToDelete, toast, confirmPayloadRef]);

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

  // Assemble EditorCanvas props via a hook to keep the JSX area concise.
  const { ctx: editorCanvasCtx, bottomToolbarProps } = useEditorCanvasCtx({
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
    brushToolbarExpanded,
    showBrushToolbarTemporarily,
    setBrushToolbarNode,
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
        titleBarProps={{
          tabs,
          activeTabId,
          onSwitchTab: (tabId: string) => { void switchToTab(tabId); },
          onOpenMapSettings: () => setShowMapSettingsOnly(true),
          onCloseEnemyTab: (tabId: string) => setPendingEnemyTabCloseId(tabId),
          onCreateNewMap: () => setShowCreateMapDialog(true),
          saveStatus,
          lastSaveTime,
          onMinimize: handleMinimize,
          onMaximize: handleMaximize,
          onClose: handleClose,
          flareIconUrl
        }}
        sidebarToggleProps={{
          show: showSidebarToggle,
          leftCollapsed,
          onToggle: () => {
            setLeftTransitioning(true);
            if (editor && typeof editor.setSidebarTransitioning === 'function') {
              try { editor.setSidebarTransitioning(true); } catch { /* ignore */ }
            }
            setLeftCollapsed((s) => !s);
            window.setTimeout(() => {
              setLeftTransitioning(false);
              if (editor && typeof editor.setSidebarTransitioning === 'function') {
                try { editor.setSidebarTransitioning(false); } catch { /* ignore */ }
              }
            }, 380);
          }
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
          onClose={() => setShowSettings(false)}
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
          onClose={() => setShowMapSettingsOnly(false)}
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
          onClose={() => setShowClearLayerDialog(false)}
          onConfirm={() => {
            if (editor) {
              editor.clearLayer();
            }
            setSelectedBrushTool('brush');
            setShowClearLayerDialog(false);
          }}
        />

        <ConfirmActionDialog
          action={confirmAction}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            try {
              if (!confirmAction) return;
              if (confirmAction.type === 'removeBrush') {
                const brushId = confirmAction.payload as number;
                if (editor) editor.removeBrush(brushId);
              } else if (confirmAction.type === 'removeTileset') {
                if (editor) editor.removeLayerTileset();
              } else if (confirmAction.type === 'removeTab') {
                const payload = tabToDelete ?? confirmPayloadRef.current ?? (confirmAction.payload as { layerType: string; tabId: number } | undefined);
                if (editor && payload && payload.layerType) {
                  const liveActive = editor.getActiveLayerTabId ? editor.getActiveLayerTabId(payload.layerType) : null;
                  const finalTabId = (typeof liveActive === 'number' && liveActive !== null) ? liveActive : payload.tabId;
                  if (typeof finalTabId === 'number') {
                    editor.removeLayerTab(payload.layerType, finalTabId);
                    setTabTick(t => t + 1);
                    try { editor.refreshTilePalette(true); } catch (err) { console.warn('refreshTilePalette failed', err); }
                    try {
                      const newActive = editor.getActiveLayerTabId ? editor.getActiveLayerTabId(payload.layerType) : null;
                      if (typeof newActive === 'number') {
                        editor.setActiveLayerTab(payload.layerType, newActive);
                        setTabTick(t => t + 1);
                        try { editor.refreshTilePalette(true); } catch (err) { console.warn('refreshTilePalette failed', err); }
                      }
                    } catch (e) {
                      console.warn('Post-remove setActiveLayerTab safeguard failed', e);
                    }
                  } else {
                    console.warn('Confirm removeTab: no finalTabId available, aborting', payload);
                  }
                }
                setTabToDelete(null);
                confirmPayloadRef.current = null;
              }
            } catch (error) {
              console.error('Confirm action failed:', error);
            } finally {
              setConfirmAction(null);
            }
          }}
        />

        <HelpDialog
          open={showHelp}
          activeTab={activeHelpTab}
          setActiveTab={setActiveHelpTab}
          onClose={() => setShowHelp(false)}
        />

        {/* Center Area */}
        {isEnemyTabActive ? (
          <section className="flex-1 min-w-0 flex flex-col relative">
            <div className="p-6 h-full overflow-auto">
              <EnemyTabPanel
                enemy={(activeTab?.config as EnemyTabConfig | null)?.enemy}
                showCloseConfirm={pendingEnemyTabCloseId === activeTabId}
                onCloseDecision={(decision) => {
                  if (decision === 'cancel') {
                    setPendingEnemyTabCloseId(null);
                    return;
                  }
                  setPendingEnemyTabCloseId(null);
                  closeEditorTab(activeTabId ?? '');
                }}
                onSave={(updated: MapObject) => {
                  // Persist into the map/editor and also update the tab's cached config
                  handleUpdateObject(updated);
                  setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, config: { ...t.config, enemy: updated } } : t));
                }}
              />
            </div>
          </section>
        ) : (
          <section className="flex-1 min-w-0 flex flex-col relative">
          {/* Zoom Controls & Undo/Redo */}
        {!isEnemyTabActive && (
          <TopBar
            toolbarExpanded={toolbarExpanded}
            containerRef={toolbarContainerRef}
            onMouseEnter={handleToolbarMouseEnter}
            onMouseLeave={handleToolbarMouseLeave}
            onFocus={handleToolbarFocus}
            onBlur={handleToolbarBlur}
            handleUndo={handleUndo}
            handleRedo={handleRedo}
            handleZoomIn={handleZoomIn}
            handleZoomOut={handleZoomOut}
            handleResetZoom={handleResetZoom}
          />
        )}
          {/* EditorCanvas assembled via `useEditorCanvasCtx` above */}
          <EditorCanvas ctx={editorCanvasCtx} bottomToolbarProps={bottomToolbarProps} />
        </section>
        )}
      </main>
      
      <Toaster />

      {/* Centralized dialogs container */}
      <DialogsContainer
        ctx={{
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
          onRuleClose: () => {
            closeRuleDialog();
            setRuleDialogError(null);
            setRuleDialogStep('start');
            setRuleStartType(null);
            setRuleTriggerId('');
            setRuleActionSelection(null);
          },
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
          onDialogueClose: () => { setShowDialogueTreeDialog(false); setDialogueTabToDelete(null); },
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
        }}
      />

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
