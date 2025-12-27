import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { TileMapEditor } from './editor/TileMapEditor';
import type { EditorProjectData } from './editor/TileMapEditor';
import { TileLayer, MapObject, FlareNPC } from './types';
import { serializeNpcToFlare } from './utils/flareNpcUtils';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import WelcomeScreen from './components/WelcomeScreen';
// UI helpers like Button/Badge/Tooltip are imported in the components that use them.
import OverwriteExportDialog from './components/OverwriteExportDialog';
import EnemyTabPanel from '@/components/EnemyTabPanel';
import AbilityDialog from '@/components/AbilityDialog';
import ActorDialog from '@/components/ActorDialog';
import ClearLayerDialog from '@/components/ClearLayerDialog';
import EngineSettingsDialog from '@/components/EngineSettingsDialog';
import HelpDialog from '@/components/HelpDialog';
import ItemDialog from '@/components/ItemDialog';
import ItemEditDialog from '@/components/ItemEditDialog';
import MapDialogs from '@/components/MapDialogs';
import MapSettingsDialog from '@/components/MapSettingsDialog';
import ObjectManagementDialog from '@/components/ObjectManagementDialog';
import RuleDialog from '@/components/RuleDialog';
import DialogueTreeDialog from '@/components/dialogue/DialogueTreeDialog';
import SeparateBrushDialog from '@/components/SeparateBrushDialog';
import TitleBar from '@/components/TitleBar';
import TopBar from '@/components/TopBar';
import ConfirmActionDialog from '@/components/ConfirmActionDialog';
import SidebarToggle from '@/components/SidebarToggle';
import AppSidebar from '@/components/AppSidebar';
import EditorCanvas from '@/components/EditorCanvas';
import useMapsDropdown from './hooks/useMapsDropdown';
import type { ControlsProps } from '@/components/SidebarControlsArea';
import ExportSuccessModal from '@/components/ExportSuccessModal';
import VendorDialogs from '@/components/VendorDialogs';
// Sidebar child components are now rendered inside AppSidebar
import { computeIntermapTarget, extractSpawnIntermapValue } from './editor/mapSpawnUtils';
import { validateAndSanitizeObject } from './editor/objectValidation';
import type { ItemResourceSubtype, ItemRole } from './editor/itemRoles';
import type { ActorRoleKey } from './editor/actorRoles';
import { GAME_TRIGGER_OPTIONS, PLAYER_TRIGGER_OPTIONS } from './editor/ruleOptions';
import type { RuleStartType } from './editor/ruleOptions';
import useHelpState from './hooks/useHelpState';
import useMapConfig from './hooks/useMapConfig';
import useObjectEditing from './hooks/useObjectEditing';
import useProjectSession from './hooks/useProjectSession';
import useProjectIO from './hooks/useProjectIO';
import useDialogs from './hooks/useDialogs';
import { buildConstantStockString } from './utils/parsers';
import useStampState from './hooks/useStampState';
import useToolbarAutoCollapse from './hooks/useToolbarAutoCollapse';
import useAutosave from './hooks/useAutosave';
import useToolbarHandlers from './hooks/useToolbarHandlers';
import useToolbarVisibility from './hooks/useToolbarVisibility';
import useTooltip from './hooks/useTooltip';
import useVendorState from './hooks/useVendorState';
import useEditorTabs from './hooks/useEditorTabs';
import useEditorState from './hooks/useEditorState';
import usePreferences from './hooks/usePreferences';
import flareIconUrl from '/flare-ico.png?url';
import type { MapConfig } from './editor/mapConfig';
import type { EditorTab } from './hooks/useEditorTabs';

type EnemyTabConfig = { enemy: MapObject };

import useItems from './hooks/useItems';
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
  const toolbar = useToolbarAutoCollapse();
  const bottomToolbar = useToolbarAutoCollapse();
  const brushToolbar = useToolbarAutoCollapse({ autoCollapse: false });
  // Selection / tool state moved here to ensure availability for handlers
  const [selectedTool, setSelectedTool] = useState<'brush' | 'selection' | 'shape' | 'eyedropper' | 'stamp'>('brush');
  const [selectedBrushTool, setSelectedBrushTool] = useState<'brush' | 'bucket' | 'eraser' | 'clear'>('brush');
  const [selectedSelectionTool, setSelectedSelectionTool] = useState<'rectangular' | 'magic-wand' | 'same-tile' | 'circular'>('rectangular');
  const [selectedShapeTool, setSelectedShapeTool] = useState<'rectangle' | 'circle' | 'line'>('rectangle');
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);
  const [selectionCount, setSelectionCount] = useState<number>(0);
  const [hasSelection, setHasSelection] = useState<boolean>(false);
  const [pendingMapConfig, setPendingMapConfig] = useState<EditorProjectData | null>(null);

  const showToolbarTemporarily = useCallback(() => toolbar.showTemporarily(), [toolbar]);
  const showBottomToolbarTemporarily = useCallback(() => bottomToolbar.showTemporarily(), [bottomToolbar]);
  const showBrushToolbarTemporarily = useCallback(() => brushToolbar.showTemporarily(), [brushToolbar]);

  // Expose toolbar state/handlers under the names expected by extracted components
  const toolbarExpanded = toolbar.expanded;
  const toolbarContainerRef = toolbar.containerRef;
  const handleToolbarMouseEnter = toolbar.handleMouseEnter;
  const handleToolbarMouseLeave = toolbar.handleMouseLeave;
  const handleToolbarFocus = toolbar.handleFocus;
  const handleToolbarBlur = (event?: React.FocusEvent<HTMLDivElement>) => toolbar.handleBlur(event as React.FocusEvent<HTMLDivElement>);

  const bottomToolbarExpanded = bottomToolbar.expanded;
  const setBottomToolbarNode = (node: HTMLDivElement | null) => { bottomToolbar.containerRef.current = node; };
  const handleBottomToolbarMouseEnter = bottomToolbar.handleMouseEnter;
  const handleBottomToolbarMouseLeave = bottomToolbar.handleMouseLeave;
  const handleBottomToolbarFocus = bottomToolbar.handleFocus;
  const handleBottomToolbarBlur = bottomToolbar.handleBlur;

  const brushToolbarExpanded = brushToolbar.expanded;
  const setBrushToolbarNode = (node: HTMLDivElement | null) => { brushToolbar.containerRef.current = node; };
  

  // Option popovers for toolbar buttons
  const [showBrushOptions, setShowBrushOptions] = useState(false);
  const handleShowBrushOptions = useCallback(() => setShowBrushOptions(true), []);
  const handleHideBrushOptions = useCallback(() => setShowBrushOptions(false), []);

  const [showSelectionOptions, setShowSelectionOptions] = useState(false);
  const handleShowSelectionOptions = useCallback(() => setShowSelectionOptions(true), []);
  const handleHideSelectionOptions = useCallback(() => setShowSelectionOptions(false), []);

  const [showShapeOptions, setShowShapeOptions] = useState(false);
  const handleShowShapeOptions = useCallback(() => setShowShapeOptions(true), []);
  const handleHideShapeOptions = useCallback(() => setShowShapeOptions(false), []);

  const canUseTilesetDialog = !!editor;
  const {
    brushTool,
    setBrushTool,
    showSeparateDialog,
    setShowSeparateDialog,
    brushToSeparate,
    setBrushToSeparate,
    stamps,
    setStamps,
    selectedStamp,
    setSelectedStamp,
    stampMode,
    setStampMode,
    setShowStampDialog,
    newStampName,
    setNewStampName
  } = useStampState();
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
  // Clear layer confirmation dialog state (replaces window.confirm)
  const [showClearLayerDialog, setShowClearLayerDialog] = useState(false);
  // Generic confirmation dialog for other destructive actions
  const [confirmAction, setConfirmAction] = useState<null | { type: 'removeBrush' | 'removeTileset' | 'removeTab'; payload?: number | { layerType: string; tabId: number } }>(null);
  // Keep a stable React state for the tab that was requested to be deleted so
  // the confirmation handler can use the exact intended tab (avoids stale refs).
  const [tabToDelete, setTabToDelete] = useState<null | { layerType: string; tabId: number }>(null);
  // Keep an optional ref as a fallback for older flows
  const confirmPayloadRef = React.useRef<null | { layerType: string; tabId: number }>(null);
  
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
  const [showAbilityDialog, setShowAbilityDialog] = useState(false);
  const [abilityNameInput, setAbilityNameInput] = useState('');
  const [, setAbilitiesList] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [ruleNameInput, setRuleNameInput] = useState('');
  const [ruleStartType, setRuleStartType] = useState<RuleStartType | null>(null);
  const [ruleTriggerId, setRuleTriggerId] = useState<string>('');
  const [ruleActionSelection, setRuleActionSelection] = useState<{ groupId: string; actionId: string } | null>(null);
  // Items list for display
  
  // Expanded item categories for accordion
  const [expandedItemCategories, setExpandedItemCategories] = useState<Set<ItemRole>>(new Set());

  const normalizeItemsForState = useCallback((items: Array<{ id: number; name: string; category: string; filePath: string; fileName: string; role?: string; resourceSubtype?: string }>) => {
    const toResourceSubtype = (value: string | undefined): ItemResourceSubtype => {
      if (value === 'currency' || value === 'material' || value === '') return value;
      return '';
    };

    return items.map((item) => ({
      ...item,
      role: (item.role as ItemRole) || 'unspecified',
      resourceSubtype: toResourceSubtype(item.resourceSubtype)
    }));
  }, []);

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
    toolbar,
    brushToolbar,
    bottomToolbar
  });
  // Editor-instantiation is now handled by `useEditorState` hook.

  // Track hover coordinates
  useEffect(() => {
    if (!editor) return;

    const updateHoverCoords = () => {
      const coords = editor.getHoverCoordinates();
      setHoverCoords(coords);
    };

    // Update hover coordinates on animation frame for smooth updates
    let animationFrameId: number;
    const pollHoverCoords = () => {
      updateHoverCoords();
      animationFrameId = requestAnimationFrame(pollHoverCoords);
    };

    pollHoverCoords();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [editor, setHoverCoords]);


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

  const handleRemoveBrush = useCallback((brushId: number) => {
    if (!editor) return;
    
    console.log(`handleRemoveBrush called with brushId: ${brushId}`);
  // Open generic confirm dialog
  setConfirmAction({ type: 'removeBrush', payload: brushId });
  }, [editor, setConfirmAction]);

  const handleBrushReorder = useCallback((fromTileIndex: number, toTileIndex: number) => {
    if (!editor) return;
    
    try {
      // Get the current brush order to find array indices
      const tileInfo = editor.getDetectedTileInfo();
      const fromIndex = tileInfo.findIndex(tile => tile.gid === fromTileIndex);
      const toIndex = tileInfo.findIndex(tile => tile.gid === toTileIndex);
      
      if (fromIndex !== -1 && toIndex !== -1) {
        editor.reorderBrush(fromIndex, toIndex);
        console.log(`Reordered brush ${fromTileIndex} to position of ${toTileIndex}`);
      }
    } catch (error) {
      console.error('Failed to reorder brush:', error);
    }
  }, [editor]);

  // Object management handlers
  const handleEditObject = useCallback((objectId: number) => {
    if (!editor) return;

    setObjectValidationErrors([]);
    const obj = editor.getMapObjects().find((o: MapObject) => o.id === objectId);
    if (obj) {
      if (obj.type === 'enemy') {
        const existingTab = tabs.find(
          (tab) => tab.tabType === 'enemy' && (tab.config as { enemy?: MapObject } | null)?.enemy?.id === obj.id
        );
        if (existingTab) {
          void switchToTab(existingTab.id);
          return;
        }

        // Create tab for enemy editing
        const tabName = obj.name || 'Enemy';
        const tab = createTabFor(tabName, currentProjectPath, { enemy: obj });
        setActiveTabId(tab.id);
        setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, tabType: 'enemy' } : t));
      } else {
        setEditingObject(obj);
        setShowObjectDialog(true);
      }
    }
  }, [createTabFor, currentProjectPath, editor, setActiveTabId, setEditingObject, setObjectValidationErrors, setShowObjectDialog, setTabs, switchToTab, tabs]);

  const handleUpdateObject = useCallback((updatedObject: MapObject) => {
    if (!editor) return;

    editor.updateMapObject(updatedObject.id, updatedObject);
    setEditingObject(null);
    setShowObjectDialog(false);
    syncMapObjects();
    setObjectValidationErrors([]);
    
    // Trigger autosave after NPC attributes are edited
    editor.triggerAutoSave(true);
  }, [editor, setEditingObject, setObjectValidationErrors, setShowObjectDialog, syncMapObjects]);

  const handleActorFieldChange = useCallback((field: 'name' | 'tilesetPath' | 'portraitPath', value: string) => {
    setActorDialogState((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
    setActorDialogError(null);
  }, [setActorDialogError, setActorDialogState]);

  const handleActorRoleToggle = useCallback((role: ActorRoleKey) => {
    setActorDialogState((prev) => {
      if (!prev) return prev;
      return { ...prev, [role]: !prev[role] };
    });
  }, [setActorDialogState]);

  const handleActorTilesetBrowse = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electronAPI?.selectTilesetFile) {
      return;
    }

    try {
      const selected = await window.electronAPI.selectTilesetFile();
      if (selected) {
        handleActorFieldChange('tilesetPath', selected);
      }
    } catch (error) {
      console.error('Failed to select tileset file for actor:', error);
    }
  }, [handleActorFieldChange]);

  const handleActorPortraitBrowse = useCallback(async () => {
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
            handleActorFieldChange('portraitPath', dataUrl);
          } else {
            handleActorFieldChange('portraitPath', selected);
          }
        } else {
          handleActorFieldChange('portraitPath', selected);
        }
      }
    } catch (error) {
      console.error('Failed to select portrait file for actor:', error);
    }
  }, [handleActorFieldChange]);

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

  const handleCloseAbilityDialog = useCallback(() => {
    setShowAbilityDialog(false);
    setAbilityNameInput('');
  }, []);

  const handleCreateAbility = useCallback((name: string) => {
    setAbilitiesList((prev) => [
      ...prev,
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        name,
        type: 'Standard'
      }
    ]);
    setShowAbilityDialog(false);
    setAbilityNameInput('');
  }, []);

  // Item edit/create handlers moved to `useItems` hook (see src/hooks/useItems.ts)



  

  // NPC drag start
  const handleNpcDragStart = useCallback((e: React.DragEvent, npcId: number) => {
    e.dataTransfer.setData('npc-id', npcId.toString());
    e.dataTransfer.effectAllowed = 'move';
    setDraggingNpcId(npcId);
  }, []);

  // NPC drag end
  const handleNpcDragEnd = useCallback(() => {
    if (editor) {
      editor.clearNpcDragHover();
    }
    setDraggingNpcId(null);
  }, [editor]);

  const handleActorSubmit = useCallback(async (editAfter = false) => {
    if (!editor || !actorDialogState) {
      return;
    }

    // Required name field for both NPCs and enemies
    if (!actorDialogState.name.trim()) {
      setActorDialogError('Name is required.');
      return;
    }

    const name = actorDialogState.name.trim();
    const tilesetPath = actorDialogState.tilesetPath.trim();
    const portraitPath = actorDialogState.portraitPath.trim();
    const {
      isTalker,
      isVendor,
      isQuestGiver,
      isMelee,
      isRanged,
      isCaster,
      isSummoner,
      isBoss,
      isPassive,
      isStationary
    } = actorDialogState;

    let npcFilename: string | undefined;
    if (actorDialogState.type === 'npc' && currentProjectPath && window.electronAPI?.createNpcFile) {
      // Determine primary role for NPC file creation
      const role = isVendor ? 'vendor' : isQuestGiver ? 'quest' : isTalker ? 'talker' : 'static';
      // Create NPC file inside the project folder when available
      try {
        const result = await window.electronAPI.createNpcFile(currentProjectPath, {
          name,
          role,
          tilesetPath: tilesetPath || undefined,
          portraitPath: portraitPath || undefined,
        });
        if (result.success && result.filename) {
          npcFilename = result.filename;
          console.log('NPC file created:', result.filePath);
        } else if (result.error) {
          console.error('Failed to create NPC file:', result.error);
          // Hata olsa bile NPC'yi listeye eklemeye devam et
        }
      } catch (err) {
        console.error('Error creating NPC file:', err);
      }
    }

    // Role-based properties for either NPC or enemy
    const roleProperties: Record<string, string> = {};
    if (actorDialogState.type === 'npc') {
      if (isTalker) {
        roleProperties.talker = 'true';
      }
      if (isVendor) {
        roleProperties.vendor = 'true';
      }
      if (isQuestGiver) {
        roleProperties.questGiver = 'true';
      }
      // if none are selected, it's a static NPC (no properties)
    } else {
      if (isMelee) {
        roleProperties.melee = 'true';
      }
      if (isRanged) {
        roleProperties.ranged = 'true';
      }
      if (isCaster) {
        roleProperties.caster = 'true';
      }
      if (isSummoner) {
        roleProperties.summoner = 'true';
      }
      if (isBoss) {
        roleProperties.boss = 'true';
      }
      if (isPassive) {
        roleProperties.passive = 'true';
      }
      if (isStationary) {
        roleProperties.stationary = 'true';
      }
    }

    // Create the actor off-map (-1, -1) so it can be placed later
    const unplacedX = -1;
    const unplacedY = -1;

    // Keep the actor in the list but not on the map yet
    // Note: addMapObject 'enemy' | 'event' is allowed; we update type afterwards
    const newObject = editor.addMapObject('enemy', unplacedX, unplacedY, 1, 1);
    editor.updateMapObject(newObject.id, {
      name,
      x: unplacedX,
      y: unplacedY,
      type: actorDialogState.type,
      category: actorDialogState.type === 'npc' ? 'npc' : '',
      wander_radius: 0,
      properties: {
        ...(newObject.properties || {}),
        ...roleProperties,
        ...(tilesetPath ? { tilesetPath } : {}),
        ...(portraitPath ? { portraitPath } : {}),
        ...(npcFilename ? { npcFilename: `npcs/${npcFilename}` } : {}),
      }
    });

    syncMapObjects();
    const newObjectId = newObject.id;
    handleCloseActorDialog();
    
    if (editAfter) {
      handleEditObject(newObjectId);
    }
    
    // Trigger autosave after NPC is added
    editor.triggerAutoSave(true);
  }, [actorDialogState, editor, handleCloseActorDialog, syncMapObjects, currentProjectPath, handleEditObject, setActorDialogError]);

  const handleObjectDialogClose = useCallback(() => {
    setShowObjectDialog(false);
    setEditingObject(null);
    setObjectValidationErrors([]);
    setShowDeleteNpcConfirm(false);
    setShowDeleteEnemyConfirm(false);
  }, [setEditingObject, setObjectValidationErrors, setShowDeleteEnemyConfirm, setShowDeleteNpcConfirm, setShowObjectDialog]);

  const handleObjectDialogSave = useCallback(async () => {
    if (!editingObject) return;

    const { errors, sanitized } = validateAndSanitizeObject(editingObject);
    if (errors.length > 0) {
      setObjectValidationErrors(errors);
      return;
    }

    setObjectValidationErrors([]);
    
    // NPC için dosyayı diske kaydet (mevcut NPC dosyasına)
    if (editingObject.type === 'npc' && window.electronAPI?.writeNpcFile && currentProjectPath) {
      // npcFilename property'sinden mevcut dosya adını al
      const existingFilename = sanitized.npcFilename || editingObject.properties?.npcFilename;
      
      if (existingFilename) {
        try {
          // MapObject'ten FlareNPC oluştur
          const npc: FlareNPC = {
            id: editingObject.id,
            x: editingObject.x,
            y: editingObject.y,
            filename: existingFilename,
            name: sanitized.name || '',
            talker: sanitized.talker === 'true',
            vendor: sanitized.vendor === 'true',
            gfx: sanitized.tilesetPath || undefined,
            portrait: sanitized.portraitPath || undefined,
            direction: sanitized.direction ? parseInt(sanitized.direction) as FlareNPC['direction'] : undefined,
            waypoints: sanitized.waypoints || undefined,
            wander_radius: sanitized.wander_radius ? parseInt(sanitized.wander_radius) : undefined,
            constant_stock: sanitized.constant_stock || undefined,
            random_stock: sanitized.random_stock || undefined,
            random_stock_count: sanitized.random_stock_count ? parseInt(sanitized.random_stock_count) : undefined,
            vendor_requires_status: sanitized.vendor_requires_status || undefined,
            vendor_requires_not_status: sanitized.vendor_requires_not_status || undefined,
            customProperties: {}
          };
          
          // DialogueTrees ve diğer custom property'leri aktar (npcFilename hariç)
          for (const [key, value] of Object.entries(sanitized)) {
            if (!['npcFilename', 'name', 'talker', 'vendor', 'tilesetPath', 'portraitPath', 
                  'direction', 'waypoints', 'wander_radius', 'constant_stock', 'random_stock',
                  'random_stock_count', 'vendor_requires_status', 'vendor_requires_not_status'].includes(key)) {
              npc.customProperties![key] = value;
            }
          }
          
          // Serialize et
          const { npcFileContent } = serializeNpcToFlare(npc);
          
          // Dosya yolunu belirle (npcs/ prefix'i çıkar)
          const npcFilenameClean = existingFilename.replace(/^npcs\//, '');
          
          // Dosyayı yaz (mevcut dosyanın üzerine)
          await window.electronAPI.writeNpcFile(currentProjectPath, npcFilenameClean, npcFileContent);
          console.log(`NPC file updated: ${npcFilenameClean}`);
        } catch (error) {
          console.error('Failed to save NPC file:', error);
        }
      } else {
        console.warn('NPC has no filename, skipping file save');
      }
    }
    
    handleUpdateObject({ ...editingObject, properties: sanitized });
  }, [currentProjectPath, editingObject, handleUpdateObject, setObjectValidationErrors]);

  const updateEditingObjectProperty = useCallback((key: string, value: string | null) => {
    setEditingObject((prev) => {
      if (!prev) return prev;
      const properties = { ...(prev.properties || {}) };
      if (value === null || value === '') {
        delete properties[key];
      } else {
        properties[key] = value;
      }
      return { ...prev, properties };
    });
  }, [setEditingObject]);

  const updateEditingObjectBoolean = useCallback((key: string, checked: boolean) => {
    setEditingObject((prev) => {
      if (!prev) return prev;
      const properties = { ...(prev.properties || {}) };
      properties[key] = checked ? 'true' : 'false';
      return { ...prev, properties };
    });
  }, [setEditingObject]);

  const getEditingObjectProperty = useCallback((key: string, fallback = '') => {
    if (!editingObject || !editingObject.properties) return fallback;
    return editingObject.properties[key] ?? fallback;
  }, [editingObject]);

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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'tileset' | 'layerTileset') => {
    const file = event.target.files?.[0];
    if (file && editor?.handleFileUpload) {
      editor.handleFileUpload(file, type);
    }
  };

  const handleSetActiveLayer = async (layerId: number) => {
    if (editor) {
      editor.setActiveLayer(layerId);
      setActiveLayerId(layerId);
      
      // Check if this is the Items layer and ensure folders exist
      const layer = layers.find(l => l.id === layerId);
      if (layer?.type === 'items' && currentProjectPath && window.electronAPI?.ensureItemsFolders) {
        try {
          await window.electronAPI.ensureItemsFolders(currentProjectPath);
          // Load items list
          if (window.electronAPI.listItems) {
            const itemsResult = await window.electronAPI.listItems(currentProjectPath);
            if (itemsResult.success && itemsResult.items) {
              setItemsList(normalizeItemsForState(itemsResult.items));
            }
          }
        } catch (err) {
          console.error('Error ensuring items folders:', err);
        }
      }
      
      // Update hasTileset state based on the new active layer
    }
  };

  const handleToggleLayerVisibility = (layerId: number) => {
    if (editor) {
      editor.toggleLayerVisibility(layerId);
      // Force a fresh state update by creating a new array
      const currentLayers = editor.getLayers();
      setLayers([...currentLayers]); // Create a new array to trigger re-render
      
      // Also update tileset status for the active layer
    }
  };

  const handleLayerTransparencyChange = (layerId: number, delta: number) => {
    if (editor) {
      const layer = layers.find(l => l.id === layerId);
      if (layer) {
        const currentTransparency = layer.transparency || 0;
        const newTransparency = Math.max(0, Math.min(1, currentTransparency + delta));
        editor.setLayerTransparency(layerId, newTransparency);
        updateLayersList(); // Update UI to reflect changes
      }
    }
  };

  const handleZoomIn = () => {
    if (editor?.zoomIn) {
      editor.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (editor?.zoomOut) {
      editor.zoomOut();
    }
  };

  const handleResetZoom = () => {
    if (editor?.resetZoom) {
      editor.resetZoom();
    }
  };

  const handleUndo = useCallback(() => {
    if (editor?.undo) {
      editor.undo();
      updateLayersList(); // Update UI after undo
      syncMapObjects();
    }
  }, [editor, updateLayersList, syncMapObjects]);

  const handleRedo = useCallback(() => {
    if (editor?.redo) {
      editor.redo();
      updateLayersList(); // Update UI after redo
      syncMapObjects();
    }
  }, [editor, updateLayersList, syncMapObjects]);

  

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
  const handleUndoRef = useRef(handleUndo);
  const handleRedoRef = useRef(handleRedo);

  useEffect(() => { handleManualSaveRef.current = handleManualSave; }, [handleManualSave]);
  useEffect(() => { handleUndoRef.current = handleUndo; }, [handleUndo]);
  useEffect(() => { handleRedoRef.current = handleRedo; }, [handleRedo]);

  // Maps management moved into useProjectIO hook

  // minimap toggle handed inline where needed; removed unused handler

  const handleCreateNewMap = (config: MapConfig, newProjectPath?: string) => {
    localStorage.removeItem('tilemap_autosave_backup');
    setCurrentProjectPath(newProjectPath ?? null);
    // Do not set mapName to project name here. Only set currentProjectPath and map config state.
    updateStartingMap(Boolean(config.isStartingMap), { propagate: false });
    setNewMapName('Map Name');
    setNewMapStarting(Boolean(config.isStartingMap));
    setMapWidth(0);
    setMapHeight(0);
    setNewMapWidth(config.width);
    setNewMapHeight(config.height);
    setMapInitialized(false);
    setLayers([]);
    setActiveLayerId(null);
    setStamps([]);
    setMapObjects([]);
    setHoverCoords(null);
    setHasSelection(false);
    setSelectionCount(0);
    setPendingMapConfig(null);
    setEditor(null);
    setCreateMapError(null);
    setShowCreateMapDialog(false);
    setShowWelcome(false);

    // For project creation we do not auto-create any tabs here.
    // Tabs should only be created when the user creates an actual map inside the project.
  };

  const handleOpenMap = useCallback(async (projectDir: string, _createTab: boolean = false, mapName?: string) => {
    console.log('=== HANDLE OPEN MAP CALLED ===', projectDir);
    console.log('Project path details:', {
      path: projectDir,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Block the default editor creation effect while we open
      setIsOpeningProject(true);
      // Remember project path for subsequent saves
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

      // Check if there are any maps in the project
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
        // No maps yet: switch to the editor shell and prompt for map creation
        if (typeof refreshProjectMaps === 'function') refreshProjectMaps();
        setMapInitialized(false);
        setEditor(null);
        setPendingMapConfig(null);
        setMapName('');
        setNewMapName((prev) => (typeof prev === 'string' && prev.trim() ? prev : 'Map Name'));
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
        setNewMapWidth((prev) => (typeof prev === 'number' && prev > 0 ? prev : 20));
        setNewMapHeight((prev) => (typeof prev === 'number' && prev > 0 ? prev : 15));
        setShowWelcome(false);
        setShowCreateMapDialog(true);
        return;
      }
      await (typeof refreshProjectMaps === 'function' ? refreshProjectMaps() : Promise.resolve());
      
      // Load session from project folder (.flare-session.json)
      // This restores tabs that were open when the project was last used
      let savedSession: { tabs: { id: string; name: string; projectPath?: string }[]; activeTabId: string | null } | null = null;
      if (window.electronAPI?.readSession) {
        try {
          savedSession = await window.electronAPI.readSession(projectDir);
          console.log('Loaded session from project:', savedSession?.tabs?.length || 0, 'tabs');
        } catch (e) {
          console.warn('Failed to load session from project:', e);
        }
      }
      
      // Create tabs for ALL maps in the project that don't already have tabs
      // First, restore tabs from saved session, then add any new maps
      // Use functional update to get the latest tabs state and avoid stale closure issues
      // Normalize paths for comparison (handle different slash styles)
      const normalizedProjectDir = projectDir.replace(/\\/g, '/').toLowerCase();
      
      // Track which tab to activate after loading
      let tabToActivate: string | null = null;
      
      setTabs(prevTabs => {
        // Get existing tab names for this project
        const existingTabNames = new Set(
          prevTabs
            .filter(t => t.projectPath && t.projectPath.replace(/\\/g, '/').toLowerCase() === normalizedProjectDir)
            .map(t => t.name)
        );
        
        // Start with previous tabs (from other projects)
        const otherProjectTabs = prevTabs.filter(t => {
          const normalizedPath = t.projectPath?.replace(/\\/g, '/').toLowerCase() || '';
          return normalizedPath !== normalizedProjectDir;
        });
        
        // Restore tabs from saved session
        const restoredTabs: EditorTab[] = [];
        if (savedSession?.tabs) {
          for (const savedTab of savedSession.tabs) {
            // Only restore if the map still exists (check both .json and .txt)
            const mapExists = maps.some(m => {
              const mapBaseName = m.replace(/\.(txt|json)$/i, '').toLowerCase();
              return mapBaseName === savedTab.name.toLowerCase();
            });
            if (mapExists && !existingTabNames.has(savedTab.name)) {
              restoredTabs.push({
                id: savedTab.id,
                name: savedTab.name,
                projectPath: projectDir,
                config: null
              });
              existingTabNames.add(savedTab.name);
              console.log('Restored tab from session:', savedTab.name);
            }
          }
        }
        
        // Add tabs for any new maps not in session
        const newTabs: EditorTab[] = [];
        for (const mapFileName of maps) {
          // Extract map name from filename (remove .txt or .json extension)
          const mapNameFromFile = mapFileName.replace(/\.(txt|json)$/i, '');
          if (!existingTabNames.has(mapNameFromFile)) {
            const tabId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9) + '_' + mapNameFromFile;
            newTabs.push({
              id: tabId,
              name: mapNameFromFile,
              projectPath: projectDir,
              config: null
            });
            console.log('Creating new tab for map:', mapNameFromFile);
          }
        }
        
        const allProjectTabs = [...restoredTabs, ...newTabs];
        
        // Determine which tab to activate
        if (savedSession?.activeTabId && allProjectTabs.some(t => t.id === savedSession.activeTabId)) {
          tabToActivate = savedSession.activeTabId;
        } else if (allProjectTabs.length > 0) {
          tabToActivate = allProjectTabs[0].id;
        }
        
        console.log('Final tabs for project:', allProjectTabs.map(t => t.name), 'activating:', tabToActivate);
        
        return [...otherProjectTabs, ...allProjectTabs];
      });
      
      // Set the active tab after state update
      if (tabToActivate) {
        setActiveTabId(tabToActivate);
      }
      
      // If there are maps, proceed to open the first map as before
      if (window.electronAPI?.openMapProject) {
        // Use type assertion for optional mapName parameter (not in base type but supported)
        const mapConfig = await (window.electronAPI.openMapProject as (path: string, mapName?: string) => Promise<EditorProjectData | null>)(projectDir, mapName);
          if (mapConfig) {
          // ...existing code for setting up the map/editor...
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
            // Preserve current editor state before clearing the editor to open another project
            if (activeTabId) {
              const prevTab = tabs.find(t => t.id === activeTabId);
              if (prevTab) {
                try {
                  if (prevTab.projectPath) {
                    await editor.saveProjectData(prevTab.projectPath);
                  } else {
                            await editor.ensureTilesetsLoaded();
                            const snapshot = await editor.getProjectData();
                            const safeSnapshot = JSON.parse(JSON.stringify(snapshot));
                            setTabs((prev) => prev.map(t => t.id === prevTab.id ? { ...t, config: safeSnapshot } : t));
                            console.log('Snapshot saved into prevTab.config before opening project:', { prevTabId: prevTab.id, snapshotKeys: Object.keys(safeSnapshot || {}) });
                  }
                } catch (err) {
                  console.warn('Failed to persist current editor before opening project:', err);
                }
              }
            }
            setEditor(null);
          }
          // Tab was already created in the setTabs call above (from session + maps list)
          // We just need to set the pending map config to load this map into the editor
          // The activeTabId was already set by setActiveTabId(tabToActivate) above
          setPendingMapConfig(mapConfig);
        }
        } else {
        // Fallback for web
        console.log('Opening map project:', projectDir);
        // toast suppressed: Feature Unavailable (requires desktop app)
      }
    } catch (error) {
      console.error('Error opening map project:', error);
      // toast suppressed: Failed to open map project
    }
    finally {
      // Re-enable default editor creation for other flows
      setIsOpeningProject(false);
    }
  }, [
    activeTabId,
    editor,
    setActiveLayerId,
    setActiveTabId,
    setCreateMapError,
    setCurrentProjectPath,
    setEditor,
    setHasSelection,
    setHasUnsavedChanges,
    setHoverCoords,
    setIsOpeningProject,
    setLayers,
    setMapHeight,
    setMapInitialized,
    setMapName,
    setMapObjects,
    setMapWidth,
    setNewMapHeight,
    setNewMapName,
    setNewMapStarting,
    setNewMapWidth,
    setPendingMapConfig,
    refreshProjectMaps,
    setReservedMapNames,
    setSaveStatus,
    setSelectionCount,
    setShowCreateMapDialog,
    setShowWelcome,
    setStartingMapIntermap,
    setStamps,
    setTabs,
    showBottomToolbarTemporarily,
    showToolbarTemporarily,
    startingMapIntermap,
    tabs,
    updateStartingMap
  ]);

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

  // Wire Electron menu actions (Save/Open/New)
  // We intentionally register IPC/menu listeners once and call the latest handlers via refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!window.electronAPI) return;

    // Register IPC listeners once and call the latest handler via refs.
    window.electronAPI.onMenuSaveMap(async () => {
      try { await handleManualSaveRef.current?.(); } catch (e) { console.error(e); }
    });

    window.electronAPI.onMenuOpenMap(async () => {
      const selected = await window.electronAPI.selectDirectory();
      if (selected) {
        try {
          const fn = handleOpenMapRef.current;
          if (fn) await fn(selected);
        } catch (e) {
          console.error(e);
        }
      }
    });

    window.electronAPI.onMenuNewMap(() => {
      setShowWelcome(true);
      setMapInitialized(false);
      setEditor(null);
      setMapWidth(0);
      setMapHeight(0);
      setShowCreateMapDialog(false);
    });

    window.electronAPI.onMenuUndo(() => { try { handleUndoRef.current?.(); } catch (e) { console.error(e); } });
    window.electronAPI.onMenuRedo(() => { try { handleRedoRef.current?.(); } catch (e) { console.error(e); } });

    // We intentionally do not include non-stable dependencies so listeners are registered only once.
  }, [setShowWelcome, setMapInitialized, setEditor, setMapWidth, setMapHeight, setShowCreateMapDialog]);

  // Handle close confirmation events. Register listeners once and use refs
  // to access the latest handlers/state so we avoid adding multiple
  // listeners (which caused MaxListenersExceededWarning).
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  useEffect(() => { hasUnsavedChangesRef.current = hasUnsavedChanges; }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onBeforeClose(async () => {
      try {
        // Use ref to read the latest unsaved state
        await window.electronAPI.confirmClose(hasUnsavedChangesRef.current);
      } catch (err) {
        console.error('onBeforeClose handler failed:', err);
      }
    });

    window.electronAPI.onSaveAndClose(async () => {
      try {
        await handleManualSaveRef.current?.();
        window.electronAPI.closeAfterSave();
      } catch (error) {
        console.error('Failed to save before close:', error);
        window.electronAPI.closeAfterSave();
      }
    });
    // Intentionally no dependencies so listeners are registered only once.
  }, []);

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
  }, [activeLayer?.type, editor, setConfirmAction, setTabToDelete, toast]);

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
      <TitleBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSwitchTab={(tabId) => { void switchToTab(tabId); }}
        onOpenMapSettings={() => setShowMapSettingsOnly(true)}
        onCloseEnemyTab={(tabId) => setPendingEnemyTabCloseId(tabId)}
        onCreateNewMap={() => setShowCreateMapDialog(true)}
        saveStatus={saveStatus}
        lastSaveTime={lastSaveTime}
        onMinimize={handleMinimize}
        onMaximize={handleMaximize}
        onClose={handleClose}
        flareIconUrl={flareIconUrl}
      />

      {/* Main Content */}
      {/* Left-edge collapse/expand toggle - placed outside the aside so it remains clickable when the sidebar is hidden */}
      <SidebarToggle
        show={showSidebarToggle}
        leftCollapsed={leftCollapsed}
        onToggle={() => {
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
        }}
      />

      <main className="flex flex-1 min-h-0">
        {
          (() => {
            const actors = {
              isNpcLayer,
              isEnemyLayer,
              actorEntries,
              draggingNpcId,
              handleEditObject,
              setNpcHoverTooltip,
              handleNpcDragStart,
              handleNpcDragEnd,
              handleOpenActorDialog
            };

            const rules = {
              isRulesLayer,
              rulesList,
              handleAddRule
            };

            const items = {
              isItemsLayer,
              itemsList,
              expandedItemCategories,
              setExpandedItemCategories,
              handleOpenItemEdit,
              handleOpenItemDialog
            };

            const tileset = {
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
              handleOpenActorDialog,
              stampsState
            };

            const layersObj = {
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
              leftCollapsed
            };

            const exportStatus = { isExporting, exportProgress };

            const controlsObj: ControlsProps = {
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
              uiHelpers,
              toast
            };

            return (
              <AppSidebar
                leftCollapsed={leftCollapsed}
                actors={actors}
                rules={rules}
                items={items}
                tileset={tileset}
                layers={layersObj}
                exportStatus={exportStatus}
                controls={controlsObj}
              />
            );
          })()
        }

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
          <EditorCanvas
            ctx={{
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
              leftTransitioning
            }}
            bottomToolbarProps={{
              bottomToolbarExpanded,
              setBottomToolbarNode,
              onMouseEnter: handleBottomToolbarMouseEnter,
              onMouseLeave: handleBottomToolbarMouseLeave,
              onFocus: handleBottomToolbarFocus,
              onBlur: handleBottomToolbarBlur,
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
            }}
          />
        </section>
        )}
      </main>
      
      <Toaster />
      
      <SeparateBrushDialog
        open={showSeparateDialog}
        onOpenChange={setShowSeparateDialog}
        onConfirm={confirmSeparateBrush}
      />

      {(() => {
        const vendorState = {
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
        };

        const vendorHandlers = {
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
        };

        return <VendorDialogs vendorState={vendorState} vendorHandlers={vendorHandlers} />;
      })()}

      <RuleDialog
        open={showRuleDialog}
        ruleDialogStep={ruleDialogStep}
        ruleDialogError={ruleDialogError}
        ruleNameInput={ruleNameInput}
        setRuleNameInput={setRuleNameInput}
        ruleStartType={ruleStartType}
        setRuleStartType={setRuleStartType}
        ruleTriggerId={ruleTriggerId}
        setRuleTriggerId={setRuleTriggerId}
        ruleActionSelection={ruleActionSelection}
        setRuleActionSelection={setRuleActionSelection}
        availableRuleTriggers={availableRuleTriggers}
        onClose={() => {
          closeRuleDialog();
          setRuleDialogError(null);
          setRuleDialogStep('start');
          setRuleStartType(null);
          setRuleTriggerId('');
          setRuleActionSelection(null);
        }}
        onSave={handleSaveRule}
        onSetStep={setRuleDialogStep}
      />

      <AbilityDialog
        open={showAbilityDialog}
        abilityNameInput={abilityNameInput}
        onNameChange={setAbilityNameInput}
        onClose={handleCloseAbilityDialog}
        onCreate={handleCreateAbility}
      />

      <ActorDialog
        actorDialogState={actorDialogState}
        actorDialogError={actorDialogError}
        canUseTilesetDialog={canUseTilesetDialog}
        onClose={handleCloseActorDialog}
        onFieldChange={handleActorFieldChange}
        onRoleToggle={handleActorRoleToggle}
        onTilesetBrowse={() => { void handleActorTilesetBrowse(); }}
        onPortraitBrowse={() => { void handleActorPortraitBrowse(); }}
        onSubmit={handleActorSubmit}
      />

      <ItemDialog
        itemDialogState={itemDialogState}
        itemDialogError={itemDialogError}
        pendingDuplicateItem={pendingDuplicateItem}
        onClose={handleCloseItemDialog}
        onFieldChange={handleItemFieldChange}
        onSubmit={handleItemSubmit}
        onConfirmDuplicate={handleConfirmDuplicateItem}
        onClearDuplicate={() => setPendingDuplicateItem(null)}
      />

      <ItemEditDialog
        showItemEditDialog={showItemEditDialog}
        editingItem={editingItem}
        updateEditingItemField={updateEditingItemField}
        handleCloseItemEdit={handleCloseItemEdit}
        handleSaveItemEdit={handleSaveItemEdit}
      />

      <ObjectManagementDialog
        showObjectDialog={showObjectDialog}
        editingObject={editingObject}
        objectValidationErrors={objectValidationErrors}
        setEditingObject={setEditingObject}
        handleObjectDialogClose={handleObjectDialogClose}
        handleObjectDialogSave={handleObjectDialogSave}
        updateEditingObjectProperty={updateEditingObjectProperty}
        updateEditingObjectBoolean={updateEditingObjectBoolean}
        getEditingObjectProperty={getEditingObjectProperty}
        editor={editor}
        syncMapObjects={syncMapObjects}
        canUseTilesetDialog={canUseTilesetDialog}
        handleEditingTilesetBrowse={handleEditingTilesetBrowse}
        handleEditingPortraitBrowse={handleEditingPortraitBrowse}
        handleOpenVendorStockDialog={handleOpenVendorStockDialog}
        handleOpenVendorUnlockDialog={handleOpenVendorUnlockDialog}
        handleOpenVendorRandomDialog={handleOpenVendorRandomDialog}
        setDialogueTrees={setDialogueTrees}
        setActiveDialogueTab={setActiveDialogueTab}
        setShowDialogueTreeDialog={setShowDialogueTreeDialog}
        showDeleteNpcConfirm={showDeleteNpcConfirm}
        setShowDeleteNpcConfirm={setShowDeleteNpcConfirm}
        showDeleteEnemyConfirm={showDeleteEnemyConfirm}
        setShowDeleteEnemyConfirm={setShowDeleteEnemyConfirm}
      />

      <DialogueTreeDialog
        showDialogueTreeDialog={showDialogueTreeDialog}
        dialogueTrees={dialogueTrees}
        setDialogueTrees={setDialogueTrees}
        activeDialogueTab={activeDialogueTab}
        setActiveDialogueTab={setActiveDialogueTab}
        dialogueTabToDelete={dialogueTabToDelete}
        setDialogueTabToDelete={setDialogueTabToDelete}
        editingObject={editingObject}
        updateEditingObjectProperty={updateEditingObjectProperty}
        onClose={() => {
          setShowDialogueTreeDialog(false);
          setDialogueTabToDelete(null);
        }}
      />

      <MapDialogs
        showCreateMapDialog={showCreateMapDialog}
        setShowCreateMapDialog={setShowCreateMapDialog}
        newMapName={newMapName}
        setNewMapName={setNewMapName}
        newMapWidth={newMapWidth}
        setNewMapWidth={setNewMapWidth}
        newMapHeight={newMapHeight}
        setNewMapHeight={setNewMapHeight}
        newMapStarting={newMapStarting}
        setNewMapStarting={setNewMapStarting}
        createMapError={createMapError}
        setCreateMapError={setCreateMapError}
        isPreparingNewMap={isPreparingNewMap}
        handleConfirmCreateMap={handleConfirmCreateMap}
        showHeroEditDialog={showHeroEditDialog}
        setShowHeroEditDialog={setShowHeroEditDialog}
        heroEditData={heroEditData}
        setHeroEditData={setHeroEditData}
        handleHeroEditCancel={handleHeroEditCancel}
        handleHeroEditConfirm={handleHeroEditConfirm}
      />
      
      {/* Overwrite Export Confirmation Dialog */}
      <OverwriteExportDialog
        open={showOverwriteDialog}
        onConfirm={handleOverwriteConfirm}
        onCancel={handleOverwriteCancel}
      />

      <ExportSuccessModal open={showExportSuccess} onClose={() => setShowExportSuccess(false)} />

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
