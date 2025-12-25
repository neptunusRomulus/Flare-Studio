import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Tooltip from '@/components/ui/tooltip';
import { Download, Undo2, Redo2, X, ZoomIn, ZoomOut, RotateCcw, Map, Square, Settings, Mouse, MousePointer2, Eye, EyeOff, Move, Circle, Paintbrush2, PaintBucket, Eraser, MousePointer, Wand2, Target, Shapes, Pen, Blend, MapPin, Save, Scan, Check, HelpCircle, Folder, Plus, Image, Grid, Box, Users, Locate, Clock, Menu, Sword, GitBranch } from 'lucide-react';
import { TileMapEditor } from './editor/TileMapEditor';
import type { EditorProjectData } from './editor/TileMapEditor';
import { TileLayer, MapObject, FlareNPC } from './types';
import { serializeNpcToFlare } from './utils/flareNpcUtils';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import WelcomeScreen from './components/WelcomeScreen';
import OverwriteExportDialog from './components/OverwriteExportDialog';
import EnemyTabPanel from '@/components/EnemyTabPanel';
import AbilityDialog from '@/components/AbilityDialog';
import ActorDialog from '@/components/ActorDialog';
import BottomToolbar from '@/components/BottomToolbar';
import BrushToolbar from '@/components/BrushToolbar';
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
import SidebarLayout from '@/components/SidebarLayout';
import SidebarToggle from '@/components/SidebarToggle';
import TilesetPalette from '@/components/TilesetPalette';
import TitleBar from '@/components/TitleBar';
import VendorDialogs from '@/components/VendorDialogs';
import SidebarActorEntries from '@/components/SidebarActorEntries';
import SidebarItemsPanel from '@/components/SidebarItemsPanel';
import SidebarRulesPanel from '@/components/SidebarRulesPanel';
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
import useStampState from './hooks/useStampState';
import useToolbarAutoCollapse from './hooks/useToolbarAutoCollapse';
import useToolbarHandlers from './hooks/useToolbarHandlers';
import useToolbarVisibility from './hooks/useToolbarVisibility';
import useTooltip from './hooks/useTooltip';
import useToolSelection from './hooks/useToolSelection';
import useVendorState from './hooks/useVendorState';
import useEditorTabs from './hooks/useEditorTabs';
import flareIconUrl from '/flare-ico.png?url';
import type { MapConfig } from './editor/mapConfig';
import type { EditorTab } from './hooks/useEditorTabs';

type EnemyTabConfig = { enemy: MapObject };

function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [editor, setEditor] = useState<TileMapEditor | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const setupAutoSaveRef = useRef<null | ((editor: TileMapEditor) => void)>(null);
  const updateLayersListRef = useRef<null | (() => void)>(null);
  const syncMapObjectsRef = useRef<null | (() => void)>(null);
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

  const [activeGid, setActiveGid] = useState<string>('(none)');
  const [showMinimap, setShowMinimap] = useState(true);
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
  const [showSettings, setShowSettings] = useState(false);
  const [showMapSettingsOnly, setShowMapSettingsOnly] = useState(false);
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
  const {
    expanded: toolbarExpanded,
    containerRef: toolbarContainerRef,
    showTemporarily: showToolbarTemporarily,
    handleMouseEnter: handleToolbarMouseEnter,
    handleMouseLeave: handleToolbarMouseLeave,
    handleFocus: handleToolbarFocus,
    handleBlur: handleToolbarBlur
  } = toolbar;
  const {
    expanded: bottomToolbarExpanded,
    containerRef: bottomToolbarContainerRef,
    showTemporarily: showBottomToolbarTemporarily,
    handleMouseEnter: handleBottomToolbarMouseEnter,
    handleMouseLeave: handleBottomToolbarMouseLeave,
    handleFocus: handleBottomToolbarFocus,
    handleBlur: handleBottomToolbarBlur
  } = bottomToolbar;
  const {
    expanded: brushToolbarExpanded,
    containerRef: brushToolbarContainerRef,
    showTemporarily: showBrushToolbarTemporarily
  } = brushToolbar;
  // Left sidebar buttons expand/collapse (independent)
  // Left bottom action buttons are always expanded now; no local state required.
  const [pendingMapConfig, setPendingMapConfig] = useState<EditorProjectData | null>(null);

  const setBrushToolbarNode = useCallback((node: HTMLDivElement | null) => {
    brushToolbarContainerRef.current = node;
  }, [brushToolbarContainerRef]);

  const setBottomToolbarNode = useCallback((node: HTMLDivElement | null) => {
    toolbarRef.current = node;
    bottomToolbarContainerRef.current = node;
  }, [bottomToolbarContainerRef, toolbarRef]);

  const canUseTilesetDialog = useMemo(() => {
    return typeof window !== 'undefined' && !!window.electronAPI?.selectTilesetFile;
  }, [setVendorStockSelection]);
  
  const {
    selectedTool,
    setSelectedTool,
    showBrushOptions,
    showSelectionOptions,
    showShapeOptions,
    selectedBrushTool,
    setSelectedBrushTool,
    selectedSelectionTool,
    setSelectedSelectionTool,
    selectedShapeTool,
    setSelectedShapeTool,
    handleShowBrushOptions,
    handleHideBrushOptions,
    handleShowSelectionOptions,
    handleHideSelectionOptions,
    handleShowShapeOptions,
    handleHideShapeOptions
  } = useToolSelection({
    onCloseStampDialog: () => setShowStampDialog(false)
  });
  
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
  const setupAutoSaveWrapper = useCallback((target: TileMapEditor) => {
    setupAutoSaveRef.current?.(target);
  }, []);
  const updateLayersListWrapper = useCallback(() => {
    updateLayersListRef.current?.();
  }, []);
  const syncMapObjectsWrapper = useCallback(() => {
    syncMapObjectsRef.current?.();
  }, []);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Initialize from localStorage or default to false
    const savedTheme = localStorage.getItem('isDarkMode');
    return savedTheme ? JSON.parse(savedTheme) : false;
  });

  // Show/hide the left sidebar collapse toggle (user preference)
  const [showSidebarToggle, setShowSidebarToggle] = useState(() => {
    const saved = localStorage.getItem('showSidebarToggle');
    return saved ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    try {
      localStorage.setItem('showSidebarToggle', JSON.stringify(showSidebarToggle));
    } catch {
      // ignore storage errors
    }
  }, [showSidebarToggle]);
  
  // Auto-save states
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error' | 'unsaved'>('unsaved');
  const [autoSaveEnabled, setAutoSaveEnabledState] = useState(true);
  const [lastSaveTime, setLastSaveTime] = useState<number>(0);
  const [isManuallySaving, setIsManuallySaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // When true, we're in the middle of opening an existing project
  // and should avoid creating a blank editor instance.
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  
  const { tooltip, showTooltipWithDelay, hideTooltip } = useTooltip({ toolbarRef, canvasRef });

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
  
  // Item dialog state
  const [itemDialogState, setItemDialogState] = useState<{
    name: string;
    role: ItemRole;
    resourceSubtype: ItemResourceSubtype;
  } | null>(null);
  const [itemDialogError, setItemDialogError] = useState<string | null>(null);
  const [pendingDuplicateItem, setPendingDuplicateItem] = useState<{
    name: string;
    targetRole: ItemRole;
    conflictRole: ItemRole;
    kind: 'same-role' | 'other-role';
  } | null>(null);

  // Rules list for the Rules layer (UI-only for now; persistence will be added later).
  const [rulesList, setRulesList] = useState<Array<{ id: string; name: string; startType: RuleStartType; triggerId: string }>>([]);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [showAbilityDialog, setShowAbilityDialog] = useState(false);
  const [abilityNameInput, setAbilityNameInput] = useState('');
  const [, setAbilitiesList] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [ruleNameInput, setRuleNameInput] = useState('');
  const [ruleStartType, setRuleStartType] = useState<RuleStartType | null>(null);
  const [ruleTriggerId, setRuleTriggerId] = useState<string>('');
  const [ruleActionSelection, setRuleActionSelection] = useState<{ groupId: string; actionId: string } | null>(null);
  const [ruleDialogError, setRuleDialogError] = useState<string | null>(null);
  const [ruleDialogStep, setRuleDialogStep] = useState<'start' | 'actions'>('start');
  // Items list for display
  const [itemsList, setItemsList] = useState<Array<{ id: number; name: string; category: string; filePath: string; fileName: string; role: ItemRole; resourceSubtype?: ItemResourceSubtype }>>([]);
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

  const refreshItemsList = useCallback(async (projectPath: string | null) => {
    if (!projectPath || !window.electronAPI?.listItems) {
      setItemsList([]);
      return;
    }

    try {
      // Preload at project start so other UIs (dialogue/vendor/etc.) don't depend on selecting the Items layer first.
      if (window.electronAPI.ensureItemsFolders) {
        await window.electronAPI.ensureItemsFolders(projectPath);
      }

      const itemsResult = await window.electronAPI.listItems(projectPath);
      if (itemsResult.success && itemsResult.items) {
        setItemsList(normalizeItemsForState(itemsResult.items));
      } else {
        setItemsList([]);
      }
    } catch (error) {
      console.error('Failed to load items list:', error);
    }
  }, [normalizeItemsForState]);

  useEffect(() => {
    void refreshItemsList(currentProjectPath);
  }, [currentProjectPath, refreshItemsList]);

  useEffect(() => {
    setRulesList([]);
  }, [currentProjectPath]);

  useEffect(() => {
    if (!ruleStartType) {
      if (ruleTriggerId) {
        setRuleTriggerId('');
      }
      return;
    }

    const availableOptions = ruleStartType === 'player' ? PLAYER_TRIGGER_OPTIONS : GAME_TRIGGER_OPTIONS;
    if (!availableOptions.some(option => option.id === ruleTriggerId)) {
      setRuleTriggerId(availableOptions[0]?.id ?? '');
    }
  }, [ruleStartType, ruleTriggerId]);

  const parseConstantStock = useCallback((value?: string): Record<number, number> => {
    if (!value) return {};
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .reduce<Record<number, number>>((acc, token) => {
        const [idPart, qtyPart] = token.split(':').map((p) => p.trim());
        const id = Number.parseInt(idPart, 10);
        if (Number.isNaN(id)) return acc;
        const qty = Math.max(1, Number.parseInt(qtyPart || '1', 10) || 1);
        acc[id] = qty;
        return acc;
      }, {});
  }, []);

  const buildConstantStockString = useCallback((selection: Record<number, number>): string => {
    const entries = Object.entries(selection)
      .filter(([, qty]) => qty > 0)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([id, qty]) => `${id}:${qty}`);
    return entries.join(',');
  }, []);

  const {
    isExporting,
    exportProgress,
    showExportSuccess,
    setShowExportSuccess,
    showOverwriteDialog,
    handleOverwriteConfirm,
    handleOverwriteCancel,
    performExport,
    handleExportMap
  } = useProjectIO({
    editor,
    currentProjectPath,
    mapName,
    startingMapIntermap,
    mapObjects,
    buildConstantStockString,
    toast
  });

  const parseStatusStockEntries = useCallback((value?: string): Array<{ id: string; requirement: string; items: Record<number, number> }> => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((entry, idx) => {
          if (!entry) return null;
          const requirement = typeof entry.requirement === 'string' ? entry.requirement.trim() : '';
          const itemsObj = typeof entry.items === 'object' && entry.items !== null ? entry.items : {};
          return {
            id: entry.id || `req-${idx}`,
            requirement,
            items: Object.entries(itemsObj).reduce<Record<number, number>>((acc, [k, v]) => {
              const idNum = Number.parseInt(k, 10);
              const qtyNum = Math.max(1, Number.parseInt(String(v), 10) || 1);
              if (!Number.isNaN(idNum)) acc[idNum] = qtyNum;
              return acc;
            }, {})
          };
        })
        .filter(Boolean) as Array<{ id: string; requirement: string; items: Record<number, number> }>;
    } catch {
      return [];
    }
  }, []);

  const parseRandomStock = useCallback((value?: string): Record<number, { chance: number; min: number; max: number }> => {
    if (!value) return {};
    const tokens = value.split(',').map(t => t.trim()).filter(Boolean);
    const result: Record<number, { chance: number; min: number; max: number }> = {};
    for (let i = 0; i + 3 < tokens.length; i += 4) {
      const id = parseInt(tokens[i], 10);
      const chance = parseInt(tokens[i + 1], 10);
      const min = parseInt(tokens[i + 2], 10);
      const max = parseInt(tokens[i + 3], 10);
      if (Number.isNaN(id)) continue;
      result[id] = {
        chance: Number.isNaN(chance) ? 100 : chance,
        min: Number.isNaN(min) ? 1 : Math.max(1, min),
        max: Number.isNaN(max) ? Math.max(1, Number.isNaN(min) ? 1 : min) : Math.max(1, max)
      };
    }
    return result;
  }, []);

  const parseRandomStockCount = useCallback((value?: string): { min: number; max: number } => {
    if (!value) return { min: 1, max: 1 };
    const parts = value.split(',').map(p => p.trim()).filter(Boolean);
    const min = parts[0] ? Math.max(1, parseInt(parts[0], 10) || 1) : 1;
    const max = parts[1] ? Math.max(min, parseInt(parts[1], 10) || min) : min;
    return { min, max };
  }, []);

  const buildRandomStockString = useCallback((selection: Record<number, { chance: number; min: number; max: number }>): string => {
    const entries = Object.entries(selection)
      .filter(([, val]) => val.min > 0 && val.max > 0 && val.chance > 0)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .flatMap(([id, val]) => [id, val.chance.toString(), val.min.toString(), val.max.toString()]);
    return entries.join(', ');
  }, []);

  const buildRandomStockCountString = useCallback((count: { min: number; max: number }) => {
    return `${Math.max(1, count.min)},${Math.max(Math.max(1, count.min), count.max)}`;
  }, []);
  
  // Item Edit Dialog state
  const [showItemEditDialog, setShowItemEditDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    // Basic Identifier Properties
    id: number;
    name: string;
    role: ItemRole;
    resourceSubtype: ItemResourceSubtype;
    flavor: string;
    level: number;
    icon: string;
    quality: string;
    // Trade and Inventory Properties
    price: string;
    price_sell: string;
    max_quantity: number;
    quest_item: boolean;
    no_stash: string;
    // Equipment and Requirement Properties
    item_type: string;
    equip_flags: string;
    requires_level: number;
    requires_stat: string;
    requires_class: string;
    disable_slots: string;
    gfx: string;
    // Status and Effect Properties (Bonuses)
    bonus: string;
    bonus_power_level: string;
    // Usage and Power Properties
    dmg: string;
    abs: string;
    power: string;
    power_desc: string;
    replace_power: string;
    book: string;
    book_is_readable: boolean;
    script: string;
    // Visual and Audio Properties
    soundfx: string;
    stepfx: string;
    loot_animation: string;
    // Randomization and Loot Properties
    randomizer_def: string;
    loot_drops_max: number;
    pickup_status: string;
    // Metadata
    category: string;
    filePath: string;
    fileName: string;
  } | null>(null);
  
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
  
  // Hero position edit dialog state
  const [showHeroEditDialog, setShowHeroEditDialog] = useState(false);
  const [heroEditData, setHeroEditData] = useState<{
    currentX: number;
    currentY: number;
    mapWidth: number;
    mapHeight: number;
    onConfirm: (x: number, y: number) => void;
  } | null>(null);
  
  // Floating toolbar ref for anchored tooltip

  // Hover coordinates state
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);

  // Selection state
  const [selectionCount, setSelectionCount] = useState(0);
  const [hasSelection, setHasSelection] = useState(false);

  const { toast } = useToast();

  // Maps dropdown state (lists files from project/maps)
  const [projectMaps, setProjectMaps] = useState<string[]>([]);
  const [mapsDropdownOpen, setMapsDropdownOpen] = useState<boolean>(false);
  const mapsButtonRef = useRef<HTMLButtonElement | null>(null);
  const [mapsDropdownPos, setMapsDropdownPos] = useState<{ left: number; top: number } | null>(null);
  const mapsPortalRef = useRef<HTMLDivElement | null>(null);
  const mapsSubPortalRef = useRef<HTMLDivElement | null>(null);
  const [mapsSubPos, setMapsSubPos] = useState<{ left: number; top: number } | null>(null);
  const [mapsSubOpen, setMapsSubOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!mapsDropdownOpen) return;
    const computePos = () => {
      const btn = mapsButtonRef.current as HTMLButtonElement | null;
      if (!btn) return setMapsDropdownPos(null);
      const rect = btn.getBoundingClientRect();
      // position the menu to open upwards: set top to the button's top and use translateY(-100%) in CSS
      setMapsDropdownPos({ left: rect.left, top: rect.top - 8 });
    };
    computePos();
    window.addEventListener('resize', computePos);
    window.addEventListener('scroll', computePos, true);
    return () => {
      window.removeEventListener('resize', computePos);
      window.removeEventListener('scroll', computePos, true);
    };
  }, [mapsDropdownOpen]);

  // Compute position for the nested maps submenu so it appears to the right of the main dropdown
  useEffect(() => {
    if (!mapsSubOpen) return;
    const computeSubPos = () => {
      const portal = mapsPortalRef.current;
      if (!portal) return setMapsSubPos(null);
      const rect = portal.getBoundingClientRect();
      // place submenu to the right of the main portal with a small gap
      setMapsSubPos({ left: rect.right + 8, top: rect.top });
    };
    computeSubPos();
    window.addEventListener('resize', computeSubPos);
    window.addEventListener('scroll', computeSubPos, true);
    return () => {
      window.removeEventListener('resize', computeSubPos);
      window.removeEventListener('scroll', computeSubPos, true);
    };
  }, [mapsSubOpen]);

  // Close maps dropdown on Escape or clicking outside
  useEffect(() => {
    if (!mapsDropdownOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMapsDropdownOpen(false);
        setMapsSubOpen(false);
      }
    };
    const onMouse = (e: MouseEvent) => {
      const portal = mapsPortalRef.current;
      const subportal = mapsSubPortalRef.current;
      const btn = mapsButtonRef.current;
      const target = e.target as Node | null;
      if (!portal) return;
      if (portal.contains(target)) return;
      if (subportal && subportal.contains(target)) return;
      if (btn && btn.contains(target)) return; // clicking the button toggles; allow it
      setMapsDropdownOpen(false);
      setMapsSubOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onMouse);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onMouse);
    };
  }, [mapsDropdownOpen]);
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
  }, [syncMapObjects]);

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

  // Helper function to set up auto-save for an editor instance
const setupAutoSave = useCallback((editorInstance: TileMapEditor) => {
    // Set up optional callback for additional auto-save actions
    editorInstance.setAutoSaveCallback(async () => {
      // Persist to disk automatically when running in Electron with a project path
      try {
        if (window.electronAPI && currentProjectPath) {
          await editorInstance.saveProjectData(currentProjectPath);
        }
      } catch (e) {
        console.warn('Auto-save to disk failed:', e);
      }
      setLastSaveTime(Date.now());
    });

    editorInstance.setSaveStatusCallback((status) => {
      setSaveStatus(status);
      setHasUnsavedChanges(status === 'unsaved' || status === 'error');
    });

    editorInstance.setAutoSaveEnabled(autoSaveEnabled);
    
    // Set up eyedropper callback to switch back to brush tool
    editorInstance.setEyedropperCallback(() => {
      handleSelectTool('brush');
      setSelectedBrushTool('brush');
    });

    // Set up stamp callback to update stamps list
    editorInstance.setStampCallback((stampsList) => {
      setStamps(stampsList);
    });

    editorInstance.setObjectsChangedCallback((objects) => {
      setMapObjects(objects);
    });

    // Set up NPC right-click callback to show delete confirmation
    editorInstance.setNpcRightClickCallback((npcId, screenX, screenY) => {
      setNpcDeletePopup({ npcId, screenX, screenY });
    });

    // Set up hero edit callback to show dialog
    editorInstance.setHeroEditCallback((currentX, currentY, mapWidth, mapHeight, onConfirm) => {
      setHeroEditData({ currentX, currentY, mapWidth, mapHeight, onConfirm });
      setShowHeroEditDialog(true);
    });
}, [
    autoSaveEnabled,
    currentProjectPath,
    handleSelectTool,
    setHasUnsavedChanges,
    setHeroEditData,
    setLastSaveTime,
    setMapObjects,
    setNpcDeletePopup,
    setSaveStatus,
    setSelectedBrushTool,
    setShowHeroEditDialog,
    setStamps
  ]);

  useEffect(() => {
    setupAutoSaveRef.current = setupAutoSave;
  }, [setupAutoSave]);

  useToolbarVisibility({
    showWelcome,
    mapInitialized,
    toolbar,
    brushToolbar,
    bottomToolbar
  });

  // Wire Electron menu actions (Save/Open/New)
  // Moved after function definitions

  useEffect(() => {
    // Prepare an editor instance when entering the workspace, unless a project load is in progress
    if (
      canvasRef.current &&
      !showWelcome &&
      !editor &&
      !isOpeningProject &&
      !pendingMapConfig
    ) {
      const tileEditor = new TileMapEditor(canvasRef.current);
      tileEditor.setDarkMode(isDarkMode);
      setupAutoSave(tileEditor);

      tileEditor.resetForNewProject();
      if (mapInitialized && mapWidth > 0 && mapHeight > 0) {
        tileEditor.setMapSize(mapWidth, mapHeight);
      } else {
        tileEditor.setMapSize(0, 0);
      }

      setEditor(tileEditor);
    }
  }, [
    showWelcome,
    editor,
    setupAutoSave,
    isOpeningProject,
    isDarkMode,
    pendingMapConfig,
    mapInitialized,
    mapWidth,
    mapHeight
  ]);

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
  }, [editor]);

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
  }, [editor]);

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
  }, [updateLayersList]);

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

  // Icon helper functions
  const getBrushIcon = () => {
    switch (selectedBrushTool) {
      case 'bucket':
        return <PaintBucket className="w-4 h-4" />;
      case 'eraser':
        return <Eraser className="w-4 h-4" />;
      default:
        return <Paintbrush2 className="w-4 h-4" />;
    }
  };

  const getSelectionIcon = () => {
    switch (selectedSelectionTool) {
      case 'magic-wand':
        return <Wand2 className="w-4 h-4" />;
      case 'same-tile':
        return <Target className="w-4 h-4" />;
      case 'circular':
        return <Circle className="w-4 h-4" />;
      default:
        return <MousePointer className="w-4 h-4" />;
    }
  };

  const getShapeIcon = () => {
    switch (selectedShapeTool) {
      case 'circle':
        return <Circle className="w-4 h-4" />;
      case 'line':
        return <Pen className="w-4 h-4" />;
      default:
        return <Shapes className="w-4 h-4" />;
    }
  };

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

  // Item dialog handlers
  const handleOpenItemDialog = useCallback(async () => {
    setItemDialogState({
      name: '',
      role: 'equipment',
      resourceSubtype: 'material'
    });
    setItemDialogError(null);
  }, []);

  const handleCloseItemDialog = useCallback(() => {
    setItemDialogState(null);
    setItemDialogError(null);
  }, []);

  const handleAddRule = useCallback(() => {
    setRuleDialogError(null);
    setRuleStartType(null);
    setRuleTriggerId('');
    setRuleActionSelection(null);
    setRuleNameInput(`Rule ${rulesList.length + 1}`);
    setRuleDialogStep('start');
    setShowRuleDialog(true);
  }, [rulesList.length]);

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
    setShowRuleDialog(false);
    setRuleDialogError(null);
    setRuleNameInput('');
    setRuleStartType(null);
    setRuleTriggerId('');
    setRuleActionSelection(null);
  }, [ruleNameInput, ruleStartType, ruleTriggerId]);

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

  const handleItemFieldChange = useCallback((field: 'name' | 'role' | 'resourceSubtype', value: string) => {
    setItemDialogState((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
    setItemDialogError(null);
  }, []);

  const performCreateItem = useCallback(async (skipDuplicateCheck = false) => {
    if (!itemDialogState) return;
    
    if (!itemDialogState.name.trim()) {
      setItemDialogError('Item name is required.');
      return;
    }

    if (!currentProjectPath) {
      setItemDialogError('No project path available.');
      return;
    }

    try {
      // Pull latest items for duplicate checks
      let latestItems = itemsList;
      if (window.electronAPI?.listItems) {
        const itemsResult = await window.electronAPI.listItems(currentProjectPath);
        if (itemsResult.success && itemsResult.items) {
          latestItems = normalizeItemsForState(itemsResult.items);
          setItemsList(latestItems);
        }
      }

      const selectedCategory = 'Default';
      const selectedRole = itemDialogState.role || 'unspecified';
      const normalizedName = itemDialogState.name.trim().toLowerCase();
      if (!skipDuplicateCheck) {
        const sameCategory = latestItems.find(
          (it) => (it.category || 'Default') === selectedCategory && (it.name || '').trim().toLowerCase() === normalizedName && (it.role || 'unspecified') === selectedRole
        );
        if (sameCategory) {
          setItemDialogError(null);
          setPendingDuplicateItem({
            name: itemDialogState.name.trim(),
            targetRole: selectedRole,
            conflictRole: selectedRole,
            kind: 'same-role'
          });
          return;
        }
        const otherRole = latestItems.find(
          (it) => (it.category || 'Default') === selectedCategory && (it.name || '').trim().toLowerCase() === normalizedName && (it.role || 'unspecified') !== selectedRole
        );
        if (otherRole) {
          setPendingDuplicateItem({
            name: itemDialogState.name.trim(),
            targetRole: selectedRole,
            conflictRole: (otherRole.role as ItemRole) || 'unspecified',
            kind: 'other-role'
          });
          return;
        }
      }

      // Get next item ID
      let itemId = 1;
      if (window.electronAPI?.getNextItemId) {
        const idResult = await window.electronAPI.getNextItemId(currentProjectPath);
        if (idResult.success) {
          itemId = idResult.nextId;
        }
      }

      // Create item file
      if (window.electronAPI?.createItemFile) {
        type CreateItemPayload = Parameters<NonNullable<Window['electronAPI']>['createItemFile']>[1];
        const payload: CreateItemPayload = {
          name: itemDialogState.name.trim(),
          id: itemId,
          category: selectedCategory,
        };
        const result = await window.electronAPI.createItemFile(currentProjectPath, payload);
        
        if (result.success) {
          console.log('Item file created:', result.filePath);
          toast({ title: 'Item Created', description: `${itemDialogState.name} (ID: ${itemId}) has been created.` });
          
          // Refresh items list
          if (window.electronAPI?.listItems) {
            const itemsResult = await window.electronAPI.listItems(currentProjectPath);
            if (itemsResult.success && itemsResult.items) {
              setItemsList(normalizeItemsForState(itemsResult.items));
            }
          }
          
          handleCloseItemDialog();
        } else if (result.error) {
          setItemDialogError(result.error);
        }
      }
    } catch (err) {
      console.error('Error creating item:', err);
      setItemDialogError('Failed to create item file.');
    }
  }, [itemDialogState, currentProjectPath, handleCloseItemDialog, toast, normalizeItemsForState, itemsList]);

  const handleItemSubmit = useCallback(async () => {
    await performCreateItem(false);
  }, [performCreateItem]);

  const handleConfirmDuplicateItem = useCallback(async () => {
    setPendingDuplicateItem(null);
    await performCreateItem(true);
  }, [performCreateItem]);

  // Item Edit Dialog handlers
  const handleOpenItemEdit = useCallback(async (item: { id: number; name: string; category: string; filePath: string; fileName: string; role?: ItemRole; resourceSubtype?: ItemResourceSubtype }) => {
    // Read item file and parse all properties
    if (window.electronAPI?.readItemFile) {
      try {
        const result = await window.electronAPI.readItemFile(item.filePath);
        if (result.success && result.data) {
          const d = result.data as Record<string, unknown>;
          const itemRole = (typeof item.role === 'string' ? item.role : 'unspecified') as ItemRole;
          const isQuestRole = itemRole === 'quest';
          const roleDefaultMaxQuantity = (() => {
            if (itemRole === 'consumable') return 10;
            if (itemRole === 'resource') return 99;
            return 1;
          })();
          setEditingItem({
            id: (typeof d.id === 'number' ? d.id : item.id),
            name: (typeof d.name === 'string' ? d.name : item.name),
            role: itemRole,
            resourceSubtype: (typeof item.resourceSubtype === 'string' ? item.resourceSubtype : '') as ItemResourceSubtype,
            flavor: (typeof d.flavor === 'string' ? d.flavor : ''),
            level: (typeof d.level === 'number' ? d.level : 1),
            icon: (typeof d.icon === 'string' ? d.icon : ''),
            quality: (typeof d.quality === 'string' ? d.quality : ''),
            price: (typeof d.price === 'string' ? d.price : (typeof d.price === 'number' ? String(d.price) : '0')),
            price_sell: (typeof d.price_sell === 'string' ? d.price_sell : (typeof d.price_sell === 'number' ? String(d.price_sell) : '0')),
            max_quantity: (typeof d.max_quantity === 'number' ? d.max_quantity : roleDefaultMaxQuantity),
            quest_item: isQuestRole ? true : (d.quest_item === 'true' || d.quest_item === true),
            no_stash: (typeof d.no_stash === 'string' ? d.no_stash : 'ignore'),
            item_type: (typeof d.item_type === 'string' ? d.item_type : ''),
            equip_flags: (typeof d.equip_flags === 'string' ? d.equip_flags : ''),
            requires_level: (typeof d.requires_level === 'number' ? d.requires_level : 0),
            requires_stat: (typeof d.requires_stat === 'string' ? d.requires_stat : ''),
            requires_class: (typeof d.requires_class === 'string' ? d.requires_class : ''),
            disable_slots: (typeof d.disable_slots === 'string' ? d.disable_slots : ''),
            gfx: (typeof d.gfx === 'string' ? d.gfx : ''),
            bonus: (typeof d.bonus === 'string' ? d.bonus : ''),
            bonus_power_level: (typeof d.bonus_power_level === 'string' ? d.bonus_power_level : ''),
            dmg: (typeof d.dmg === 'string' ? d.dmg : ''),
            abs: (typeof d.abs === 'string' ? d.abs : ''),
            power: (typeof d.power === 'string' ? d.power : ''),
            power_desc: (typeof d.power_desc === 'string' ? d.power_desc : ''),
            replace_power: (typeof d.replace_power === 'string' ? d.replace_power : ''),
            book: (typeof d.book === 'string' ? d.book : ''),
            book_is_readable: d.book_is_readable === 'true' || d.book_is_readable === true,
            script: (typeof d.script === 'string' ? d.script : ''),
            soundfx: (typeof d.soundfx === 'string' ? d.soundfx : ''),
            stepfx: (typeof d.stepfx === 'string' ? d.stepfx : ''),
            loot_animation: (typeof d.loot_animation === 'string' ? d.loot_animation : ''),
            randomizer_def: (typeof d.randomizer_def === 'string' ? d.randomizer_def : ''),
            loot_drops_max: (typeof d.loot_drops_max === 'number' ? d.loot_drops_max : 1),
            pickup_status: (typeof d.pickup_status === 'string' ? d.pickup_status : ''),
            category: item.category,
            filePath: item.filePath,
            fileName: item.fileName,
          });
          setShowItemEditDialog(true);
        } else {
          // Fallback if file can't be read
          const fallbackRole = (typeof item.role === 'string' ? item.role : 'unspecified') as ItemRole;
          const fallbackMaxQuantity = (() => {
            if (fallbackRole === 'consumable') return 10;
            if (fallbackRole === 'resource') return 99;
            return 1;
          })();
          setEditingItem({
            id: item.id,
            name: item.name,
            role: fallbackRole,
            resourceSubtype: (typeof item.resourceSubtype === 'string' ? item.resourceSubtype : '') as ItemResourceSubtype,
            flavor: '',
            level: 1,
            icon: '',
            quality: '',
            price: '0',
            price_sell: '0',
            max_quantity: fallbackMaxQuantity,
            quest_item: item.role === 'quest',
            no_stash: 'ignore',
            item_type: '',
            equip_flags: '',
            requires_level: 0,
            requires_stat: '',
            requires_class: '',
            disable_slots: '',
            gfx: '',
            bonus: '',
            bonus_power_level: '',
            dmg: '',
            abs: '',
            power: '',
            power_desc: '',
            replace_power: '',
            book: '',
            book_is_readable: false,
            script: '',
            soundfx: '',
            stepfx: '',
            loot_animation: '',
            randomizer_def: '',
            loot_drops_max: 1,
            pickup_status: '',
            category: item.category,
            filePath: item.filePath,
            fileName: item.fileName,
          });
          setShowItemEditDialog(true);
        }
      } catch (err) {
        console.error('Error reading item file:', err);
        toast({ title: 'Error', description: 'Failed to read item file.', variant: 'destructive' });
      }
    }
  }, [toast]);

  const handleCloseItemEdit = useCallback(() => {
    setShowItemEditDialog(false);
    setEditingItem(null);
  }, []);

  const handleSaveItemEdit = useCallback(async () => {
    if (!editingItem || !window.electronAPI?.writeItemFile) return;
    
    // Ensure role is persisted as item_type in the saved file
    const payload = { ...editingItem, item_type: editingItem.role || editingItem.item_type };

    try {
      const result = await window.electronAPI.writeItemFile(editingItem.filePath, payload);
      if (result.success) {
        toast({ title: 'Item Saved', description: `${editingItem.name} has been updated.` });
        // Refresh items list
        if (window.electronAPI?.listItems && currentProjectPath) {
          const itemsResult = await window.electronAPI.listItems(currentProjectPath);
          if (itemsResult.success && itemsResult.items) {
            setItemsList(normalizeItemsForState(itemsResult.items));
          }
        }
        handleCloseItemEdit();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to save item.', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Error saving item:', err);
      toast({ title: 'Error', description: 'Failed to save item file.', variant: 'destructive' });
    }
  }, [editingItem, currentProjectPath, toast, handleCloseItemEdit, normalizeItemsForState]);

  const updateEditingItemField = useCallback((key: string, value: unknown) => {
    setEditingItem((prev) => (prev ? { ...prev, [key]: value } : null));
  }, [setEditingItem]);



  // NPC'yi haritaya belirli konuma yerleştir
  const handlePlaceActorOnMap = useCallback((objectId: number, x?: number, y?: number) => {
    if (!editor) return;
    const spawnX = x !== undefined ? x : Math.floor(mapWidth / 2);
    const spawnY = y !== undefined ? y : Math.floor(mapHeight / 2);
    editor.updateMapObject(objectId, { x: spawnX, y: spawnY });
    syncMapObjects();
  }, [editor, mapWidth, mapHeight, syncMapObjects]);

  // NPC'yi haritadan kaldır (database olarak tut)
  const handleUnplaceActorFromMap = useCallback((objectId: number) => {
    if (!editor) return;
    editor.updateMapObject(objectId, { x: -1, y: -1 });
    syncMapObjects();
  }, [editor, syncMapObjects]);

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
  }, [actorDialogState, editor, handleCloseActorDialog, syncMapObjects, currentProjectPath, handleEditObject]);

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

  const handleOpenVendorStockDialog = useCallback(() => {
    if (!editingObject) return;
    const parsed = parseConstantStock(editingObject.properties?.constant_stock as string | undefined);
    setVendorStockSelection(parsed);
    setShowVendorStockDialog(true);
  }, [editingObject, parseConstantStock, setShowVendorStockDialog, setVendorStockSelection]);

  const handleOpenVendorUnlockDialog = useCallback(() => {
    if (!editingObject) return;
    const parsed = parseStatusStockEntries(editingObject.properties?.status_stock_entries as string | undefined);
    if (parsed.length === 0) {
      setVendorUnlockEntries([{ id: `req-${Date.now()}`, requirement: '', items: {} }]);
    } else {
      setVendorUnlockEntries(parsed);
    }
    setShowVendorUnlockDialog(true);
  }, [editingObject, parseStatusStockEntries, setShowVendorUnlockDialog, setVendorUnlockEntries]);

  const handleOpenVendorRandomDialog = useCallback(() => {
    if (!editingObject) return;
    const parsed = parseRandomStock(editingObject.properties?.random_stock as string | undefined);
    setVendorRandomSelection(parsed);
    const parsedCount = parseRandomStockCount(editingObject.properties?.random_stock_count as string | undefined);
    setVendorRandomCount(parsedCount);
    setShowVendorRandomDialog(true);
  }, [editingObject, parseRandomStock, parseRandomStockCount, setShowVendorRandomDialog, setVendorRandomCount, setVendorRandomSelection]);

  const handleToggleVendorStockItem = useCallback((id: number) => {
    setVendorStockSelection((prev) => {
      const next = { ...prev };
      if (next[id] !== undefined) {
        delete next[id];
      } else {
        next[id] = 1;
      }
      return next;
    });
  }, []);

  const handleVendorStockQtyChange = useCallback((id: number, qty: number) => {
    setVendorStockSelection((prev) => {
      const next = { ...prev };
      if (qty <= 0) qty = 1;
      next[id] = qty;
      return next;
    });
  }, []);

  const handleSaveVendorStock = useCallback(() => {
    if (!editingObject) return;
    const constantStock = buildConstantStockString(vendorStockSelection);
    setEditingObject((prev) => {
      if (!prev) return prev;
      const properties = { ...(prev.properties || {}) };
      if (constantStock) {
        properties.constant_stock = constantStock;
      } else {
        delete properties.constant_stock;
      }
      return { ...prev, properties };
    });
    setShowVendorStockDialog(false);
  }, [editingObject, buildConstantStockString, setEditingObject, setShowVendorStockDialog, vendorStockSelection]);

  const handleAddVendorUnlockRequirement = useCallback(() => {
    setVendorUnlockEntries((prev) => [...prev, { id: `req-${Date.now()}-${Math.random()}`, requirement: '', items: {} }]);
  }, [setVendorUnlockEntries]);

  const handleUpdateVendorUnlockRequirement = useCallback((id: string, requirement: string) => {
    setVendorUnlockEntries((prev) => prev.map((entry) => entry.id === id ? { ...entry, requirement } : entry));
  }, [setVendorUnlockEntries]);

  const handleToggleVendorUnlockItem = useCallback((reqId: string, itemId: number) => {
    setVendorUnlockEntries((prev) => prev.map((entry) => {
      if (entry.id !== reqId) return entry;
      const items = { ...entry.items };
      if (items[itemId] !== undefined) {
        delete items[itemId];
      } else {
        items[itemId] = 1;
      }
      return { ...entry, items };
    }));
  }, [setVendorUnlockEntries]);

  const handleVendorUnlockQtyChange = useCallback((reqId: string, itemId: number, qty: number) => {
    setVendorUnlockEntries((prev) => prev.map((entry) => {
      if (entry.id !== reqId) return entry;
      const items = { ...entry.items };
      items[itemId] = Math.max(1, qty || 1);
      return { ...entry, items };
    }));
  }, [setVendorUnlockEntries]);

  const handleRemoveVendorUnlockRequirement = useCallback((id: string) => {
    setVendorUnlockEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, [setVendorUnlockEntries]);

  const handleSaveVendorUnlock = useCallback(() => {
    if (!editingObject) return;
    const cleaned = vendorUnlockEntries
      .map((entry, idx) => ({
        id: entry.id || `req-${idx}`,
        requirement: entry.requirement.trim(),
        items: Object.fromEntries(
          Object.entries(entry.items || {}).filter(([, qty]) => qty > 0)
        )
      }))
      .filter((entry) => entry.requirement && Object.keys(entry.items).length > 0);

    setEditingObject((prev) => {
      if (!prev) return prev;
      const properties = { ...(prev.properties || {}) };
      if (cleaned.length > 0) {
        properties.status_stock_entries = JSON.stringify(cleaned);
      } else {
        delete properties.status_stock_entries;
      }
      return { ...prev, properties };
    });
    setShowVendorUnlockDialog(false);
  }, [editingObject, setEditingObject, setShowVendorUnlockDialog, vendorUnlockEntries]);

  const handleToggleVendorRandomItem = useCallback((itemId: number) => {
    setVendorRandomSelection((prev) => {
      const next = { ...prev };
      if (next[itemId]) {
        delete next[itemId];
      } else {
        next[itemId] = { chance: 100, min: 1, max: 1 };
      }
      return next;
    });
  }, [setVendorRandomSelection]);

  const handleVendorRandomFieldChange = useCallback((itemId: number, field: 'chance' | 'min' | 'max', value: number) => {
    setVendorRandomSelection((prev) => {
      const next = { ...prev };
      const current = next[itemId] || { chance: 100, min: 1, max: 1 };
      const val = Math.max(1, value || 1);
      if (field === 'chance') {
        current.chance = val;
      } else if (field === 'min') {
        current.min = val;
        if (current.max < val) current.max = val;
      } else {
        current.max = val < current.min ? current.min : val;
      }
      next[itemId] = current;
      return next;
    });
  }, [setVendorRandomSelection]);

  const handleRandomCountChange = useCallback((field: 'min' | 'max', value: number) => {
    setVendorRandomCount((prev) => {
      const next = { ...prev };
      if (field === 'min') {
        next.min = Math.max(1, value || 1);
        if (next.max < next.min) next.max = next.min;
      } else {
        next.max = Math.max(prev.min, value || prev.min);
      }
      return next;
    });
  }, [setVendorRandomCount]);

  const handleSaveVendorRandom = useCallback(() => {
    if (!editingObject) return;
    const randomStock = buildRandomStockString(vendorRandomSelection);
    const randomStockCount = buildRandomStockCountString(vendorRandomCount);
    setEditingObject((prev) => {
      if (!prev) return prev;
      const properties = { ...(prev.properties || {}) };
      if (randomStock) {
        properties.random_stock = randomStock;
        properties.random_stock_count = randomStockCount;
      } else {
        delete properties.random_stock;
        delete properties.random_stock_count;
      }
      return { ...prev, properties };
    });
    setShowVendorRandomDialog(false);
  }, [buildRandomStockCountString, buildRandomStockString, editingObject, setEditingObject, setShowVendorRandomDialog, vendorRandomCount, vendorRandomSelection]);

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

  // Hero position edit handlers
  const handleHeroEditConfirm = useCallback((x: number, y: number) => {
    if (heroEditData?.onConfirm) {
      heroEditData.onConfirm(x, y);
    }
    setShowHeroEditDialog(false);
    setHeroEditData(null);
  }, [heroEditData]);

  const handleHeroEditCancel = useCallback(() => {
    setShowHeroEditDialog(false);
    setHeroEditData(null);
  }, []);

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
  }, [editor, handleEditObject]);

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

  // Effect to handle pending map config when canvas becomes available
  useEffect(() => {
    if (pendingMapConfig && canvasRef.current && !showWelcome) {
      console.log('Canvas available and map config pending, creating editor...');

      const createEditorWithConfig = async () => {
        try {
          console.log('Creating new editor with pending config...');
          const newEditor = new TileMapEditor(canvasRef.current!);
          if (pendingMapConfig.name) {
            newEditor.setMapName(pendingMapConfig.name);
          } else {
            newEditor.setMapName('Untitled Map');
          }

          // Clear auto-save backup to prevent old data from loading
          console.log('Clearing local storage backup...');
          newEditor.clearLocalStorageBackup();

          console.log('Setting map size...');
          newEditor.setMapSize(pendingMapConfig.width ?? 20, pendingMapConfig.height ?? 15);

          // Load project data
          console.log('Loading project data...');
          const projectDataLoaded = await loadProjectData(newEditor, pendingMapConfig);
          console.log('Project data loading result:', projectDataLoaded);

          // Check editor state after loadProjectData
          console.log('=== EDITOR STATE AFTER loadProjectData ===');
          console.log('Tile count after loadProjectData:', newEditor.getTileCount());
          console.log('Active layer after loadProjectData:', newEditor.getActiveLayerId());
          console.log('Layers after loadProjectData:', newEditor.getLayers().map(l => ({ id: l.id, name: l.name, type: l.type })));

          // Discover and assign tilesets - only for projects without per-layer tileset data
          if (window.electronAPI?.discoverTilesetImages && currentProjectPath) {
            console.log('Calling discoverTilesetImages for path:', currentProjectPath);
            const found = await window.electronAPI.discoverTilesetImages(currentProjectPath);

            const images = found?.tilesetImages || {};
            const imageKeys = Object.keys(images);

            // Check if the project already has per-layer tilesets loaded
            const hasPerLayerTilesets = Array.isArray(pendingMapConfig.tilesets) &&
              pendingMapConfig.tilesets.some((ts) => Boolean(ts?.layerType));

            console.log('Has per-layer tilesets in project:', hasPerLayerTilesets);
            console.log('Available discovered images:', imageKeys);

            // Do NOT auto-assign discovered project tileset images when loading a map.
            // Auto-assigning can cause tilesets imported in one map to appear in other maps
            // unexpectedly. Tilesets should be per-map and restored only from saved
            // project/map data. If you want automatic assignment in the future we can
            // add an explicit opt-in setting.
            if (!hasPerLayerTilesets && imageKeys.length > 0) {
              console.log('Discovered project tileset images are available but auto-assignment is disabled to preserve per-map tileset isolation.');
            }
          }

          console.log('Setting up autosave and updating UI...');
          // Set dark mode state
          newEditor.setDarkMode(isDarkMode);
          setupAutoSave(newEditor);
          setEditor(newEditor);
          setMapInitialized(true);
          setShowCreateMapDialog(false);

          // Update layers list and UI state after everything is loaded
          setTimeout(() => {
            updateLayersList();
            // Force UI state update after loading - check current active layer
            const activeLayerId = newEditor.getActiveLayerId();
            const activeLayer = newEditor.getLayers().find(l => l.id === activeLayerId);
            console.log('Final UI update - checking active layer:', activeLayerId, activeLayer?.type);

            // Force a final redraw to ensure everything is visible
            newEditor.redraw();
          }, 150);

          // Clear pending config
          setPendingMapConfig(null);

          // toast suppressed: Project loaded

        } catch (error) {
          console.error('Failed to create editor with pending config:', error);
          setPendingMapConfig(null);
          setMapInitialized(false);
          if (typeof toast === 'function') {
            const description = error instanceof Error ? error.message : 'An error occurred while loading the project.';
            toast({ title: 'Failed to open project', description, variant: 'destructive' });
          }
        }
      };

      createEditorWithConfig();
    }
  }, [
    canvasRef,
    currentProjectPath,
    isDarkMode,
    loadProjectData,
    pendingMapConfig,
    setEditor,
    setMapInitialized,
    setPendingMapConfig,
    setShowCreateMapDialog,
    showWelcome,
    setupAutoSave,
    toast,
    updateLayersList
  ]);

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
  }, [editor, currentProjectPath]);

  // Keep stable refs to the handlers so we can register IPC listeners once
  // and still call the latest handler implementations without re-registering.
  const handleManualSaveRef = useRef(handleManualSave);
  const handleOpenMapRef = useRef<typeof handleOpenMap | null>(null);
  const handleUndoRef = useRef(handleUndo);
  const handleRedoRef = useRef(handleRedo);

  useEffect(() => { handleManualSaveRef.current = handleManualSave; }, [handleManualSave]);
  useEffect(() => { handleUndoRef.current = handleUndo; }, [handleUndo]);
  useEffect(() => { handleRedoRef.current = handleRedo; }, [handleRedo]);

  // Maps helpers (moved after performExport/handleManualSave to avoid forward ref issues)
  const refreshProjectMaps = useCallback(async () => {
    if (!currentProjectPath || !window.electronAPI?.listMaps) {
      setProjectMaps([]);
      return;
    }
    try {
      const maps: string[] = await window.electronAPI.listMaps(currentProjectPath);
      setProjectMaps([...maps]);
    } catch (e) {
      console.warn('Failed to list maps:', e);
      setProjectMaps([]);
    }
  }, [currentProjectPath]);

  const handleOpenMapFromMapsFolder = useCallback(async (filename: string) => {
    if (!currentProjectPath) return;

    try {
      const exported = await performExport({ silent: true });
      if (!exported) {
        toast({ title: 'Export failed', description: 'Failed to export current map before opening a new one.', variant: 'destructive' });
        return;
      }

      await handleManualSave();

      const content = await window.electronAPI.readMapFile(currentProjectPath, filename);
      if (!content) {
        toast({ title: 'Open failed', description: `Failed to read map file ${filename}`, variant: 'destructive' });
        return;
      }

      // If editor has a loader for Flare TXT, use it. Otherwise notify user.
      if (editor && typeof editor.loadFlareMapTxt === 'function') {
        editor.loadFlareMapTxt!(content);
        editor.setMapName(filename.replace(/\.txt$/i, ''));
        updateLayersList();
        syncMapObjects();
        setMapInitialized(true);
        setMapName(filename.replace(/\.txt$/i, ''));
        toast({ title: 'Map opened', description: `Opened ${filename}` });
      } else {
        // Editor does not implement a loader yet — notify user
        toast({ title: 'Map loaded (raw)', description: 'Map content loaded but no parser available in the editor. Implement loadFlareMapTxt to parse it.' });
      }
    } catch (e) {
      console.error('Open map error:', e);
      toast({ title: 'Open failed', description: 'An unexpected error occurred while opening the map.', variant: 'destructive' });
    }
  }, [currentProjectPath, editor, handleManualSave, performExport, setMapInitialized, setMapName, syncMapObjects, toast, updateLayersList]);

  const handleToggleMinimap = () => {
    if (editor?.toggleMinimap) {
      editor.toggleMinimap();
    }
    setShowMinimap(!showMinimap);
  };

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
        setProjectMaps([]);
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
      setProjectMaps([...maps]);
      
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
    setProjectMaps,
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
      setupAutoSave,
      syncMapObjects,
      updateLayersList,
    };
  }, [handleOpenMap, loadProjectData, setupAutoSave, syncMapObjects, updateLayersList]);

  // Wire Electron menu actions (Save/Open/New)
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

    // We intentionally do not include dependencies so listeners are registered only once.
  }, []);

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

  const handleFillSelection = () => {
    if (editor) {
      editor.fillSelection();
    }
  };

  const handleClearSelection = () => {
    if (editor) {
      editor.clearSelection();
    }
  };

  const handleDeleteSelection = () => {
    if (editor) {
      editor.deleteSelection();
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
        {/* Left Sidebar */}
        <SidebarLayout leftCollapsed={leftCollapsed}>
          {/* Hover handle / visual affordance when collapsed (removed) */}
          {/* collapse toggle is provided on the outer edge (see edge button) */}
          {/* Tileset Brushes Section */}
          <section className="flex flex-col flex-1">
            {/* If this is an NPC, Enemy, Event, Rules, or Items layer render a header and controls */}
            {(isNpcLayer || isEnemyLayer) && (
              <SidebarActorEntries
                isNpcLayer={isNpcLayer}
                isEnemyLayer={isEnemyLayer}
                actorEntries={actorEntries}
                leftCollapsed={leftCollapsed}
                draggingNpcId={draggingNpcId}
                onEditObject={handleEditObject}
                onHover={(position) => setNpcHoverTooltip(position)}
                onHoverEnd={() => setNpcHoverTooltip(null)}
                onDragStart={handleNpcDragStart}
                onDragEnd={handleNpcDragEnd}
                onAddNpc={() => handleOpenActorDialog('npc')}
                onAddEnemy={() => handleOpenActorDialog('enemy')}
              />
            )}



            {/* Rules Layer - list and add button (similar UX to NPC layer) */}
            {isRulesLayer && (
              <SidebarRulesPanel
                rulesList={rulesList}
                onAddRule={handleAddRule}
              />
            )}

            {/* Items Layer - Add Item button only */}
            {isItemsLayer && (
              <SidebarItemsPanel
                itemsList={itemsList}
                expandedItemCategories={expandedItemCategories}
                setExpandedItemCategories={setExpandedItemCategories}
                onOpenItemEdit={handleOpenItemEdit}
                onAddItem={handleOpenItemDialog}
              />
            )}

            {/* Tileset Brushes Window - render for all layers except NPC, Enemy, Items, Rules, and Actions */}
            {!isNpcLayer && !isEnemyLayer && !isItemsLayer && !isRulesLayer && (
              <TilesetPalette
                editor={editor}
                activeLayer={activeLayer}
                tabTick={tabTick}
                setTabTick={setTabTick}
                brushTool={brushTool}
              />
            )}
            {/* Brush Tools - stick to bottom so palette can fill remaining space */}
            {!isNpcLayer && !isEnemyLayer && !isItemsLayer && !isRulesLayer && (
              <BrushToolbar
                editor={editor}
                activeLayer={activeLayer}
                isCollisionLayer={isCollisionLayer}
                brushTool={brushTool}
                brushToolbarExpanded={brushToolbarExpanded}
                showBrushToolbarTemporarily={showBrushToolbarTemporarily}
                setTabTick={setTabTick}
                setBrushToolbarNode={setBrushToolbarNode}
                onOpenActorDialog={handleOpenActorDialog}
                onFileUpload={handleFileUpload}
                onToggleBrushTool={handleToggleBrushTool}
                onDeleteActiveTab={handleDeleteActiveTab}
                toast={toast}
              />
            )}
          </section>

          {/* Layers Section */}
          <section
            className="mb-0 flex-shrink-0 flex flex-col justify-center h-auto" // auto height to fit all layers
            onMouseEnter={() => setLayersPanelExpanded(true)}
            onMouseLeave={() => setLayersPanelExpanded(false)}
            tabIndex={0}
          >
            {/* Layers List - reserve height to avoid layout shifts */}
            <div className="mb-2 w-full flex flex-col justify-center h-full">
              <div className="h-auto overflow-hidden flex flex-col justify-center w-full">
                <div className="space-y-0.5 h-auto overflow-y-visible flex flex-col justify-center w-full">
                  {layers.filter(layer => layer.type !== 'actions').map((layer) => {
                    const isActive = activeLayerId === layer.id;
                    const isHovered = hoveredLayerId === layer.id;
                    const visible = layersPanelExpanded || isActive;
                    return (
                      <div
                        key={layer.id}
                        className={`block w-full max-w-xs px-2 py-1 rounded transition-all text-xs transform-gpu ${
                          isActive
                            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400'
                            : isHovered
                            ? 'bg-orange-100/50 dark:bg-orange-800/15 border-orange-300/50'
                            : 'bg-transparent border-transparent'
                        }`}
                        style={{
                          opacity: visible ? 1 : 0.65,
                          transform: visible ? 'scaleY(1) translateY(0)' : 'scaleY(0.98) translateY(0)',
                          transformOrigin: 'top',
                          pointerEvents: visible ? 'auto' : 'none',
                          transition: 'transform 400ms cubic-bezier(.2,.9,.2,1), opacity 400ms ease, box-shadow 300ms ease, background-color 150ms ease',
                          boxShadow: isActive ? '0 6px 12px rgba(15,23,42,0.06)' : isHovered ? '0 2px 6px rgba(251,146,60,0.15)' : 'none',
                          zIndex: isActive ? 30 : isHovered ? 20 : 10,
                        }}
                        onMouseEnter={() => setHoveredLayerId(layer.id)}
                        onMouseLeave={() => setHoveredLayerId(null)}
                      >
                        <div
                          className="cursor-pointer w-full flex items-center"
                          onClick={() => handleSetActiveLayer(layer.id)}
                        >
                          <div className={`flex items-center gap-2 w-full ${isActive ? 'opacity-100' : isHovered ? 'opacity-95' : 'opacity-80'}`}> 
                            <Tooltip content={layer.visible ? 'Hide layer' : 'Show layer'}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleLayerVisibility(layer.id);
                                }}
                                className="w-4 h-4 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                              >
                                {layer.visible ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5 text-gray-400 dark:text-gray-500" />}
                              </Button>
                            </Tooltip>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-4 h-4 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                              onMouseEnter={(e) => {
                                const transparencyPercent = Math.round((layer.transparency || 0) * 100);
                                showTooltipWithDelay(
                                  <div className="flex items-center gap-1">
                                    <Mouse className="w-3 h-3" />
                                    Transparency ({transparencyPercent}%)
                                  </div>,
                                  e.currentTarget
                                );
                              }}
                              onMouseLeave={hideTooltip}
                              onWheel={(e) => {
                                e.preventDefault();
                                const delta = e.deltaY > 0 ? 0.1 : -0.1;
                                handleLayerTransparencyChange(layer.id, delta);
                                const currentTransparency = layer.transparency || 0;
                                const newTransparency = Math.max(0, Math.min(1, currentTransparency + delta));
                                const newPercent = Math.round(newTransparency * 100);
                                showTooltipWithDelay(
                                  <div className="flex items-center gap-1">
                                    <Mouse className="w-3 h-3" />
                                    Transparency ({newPercent}%)
                                  </div>,
                                  e.currentTarget
                                );
                              }}
                            >
                              <Blend className="w-2.5 h-2.5" />
                            </Button>

                            <div className="flex items-center gap-2">
                              <Tooltip content={layer.type === 'rules' ? 'When this happens → do this' : layer.name}>
                                <span className="text-xs font-medium truncate flex items-center gap-2">
                                  {(() => {
                                    switch ((layer.type || '').toLowerCase()) {
                                      case 'background':
                                      case 'bg':
                                        return <Image className="w-4 h-4" />;
                                      case 'collision':
                                      case 'collision layer':
                                        return <Grid className="w-4 h-4" />;
                                      case 'objects':
                                      case 'object':
                                        return <Box className="w-4 h-4" />;
                                      case 'items':
                                        return <Sword className="w-4 h-4" />;
                                      case 'rules':
                                        return <GitBranch className="w-4 h-4" />;
                                      case 'npc':
                                        return <Users className="w-4 h-4" />;
                                      case 'enemy':
                                        return <Locate className="w-4 h-4" />;
                                      case 'event':
                                        return <Clock className="w-4 h-4" />;
                                      default:
                                        return <Map className="w-4 h-4" />;
                                    }
                                  })()}
                                </span>
                              </Tooltip>
                              <span className={leftCollapsed ? 'sr-only text-xs font-medium' : 'text-xs font-medium truncate'} title={layer.name}>
                                {layer.name.replace(/ Layer$/i, '')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Bottom Action Buttons */}
          <section className="flex-shrink-0 mt-auto mb-2">
            {/* Export Loading Bar - reserve space */}
            <div className="w-full h-1.5 mb-2">
              {isExporting ? (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-orange-600 h-full transition-all duration-1000 ease-out rounded-full"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
              ) : (
                <div className="w-full h-full" />
              )}
            </div>

            <div className={`flex gap-2 justify-center`}>
              <div>
                <Button
                  ref={mapsButtonRef}
                  size="sm"
                  className="w-7 h-7 p-0 shadow-sm"
                  onClick={async () => {
                    if (!mapsDropdownOpen) await refreshProjectMaps();
                    setMapsDropdownOpen((s) => !s);
                  }}
                  disabled={isExporting || isPreparingNewMap}
                >
                  <Menu className="w-3 h-3" />
                </Button>

                {mapsDropdownOpen && mapsDropdownPos && createPortal(
                  <div
                    ref={mapsPortalRef}
                    style={{ left: mapsDropdownPos.left, top: mapsDropdownPos.top, position: 'absolute', transform: 'translateY(-100%)' }}
                    className="w-56 bg-background border border-border rounded shadow-lg z-[9999]"
                  >
                    {/* Actions header removed per UX request */}
                    <div className="max-h-60 overflow-y-auto minimal-scroll">
                      {currentProjectPath ? (
                        <>
                          <div className="relative">
                            <button
                              className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 text-xs flex items-center gap-2"
                              onClick={() => setMapsSubOpen((s) => !s)}
                            >
                              <span className="flex items-center gap-2"><Folder className="w-3 h-3" /><span>Open map</span></span>
                              <svg className={`w-3 h-3 transition-transform ${mapsSubOpen ? 'transform rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                            </button>

                            {/* nested maps list: render into a separate portal to appear to the right */}
                            {mapsSubOpen && mapsSubPos && createPortal(
                              <div
                                ref={mapsSubPortalRef}
                                style={{ left: mapsSubPos.left, top: mapsSubPos.top, position: 'absolute' }}
                                className="w-48 bg-background border border-border rounded shadow-md z-[10000] max-h-60 overflow-y-auto minimal-scroll"
                              >
                                {projectMaps.length === 0 ? (
                                  <div className="p-2 text-xs text-muted-foreground">No maps found</div>
                                ) : (
                                  projectMaps.map((f) => (
                                    <button
                                      key={f}
                                      className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 text-xs"
                                      onClick={() => {
                                        setMapsDropdownOpen(false);
                                        setMapsSubOpen(false);
                                        handleOpenMapFromMapsFolder(f);
                                      }}
                                    >
                                      {f}
                                    </button>
                                  ))
                                )}
                              </div>, document.body
                            )}
                          </div>

                          <div className="border-t border-border" />

                          <button
                            className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 text-xs flex items-center gap-2"
                            onClick={async () => {
                              setMapsDropdownOpen(false);
                              await handleExportMap();
                            }}
                          >
                            <Download className="w-3 h-3" />
                            <span>Export map</span>
                          </button>

                          <div className="border-t border-border" />

                          <button
                            className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 text-xs flex items-center gap-2"
                            onClick={() => {
                              setMapsDropdownOpen(false);
                              handleOpenCreateMapDialog();
                            }}
                          >
                            <Plus className="w-3 h-3" />
                            <span>Create new map</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 text-xs flex items-center gap-2"
                            onClick={async () => {
                              setMapsDropdownOpen(false);
                              if (window.electronAPI?.selectDirectory) {
                                try {
                                  const selected = await window.electronAPI.selectDirectory();
                                  if (selected) {
                                    await handleOpenMap(selected);
                                  }
                                } catch (err) {
                                  console.error('Failed to select directory:', err);
                                  toast({ title: 'Open failed', description: 'Unable to open project directory.', variant: 'destructive' });
                                }
                              } else {
                                toast({ title: 'Open unavailable', description: 'Open project requires the desktop app.', variant: 'destructive' });
                              }
                            }}
                          >
                            <Folder className="w-3 h-3" />
                            <span>Open project...</span>
                          </button>

                          <div className="border-t border-border" />

                          <div className="p-2 text-xs">No project is currently open. Open a project to list maps and enable Export.</div>

                          <div className="border-t border-border" />

                          <button
                            className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 text-xs flex items-center gap-2"
                            onClick={() => {
                              setMapsDropdownOpen(false);
                              // Open the create map dialog in-app as fallback for creating a new map without an existing project
                              handleOpenCreateMapDialog();
                            }}
                          >
                            <Plus className="w-3 h-3" />
                            <span>Create new map</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>, document.body
                )}
              </div>

              <Tooltip content={hasUnsavedChanges ? 'Save changes' : 'All changes saved'}>
                <Button
                  onClick={handleManualSave}
                  className={`w-7 h-7 p-0 shadow-sm transition-colors ${
                    isManuallySaving ? 'bg-blue-500 hover:bg-blue-600' : hasUnsavedChanges ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                  disabled={isManuallySaving || isPreparingNewMap}
                  size="sm"
                >
                  {isManuallySaving ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                </Button>
              </Tooltip>

              {/* Help button moved into Settings > Other Options */}

              <Tooltip content="Engine Settings">
                <Button onClick={() => setShowSettings(true)} className="w-7 h-7 p-0 shadow-sm" variant="outline" size="sm">
                  <Settings className="w-3 h-3" />
                </Button>
              </Tooltip>
            </div>
          </section>
        </SidebarLayout>

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

        {/* Generic Confirmation Dialog for destructive actions */}
        {confirmAction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-background border border-border rounded-lg p-6 w-80">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Confirm</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setConfirmAction(null)}
                  className="w-8 h-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-sm text-foreground mb-4">
                {confirmAction.type === 'removeBrush' && 'Are you sure you want to remove this brush?'}
                {confirmAction.type === 'removeTileset' && 'Are you sure you want to remove the tileset for this layer? This will clear the tileset but keep any placed tiles.'}
                {confirmAction.type === 'removeTab' && 'Are you sure you want to remove this tileset tab?'}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
                <Button
                  onClick={() => {
                    try {
                      if (confirmAction.type === 'removeBrush') {
                        const brushId = confirmAction.payload as number;
                        if (editor) editor.removeBrush(brushId);
                      } else if (confirmAction.type === 'removeTileset') {
                        if (editor) editor.removeLayerTileset();
                      } else if (confirmAction.type === 'removeTab') {
                        // Prefer the stable React state if present
                        const payload = tabToDelete ?? confirmPayloadRef.current ?? (confirmAction.payload as { layerType: string; tabId: number } | undefined);
                        if (editor && payload && payload.layerType) {
                          // At confirmation time prefer the editor's current active tab for that layer
                          const liveActive = editor.getActiveLayerTabId ? editor.getActiveLayerTabId(payload.layerType) : null;
                          const finalTabId = (typeof liveActive === 'number' && liveActive !== null) ? liveActive : payload.tabId;
                          console.info('Confirm removeTab: requested=', payload, 'liveActive=', liveActive, 'using=', finalTabId);
                          if (typeof finalTabId === 'number') {
                            editor.removeLayerTab(payload.layerType, finalTabId);
                            // Force UI update and refresh palette
                            setTabTick(t => t + 1);
                            try { editor.refreshTilePalette(true); } catch (err) { console.warn('refreshTilePalette failed', err); }

                            // Extra safeguard: explicitly set the editor's active tab to the new live active
                            try {
                              const newActive = editor.getActiveLayerTabId ? editor.getActiveLayerTabId(payload.layerType) : null;
                              if (typeof newActive === 'number') {
                                editor.setActiveLayerTab(payload.layerType, newActive);
                                // one more refresh to ensure palette content is synced
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
                        // Clear the state/ref after handling
                        setTabToDelete(null);
                        confirmPayloadRef.current = null;
                      }
                    } catch (error) {
                      console.error('Confirm action failed:', error);
                    } finally {
                      setConfirmAction(null);
                    }
                  }}
                >
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        )}

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
          <div
            ref={toolbarContainerRef}
            className="absolute top-2 right-2 z-10"
            onMouseEnter={handleToolbarMouseEnter}
            onMouseLeave={handleToolbarMouseLeave}
            onFocus={handleToolbarFocus}
            onBlur={handleToolbarBlur}
            tabIndex={toolbarExpanded ? -1 : 0}
            aria-label="Map controls"
          >
            <div
              className={`flex items-center bg-white/90 dark:bg-neutral-900/90 border border-border rounded-full shadow-lg transition-all duration-300 ease-in-out ${toolbarExpanded ? 'px-2 py-1' : 'px-1 py-1'}`}
            >
              <div
                className={`flex items-center gap-1 overflow-hidden transition-all duration-300 ease-out ${toolbarExpanded ? 'opacity-100 scale-100 max-w-[420px]' : 'opacity-0 scale-95 max-w-0 pointer-events-none'}`}
              >
                <Tooltip content="Undo (Ctrl+Z)" side="bottom">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-8 h-8 p-0 rounded-full"
                    onClick={handleUndo}
                  >
                    <Undo2 className="w-4 h-4" />
                  </Button>
                </Tooltip>
                <Tooltip content="Redo (Ctrl+Y)" side="bottom">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-8 h-8 p-0 rounded-full"
                    onClick={handleRedo}
                  >
                    <Redo2 className="w-4 h-4" />
                  </Button>
                </Tooltip>
                <Tooltip content="Zoom In" side="bottom">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-8 h-8 p-0 rounded-full"
                    onClick={handleZoomIn}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </Tooltip>
                <Tooltip content="Zoom Out" side="bottom">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-8 h-8 p-0 rounded-full"
                    onClick={handleZoomOut}
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                </Tooltip>
                <Tooltip content="Reset View" side="bottom">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-8 h-8 p-0 rounded-full"
                    onClick={handleResetZoom}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </Tooltip>
                <Tooltip content="Toggle Minimap" side="bottom">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-8 h-8 p-0 rounded-full"
                    onClick={handleToggleMinimap}
                  >
                    <Map className="w-4 h-4" />
                  </Button>
                </Tooltip>
              </div>
              <div
                className={`flex items-center justify-center w-8 h-8 transition-all duration-300 ease-out ${toolbarExpanded ? 'opacity-50 scale-90' : 'opacity-100 scale-100'}`}
                aria-hidden
              >
                <Scan className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        )}
          <div 
            className={`bg-gray-100 flex-1 min-h-0 flex items-center justify-center overflow-hidden relative ${draggingNpcId ? 'ring-2 ring-orange-500 ring-inset' : ''}`}
            onDragOver={(e) => {
              if (draggingNpcId && editor) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                // Update NPC drag hover highlight on map
                const canvas = canvasRef.current;
                if (canvas) {
                  const rect = canvas.getBoundingClientRect();
                  const canvasX = e.clientX - rect.left;
                  const canvasY = e.clientY - rect.top;
                  editor.setNpcDragHover(canvasX, canvasY);
                }
              }
            }}
            onDragLeave={() => {
              // Clear hover when leaving the canvas area
              if (draggingNpcId && editor) {
                editor.clearNpcDragHover();
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const npcIdStr = e.dataTransfer.getData('npc-id');
              if (!npcIdStr || !editor) return;
              
              const npcId = parseInt(npcIdStr, 10);
              if (isNaN(npcId)) return;
              
              // Canvas üzerindeki koordinatları hesapla
              const canvas = canvasRef.current;
              if (!canvas) return;
              
              const rect = canvas.getBoundingClientRect();
              const canvasX = e.clientX - rect.left;
              const canvasY = e.clientY - rect.top;
              
              // Screen koordinatlarını map koordinatlarına çevir (aynı fonksiyon hover'da kullanılan)
              const mapCoords = editor.screenToTile(canvasX, canvasY);
              if (mapCoords && mapCoords.x >= 0 && mapCoords.x < mapWidth && mapCoords.y >= 0 && mapCoords.y < mapHeight) {
                handlePlaceActorOnMap(npcId, mapCoords.x, mapCoords.y);
              }
              
              // Clear the hover highlight
              editor.clearNpcDragHover();
              setDraggingNpcId(null);
            }}
          >
            {/* Canvas Tips Panel - minimizes to question mark icon with animation */}
            {!isEnemyTabActive && (
            <div className="absolute top-4 left-4 z-20">
              {/* Minimized state: Question mark icon in a circle */}
              <div 
                className={`absolute inset-0 transition-all duration-300 ${tipsMinimized ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-75 pointer-events-none'}`}
              >
                <Tooltip content="Click to see help" side="right">
                  <button
                    className="w-8 h-8 flex items-center justify-center bg-white dark:bg-neutral-900 rounded-full border border-border shadow-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all duration-200 hover:scale-105"
                    onClick={() => setTipsMinimized(false)}
                    aria-label="Show help tips"
                  >
                    <HelpCircle className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </button>
                </Tooltip>
              </div>

              {/* Expanded state: Full tips panel */}
              <div
                className={`p-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-lg border border-border shadow-lg transition-all duration-300 origin-top-left ${tipsMinimized ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100 pointer-events-auto'}`}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 w-6 h-6 p-0"
                  onClick={() => setTipsMinimized(true)}
                >
                  <X className="w-3 h-3" />
                </Button>

                <div className="space-y-2 pr-6">
                  <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <MousePointer2 className="w-4 h-4" />
                    <span>Left Click to Paint</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <Mouse className="w-4 h-4" />
                    <span>Right Click to Delete</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <Move className="w-4 h-4" />
                    <span>Spacebar + Mouse to Pan</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <div className="relative">
                      <Mouse className="w-4 h-4" />
                      <Circle className="w-2 h-2 absolute top-1 left-1.5 opacity-60" />
                    </div>
                    <span>Mouse Wheel to Zoom In-Out</span>
                  </div>
                  <button
                    className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 hover:text-orange-500 transition-colors w-full text-left mt-1 pt-1 border-t border-gray-100 dark:border-neutral-800"
                    onClick={() => setShowHelp(true)}
                  >
                    <HelpCircle className="w-4 h-4 text-orange-400" />
                    <span className="font-medium">Help and Documentation</span>
                  </button>
                </div>
              </div>
            </div>
            )}

            <canvas
              ref={canvasRef}
              id="mapCanvas"
              className={`tile-canvas w-full h-full max-w-full max-h-full canvas-fade ${leftTransitioning ? 'during-sidebar-transition' : ''}`}
            />

            {/* Map initialization overlay - always mounted for smooth transitions */}
            <div
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${!mapInitialized ? 'opacity-100 pointer-events-auto bg-background/80 backdrop-blur-sm' : 'opacity-0 pointer-events-none'}`}
              aria-hidden={mapInitialized}
            >
              <div className={`flex items-center gap-3 px-4 py-2 rounded-full border-2 border-orange-500/80 bg-background/95 shadow-lg backdrop-blur-sm transition-opacity duration-200 ${!mapInitialized ? 'opacity-100' : 'opacity-0'}`}>
                <span className="text-sm font-medium text-muted-foreground">Create a map</span>
                <Button
                  size="sm"
                  variant="default"
                  className="w-9 h-9 p-0 rounded-full bg-orange-500 text-white shadow-sm transition-all duration-150 hover:bg-orange-600 hover:shadow-md hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
                  onClick={handleOpenCreateMapDialog}
                  disabled={isPreparingNewMap}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Hover Coordinates Display - always mounted to allow transitions */}
            <div
              className={`absolute bottom-4 left-4 z-10 p-2 rounded-md text-xs font-mono flex items-center gap-2 transition-opacity duration-200 ${hoverCoords ? 'opacity-100 pointer-events-auto bg-white/90 dark:bg-neutral-900/90 border border-gray-200 dark:border-neutral-600 text-gray-800 dark:text-white shadow-sm' : 'opacity-0 pointer-events-none'}`}
              aria-hidden={!hoverCoords}
            >
              <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span>{hoverCoords ? `${hoverCoords.x}, ${hoverCoords.y}` : ''}</span>
              {/* Active GID Indicator - keep mounted but toggle visibility */}
              <div className={`ml-2 transition-opacity duration-200 ${hoverCoords && showActiveGid && !isEnemyTabActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <Tooltip content="Active GID number of selected tilebrush">
                  <Badge variant="secondary" className="text-xs px-2 py-1 bg-black/80 text-white border-gray-600 hover:bg-black/90">
                    <span id="activeGid">{activeGid}</span>
                  </Badge>
                </Tooltip>
              </div>
            </div>

            {/* NPC Delete Confirmation Popup */}
            {npcDeletePopup && (
              <div
                className="fixed z-50 flex items-center gap-1 px-2 py-1.5 bg-black rounded-lg shadow-xl border border-neutral-700"
                style={{
                  left: npcDeletePopup.screenX,
                  top: npcDeletePopup.screenY,
                  transform: 'translate(-50%, -120%)'
                }}
              >
                <span className="text-white text-xs font-medium mr-1">Remove NPC?</span>
                <button
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-neutral-700 transition-colors"
                  onClick={() => {
                    handleUnplaceActorFromMap(npcDeletePopup.npcId);
                    setNpcDeletePopup(null);
                  }}
                  title="Confirm"
                >
                  <Check className="w-4 h-4 text-emerald-500" />
                </button>
                <button
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-neutral-700 transition-colors"
                  onClick={() => setNpcDeletePopup(null)}
                  title="Cancel"
                >
                  <X className="w-4 h-4 text-red-500" />
                </button>
              </div>
            )}

            {/* NPC Hover Tooltip - follows cursor */}
            {npcHoverTooltip && (
              <div
                className="fixed z-50 px-2 py-1 bg-black/90 text-white text-xs rounded shadow-lg pointer-events-none flex items-center gap-1.5"
                style={{
                  left: npcHoverTooltip.x + 12,
                  top: npcHoverTooltip.y + 12
                }}
              >
                <MousePointer className="w-3 h-3" />
                <span>Click to Edit</span>
              </div>
            )}

            {/* Selection Info Display - keep mounted to avoid reflows */}
            <div className={`absolute bottom-4 left-32 z-10 p-2 rounded-md text-xs flex items-center gap-3 transition-opacity duration-200 ${hasSelection ? 'opacity-100 pointer-events-auto bg-orange-600/90 border border-orange-500 text-white' : 'opacity-0 pointer-events-none'}`}>
              <div className="flex items-center gap-2 font-mono">
                <Square className="w-4 h-4 text-orange-200" />
                <span>{hasSelection ? `${selectionCount} tiles selected` : ''}</span>
              </div>
              <div className={`flex items-center gap-1 ${hasSelection ? '' : 'pointer-events-none'}`}>
                <Tooltip content="Fill selection with active tile">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 px-2 text-xs text-white hover:bg-orange-500/50"
                    onClick={handleFillSelection}
                  >
                    Fill
                  </Button>
                </Tooltip>
                <Tooltip content="Delete selected tiles (DEL)">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 px-2 text-xs text-white hover:bg-orange-500/50"
                    onClick={handleDeleteSelection}
                  >
                    Delete
                  </Button>
                </Tooltip>
                <Tooltip content="Clear selection (ESC)">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 px-2 text-xs text-white hover:bg-orange-500/50"
                    onClick={handleClearSelection}
                  >
                    Clear
                  </Button>
                </Tooltip>
              </div>
            </div>
            {/* Floating Toolbar (inside canvas, centered, pill-sized) */}
            <BottomToolbar
              bottomToolbarExpanded={bottomToolbarExpanded}
              setBottomToolbarNode={setBottomToolbarNode}
              onMouseEnter={handleBottomToolbarMouseEnter}
              onMouseLeave={handleBottomToolbarMouseLeave}
              onFocus={handleBottomToolbarFocus}
              onBlur={handleBottomToolbarBlur}
              selectedTool={selectedTool}
              handleSelectTool={handleSelectTool}
              showBrushOptions={showBrushOptions}
              handleShowBrushOptions={handleShowBrushOptions}
              handleHideBrushOptions={handleHideBrushOptions}
              selectedBrushTool={selectedBrushTool}
              setSelectedBrushTool={setSelectedBrushTool}
              showTooltipWithDelay={showTooltipWithDelay}
              hideTooltip={hideTooltip}
              setShowClearLayerDialog={setShowClearLayerDialog}
              getBrushIcon={getBrushIcon}
              showSelectionOptions={showSelectionOptions}
              handleShowSelectionOptions={handleShowSelectionOptions}
              handleHideSelectionOptions={handleHideSelectionOptions}
              selectedSelectionTool={selectedSelectionTool}
              setSelectedSelectionTool={setSelectedSelectionTool}
              getSelectionIcon={getSelectionIcon}
              showShapeOptions={showShapeOptions}
              handleShowShapeOptions={handleShowShapeOptions}
              handleHideShapeOptions={handleHideShapeOptions}
              selectedShapeTool={selectedShapeTool}
              setSelectedShapeTool={setSelectedShapeTool}
              getShapeIcon={getShapeIcon}
              stampMode={stampMode}
              setStampMode={setStampMode}
              newStampName={newStampName}
              setNewStampName={setNewStampName}
              handleCreateStamp={handleCreateStamp}
              stamps={stamps}
              selectedStamp={selectedStamp}
              handleStampSelect={handleStampSelect}
              handleDeleteStamp={handleDeleteStamp}
            />
          </div>
        </section>
        )}
      </main>
      
      <Toaster />
      
      <SeparateBrushDialog
        open={showSeparateDialog}
        onOpenChange={setShowSeparateDialog}
        onConfirm={confirmSeparateBrush}
      />

      <VendorDialogs
        itemsList={itemsList}
        showVendorUnlockDialog={showVendorUnlockDialog}
        setShowVendorUnlockDialog={setShowVendorUnlockDialog}
        vendorUnlockEntries={vendorUnlockEntries}
        handleUpdateVendorUnlockRequirement={handleUpdateVendorUnlockRequirement}
        handleRemoveVendorUnlockRequirement={handleRemoveVendorUnlockRequirement}
        handleToggleVendorUnlockItem={handleToggleVendorUnlockItem}
        handleVendorUnlockQtyChange={handleVendorUnlockQtyChange}
        handleAddVendorUnlockRequirement={handleAddVendorUnlockRequirement}
        handleSaveVendorUnlock={handleSaveVendorUnlock}
        showVendorRandomDialog={showVendorRandomDialog}
        setShowVendorRandomDialog={setShowVendorRandomDialog}
        vendorRandomSelection={vendorRandomSelection}
        handleToggleVendorRandomItem={handleToggleVendorRandomItem}
        handleVendorRandomFieldChange={handleVendorRandomFieldChange}
        vendorRandomCount={vendorRandomCount}
        handleRandomCountChange={handleRandomCountChange}
        handleSaveVendorRandom={handleSaveVendorRandom}
        showVendorStockDialog={showVendorStockDialog}
        setShowVendorStockDialog={setShowVendorStockDialog}
        vendorStockSelection={vendorStockSelection}
        handleToggleVendorStockItem={handleToggleVendorStockItem}
        handleVendorStockQtyChange={handleVendorStockQtyChange}
        handleSaveVendorStock={handleSaveVendorStock}
      />

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
          setShowRuleDialog(false);
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
        dialogueTrees={dialogueTrees}
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

      {/* Export Success Modal */}
      {showExportSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-black rounded-lg shadow-xl p-6 max-w-md mx-4 relative">
            {/* Close button */}
            <button
              onClick={() => setShowExportSuccess(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            {/* Content */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                Export Successful
              </h3>
            </div>
            
            <p className="text-gray-300 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 font-medium text-white">
                <Folder className="w-4 h-4" />
              </span>
              Project exported to project folder.
            </p>
          </div>
        </div>
      )}

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
