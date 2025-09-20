import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Tooltip from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Upload, Download, Undo2, Redo2, X, ZoomIn, ZoomOut, RotateCcw, Map, Minus, Square, Settings, Mouse, MousePointer2, Eye, EyeOff, Move, Circle, Paintbrush2, PaintBucket, Eraser, MousePointer, Wand2, Target, Shapes, Pen, Stamp, Pipette, Sun, Moon, Blend, MapPin, Save, Scan, Link2, Scissors, Trash2, Check, HelpCircle, Folder, Shield, Plus } from 'lucide-react';
import { TileMapEditor } from './editor/TileMapEditor';
import { TileLayer, MapObject } from './types';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import WelcomeScreen from './components/WelcomeScreen';

interface MapConfig {
  name: string;
  width: number;
  height: number;
  tileSize: number;
  location: string;
  isStartingMap?: boolean;
}

type PropertyType =
  | 'string'
  | 'int'
  | 'float'
  | 'bool'
  | 'filename'
  | 'duration'
  | 'intPair'
  | 'floatPair'
  | 'direction'
  | 'point'
  | 'list'
  | 'predefined';

interface PropertySpec {
  type: PropertyType;
  min?: number;
  max?: number;
  options?: string[];
}

const ENEMY_PROPERTY_SPECS: Record<string, PropertySpec> = {
  xp: { type: 'int', min: 0 },
  xp_scaling: { type: 'filename' },
  defeat_status: { type: 'string' },
  convert_status: { type: 'string' },
  first_defeat_loot: { type: 'int', min: 1 },
  animations: { type: 'filename' },
  loot: { type: 'list' },
  loot_count: { type: 'intPair', min: 0 },
  threat_range: { type: 'floatPair', min: 0 },
  flee_range: { type: 'float', min: 0 },
  chance_pursue: { type: 'float', min: 0 },
  chance_flee: { type: 'float', min: 0 },
  waypoint_pause: { type: 'duration' },
  turn_delay: { type: 'duration' },
  combat_style: { type: 'predefined', options: ['default', 'aggressive', 'passive'] },
  power: { type: 'list' },
  passive_powers: { type: 'list' },
  quest_loot: { type: 'list' },
  flee_duration: { type: 'duration' },
  flee_cooldown: { type: 'duration' },
  humanoid: { type: 'bool' },
  lifeform: { type: 'bool' },
  flying: { type: 'bool' },
  intangible: { type: 'bool' },
  facing: { type: 'bool' },
  suppress_hp: { type: 'bool' }
};

const NPC_PROPERTY_SPECS: Record<string, PropertySpec> = {
  'dialog.id': { type: 'string' },
  'dialog.topic': { type: 'string' },
  'dialog.group': { type: 'string' },
  'dialog.voice': { type: 'list' },
  'dialog.him': { type: 'list' },
  'dialog.her': { type: 'list' },
  'dialog.you': { type: 'list' },
  'dialog.portrait_him': { type: 'list' },
  'dialog.portrait_her': { type: 'list' },
  'dialog.portrait_you': { type: 'list' },
  'dialog.response': { type: 'list' },
  'dialog.allow_movement': { type: 'bool' },
  'dialog.take_a_party': { type: 'bool' },
  'dialog.response_only': { type: 'bool' },
  'npc.name': { type: 'string' },
  'npc.portrait': { type: 'filename' },
  'npc.filename': { type: 'filename' },
  'npc.direction': { type: 'direction' },
  'npc.waypoints': { type: 'list' },
  'npc.wander_radius': { type: 'int', min: 0 },
  'npc.show_on_minimap': { type: 'bool' },
  'npc.talker': { type: 'bool' },
  'npc.vendor': { type: 'bool' },
  'npc.requires_status': { type: 'list' },
  'npc.requires_not_status': { type: 'list' },
  'npc.requires_item': { type: 'list' },
  'npc.requires_not_item': { type: 'list' },
  'npc.requires_level': { type: 'int', min: 0 },
  'npc.requires_not_level': { type: 'int', min: 0 },
  'npc.requires_currency': { type: 'int', min: 0 },
  'npc.requires_not_currency': { type: 'int', min: 0 },
  'npc.requires_class': { type: 'string' },
  'npc.requires_not_class': { type: 'string' },
  'npc.vendor_requires_status': { type: 'list' },
  'npc.vendor_requires_not_status': { type: 'list' },
  'npc.constant_stock': { type: 'list' },
  'npc.status_stock': { type: 'list' },
  'npc.random_stock': { type: 'list' },
  'npc.random_stock_count': { type: 'intPair', min: 0 },
  'npc.vendor_ratio_buy': { type: 'float', min: 0 },
  'npc.vendor_ratio_sell': { type: 'float', min: 0 },
  'npc.vendor_ratio_sell_old': { type: 'float', min: 0 },
  'npc.vox_intro': { type: 'list' }
};

const BOOLEAN_STRINGS = new Set(['true', 'false']);
const CARDINAL_DIRECTIONS = new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);

function validateValue(key: string, value: string, spec: PropertySpec): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  switch (spec.type) {
    case 'int': {
      if (!/^-?\d+$/.test(trimmed)) {
        return `${key} must be an integer.`;
      }
      const parsed = Number.parseInt(trimmed, 10);
      if (spec.min !== undefined && parsed < spec.min) {
        return `${key} must be greater than or equal to ${spec.min}.`;
      }
      if (spec.max !== undefined && parsed > spec.max) {
        return `${key} must be less than or equal to ${spec.max}.`;
      }
      return null;
    }
    case 'float': {
      const parsed = Number.parseFloat(trimmed);
      if (Number.isNaN(parsed)) {
        return `${key} must be a number.`;
      }
      if (spec.min !== undefined && parsed < spec.min) {
        return `${key} must be greater than or equal to ${spec.min}.`;
      }
      if (spec.max !== undefined && parsed > spec.max) {
        return `${key} must be less than or equal to ${spec.max}.`;
      }
      return null;
    }
    case 'bool': {
      if (!BOOLEAN_STRINGS.has(trimmed.toLowerCase())) {
        return `${key} must be true or false.`;
      }
      return null;
    }
    case 'filename': {
      if (!trimmed) {
        return `${key} cannot be empty.`;
      }
      return null;
    }
    case 'duration': {
      if (!/^\d+(ms|s)?$/i.test(trimmed)) {
        return `${key} must be a duration such as 200ms or 2s.`;
      }
      return null;
    }
    case 'intPair': {
      const parts = trimmed.split(',').map(part => part.trim()).filter(Boolean);
      if (parts.length === 0 || parts.length > 2) {
        return `${key} must contain one or two comma-separated integers.`;
      }
      for (const part of parts) {
        if (!/^-?\d+$/.test(part)) {
          return `${key} must contain valid integers.`;
        }
        const parsed = Number.parseInt(part, 10);
        if (spec.min !== undefined && parsed < spec.min) {
          return `${key} values must be greater than or equal to ${spec.min}.`;
        }
        if (spec.max !== undefined && parsed > spec.max) {
          return `${key} values must be less than or equal to ${spec.max}.`;
        }
      }
      return null;
    }
    case 'floatPair': {
      const parts = trimmed.split(',').map(part => part.trim()).filter(Boolean);
      if (parts.length === 0 || parts.length > 2) {
        return `${key} must contain one or two comma-separated numbers.`;
      }
      for (const part of parts) {
        const parsed = Number.parseFloat(part);
        if (Number.isNaN(parsed)) {
          return `${key} must contain valid numbers.`;
        }
        if (spec.min !== undefined && parsed < spec.min) {
          return `${key} values must be greater than or equal to ${spec.min}.`;
        }
        if (spec.max !== undefined && parsed > spec.max) {
          return `${key} values must be less than or equal to ${spec.max}.`;
        }
      }
      return null;
    }
    case 'direction': {
      const upper = trimmed.toUpperCase();
      if (CARDINAL_DIRECTIONS.has(upper)) {
        return null;
      }
      const parsed = Number.parseInt(trimmed, 10);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 7) {
        return null;
      }
      return `${key} must be a direction (N, NE, ... , NW) or a number between 0 and 7.`;
    }
    case 'point': {
      const parts = trimmed.split(',').map(part => part.trim());
      if (parts.length !== 2 || !parts.every(part => /^-?\d+$/.test(part))) {
        return `${key} must be two comma-separated integers.`;
      }
      return null;
    }
    case 'predefined': {
      if (spec.options && !spec.options.includes(trimmed)) {
        return `${key} must be one of: ${spec.options.join(', ')}.`;
      }
      return null;
    }
    case 'list':
    case 'string':
    default:
      return null;
  }
}

function validateAndSanitizeObject(object: MapObject): { errors: string[]; sanitized: Record<string, string> } {
  const specs = object.type === 'enemy' ? ENEMY_PROPERTY_SPECS
    : object.type === 'npc' ? NPC_PROPERTY_SPECS
    : {};

  const sanitized: Record<string, string> = {};
  const errors: string[] = [];
  const properties = object.properties || {};

  for (const [key, rawValue] of Object.entries(properties)) {
    const value = (rawValue ?? '').toString();
    const trimmed = value.trim();
    const spec = specs[key];

    if (spec) {
      const error = validateValue(key, trimmed, spec);
      if (error) {
        errors.push(error);
      }
      if (spec.type === 'bool') {
        sanitized[key] = trimmed.toLowerCase();
      } else if (spec.type === 'direction' && CARDINAL_DIRECTIONS.has(trimmed.toUpperCase())) {
        sanitized[key] = trimmed.toUpperCase();
      } else {
        sanitized[key] = trimmed;
      }
    } else {
      sanitized[key] = trimmed;
    }
  }

  return { errors, sanitized };
}

function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [editor, setEditor] = useState<TileMapEditor | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapWidth, setMapWidth] = useState(0);
  const [mapHeight, setMapHeight] = useState(0);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [showCreateMapDialog, setShowCreateMapDialog] = useState(false);
  const [newMapWidth, setNewMapWidth] = useState(20);
  const [newMapHeight, setNewMapHeight] = useState(15);
  const [newMapName, setNewMapName] = useState('Untitled Map');
  const [newMapStarting, setNewMapStarting] = useState(false);
  const [activeGid] = useState('(none)'); // Removed unused setter
  const [showMinimap, setShowMinimap] = useState(true);
  const [layers, setLayers] = useState<TileLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<number | null>(null);
  const [showAddLayerDropdown, setShowAddLayerDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [activeHelpTab, setActiveHelpTab] = useState('engine');
  const [showTooltip, setShowTooltip] = useState(true);
  const [toolbarExpanded, setToolbarExpanded] = useState(true);
  const toolbarCollapseTimer = useRef<number | null>(null);
  const toolbarContainerRef = useRef<HTMLDivElement | null>(null);
  const [bottomToolbarExpanded, setBottomToolbarExpanded] = useState(true);
  const bottomToolbarCollapseTimer = useRef<number | null>(null);
  const bottomToolbarContainerRef = useRef<HTMLDivElement | null>(null);
  const [pendingMapConfig, setPendingMapConfig] = useState<MapConfig | null>(null);
  const clearToolbarCollapseTimer = useCallback(() => {
    if (toolbarCollapseTimer.current !== null) {
      window.clearTimeout(toolbarCollapseTimer.current);
      toolbarCollapseTimer.current = null;
    }
  }, []);

  const scheduleToolbarCollapse = useCallback(() => {
    clearToolbarCollapseTimer();
    toolbarCollapseTimer.current = window.setTimeout(() => {
      setToolbarExpanded(false);
    }, 500);
  }, [clearToolbarCollapseTimer]);

  const showToolbarTemporarily = useCallback(() => {
    setToolbarExpanded(true);
    scheduleToolbarCollapse();
  }, [scheduleToolbarCollapse]);

  const handleToolbarMouseEnter = useCallback(() => {
    clearToolbarCollapseTimer();
    setToolbarExpanded(true);
  }, [clearToolbarCollapseTimer]);

  const handleToolbarMouseLeave = useCallback(() => {
    const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
    if (activeElement && toolbarContainerRef.current?.contains(activeElement)) {
      return;
    }
    scheduleToolbarCollapse();
  }, [scheduleToolbarCollapse, toolbarContainerRef]);

  const handleToolbarFocus = useCallback(() => {
    clearToolbarCollapseTimer();
    setToolbarExpanded(true);
  }, [clearToolbarCollapseTimer]);

  const handleToolbarBlur = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (!event.currentTarget.contains(nextTarget)) {
      scheduleToolbarCollapse();
    }
  }, [scheduleToolbarCollapse]);

  const clearBottomToolbarCollapseTimer = useCallback(() => {
    if (bottomToolbarCollapseTimer.current !== null) {
      window.clearTimeout(bottomToolbarCollapseTimer.current);
      bottomToolbarCollapseTimer.current = null;
    }
  }, []);

  const scheduleBottomToolbarCollapse = useCallback(() => {
    clearBottomToolbarCollapseTimer();
    bottomToolbarCollapseTimer.current = window.setTimeout(() => {
      setBottomToolbarExpanded(false);
    }, 500);
  }, [clearBottomToolbarCollapseTimer]);

  const showBottomToolbarTemporarily = useCallback(() => {
    setBottomToolbarExpanded(true);
    scheduleBottomToolbarCollapse();
  }, [scheduleBottomToolbarCollapse]);

  const handleBottomToolbarMouseEnter = useCallback(() => {
    clearBottomToolbarCollapseTimer();
    setBottomToolbarExpanded(true);
  }, [clearBottomToolbarCollapseTimer]);

  const handleBottomToolbarMouseLeave = useCallback(() => {
    const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
    if (activeElement && bottomToolbarContainerRef.current?.contains(activeElement)) {
      return;
    }
    scheduleBottomToolbarCollapse();
  }, [scheduleBottomToolbarCollapse]);

  const handleBottomToolbarFocus = useCallback(() => {
    clearBottomToolbarCollapseTimer();
    setBottomToolbarExpanded(true);
  }, [clearBottomToolbarCollapseTimer]);

  const handleBottomToolbarBlur = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (!event.currentTarget.contains(nextTarget)) {
      scheduleBottomToolbarCollapse();
    }
  }, [scheduleBottomToolbarCollapse]);

  const setBottomToolbarNode = useCallback((node: HTMLDivElement | null) => {
    toolbarRef.current = node;
    bottomToolbarContainerRef.current = node;
  }, []);

  const handleSelectTool = useCallback((tool: 'brush' | 'selection' | 'shape' | 'stamp' | 'eyedropper') => {
    setSelectedTool(tool);
    showBottomToolbarTemporarily();
  }, [showBottomToolbarTemporarily]);

  const canUseTilesetDialog = useMemo(() => {
    return typeof window !== 'undefined' && !!window.electronAPI?.selectTilesetFile;
  }, []);
  
  // Toolbar states
  const [selectedTool, setSelectedTool] = useState('brush');
  const [showBrushOptions, setShowBrushOptions] = useState(false);
  const [showSelectionOptions, setShowSelectionOptions] = useState(false);
  const [showShapeOptions, setShowShapeOptions] = useState(false);
  
  // Sub-tool states
  const [selectedBrushTool, setSelectedBrushTool] = useState('brush');
  const [selectedSelectionTool, setSelectedSelectionTool] = useState('rectangular');
  const [selectedShapeTool, setSelectedShapeTool] = useState('rectangle');
  
  // Brush management states
  const [brushTool, setBrushTool] = useState<'none' | 'move' | 'merge' | 'separate' | 'remove'>('none');
  // Removed unused state: selectedBrushes
  const [showSeparateDialog, setShowSeparateDialog] = useState(false);
  const [brushToSeparate, setBrushToSeparate] = useState<number | null>(null);
  
  // Stamp states
  const [stamps, setStamps] = useState<import('./types').Stamp[]>([]);
  const [selectedStamp, setSelectedStamp] = useState<string | null>(null);
  const [stampMode, setStampMode] = useState<'select' | 'create' | 'place'>('select');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showStampDialog, setShowStampDialog] = useState(false);
  const [newStampName, setNewStampName] = useState('');
  // Clear layer confirmation dialog state (replaces window.confirm)
  const [showClearLayerDialog, setShowClearLayerDialog] = useState(false);
  // Generic confirmation dialog for other destructive actions
  const [confirmAction, setConfirmAction] = useState<null | { type: 'removeBrush' | 'removeTileset'; payload?: number }>(null);
  
  // Settings states
  const [mapName, setMapName] = useState('Untitled Map');
  const [isStartingMap, setIsStartingMap] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Initialize from localStorage or default to false
    const savedTheme = localStorage.getItem('isDarkMode');
    return savedTheme ? JSON.parse(savedTheme) : false;
  });
  
  // Auto-save states
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error' | 'unsaved'>('saved');
  const [autoSaveEnabled, setAutoSaveEnabledState] = useState(true);
  const [lastSaveTime, setLastSaveTime] = useState<number>(0);
  const [isManuallySaving, setIsManuallySaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // Current project path for Electron saves
  const [projectPath, setProjectPath] = useState<string | null>(null);
  // When true, we're in the middle of opening an existing project
  // and should avoid creating a blank editor instance.
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  
  // Export loading state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  
  // Custom tooltip states
  const [tooltip, setTooltip] = useState<{
    content: React.ReactNode;
    x: number;
    y: number;
    visible: boolean;
    fadeOut: boolean;
  } | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Object management states  
  const [showObjectDialog, setShowObjectDialog] = useState(false);
  const [editingObject, setEditingObject] = useState<MapObject | null>(null);
  const [objectValidationErrors, setObjectValidationErrors] = useState<string[]>([]);
  const [mapObjects, setMapObjects] = useState<MapObject[]>([]);
  const [actorDialogState, setActorDialogState] = useState<{
    type: 'npc' | 'enemy';
    name: string;
    x: string;
    y: string;
    tilesetPath: string;
  } | null>(null);
  const [actorDialogError, setActorDialogError] = useState<string | null>(null);
  
  // Hero position edit dialog state
  const [showHeroEditDialog, setShowHeroEditDialog] = useState(false);
  const [heroEditData, setHeroEditData] = useState<{
    currentX: number;
    currentY: number;
    mapWidth: number;
    mapHeight: number;
    onConfirm: (x: number, y: number) => void;
  } | null>(null);
  
  // Tool dropdown timeout refs
  const brushOptionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectionOptionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shapeOptionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Floating toolbar ref for anchored tooltip
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  // Hover coordinates state
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);

  // Selection state
  const [selectionCount, setSelectionCount] = useState(0);
  const [hasSelection, setHasSelection] = useState(false);

  const { toast } = useToast();

  const syncMapObjects = useCallback(() => {
    if (editor) {
      setMapObjects(editor.getMapObjects());
    } else {
      setMapObjects([]);
    }
  }, [editor]);

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

  // Helper function to set up auto-save for an editor instance
const setupAutoSave = useCallback((editorInstance: TileMapEditor) => {
    // Set up optional callback for additional auto-save actions
    editorInstance.setAutoSaveCallback(async () => {
      // Persist to disk automatically when running in Electron with a project path
      try {
        if (window.electronAPI && projectPath) {
          await editorInstance.saveProjectData(projectPath);
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

    // Set up hero edit callback to show dialog
    editorInstance.setHeroEditCallback((currentX, currentY, mapWidth, mapHeight, onConfirm) => {
      setHeroEditData({ currentX, currentY, mapWidth, mapHeight, onConfirm });
      setShowHeroEditDialog(true);
    });
  }, [autoSaveEnabled, projectPath, handleSelectTool]);

  useEffect(() => {
    return () => {
      clearToolbarCollapseTimer();
    };
  }, [clearToolbarCollapseTimer]);

  useEffect(() => {
    if (!showWelcome && mapInitialized) {
      showToolbarTemporarily();
    }
  }, [showWelcome, mapInitialized, showToolbarTemporarily]);

  useEffect(() => {
    if (showWelcome || !mapInitialized) {
      setToolbarExpanded(true);
      clearToolbarCollapseTimer();
    }
  }, [showWelcome, mapInitialized, clearToolbarCollapseTimer]);

  useEffect(() => {
    return () => {
      clearBottomToolbarCollapseTimer();
    };
  }, [clearBottomToolbarCollapseTimer]);

  useEffect(() => {
    if (!showWelcome && mapInitialized) {
      showBottomToolbarTemporarily();
    }
  }, [showWelcome, mapInitialized, showBottomToolbarTemporarily]);

  useEffect(() => {
    if (showWelcome || !mapInitialized) {
      setBottomToolbarExpanded(true);
      clearBottomToolbarCollapseTimer();
    }
  }, [showWelcome, mapInitialized, clearBottomToolbarCollapseTimer]);

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

  // Custom tooltip handlers
  const showTooltipWithDelay = useCallback((content: React.ReactNode, element: HTMLElement) => {
    // If a toolbarRef exists, anchor the tooltip to the left of the floating toolbar
    if (toolbarRef.current) {
      const tb = toolbarRef.current.getBoundingClientRect();
      // Place tooltip centered on screen and above the floating toolbar
  // Center horizontally then nudge a bit to the right and higher above the toolbar
      // Center horizontally to the canvas grid area if available, otherwise fall back to window center.
      let x = window.innerWidth / 2;
      if (canvasRef && canvasRef.current) {
        const cr = canvasRef.current.getBoundingClientRect();
        x = cr.left + cr.width / 2;
      }
  const y = Math.max(8, tb.top - 60); // 60px above the toolbar top (a little higher)

      setTooltip({
        content,
        x,
        y,
        visible: true,
        fadeOut: false
      });
    } else {
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top - 10;

      setTooltip({
        content,
        x,
        y,
        visible: true,
        fadeOut: false
      });
    }

    // Clear any existing timeout
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }

    // Set timeout to start fade out after 1 second
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltip(prev => prev ? { ...prev, fadeOut: true } : null);
      
      // Remove tooltip completely after fade animation
      setTimeout(() => {
        setTooltip(null);
      }, 300); // Match CSS transition duration
    }, 1000);
  }, []);

  const hideTooltip = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setTooltip(null);
  }, []);

  // Cleanup tooltip timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
      // Cleanup dropdown timeouts
      if (brushOptionsTimeoutRef.current) {
        clearTimeout(brushOptionsTimeoutRef.current);
      }
      if (selectionOptionsTimeoutRef.current) {
        clearTimeout(selectionOptionsTimeoutRef.current);
      }
      if (shapeOptionsTimeoutRef.current) {
        clearTimeout(shapeOptionsTimeoutRef.current);
      }
    };
  }, []);

  // Tool dropdown handlers
  const handleShowBrushOptions = useCallback(() => {
    // Clear all dropdown timeouts
    if (brushOptionsTimeoutRef.current) {
      clearTimeout(brushOptionsTimeoutRef.current);
    }
    if (selectionOptionsTimeoutRef.current) {
      clearTimeout(selectionOptionsTimeoutRef.current);
    }
    if (shapeOptionsTimeoutRef.current) {
      clearTimeout(shapeOptionsTimeoutRef.current);
    }
    
    // Close other dropdowns and show brush options
    setShowSelectionOptions(false);
    setShowShapeOptions(false);
    setShowStampDialog(false);
    setShowBrushOptions(true);
  }, []);

  const handleHideBrushOptions = useCallback(() => {
    brushOptionsTimeoutRef.current = setTimeout(() => {
      setShowBrushOptions(false);
    }, 1000);
  }, []);

  const handleShowSelectionOptions = useCallback(() => {
    // Clear all dropdown timeouts
    if (brushOptionsTimeoutRef.current) {
      clearTimeout(brushOptionsTimeoutRef.current);
    }
    if (selectionOptionsTimeoutRef.current) {
      clearTimeout(selectionOptionsTimeoutRef.current);
    }
    if (shapeOptionsTimeoutRef.current) {
      clearTimeout(shapeOptionsTimeoutRef.current);
    }
    
    // Close other dropdowns and show selection options
    setShowBrushOptions(false);
    setShowShapeOptions(false);
    setShowStampDialog(false);
    setShowSelectionOptions(true);
  }, []);

  const handleHideSelectionOptions = useCallback(() => {
    selectionOptionsTimeoutRef.current = setTimeout(() => {
      setShowSelectionOptions(false);
    }, 1000);
  }, []);

  const handleShowShapeOptions = useCallback(() => {
    // Clear all dropdown timeouts
    if (brushOptionsTimeoutRef.current) {
      clearTimeout(brushOptionsTimeoutRef.current);
    }
    if (selectionOptionsTimeoutRef.current) {
      clearTimeout(selectionOptionsTimeoutRef.current);
    }
    if (shapeOptionsTimeoutRef.current) {
      clearTimeout(shapeOptionsTimeoutRef.current);
    }
    
    // Close other dropdowns and show shape options
    setShowBrushOptions(false);
    setShowSelectionOptions(false);
    setShowShapeOptions(true);
  }, []);

  const handleHideShapeOptions = useCallback(() => {
    shapeOptionsTimeoutRef.current = setTimeout(() => {
      setShowShapeOptions(false);
    }, 1000);
  }, []);

  // Stamp handlers
  const handleCreateStamp = useCallback(() => {
    if (!editor || !newStampName.trim()) return;
    
    const success = editor.createStampFromSelection(newStampName.trim());
    if (success) {
      setNewStampName('');
      setShowStampDialog(false);
      setStampMode('select');
    }
  }, [editor, newStampName]);

  const handleStampSelect = useCallback((stampId: string) => {
    setSelectedStamp(stampId);
    setStampMode('place');
  }, []);

  const handleDeleteStamp = useCallback((stampId: string) => {
    if (!editor) return;
    editor.deleteStamp(stampId);
    if (selectedStamp === stampId) {
      setSelectedStamp(null);
      setStampMode('select');
    }
  }, [editor, selectedStamp]);

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

  const handleSeparateBrush = useCallback((brushId: number) => {
    setBrushToSeparate(brushId);
    setShowSeparateDialog(true);
  }, []);

  const confirmSeparateBrush = useCallback(() => {
    if (!editor || brushToSeparate === null) return;
    
    try {
      // Call the editor's separate brush method
      editor.separateBrush(brushToSeparate);
      console.log(`Separated brush with ID: ${brushToSeparate}`);
    } catch (error) {
      console.error('Failed to separate brush:', error);
    }
    
    setShowSeparateDialog(false);
    setBrushToSeparate(null);
    setBrushTool('none'); // Exit separate mode after action
  }, [editor, brushToSeparate]);

  const handleRemoveBrush = useCallback((brushId: number) => {
    if (!editor) return;
    
    console.log(`handleRemoveBrush called with brushId: ${brushId}`);
  // Open generic confirm dialog
  setConfirmAction({ type: 'removeBrush', payload: brushId });
  }, [editor]);

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
      setEditingObject(obj);
      setShowObjectDialog(true);
    }
  }, [editor]);

  const handleUpdateObject = useCallback((updatedObject: MapObject) => {
    if (!editor) return;

    editor.updateMapObject(updatedObject.id, updatedObject);
    setEditingObject(null);
    setShowObjectDialog(false);
    syncMapObjects();
    setObjectValidationErrors([]);
  }, [editor, syncMapObjects]);

  const handleOpenActorDialog = useCallback((type: 'npc' | 'enemy') => {
    const defaultX = hoverCoords?.x ?? 0;
    const defaultY = hoverCoords?.y ?? 0;

    setActorDialogState({
      type,
      name: '',
      x: defaultX.toString(),
      y: defaultY.toString(),
      tilesetPath: ''
    });
    setActorDialogError(null);
  }, [hoverCoords]);

  const handleActorFieldChange = useCallback((field: 'name' | 'x' | 'y' | 'tilesetPath', value: string) => {
    setActorDialogState((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
    setActorDialogError(null);
  }, []);

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

  const handleCloseActorDialog = useCallback(() => {
    setActorDialogState(null);
    setActorDialogError(null);
  }, []);

  const handleRemoveActor = useCallback((objectId: number) => {
    if (!editor) return;
    editor.removeMapObject(objectId);
    syncMapObjects();
  }, [editor, syncMapObjects]);

  const handleActorSubmit = useCallback(() => {
    if (!editor || !actorDialogState) {
      return;
    }

    const parsedX = parseInt(actorDialogState.x, 10);
    const parsedY = parseInt(actorDialogState.y, 10);

    if (!actorDialogState.name.trim()) {
      setActorDialogError('Name is required.');
      return;
    }

    if (Number.isNaN(parsedX) || Number.isNaN(parsedY)) {
      setActorDialogError('Position must be whole numbers.');
      return;
    }

    if (
      parsedX < 0 ||
      parsedX >= editor.getMapWidth() ||
      parsedY < 0 ||
      parsedY >= editor.getMapHeight()
    ) {
      setActorDialogError('Position is outside of the map bounds.');
      return;
    }

    if (!actorDialogState.tilesetPath.trim()) {
      setActorDialogError('Tileset location is required.');
      return;
    }

    const tilesetPath = actorDialogState.tilesetPath.trim();
    const name = actorDialogState.name.trim();
    const occupiedByType = editor
      .getObjectsAtPosition(parsedX, parsedY)
      .find((obj) => obj.type === actorDialogState.type);

    if (occupiedByType) {
      setActorDialogError(
        `There is already a ${actorDialogState.type === 'npc' ? 'NPC' : 'enemy'} at that position.`
      );
      return;
    }

    const newObject = editor.addMapObject('enemy', parsedX, parsedY, 1, 1);
    editor.updateMapObject(newObject.id, {
      name,
      x: parsedX,
      y: parsedY,
      type: actorDialogState.type,
      category: actorDialogState.type === 'npc' ? 'npc' : 'enemy',
      wander_radius: actorDialogState.type === 'npc' ? 0 : newObject.wander_radius,
      properties: {
        ...(newObject.properties || {}),
        tilesetPath
      }
    });

    syncMapObjects();
    handleCloseActorDialog();
  }, [actorDialogState, editor, handleCloseActorDialog, syncMapObjects]);

  const handleObjectDialogClose = useCallback(() => {
    setShowObjectDialog(false);
    setEditingObject(null);
    setObjectValidationErrors([]);
  }, []);

  const handleObjectDialogSave = useCallback(() => {
    if (!editingObject) return;

    const { errors, sanitized } = validateAndSanitizeObject(editingObject);
    if (errors.length > 0) {
      setObjectValidationErrors(errors);
      return;
    }

    setObjectValidationErrors([]);
    handleUpdateObject({ ...editingObject, properties: sanitized });
  }, [editingObject, handleUpdateObject]);

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
  }, []);

  const updateEditingObjectBoolean = useCallback((key: string, checked: boolean) => {
    setEditingObject((prev) => {
      if (!prev) return prev;
      const properties = { ...(prev.properties || {}) };
      properties[key] = checked ? 'true' : 'false';
      return { ...prev, properties };
    });
  }, []);

  const getEditingObjectProperty = useCallback((key: string, fallback = '') => {
    if (!editingObject || !editingObject.properties) return fallback;
    return editingObject.properties[key] ?? fallback;
  }, [editingObject]);

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadProjectData = useCallback(async (newEditor: TileMapEditor, mapConfig: any) => {
    try {
      console.log('=== LOAD PROJECT DATA DEBUG ===');
      console.log('Map config received:', {
        name: mapConfig.name,
        tilesets: mapConfig.tilesets ? mapConfig.tilesets.length : 0,
        tilesetImages: mapConfig.tilesetImages ? Object.keys(mapConfig.tilesetImages).length : 0,
        layers: mapConfig.layers ? mapConfig.layers.length : 0
      });

      // Debug the map config structure in detail
      console.log('Map config full structure:', mapConfig);
      
      // Create layers from the saved config
      console.log('Creating layers from config...');
      const layers = mapConfig.layers || [];
      console.log('Layers from config:', layers);
      
      for (const layerData of layers) {
        console.log('Processing layer:', layerData);
        const layerAdded = newEditor.addLayer(layerData.name, layerData.type);
        
        if (layerAdded) {
          console.log(`Created layer: ${layerData.type} - ${layerData.name}`);
          
          // Find the newly created layer and set its data
          const createdLayer = newEditor.getLayers().find(l => l.type === layerData.type);
          if (createdLayer && layerData.data && Array.isArray(layerData.data)) {
            console.log(`Setting data for layer ${createdLayer.id} with ${layerData.data.length} tiles`);
            createdLayer.data = layerData.data;
          }
        } else {
          console.log(`Failed to create layer: ${layerData.type} - ${layerData.name}`);
        }
      }

      // Load the complete project data into the editor
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
          
          // Clear auto-save backup to prevent old data from loading
          console.log('Clearing local storage backup...');
          newEditor.clearLocalStorageBackup();
          
          console.log('Setting map size...');
          newEditor.setMapSize(pendingMapConfig.width, pendingMapConfig.height);
          
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
          if (window.electronAPI?.discoverTilesetImages && projectPath) {
            console.log('Calling discoverTilesetImages for path:', projectPath);
            const found = await window.electronAPI.discoverTilesetImages(projectPath);
            
            const images = found?.tilesetImages || {};
            const imageKeys = Object.keys(images);
            
            // Check if the project already has per-layer tilesets loaded
            const mapConfigWithTilesets = pendingMapConfig as { tilesets?: Array<{ layerType?: string }> };
            const hasPerLayerTilesets = mapConfigWithTilesets.tilesets && 
              Array.isArray(mapConfigWithTilesets.tilesets) && 
              mapConfigWithTilesets.tilesets.some((ts) => ts.layerType);
            
            console.log('Has per-layer tilesets in project:', hasPerLayerTilesets);
            console.log('Available discovered images:', imageKeys);
            
            // Only use fallback tileset assignment if no per-layer tilesets exist
            if (!hasPerLayerTilesets && imageKeys.length > 0) {
              console.log('No per-layer tilesets found, using fallback assignment');
              const normalize = (s: string) => (s || '')
                .toLowerCase()
                .replace(/\.[^/.]+$/, '') // drop extension
                .replace(/[^a-z0-9]+/g, ' ') // non-alnum to space
                .trim();

              // Preserve the currently intended active layer to restore later
              const intendedActive = newEditor.getActiveLayerId();
              const layersToAssign = newEditor.getLayers();
              let assignedAny = false;

              for (const layer of layersToAssign) {
                // Try exact and fuzzy matches by filename
                const nameTargets = [normalize(layer.type), normalize(layer.name)];
                let matchKey: string | null = null;

                for (const key of imageKeys) {
                  const keyNorm = normalize(key);
                  if (nameTargets.includes(keyNorm)) {
                    matchKey = key;
                    break;
                  }
                }

                if (!matchKey) {
                  // Fallback: pick any key that contains layer type/name as substring
                  const keyByIncludes = imageKeys.find(k => {
                    const kn = normalize(k);
                    return nameTargets.some(t => t && kn.includes(t));
                  });
                  if (keyByIncludes) matchKey = keyByIncludes;
                }

                if (!matchKey && imageKeys.length === 1) {
                  // Final fallback: single image for the project
                  matchKey = imageKeys[0];
                }

                if (matchKey) {
                  console.log(`Assigning tileset '${matchKey}' to layer ${layer.id} (${layer.type})`);
                  // Make this layer active to store tileset under its type
                  newEditor.setActiveLayer(layer.id);
                  await newEditor.loadTilesetFromDataURL(images[matchKey], matchKey);
                  assignedAny = true;
                } else {
                  console.log(`No matching tileset found for layer ${layer.id} (${layer.type})`);
                }
              }

              // Restore intended active layer selection
              if (intendedActive !== null) {
                newEditor.setActiveLayer(intendedActive);
              }

              if (assignedAny) {
                // Trigger auto-save to preserve imported tilesets
                newEditor.forceSave();
              }
            } else {
              console.log('Per-layer tilesets already loaded, skipping fallback assignment');
              // Just update UI state based on what was loaded
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
          // toast suppressed: Failed to load the project
          setPendingMapConfig(null);
        }
      };

      createEditorWithConfig();
    }
  }, [pendingMapConfig, showWelcome, projectPath, setupAutoSave, updateLayersList]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'tileset' | 'layerTileset') => {
    const file = event.target.files?.[0];
    if (file && editor?.handleFileUpload) {
      editor.handleFileUpload(file, type);
    }
  };

  const handleSetActiveLayer = (layerId: number) => {
    if (editor) {
      editor.setActiveLayer(layerId);
      setActiveLayerId(layerId);
      
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

  const handleMapResize = () => {
    if (editor?.resizeMap) {
      editor.resizeMap(mapWidth, mapHeight);
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

  const handleOpenCreateMapDialog = () => {
    setNewMapWidth(mapWidth > 0 ? mapWidth : 20);
    setNewMapHeight(mapHeight > 0 ? mapHeight : 15);
    setNewMapName(mapName || 'Untitled Map');
    setNewMapStarting(isStartingMap);
    setShowCreateMapDialog(true);
  };

  const handleConfirmCreateMap = () => {
    const width = Math.max(1, Math.floor(newMapWidth) || 0);
    const height = Math.max(1, Math.floor(newMapHeight) || 0);
    const trimmedName = newMapName.trim();
    const resolvedName = trimmedName ? trimmedName : 'Untitled Map';

    let targetEditor = editor;

    if (!targetEditor && canvasRef.current) {
      targetEditor = new TileMapEditor(canvasRef.current);
      targetEditor.setDarkMode(isDarkMode);
      setupAutoSave(targetEditor);
    }

    if (targetEditor) {
      targetEditor.resetForNewProject();
      targetEditor.setMapSize(width, height);
      targetEditor.setDarkMode(isDarkMode);
      if (!editor) {
        setEditor(targetEditor);
      }
      updateLayersList();
      syncMapObjects();
    }

    setMapWidth(width);
    setMapHeight(height);
    setMapInitialized(true);
    showToolbarTemporarily();
    showBottomToolbarTemporarily();
    setMapName(resolvedName);
    setIsStartingMap(newMapStarting);
    setHasSelection(false);
    setSelectionCount(0);
    setShowCreateMapDialog(false);
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

  const handleExportMap = async () => {
    if (!editor || !projectPath) {
      toast({
        title: "Export Failed",
        description: "No project loaded or editor not initialized.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Simulate progress updates
      setExportProgress(25);
      
      // Generate the map and tileset content
      const mapTxt = editor.generateFlareMapTxt();
      setExportProgress(50);
      
      const tilesetDef = editor.generateFlareTilesetDef();
      setExportProgress(75);
      
      // Save files to project folder using Electron API
      if (window.electronAPI?.saveExportFiles) {
        const success = await window.electronAPI.saveExportFiles(projectPath, mapName, mapTxt, tilesetDef);
        setExportProgress(100);
        
        if (success) {
          // Show success modal after a delay to let the loading bar animation complete
          setTimeout(() => {
            setShowExportSuccess(true);
          }, 1500);
        } else {
          throw new Error("Failed to save export files");
        }
      } else {
        // Fallback to original download method if Electron API not available
        editor.exportFlareMap();
        setExportProgress(100);
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: "An error occurred while exporting the map.",
        variant: "destructive",
      });
    } finally {
      // Reset loading state after a brief delay to show completion
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 1000);
    }
  };

  const handleManualSave = useCallback(async () => {
    if (!editor) return;
    setIsManuallySaving(true);
    try {
      if (window.electronAPI && projectPath) {
        const success = await editor.saveProjectData(projectPath);
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
  }, [editor, projectPath]);

  const handleToggleMinimap = () => {
    if (editor?.toggleMinimap) {
      editor.toggleMinimap();
    }
    setShowMinimap(!showMinimap);
  };

  const handleCreateNewMap = (config: MapConfig, newProjectPath?: string) => {
    localStorage.removeItem('tilemap_autosave_backup');
    setProjectPath(newProjectPath ?? null);

    const resolvedName = config.name?.trim() ? config.name.trim() : 'Untitled Map';
    const starting = Boolean(config.isStartingMap);
    setMapName(resolvedName);
    setIsStartingMap(starting);
    setNewMapName(resolvedName);
    setNewMapStarting(starting);
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
    setShowCreateMapDialog(false);
    setShowWelcome(false);
  };

  const handleOpenMap = useCallback(async (projectPath: string) => {
    console.log('=== HANDLE OPEN MAP CALLED ===', projectPath);
    console.log('Project path details:', {
      path: projectPath,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Block the default editor creation effect while we open
      setIsOpeningProject(true);
      // Remember project path for subsequent saves
      setProjectPath(projectPath);
      if (window.electronAPI?.openMapProject) {
        console.log('Calling electronAPI.openMapProject...');
        const mapConfig = await window.electronAPI.openMapProject(projectPath);
        console.log('=== RAW MAP CONFIG RECEIVED ===');
        console.log('Full mapConfig object:', JSON.stringify(mapConfig, null, 2));
        
        if (mapConfig) {
          console.log('=== MAP CONFIG ANALYSIS ===');
          console.log('Map dimensions:', { width: mapConfig.width, height: mapConfig.height });
          console.log('Map name:', mapConfig.name);
          
          const resolvedName = mapConfig.name?.trim() ? mapConfig.name.trim() : 'Untitled Map';
          const starting = Boolean((mapConfig as { isStartingMap?: boolean }).isStartingMap);
          setMapName(resolvedName);
          setNewMapName(resolvedName);
          setIsStartingMap(starting);
          setNewMapStarting(starting);
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const extendedConfig = mapConfig as any;
          console.log('Tilesets count:', extendedConfig.tilesets ? extendedConfig.tilesets.length : 0);
          console.log('Tileset images count:', extendedConfig.tilesetImages ? Object.keys(extendedConfig.tilesetImages).length : 0);
          console.log('Layers count:', extendedConfig.layers ? extendedConfig.layers.length : 0);
          
          if (extendedConfig.tilesets) {
            console.log('=== TILESETS DETAILS ===');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            extendedConfig.tilesets.forEach((tileset: any, index: number) => {
              console.log(`Tileset ${index}:`, {
                fileName: tileset.fileName,
                tileWidth: tileset.tileWidth,
                tileHeight: tileset.tileHeight,
                spacing: tileset.spacing,
                margin: tileset.margin,
                tileCount: tileset.tileCount
              });
            });
          }
          
          if (extendedConfig.layers) {
            console.log('=== LAYERS DETAILS ===');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            extendedConfig.layers.forEach((layer: any, index: number) => {
              console.log(`Layer ${index}:`, {
                id: layer.id,
                name: layer.name,
                type: layer.type,
                visible: layer.visible,
                opacity: layer.opacity,
                dataLength: layer.data ? layer.data.length : 0
              });
            });
          }
          
          if (extendedConfig.tilesetImages) {
            console.log('=== TILESET IMAGES DETAILS ===');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Object.entries(extendedConfig.tilesetImages).forEach(([key, data]: [string, any]) => {
              console.log(`Image ${key}:`, {
                dataType: typeof data,
                dataLength: data ? data.length : 0,
                isDataURL: typeof data === 'string' && data.startsWith('data:')
              });
            });
          }
          
          console.log('Setting map dimensions and clearing editor...');
          setMapWidth(mapConfig.width);
          setMapHeight(mapConfig.height);
          setMapInitialized(true);
          showToolbarTemporarily();
          showBottomToolbarTemporarily();
          setShowWelcome(false);
          setShowCreateMapDialog(false);
          
          // Clear existing editor state first
          console.log('Clearing existing editor...');
          if (editor) {
            console.log('Found existing editor, clearing it');
            setEditor(null);
          } else {
            console.log('No existing editor to clear');
          }
          
          // Store the map config for deferred editor creation
          // The editor will be created by the useEffect when canvas becomes available
          console.log('Storing map config for deferred editor creation');
          setPendingMapConfig(mapConfig);
          // toast suppressed: Map Loaded
        }
        } else {
        // Fallback for web
        console.log('Opening map project:', projectPath);
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
  }, [editor, setupAutoSave, updateLayersList]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wire Electron menu actions (Save/Open/New)
  useEffect(() => {
    if (!window.electronAPI) return;
    // Save Map
    window.electronAPI.onMenuSaveMap(async () => {
      await handleManualSave();
    });
    // Open Map
    window.electronAPI.onMenuOpenMap(async () => {
      const selected = await window.electronAPI.selectDirectory();
      if (selected) {
        await handleOpenMap(selected);
      }
    });
    // New Map
    window.electronAPI.onMenuNewMap(() => {
      setShowWelcome(true);
      setMapInitialized(false);
      setEditor(null);
      setMapWidth(0);
      setMapHeight(0);
      setShowCreateMapDialog(false);
    });
    // Undo
    window.electronAPI.onMenuUndo(() => {
      handleUndo();
    });
    // Redo
    window.electronAPI.onMenuRedo(() => {
      handleRedo();
    });
    // No cleanup provided by preload; handlers are idempotent in this simple flow
  }, [handleManualSave, handleOpenMap, handleUndo, handleRedo]);

  // Handle close confirmation events
  useEffect(() => {
    if (!window.electronAPI) return;
    
    // Handle before close check
    window.electronAPI.onBeforeClose(async () => {
      await window.electronAPI.confirmClose(hasUnsavedChanges);
      // The main process handles the actual close logic
    });

    // Handle save and close request
    window.electronAPI.onSaveAndClose(async () => {
      try {
        await handleManualSave();
        // After save is complete, tell main process to close
        window.electronAPI.closeAfterSave();
      } catch (error) {
        console.error('Failed to save before close:', error);
        // Even if save fails, we could show another dialog or just close
        window.electronAPI.closeAfterSave();
      }
    });
  }, [hasUnsavedChanges, handleManualSave]);

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

  const isNpcLayer = activeLayer?.type === 'npc';
  const isEnemyLayer = activeLayer?.type === 'enemy';

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
      {/* Custom Title Bar */}
      <div className="bg-gray-100 dark:bg-neutral-900 text-orange-600 dark:text-orange-400 flex justify-between items-center px-4 py-1 select-none drag-region border-b border-gray-200 dark:border-neutral-700">
        <div className="flex items-center gap-3">
          {/* Logo and Brand */}
          <div className="flex items-center gap-1">
            <img 
              src="/flare-ico.png" 
              alt="Flarism Logo" 
              className="w-4 h-6"
            />
            <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">Flarism</span>
          </div>
          <div className="text-sm font-medium"></div>
          {/* Save Status Indicator */}
          <div className="flex items-center gap-1 text-xs">
            {saveStatus === 'saving' && (
              <>
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                <span className="text-orange-600">Saving...</span>
              </>
            )}
            {saveStatus === 'saved' && lastSaveTime > 0 && (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-green-600">Saved</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-red-600">Save Error</span>
              </>
            )}
            {saveStatus === 'unsaved' && (
              <>
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-yellow-600">Unsaved</span>
              </>
            )}
          </div>
        </div>
        <div className="flex no-drag">
          <Tooltip content="Minimize">
            <button 
              onClick={handleMinimize}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content="Maximize">
            <button 
              onClick={handleMaximize}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded transition-colors"
            >
              <Square className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content="Close">
            <button 
              onClick={handleClose}
              className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        <aside className="w-80 border-r border-border bg-muted/30 p-4 overflow-y-auto flex flex-col">
          {/* Tileset Brushes Section */}
          <section className="flex flex-col flex-1">
            {isNpcLayer || isEnemyLayer ? (
              <div className="flex flex-col flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">{isNpcLayer ? 'NPCs' : 'Enemies'}</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 text-white border-orange-500 hover:border-orange-600 h-6 text-xs px-2 shadow-sm"
                    onClick={() => handleOpenActorDialog(isNpcLayer ? 'npc' : 'enemy')}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {isNpcLayer ? 'Add NPC' : 'Add Enemy'}
                  </Button>
                </div>
                <div className="flex-1 min-h-0">
                  {actorEntries.length === 0 ? (
                    <div className="h-full border border-dashed border-border rounded-md flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
                      {isNpcLayer ? 'No NPCs added yet. Use the button above to place your first NPC.' : 'No enemies added yet. Use the button above to place an enemy.'}
                    </div>
                  ) : (
                    <div className="space-y-2 overflow-y-auto pr-1">
                      {actorEntries.map((actor) => (
                        <div
                          key={actor.id}
                          className="border border-border rounded-md px-3 py-2 bg-background/50 hover:bg-background transition-colors cursor-pointer"
                          onClick={() => handleEditObject(actor.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 text-sm">
                              <div className="font-medium text-foreground">
                                {actor.name || `${actor.type === 'npc' ? 'NPC' : 'Enemy'} #${actor.id}`}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                ({actor.x}, {actor.y})
                              </div>
                              {actor.properties?.tilesetPath && (
                                <div className="text-xs text-muted-foreground break-all">
                                  {actor.properties.tilesetPath}
                                </div>
                              )}
                            </div>
                            <Tooltip content="Remove">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-6 h-6 p-0 text-red-500 hover:text-red-600"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleRemoveActor(actor.id);
                                }}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
            {/* Header with Import Button */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Tileset Brushes</h2>
              <Tooltip content="Import a PNG tileset for the active layer" side="bottom">
                <Button variant="outline" size="sm" className="relative bg-orange-500 hover:bg-orange-600 text-white border-orange-500 hover:border-orange-600 h-6 text-xs px-2 shadow-sm">
                  <Upload className="w-3 h-3 mr-1" />
                  Import
                  <input
                    type="file"
                    accept="image/png"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => handleFileUpload(e, 'layerTileset')}
                  />
                </Button>
              </Tooltip>
            </div>
            
            <div id="tilesetMeta" className="text-sm text-muted-foreground mb-2"></div>
            
            {/* Tileset Brushes Window - Takes maximum space */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="relative flex-1 min-h-0 overflow-auto h-full">
                <div id="tilesContainer" className="tile-palette h-full"></div>
                
                {/* Hidden element to track brush tool state */}
                <div data-brush-tool={brushTool} className="hidden"></div>
                
                {/* Active GID Badge - Fixed position at bottom-left */}
                <div className="absolute bottom-2 left-2 z-10">
                  <Tooltip content="Active GID number of selected tilebrush">
                    <Badge variant="secondary" className="text-xs px-2 py-1 bg-black/80 text-white border-gray-600 hover:bg-black/90">
                      <span id="activeGid">{activeGid}</span>
                    </Badge>
                  </Tooltip>
                </div>
              </div>
            </div>
            
            {/* Brush Tools Header */}
            <div className="flex items-center justify-between mb-1 mt-2">
              <div className="text-xs text-muted-foreground">Brush Tools</div>
              <div className="flex gap-1">
                <Tooltip content="Move/Reorder brushes">
                  <Button
                    variant={brushTool === 'move' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs px-1 py-1 h-6 shadow-sm"
                    onClick={() => setBrushTool(brushTool === 'move' ? 'none' : 'move')}
                  >
                    <Scan className="w-3 h-3" />
                  </Button>
                </Tooltip>
                <Tooltip content="Merge brushes">
                  <Button
                    variant={brushTool === 'merge' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs px-1 py-1 h-6 shadow-sm"
                    onClick={() => setBrushTool(brushTool === 'merge' ? 'none' : 'merge')}
                  >
                    <Link2 className="w-3 h-3" />
                  </Button>
                </Tooltip>
                <Tooltip content="Separate brushes">
                  <Button
                    variant={brushTool === 'separate' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs px-1 py-1 h-6 shadow-sm"
                    onClick={() => setBrushTool(brushTool === 'separate' ? 'none' : 'separate')}
                  >
                    <Scissors className="w-3 h-3" />
                  </Button>
                </Tooltip>
                <Tooltip content="Remove brushes">
                  <Button
                    variant={brushTool === 'remove' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs px-1 py-1 h-6 shadow-sm"
                    onClick={() => setBrushTool(brushTool === 'remove' ? 'none' : 'remove')}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </Tooltip>
                <Tooltip content="Remove tileset for current layer">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-1 py-1 h-6 border-red-500 hover:border-red-600 hover:bg-red-50 shadow-sm"
                    onClick={() => {
                      setConfirmAction({ type: 'removeTileset' });
                    }}
                  >
                    <X className="w-3 h-3 text-red-500" />
                  </Button>
                </Tooltip>
              </div>
            </div>
              </>
            )}
          </section>

          {/* Layers Section */}
          <section className="mb-4 flex-shrink-0">
            <h2 className="text-sm font-semibold mb-2">Layers</h2>
            
            {/* Layers List */}
            <div className="mb-2 space-y-0.5 max-h-48 overflow-y-auto">
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  className={`px-2 py-1 border rounded transition-colors text-xs ${
                    activeLayerId === layer.id 
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-400' 
                      : 'border-border hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div 
                    className="cursor-pointer"
                    onClick={() => handleSetActiveLayer(layer.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Tooltip content={layer.visible ? "Hide layer" : "Show layer"}>
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
                            const currentTransparency = layer.transparency || 0;
                            const newTransparency = Math.max(0, Math.min(1, currentTransparency + delta));
                            
                            handleLayerTransparencyChange(layer.id, delta);
                            
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
                        
                        <span className="text-xs font-medium truncate">{layer.name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Bottom Action Buttons */}
          <section className="flex-shrink-0">
            {/* Export Loading Bar - Always reserve space */}
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
            
            <div className="flex gap-2 justify-center">
              <Tooltip content="Export the map file and tilesetdef">
                <Button 
                  onClick={handleExportMap} 
                  className="shadow-sm flex items-center gap-1 px-3 py-1 h-7 text-xs w-20"
                  size="sm"
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Export</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3" />
                      <span>Export</span>
                    </>
                  )}
                </Button>
              </Tooltip>
              <Tooltip content={hasUnsavedChanges ? 'Save changes' : 'All changes saved'}>
                <Button 
                  onClick={handleManualSave}
                  className={`w-7 h-7 p-0 shadow-sm transition-colors ${
                    isManuallySaving 
                      ? 'bg-blue-500 hover:bg-blue-600' 
                      : hasUnsavedChanges 
                        ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                        : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                  disabled={isManuallySaving}
                  size="sm"
                >
                  {isManuallySaving ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                </Button>
              </Tooltip>
              <Tooltip content="Help & Documentation">
                <Button 
                  onClick={() => setShowHelp(true)} 
                  className="w-7 h-7 p-0 shadow-sm"
                  variant="outline"
                  size="sm"
                >
                  <HelpCircle className="w-3 h-3" />
                </Button>
              </Tooltip>
              <Tooltip content="Map Settings">
                <Button 
                  onClick={() => setShowSettings(true)} 
                  className="w-7 h-7 p-0 shadow-sm"
                  variant="outline"
                  size="sm"
                >
                  <Settings className="w-3 h-3" />
                </Button>
              </Tooltip>
            </div>
          </section>
        </aside>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-background border border-border rounded-lg p-6 w-96">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Map Settings</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowSettings(false)}
                  className="w-8 h-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Map Name</label>
                  <Input
                    type="text"
                    value={mapName}
                    onChange={(e) => setMapName(e.target.value)}
                    placeholder="Enter map name"
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Map Width</label>
                  <Input
                    type="number"
                    value={mapWidth}
                    onChange={(e) => setMapWidth(Number(e.target.value))}
                    min="1"
                    max="100"
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Map Height</label>
                  <Input
                    type="number"
                    value={mapHeight}
                    onChange={(e) => setMapHeight(Number(e.target.value))}
                    min="1"
                    max="100"
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Theme (Experimental)</label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Light Mode</span>
                    <button
                      onClick={() => setIsDarkMode(!isDarkMode)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isDarkMode ? 'bg-orange-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isDarkMode ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                      <span className="sr-only">Toggle dark mode</span>
                    </button>
                    <span className="text-sm flex items-center gap-1">
                      {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                      Dark Mode
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Debug Mode</label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Disabled</span>
                    <button
                      onClick={() => {
                        if (editor) {
                          editor.toggleDebugMode();
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        editor?.getDebugMode() ? 'bg-orange-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          editor?.getDebugMode() ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                      <span className="sr-only">Toggle debug mode</span>
                    </button>
                    <span className="text-sm flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      Debug Tiles
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Shows tile boundaries and coordinates for debugging
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Auto-Save</label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Disabled</span>
                    <button
                      onClick={() => {
                        const newEnabled = !autoSaveEnabled;
                        setAutoSaveEnabledState(newEnabled);
                        if (editor) {
                          editor.setAutoSaveEnabled(newEnabled);
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        autoSaveEnabled ? 'bg-orange-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          autoSaveEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                      <span className="sr-only">Toggle auto-save</span>
                    </button>
                    <span className="text-sm">
                      Enabled
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Automatically saves your work every 8 seconds
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => setShowSettings(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    handleMapResize();
                    setShowSettings(false);
                  }}
                  className="flex-1"
                >
                  Apply Changes
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Clear Layer Confirmation Dialog (replaces native confirm) */}
        {showClearLayerDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-background border border-border rounded-lg p-6 w-80">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Clear Layer</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowClearLayerDialog(false)}
                  className="w-8 h-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-sm text-foreground mb-4">Are you sure you want to clear all tiles from the current layer? This action cannot be undone.</div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowClearLayerDialog(false)}>Cancel</Button>
                <Button
                  onClick={() => {
                    if (editor) {
                      editor.clearLayer();
                    }
                    setSelectedBrushTool('brush'); // Reset to brush tool after clearing
                    setShowClearLayerDialog(false);
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
        )}

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

        {/* Help Modal */}
        {showHelp && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-background border border-border rounded-lg p-0 w-[800px] max-h-[80vh] overflow-y-auto help-modal relative">
              {/* Modal-local header that stays visible while the modal body scrolls */}
              <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border py-3 px-4 rounded-t-lg">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Help & Documentation</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHelp(false)}
                    className="w-8 h-8 p-0 rounded-full"
                    aria-label="Close Help"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {/* Tab Navigation */}
                <div className="flex space-x-1 mt-3 bg-gray-100 dark:bg-neutral-800 rounded-lg p-1">
                  <button
                    onClick={() => setActiveHelpTab('engine')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      activeHelpTab === 'engine'
                        ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <Target className="w-4 h-4 inline mr-2" />
                    Engine
                  </button>
                  <button
                    onClick={() => setActiveHelpTab('collisions')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      activeHelpTab === 'collisions'
                        ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <Shield className="w-4 h-4 inline mr-2" />
                    Collisions
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Engine Tab Content */}
                {activeHelpTab === 'engine' && (
                  <>
                    <section>
                      <h4 className="text-xl font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                        <Target className="w-5 h-5 text-orange-500" />
                        Getting Started
                      </h4>
                      <div className="space-y-2 text-gray-700 dark:text-gray-400">
                        <p>Welcome to the Isometric Tile Map Editor! This tool allows you to create beautiful isometric tile-based maps.</p>
                        <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700 dark:text-gray-400">
                          <li>Start by creating a new map or loading an existing one</li>
                          <li>Import tilesets to begin designing</li>
                          <li>Use layers to organize different elements of your map</li>
                          <li>Export your finished map for use in your projects</li>
                        </ul>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                        <Map className="w-5 h-5 text-orange-500" />
                        Map Management
                      </h4>
                      <div className="space-y-3">
                        <p className="text-gray-700 dark:text-gray-400">Layers help organize your map content. Each layer can have its own tileset and transparency.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="flex items-start gap-3">
                            <Save className="w-4 h-4 mt-1 text-orange-500" />
                            <div>
                              <h5 className="font-medium text-gray-800 dark:text-gray-100">Save/Export</h5>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Save your map as JSON or export as PNG image</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Upload className="w-4 h-4 mt-1 text-orange-500" />
                            <div>
                              <h5 className="font-medium text-gray-800 dark:text-gray-100">Load Map</h5>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Load previously saved JSON map files</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Settings className="w-4 h-4 mt-1 text-orange-500" />
                            <div>
                              <h5 className="font-medium text-gray-800 dark:text-gray-100">Map Settings</h5>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Configure map dimensions, tile size, and other properties</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Link2 className="w-4 h-4 mt-1 text-orange-500" />
                            <div>
                              <h5 className="font-medium text-gray-800 dark:text-gray-100">Lock/Unlock</h5>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Prevent accidental edits to completed layers</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xl font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                        <Paintbrush2 className="w-5 h-5 text-orange-500" />
                        Drawing Tools
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-start gap-3">
                          <Paintbrush2 className="w-4 h-4 mt-1 text-orange-500" />
                          <div>
                            <h5 className="font-medium text-gray-800 dark:text-gray-100">Brush Tool</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Paint individual tiles by clicking</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <PaintBucket className="w-4 h-4 mt-1 text-orange-500" />
                          <div>
                            <h5 className="font-medium text-gray-800 dark:text-gray-100">Bucket Fill</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Fill connected areas with the same tile</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Eraser className="w-4 h-4 mt-1 text-orange-500" />
                          <div>
                            <h5 className="font-medium text-gray-800 dark:text-gray-100">Eraser</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Remove tiles from the map</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Pipette className="w-4 h-4 mt-1 text-orange-500" />
                          <div>
                            <h5 className="font-medium text-gray-800 dark:text-gray-100">Eyedropper</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Select a tile from the map to use as brush</p>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xl font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                        <Square className="w-5 h-5 text-orange-500" />
                        Tileset Management
                      </h4>
                      <div className="space-y-3">
                        <p className="text-gray-700 dark:text-gray-400">Each layer can have its own tileset. Import PNG images to use as tilesets.</p>
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <Upload className="w-4 h-4 mt-1 text-orange-500" />
                            <div>
                              <h5 className="font-medium text-gray-800 dark:text-gray-100">Import Tileset</h5>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Click the upload button for each layer to import a tileset image</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <X className="w-4 h-4 mt-1 text-orange-500" />
                            <div>
                              <h5 className="font-medium text-gray-800 dark:text-gray-100">Remove Tileset</h5>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Use the red X button to remove a tileset from a layer</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xl font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                        <Move className="w-5 h-5 text-orange-500" />
                        Navigation & Viewport
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-start gap-3">
                          <ZoomIn className="w-4 h-4 mt-1 text-orange-500" />
                          <div>
                            <h5 className="font-medium text-gray-800 dark:text-gray-100">Zoom Controls</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Use +/- buttons or mouse wheel to zoom in/out</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Move className="w-4 h-4 mt-1 text-orange-500" />
                          <div>
                            <h5 className="font-medium text-gray-800 dark:text-gray-100">Pan View</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Hold and drag the middle mouse button to pan</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <RotateCcw className="w-4 h-4 mt-1 text-orange-500" />
                          <div>
                            <h5 className="font-medium text-gray-800 dark:text-gray-100">Reset View</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Reset zoom and center the view</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <MapPin className="w-4 h-4 mt-1 text-orange-500" />
                          <div>
                            <h5 className="font-medium text-gray-800 dark:text-gray-100">Coordinates</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Hover over the map to see tile coordinates</p>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                        <Target className="w-5 h-5 text-orange-500" />
                        Keyboard Shortcuts
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 dark:bg-neutral-900 p-4 rounded-lg">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Ctrl+Z</span>
                            <span className="text-sm text-gray-400">Undo</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Ctrl+Y</span>
                            <span className="text-sm text-gray-400">Redo</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Ctrl+S</span>
                            <span className="text-sm text-gray-400">Save Map</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Mouse Wheel</span>
                            <span className="text-sm text-gray-400">Zoom</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Middle Click + Drag</span>
                            <span className="text-sm text-gray-400">Pan</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-mono text-sm bg-gray-200 dark:bg-neutral-800 px-2 py-1 rounded">Hover + Wheel</span>
                            <span className="text-sm text-gray-400">Layer Transparency</span>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
                        <Wand2 className="w-5 h-5 text-orange-500" />
                        Tips & Best Practices
                      </h4>
                      <div className="space-y-2 text-gray-700 dark:text-gray-400">
                        <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700 dark:text-gray-400">
                          <li>Use separate layers for different map elements (background, objects, decorations)</li>
                          <li>Name your layers descriptively for better organization</li>
                          <li>Lock completed layers to prevent accidental changes</li>
                          <li>Adjust layer transparency to see underlying elements while editing</li>
                          <li>Use the eyedropper tool to quickly select tiles from existing map areas</li>
                          <li>Save frequently to avoid losing work</li>
                          <li>Test your map export to ensure it looks correct in your target application</li>
                        </ul>
                      </div>
                    </section>
                  </>
                )}

                {/* Collisions Tab Content */}
                {activeHelpTab === 'collisions' && (
                  <>
                    <section>
                      <h4 className="text-xl font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                        <Shield className="w-5 h-5 text-orange-500" />
                        Summary of Collision Values for Flare
                      </h4>
                      <div className="space-y-4">
                        <p className="text-gray-700 dark:text-gray-400">
                          Collision values in Flare Engine determine how entities interact with map tiles. Each value has specific behavior that affects movement and visibility.
                        </p>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                            <thead className="bg-gray-100 dark:bg-gray-800">
                              <tr>
                                <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold text-gray-800 dark:text-gray-100">Value</th>
                                <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold text-gray-800 dark:text-gray-100">Type</th>
                                <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold text-gray-800 dark:text-gray-100">Behavior</th>
                              </tr>
                            </thead>
                            <tbody className="text-gray-700 dark:text-gray-300">
                              <tr>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono bg-red-50 dark:bg-red-900/20">1</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium text-red-600 dark:text-red-400">Red Block</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">Impassable wall, visible on minimap</td>
                              </tr>
                              <tr>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono bg-red-50 dark:bg-red-900/20">2</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium text-red-600 dark:text-red-400">Dithered Red</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">Still blocks entities, minimap shows dithered tile</td>
                              </tr>
                              <tr>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono bg-blue-50 dark:bg-blue-900/20">3</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium text-blue-600 dark:text-blue-400">Pit (Blue)</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">Ground entities blocked; air can pass</td>
                              </tr>
                              <tr>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono bg-blue-50 dark:bg-blue-900/20">4</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium text-blue-600 dark:text-blue-400">Dithered Pit</td>
                                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">Same as 3, but minimap shows dithered</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                          <h5 className="font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Usage Guidelines
                          </h5>
                          <ul className="text-blue-700 dark:text-blue-300 text-sm space-y-1 list-disc list-inside">
                            <li><strong>Value 1 (Red Block):</strong> Use for walls, buildings, and solid obstacles that should be clearly visible on the minimap</li>
                            <li><strong>Value 2 (Dithered Red):</strong> Use for partial barriers or decorative walls that still block movement</li>
                            <li><strong>Value 3 (Pit):</strong> Use for water, lava, or ground hazards that flying entities can cross</li>
                            <li><strong>Value 4 (Dithered Pit):</strong> Use for shallow water or transitional pit areas</li>
                          </ul>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                          <h5 className="font-medium text-amber-800 dark:text-amber-200 mb-2">⚠️ Important Notes</h5>
                          <ul className="text-amber-700 dark:text-amber-300 text-sm space-y-1 list-disc list-inside">
                            <li>Collision values are set in the <strong>Collision Layer</strong> of your map</li>
                            <li>Each tile position can only have one collision value</li>
                            <li>Collision affects AI pathfinding and player movement</li>
                            <li>Minimap visualization helps players understand map layout</li>
                          </ul>
                        </div>
                      </div>
                    </section>
                  </>
                )}

                <div className="pt-4 border-t border-gray-200 text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Flarism | GUI for Flare Engine by ism.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Center Area */}
        <section className="flex-1 min-w-0 flex flex-col relative">
          {/* Zoom Controls & Undo/Redo */}
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
          <div className="bg-gray-100 flex-1 min-h-0 flex items-center justify-center overflow-hidden relative">
            {/* Canvas Tooltip Panel */}
            {showTooltip && (
              <div className="absolute top-4 left-4 z-20 p-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-lg border border-border shadow-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 w-6 h-6 p-0"
                  onClick={() => setShowTooltip(false)}
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
                </div>
              </div>
            )}
            
            <canvas
              ref={canvasRef}
              id="mapCanvas"
              className="tile-canvas w-full h-full max-w-full max-h-full"
            />
            {!mapInitialized && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <div className="flex items-center gap-3 px-4 py-2 rounded-full border-2 border-orange-500/80 bg-background/95 shadow-lg backdrop-blur-sm">
                  <span className="text-sm font-medium text-muted-foreground">Create a map</span>
                  <Button
                    size="sm"
                    variant="default"
                    className="w-9 h-9 p-0 rounded-full bg-orange-500 text-white shadow-sm transition-all duration-150 hover:bg-orange-600 hover:shadow-md hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
                    onClick={handleOpenCreateMapDialog}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            
            {/* Hover Coordinates Display */}
            {hoverCoords && (
              <div className="absolute bottom-4 left-4 z-10 p-2 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-md border border-gray-200 dark:border-neutral-600 text-gray-800 dark:text-white text-xs font-mono flex items-center gap-2 shadow-sm">
                <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span>{hoverCoords.x}, {hoverCoords.y}</span>
              </div>
            )}
            
            {/* Selection Info Display */}
            {hasSelection && (
              <div className="absolute bottom-4 left-32 z-10 p-2 bg-orange-600/90 backdrop-blur-sm rounded-md border border-orange-500 text-white text-xs flex items-center gap-3">
                <div className="flex items-center gap-2 font-mono">
                  <Square className="w-4 h-4 text-orange-200" />
                  <span>{selectionCount} tiles selected</span>
                </div>
                <div className="flex items-center gap-1">
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
            )}
            {/* Floating Toolbar (inside canvas, centered, pill-sized) */}
            <div
              ref={setBottomToolbarNode}
              className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30"
              onMouseEnter={handleBottomToolbarMouseEnter}
              onMouseLeave={handleBottomToolbarMouseLeave}
              onFocus={handleBottomToolbarFocus}
              onBlur={handleBottomToolbarBlur}
              tabIndex={bottomToolbarExpanded ? -1 : 0}
              aria-label="Tool selection"
            >
              <div
                className={`flex items-center bg-white/90 dark:bg-neutral-900/90 border border-border rounded-full shadow-md transition-all duration-300 ease-in-out ${bottomToolbarExpanded ? 'gap-1 px-2 py-1' : 'gap-0 px-1 py-1'}`}
              >
                {/* Brush Tool */}
                <div
                  className={`relative flex-shrink-0 transition-all duration-300 ease-out ${bottomToolbarExpanded || selectedTool === 'brush' ? 'opacity-100 scale-100 max-w-[3rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
                >
                  <Button
                        variant={selectedTool === 'brush' ? 'default' : 'ghost'}
                        size="sm"
                        className="w-7 h-7 p-1 rounded-full tool-button"
                        onClick={() => handleSelectTool('brush')}
                        onMouseEnter={(e) => {
                          handleShowBrushOptions();
                          showTooltipWithDelay('Brush Tool', e.currentTarget);
                        }}
                        onMouseLeave={() => {
                          handleHideBrushOptions();
                          hideTooltip();
                        }}
                      >
                        {getBrushIcon()}
                      </Button>

                  {showBrushOptions && (
                    <div
                      className="absolute bottom-full left-0 mb-1 bg-white dark:bg-neutral-900 border border-border rounded shadow-lg p-1 flex gap-1 min-w-max z-50"
                      onMouseEnter={handleShowBrushOptions}
                      onMouseLeave={handleHideBrushOptions}
                    >
                      <Button
                        variant={selectedBrushTool === 'brush' ? 'default' : 'ghost'}
                        size="sm"
                        className="w-6 h-6 p-1 rounded-full sub-tool-button"
                        onClick={() => setSelectedBrushTool('brush')}
                        onMouseEnter={(e) => showTooltipWithDelay('Brush Tool', e.currentTarget)}
                        onMouseLeave={hideTooltip}
                      >
                        <Paintbrush2 className="w-3 h-3" />
                      </Button>
                      <Button
                        variant={selectedBrushTool === 'bucket' ? 'default' : 'ghost'}
                        size="sm"
                        className="w-6 h-6 p-1 rounded-full sub-tool-button"
                        onClick={() => setSelectedBrushTool('bucket')}
                        onMouseEnter={(e) => showTooltipWithDelay('Bucket Fill', e.currentTarget)}
                        onMouseLeave={hideTooltip}
                      >
                        <PaintBucket className="w-3 h-3" />
                      </Button>
                      <Button
                        variant={selectedBrushTool === 'eraser' ? 'default' : 'ghost'}
                        size="sm"
                        className="w-6 h-6 p-1 rounded-full sub-tool-button"
                        onClick={() => setSelectedBrushTool('eraser')}
                        onMouseEnter={(e) => showTooltipWithDelay('Eraser', e.currentTarget)}
                        onMouseLeave={hideTooltip}
                      >
                        <Eraser className="w-3 h-3" />
                      </Button>
                      <Button
                        variant={selectedBrushTool === 'clear' ? 'default' : 'ghost'}
                        size="sm"
                        className="w-6 h-6 p-1 rounded-full sub-tool-button border-red-500 hover:border-red-600 hover:bg-red-50"
                        onClick={() => setShowClearLayerDialog(true)}
                        onMouseEnter={(e) => showTooltipWithDelay('Clear Layer', e.currentTarget)}
                        onMouseLeave={hideTooltip}
                      >
                        <X className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Selection Tool */}
                <div
                  className={`relative flex-shrink-0 transition-all duration-300 ease-out ${bottomToolbarExpanded || selectedTool === 'selection' ? 'opacity-100 scale-100 max-w-[3rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
                >
                  <Button
                      variant={selectedTool === 'selection' ? 'default' : 'ghost'}
                      size="sm"
                      className="w-7 h-7 p-1 rounded-full tool-button"
                      onClick={() => handleSelectTool('selection')}
                      onMouseEnter={(e) => {
                        handleShowSelectionOptions();
                        showTooltipWithDelay('Selection Tool', e.currentTarget);
                      }}
                      onMouseLeave={() => {
                        handleHideSelectionOptions();
                        hideTooltip();
                      }}
                    >
                      {getSelectionIcon()}
                    </Button>

                  {showSelectionOptions && (
                    <div
                      className="absolute bottom-full left-0 mb-1 bg-white dark:bg-neutral-900 border border-border rounded shadow-lg p-1 flex gap-1 min-w-max z-50"
                      onMouseEnter={handleShowSelectionOptions}
                      onMouseLeave={handleHideSelectionOptions}
                    >
                      <Button
                        variant={selectedSelectionTool === 'rectangular' ? 'default' : 'ghost'}
                        size="sm"
                        className="w-6 h-6 p-1 rounded-full sub-tool-button"
                        onClick={() => setSelectedSelectionTool('rectangular')}
                        onMouseEnter={(e) => showTooltipWithDelay('Rectangular Selection', e.currentTarget)}
                        onMouseLeave={hideTooltip}
                      >
                        <Square className="w-3 h-3" />
                      </Button>
                      <Button
                        variant={selectedSelectionTool === 'magic-wand' ? 'default' : 'ghost'}
                        size="sm"
                        className="w-6 h-6 p-1 rounded-full sub-tool-button"
                        onClick={() => setSelectedSelectionTool('magic-wand')}
                        onMouseEnter={(e) => showTooltipWithDelay('Magic Wand', e.currentTarget)}
                        onMouseLeave={hideTooltip}
                      >
                        <Wand2 className="w-3 h-3" />
                      </Button>
                      <Button
                        variant={selectedSelectionTool === 'same-tile' ? 'default' : 'ghost'}
                        size="sm"
                        className="w-6 h-6 p-1 rounded-full sub-tool-button"
                        onClick={() => setSelectedSelectionTool('same-tile')}
                        onMouseEnter={(e) => showTooltipWithDelay('Select Same Tile', e.currentTarget)}
                        onMouseLeave={hideTooltip}
                      >
                        <Target className="w-3 h-3" />
                      </Button>
                      <Button
                        variant={selectedSelectionTool === 'circular' ? 'default' : 'ghost'}
                        size="sm"
                        className="w-6 h-6 p-1 rounded-full sub-tool-button"
                        onClick={() => setSelectedSelectionTool('circular')}
                        onMouseEnter={(e) => showTooltipWithDelay('Circular Select', e.currentTarget)}
                        onMouseLeave={hideTooltip}
                      >
                        <Circle className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Shape Tool */}
                <div
                  className={`relative flex-shrink-0 transition-all duration-300 ease-out ${bottomToolbarExpanded || selectedTool === 'shape' ? 'opacity-100 scale-100 max-w-[3rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
                >
                  <Button
                      variant={selectedTool === 'shape' ? 'default' : 'ghost'}
                      size="sm"
                      className="w-7 h-7 p-1 rounded-full tool-button"
                      onClick={() => handleSelectTool('shape')}
                      onMouseEnter={(e) => { handleShowShapeOptions(); showTooltipWithDelay('Shape Tool', e.currentTarget); }}
                      onMouseLeave={() => { handleHideShapeOptions(); hideTooltip(); }}
                    >
                      {getShapeIcon()}
                    </Button>

                  {showShapeOptions && (
                    <div
                      className="absolute bottom-full left-0 mb-1 bg-white dark:bg-neutral-900 border border-border rounded shadow-lg p-1 flex gap-1 min-w-max z-50"
                      onMouseEnter={handleShowShapeOptions}
                      onMouseLeave={handleHideShapeOptions}
                    >
                      <Tooltip content="Rectangle Shape">
                        <Button
                          variant={selectedShapeTool === 'rectangle' ? 'default' : 'ghost'}
                          size="sm"
                          className="w-6 h-6 p-1 rounded-full sub-tool-button"
                          onClick={() => setSelectedShapeTool('rectangle')}
                        >
                          <Square className="w-3 h-3" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Circle Shape">
                        <Button
                          variant={selectedShapeTool === 'circle' ? 'default' : 'ghost'}
                          size="sm"
                          className="w-6 h-6 p-1 rounded-full sub-tool-button"
                          onClick={() => setSelectedShapeTool('circle')}
                        >
                          <Circle className="w-3 h-3" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Line Shape">
                        <Button
                          variant={selectedShapeTool === 'line' ? 'default' : 'ghost'}
                          size="sm"
                          className="w-6 h-6 p-1 rounded-full sub-tool-button"
                          onClick={() => setSelectedShapeTool('line')}
                        >
                          <Pen className="w-3 h-3" />
                        </Button>
                      </Tooltip>
                    </div>
                  )}
                </div>

                {/* Stamp Tool */}
                <div
                  className={`relative flex-shrink-0 transition-all duration-300 ease-out ${bottomToolbarExpanded || selectedTool === 'stamp' ? 'opacity-100 scale-100 max-w-[3rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
                >
                  <Button
                      variant={selectedTool === 'stamp' ? 'default' : 'ghost'}
                      size="sm"
                      className="w-7 h-7 p-1 rounded-full tool-button"
                      onClick={() => handleSelectTool('stamp')}
                      onMouseEnter={(e) => showTooltipWithDelay('Stamp Tool - Group tiles into a stamp and place them together', e.currentTarget)}
                      onMouseLeave={hideTooltip}
                    >
                      <Stamp className="w-3 h-3" />
                    </Button>

                  {selectedTool === 'stamp' && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-2 min-w-[200px] z-10">
                      <div className="flex flex-col gap-2">
                        {/* Stamp Mode Controls */}
                        <div className="flex gap-1">
                          <Tooltip content="Select and place existing stamps">
                            <Button
                              variant={stampMode === 'select' ? 'default' : 'ghost'}
                              size="sm"
                              className="flex-1 text-xs"
                              onClick={() => setStampMode('select')}
                            >
                              Select
                            </Button>
                          </Tooltip>
                          <Tooltip content="Create stamp from selection">
                            <Button
                              variant={stampMode === 'create' ? 'default' : 'ghost'}
                              size="sm"
                              className="flex-1 text-xs"
                              onClick={() => setStampMode('create')}
                            >
                              Create
                            </Button>
                          </Tooltip>
                        </div>

                        {/* Create Stamp Section */}
                        {stampMode === 'create' && (
                          <div className="border-t pt-2">
                            <div className="text-xs font-medium mb-1">Create New Stamp</div>
                            <div className="flex gap-1">
                              <input
                                type="text"
                                placeholder="Stamp name"
                                value={newStampName}
                                onChange={(e) => setNewStampName(e.target.value)}
                                className="flex-1 text-xs px-2 py-1 border rounded"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleCreateStamp();
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                className="text-xs"
                                onClick={handleCreateStamp}
                                disabled={!newStampName.trim()}
                              >
                                Create
                              </Button>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">First select tiles, then create stamp</div>
                          </div>
                        )}

                        {/* Stamps List */}
                        {stampMode === 'select' && (
                          <div className="border-t pt-2 max-h-32 overflow-y-auto">
                            <div className="text-xs font-medium mb-1">Available Stamps</div>
                            {stamps.length === 0 ? (
                              <div className="text-xs text-gray-500">No stamps created yet</div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {stamps.map((stamp) => (
                                  <div key={stamp.id} className="flex items-center gap-1">
                                    <Tooltip content={`${stamp.name} (${stamp.width}x${stamp.height})`}>
                                      <Button
                                        variant={selectedStamp === stamp.id ? 'default' : 'ghost'}
                                        size="sm"
                                        className="flex-1 text-xs justify-start"
                                        onClick={() => handleStampSelect(stamp.id)}
                                      >
                                        {stamp.name}
                                      </Button>
                                    </Tooltip>
                                    <Tooltip content="Delete stamp">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-6 h-6 p-0 text-red-500"
                                        onClick={() => handleDeleteStamp(stamp.id)}
                                      >
                                        <X className="w-3 h-3" />
                                      </Button>
                                    </Tooltip>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Eyedropper Tool */}
                <div
                  className={`flex-shrink-0 transition-all duration-300 ease-out ${bottomToolbarExpanded || selectedTool === 'eyedropper' ? 'opacity-100 scale-100 max-w-[3rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
                >
                  <Button
                    variant={selectedTool === 'eyedropper' ? 'default' : 'ghost'}
                    size="sm"
                    className="w-7 h-7 p-1 rounded-full tool-button"
                    onClick={() => handleSelectTool('eyedropper')}
                    onMouseEnter={(e) => showTooltipWithDelay('Eyedropper Tool - Pick a tile from the map to reuse', e.currentTarget)}
                    onMouseLeave={hideTooltip}
                  >
                    <Pipette className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Toaster />
      
      {/* Separate Brush Confirmation Dialog */}
      <Dialog open={showSeparateDialog} onOpenChange={setShowSeparateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Separate Brush</DialogTitle>
            <DialogDescription>
              Are you sure you want to separate this brush?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSeparateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSeparateBrush}>
              Separate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NPC / Enemy Creation Dialog */}
      <Dialog open={actorDialogState !== null} onOpenChange={(open) => (open ? void 0 : handleCloseActorDialog())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actorDialogState?.type === 'npc' ? 'Add NPC' : 'Add Enemy'}
            </DialogTitle>
            <DialogDescription>
              Define the placement details for this {actorDialogState?.type === 'npc' ? 'NPC' : 'enemy'}.
            </DialogDescription>
          </DialogHeader>
          {actorDialogState && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input
                  value={actorDialogState.name}
                  onChange={(event) => handleActorFieldChange('name', event.target.value)}
                  placeholder={actorDialogState.type === 'npc' ? 'Village Elder' : 'Goblin Scout'}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">X Position</label>
                  <Input
                    type="number"
                    value={actorDialogState.x}
                    onChange={(event) => handleActorFieldChange('x', event.target.value)}
                    min={0}
                    max={editor?.getMapWidth() ?? undefined}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Y Position</label>
                  <Input
                    type="number"
                    value={actorDialogState.y}
                    onChange={(event) => handleActorFieldChange('y', event.target.value)}
                    min={0}
                    max={editor?.getMapHeight() ?? undefined}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tileset Location</label>
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    value={actorDialogState.tilesetPath}
                    onChange={(event) => handleActorFieldChange('tilesetPath', event.target.value)}
                    placeholder="Desktop/mytilesets/npcs/mynpc.png"
                    readOnly={canUseTilesetDialog}
                    onClick={canUseTilesetDialog ? () => { void handleActorTilesetBrowse(); } : undefined}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { void handleActorTilesetBrowse(); }}
                    disabled={!canUseTilesetDialog}
                  >
                    Browse
                  </Button>
                </div>
              </div>
              {actorDialogError && (
                <div className="text-sm text-red-500">
                  {actorDialogError}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseActorDialog}>
              Cancel
            </Button>
            <Button onClick={handleActorSubmit}>
              {actorDialogState?.type === 'npc' ? 'Add NPC' : 'Add Enemy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Object Management Dialog */}
      <Dialog
        open={showObjectDialog}
        onOpenChange={(open) => {
          if (!open) {
            handleObjectDialogClose();
          } else {
            setShowObjectDialog(true);
          }
        }}
      >
        <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingObject ? `Edit ${editingObject.type}` : 'Add Object'}
            </DialogTitle>
            <DialogDescription>
              Configure {editingObject?.type || 'object'} properties for Flare engine compatibility.
            </DialogDescription>
          </DialogHeader>
          
          {objectValidationErrors.length > 0 && (
            <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-semibold mb-1">Please fix the following:</p>
              <ul className="ml-4 list-disc space-y-1">
                {objectValidationErrors.map((error, index) => (
                  <li key={`${error}-${index}`}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex-1 overflow-y-auto pr-2 minimal-scroll">
            {editingObject && (
            <div className="space-y-4 pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <Input
                    value={editingObject.name || ''}
                    onChange={(e) => setEditingObject({...editingObject, name: e.target.value})}
                    placeholder="Object name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <Input
                    value={editingObject.category || ''}
                    onChange={(e) => setEditingObject({...editingObject, category: e.target.value})}
                    placeholder={editingObject.type === 'enemy' ? 'creature' : 'block'}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">X Position</label>
                  <Input
                    type="number"
                    value={editingObject.x}
                    onChange={(e) => setEditingObject({...editingObject, x: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Y Position</label>
                  <Input
                    type="number"
                    value={editingObject.y}
                    onChange={(e) => setEditingObject({...editingObject, y: Number(e.target.value)})}
                  />
                </div>
              </div>

              {(editingObject.type === 'npc' || editingObject.type === 'enemy') && (
                <div>
                  <label className="block text-sm font-medium mb-1">Tileset Location</label>
                  <div className="flex gap-2">
                    <Input
                      className="flex-1"
                      value={getEditingObjectProperty('tilesetPath', '')}
                      onChange={(e) => updateEditingObjectProperty('tilesetPath', e.target.value)}
                      placeholder="Desktop/mytilesets/npcs/mynpc.png"
                      readOnly={canUseTilesetDialog}
                      onClick={canUseTilesetDialog ? () => { void handleEditingTilesetBrowse(); } : undefined}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { void handleEditingTilesetBrowse(); }}
                      disabled={!canUseTilesetDialog}
                    >
                      Browse
                    </Button>
                  </div>
                </div>
              )}

              {editingObject.type === 'enemy' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Level</label>
                      <Input
                        type="number"
                        value={editingObject.level || 1}
                        onChange={(e) => setEditingObject({...editingObject, level: Number(e.target.value)})}
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Number</label>
                      <Input
                        type="number"
                        value={editingObject.number || 1}
                        onChange={(e) => setEditingObject({...editingObject, number: Number(e.target.value)})}
                        min="1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Wander Radius</label>
                    <Input
                      type="number"
                      value={editingObject.wander_radius || 4}
                      onChange={(e) => setEditingObject({...editingObject, wander_radius: Number(e.target.value)})}
                      min="0"
                    />
                  </div>

                  <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
                    <div>
                      <h4 className="text-sm font-semibold">Enemy Specifications</h4>
                      <p className="text-xs text-muted-foreground">Configure Flare StatBlock-compatible values.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">XP</label>
                        <Input
                          type="number"
                          value={getEditingObjectProperty('xp', '')}
                          onChange={(e) => updateEditingObjectProperty('xp', e.target.value)}
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">XP Scaling Table</label>
                        <Input
                          value={getEditingObjectProperty('xp_scaling', '')}
                          onChange={(e) => updateEditingObjectProperty('xp_scaling', e.target.value)}
                          placeholder="tables/xp_scaling.txt"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Defeat Status</label>
                        <Input
                          value={getEditingObjectProperty('defeat_status', '')}
                          onChange={(e) => updateEditingObjectProperty('defeat_status', e.target.value)}
                          placeholder="campaign_status_id"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Convert Status</label>
                        <Input
                          value={getEditingObjectProperty('convert_status', '')}
                          onChange={(e) => updateEditingObjectProperty('convert_status', e.target.value)}
                          placeholder="campaign_status_id"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">First Defeat Loot</label>
                        <Input
                          value={getEditingObjectProperty('first_defeat_loot', '')}
                          onChange={(e) => updateEditingObjectProperty('first_defeat_loot', e.target.value)}
                          placeholder="items/id.txt"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Animations Definition</label>
                        <Input
                          value={getEditingObjectProperty('animations', '')}
                          onChange={(e) => updateEditingObjectProperty('animations', e.target.value)}
                          placeholder="animations/enemies/foo.txt"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Loot Entries (one per line)</label>
                      <textarea
                        className="w-full min-h-[80px] text-sm rounded-md border border-border bg-background px-2 py-1"
                        value={getEditingObjectProperty('loot', '')}
                        onChange={(e) => updateEditingObjectProperty('loot', e.target.value)}
                        placeholder="item_id, chance"
                      />
                    </div>

                    {(() => {
                      const lootCountRaw = getEditingObjectProperty('loot_count', '');
                      const [lootCountMin = '', lootCountMax = ''] = lootCountRaw.split(',').map((part) => part.trim());
                      return (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Loot Count Min</label>
                            <Input
                              type="number"
                              value={lootCountMin}
                              min="0"
                              onChange={(e) => {
                                const newMin = e.target.value;
                                if (!newMin) {
                                  updateEditingObjectProperty('loot_count', '');
                                } else {
                                  updateEditingObjectProperty('loot_count', lootCountMax ? `${newMin},${lootCountMax}` : newMin);
                                }
                              }}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Loot Count Max</label>
                            <Input
                              type="number"
                              value={lootCountMax}
                              min="0"
                              onChange={(e) => {
                                const newMax = e.target.value;
                                if (!lootCountMin) {
                                  updateEditingObjectProperty('loot_count', '');
                                } else {
                                  updateEditingObjectProperty('loot_count', newMax ? `${lootCountMin},${newMax}` : lootCountMin);
                                }
                              }}
                            />
                          </div>
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Threat Range (engage, stop)</label>
                        {(() => {
                          const raw = getEditingObjectProperty('threat_range', '');
                          const [engage = '', stop = ''] = raw.split(',').map((part) => part.trim());
                          return (
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                type="number"
                                value={engage}
                                onChange={(e) => {
                                  const newEngage = e.target.value;
                                  if (!newEngage) {
                                    updateEditingObjectProperty('threat_range', stop ? `0,${stop}` : '');
                                  } else {
                                    updateEditingObjectProperty('threat_range', stop ? `${newEngage},${stop}` : newEngage);
                                  }
                                }}
                              />
                              <Input
                                type="number"
                                value={stop}
                                onChange={(e) => {
                                  const newStop = e.target.value;
                                  if (!engage) {
                                    updateEditingObjectProperty('threat_range', '');
                                  } else {
                                    updateEditingObjectProperty('threat_range', newStop ? `${engage},${newStop}` : engage);
                                  }
                                }}
                              />
                            </div>
                          );
                        })()}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Flee Range</label>
                        <Input
                          type="number"
                          value={getEditingObjectProperty('flee_range', '')}
                          onChange={(e) => updateEditingObjectProperty('flee_range', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Chance Pursue (%)</label>
                        <Input
                          type="number"
                          value={getEditingObjectProperty('chance_pursue', '')}
                          onChange={(e) => updateEditingObjectProperty('chance_pursue', e.target.value)}
                          min="0"
                          max="100"
                          step="0.1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Chance Flee (%)</label>
                        <Input
                          type="number"
                          value={getEditingObjectProperty('chance_flee', '')}
                          onChange={(e) => updateEditingObjectProperty('chance_flee', e.target.value)}
                          min="0"
                          max="100"
                          step="0.1"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Waypoint Pause</label>
                        <Input
                          value={getEditingObjectProperty('waypoint_pause', '')}
                          onChange={(e) => updateEditingObjectProperty('waypoint_pause', e.target.value)}
                          placeholder="250ms"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Turn Delay</label>
                        <Input
                          value={getEditingObjectProperty('turn_delay', '')}
                          onChange={(e) => updateEditingObjectProperty('turn_delay', e.target.value)}
                          placeholder="100ms"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Combat Style</label>
                      <select
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                        value={getEditingObjectProperty('combat_style', '')}
                        onChange={(e) => updateEditingObjectProperty('combat_style', e.target.value)}
                      >
                        <option value="">Default</option>
                        <option value="default">default</option>
                        <option value="aggressive">aggressive</option>
                        <option value="passive">passive</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Triggered Powers (state,power,chance per line)</label>
                      <textarea
                        className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                        value={getEditingObjectProperty('power', '')}
                        onChange={(e) => updateEditingObjectProperty('power', e.target.value)}
                        placeholder="melee,power/melee_slash,25"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Passive Powers (one power id per line)</label>
                      <textarea
                        className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                        value={getEditingObjectProperty('passive_powers', '')}
                        onChange={(e) => updateEditingObjectProperty('passive_powers', e.target.value)}
                        placeholder="power_id"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Quest Loot (one per line: status,not_status,item_id)</label>
                      <textarea
                        className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                        value={getEditingObjectProperty('quest_loot', '')}
                        onChange={(e) => updateEditingObjectProperty('quest_loot', e.target.value)}
                        placeholder="status_required,status_block,item_id"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Flee Duration</label>
                        <Input
                          value={getEditingObjectProperty('flee_duration', '')}
                          onChange={(e) => updateEditingObjectProperty('flee_duration', e.target.value)}
                          placeholder="1.5s"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Flee Cooldown</label>
                        <Input
                          value={getEditingObjectProperty('flee_cooldown', '')}
                          onChange={(e) => updateEditingObjectProperty('flee_cooldown', e.target.value)}
                          placeholder="5s"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { key: 'humanoid', label: 'Humanoid' },
                        { key: 'lifeform', label: 'Lifeform' },
                        { key: 'flying', label: 'Flying' },
                        { key: 'intangible', label: 'Intangible' },
                        { key: 'facing', label: 'Facing' },
                        { key: 'suppress_hp', label: 'Hide HP Bar' }
                      ].map((field) => (
                        <label key={field.key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={getEditingObjectProperty(field.key, 'false') === 'true'}
                            onChange={(e) => updateEditingObjectBoolean(field.key, e.target.checked)}
                          />
                          {field.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {editingObject.type === 'npc' && (
                <>
                  <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
                    <div>
                      <h4 className="text-sm font-semibold">Dialog</h4>
                      <p className="text-xs text-muted-foreground">Configure dialog tree content and metadata.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Dialog ID</label>
                        <Input
                          value={getEditingObjectProperty('dialog.id', '')}
                          onChange={(e) => updateEditingObjectProperty('dialog.id', e.target.value)}
                          placeholder="villager_intro"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Topic</label>
                        <Input
                          value={getEditingObjectProperty('dialog.topic', '')}
                          onChange={(e) => updateEditingObjectProperty('dialog.topic', e.target.value)}
                          placeholder="Greetings"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Group</label>
                        <Input
                          value={getEditingObjectProperty('dialog.group', '')}
                          onChange={(e) => updateEditingObjectProperty('dialog.group', e.target.value)}
                          placeholder="main_story"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Voice File(s)</label>
                        <textarea
                          className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                          value={getEditingObjectProperty('dialog.voice', '')}
                          onChange={(e) => updateEditingObjectProperty('dialog.voice', e.target.value)}
                          placeholder="voice/npcs/intro.ogg"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Lines (Him)</label>
                        <textarea
                          className="w-full min-h-[80px] text-sm rounded-md border border-border bg-background px-2 py-1"
                          value={getEditingObjectProperty('dialog.him', '')}
                          onChange={(e) => updateEditingObjectProperty('dialog.him', e.target.value)}
                          placeholder="Hello there!"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Lines (Her)</label>
                        <textarea
                          className="w-full min-h-[80px] text-sm rounded-md border border-border bg-background px-2 py-1"
                          value={getEditingObjectProperty('dialog.her', '')}
                          onChange={(e) => updateEditingObjectProperty('dialog.her', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Lines (You)</label>
                        <textarea
                          className="w-full min-h-[80px] text-sm rounded-md border border-border bg-background px-2 py-1"
                          value={getEditingObjectProperty('dialog.you', '')}
                          onChange={(e) => updateEditingObjectProperty('dialog.you', e.target.value)}
                          placeholder="What brings you here?"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Portrait (Him)</label>
                        <textarea
                          className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                          value={getEditingObjectProperty('dialog.portrait_him', '')}
                          onChange={(e) => updateEditingObjectProperty('dialog.portrait_him', e.target.value)}
                          placeholder="portraits/npcs/villager.png"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Portrait (Her)</label>
                        <textarea
                          className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                          value={getEditingObjectProperty('dialog.portrait_her', '')}
                          onChange={(e) => updateEditingObjectProperty('dialog.portrait_her', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Portrait (You)</label>
                        <textarea
                          className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                          value={getEditingObjectProperty('dialog.portrait_you', '')}
                          onChange={(e) => updateEditingObjectProperty('dialog.portrait_you', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Response IDs (one per line, must precede dialog text)</label>
                      <textarea
                        className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                        value={getEditingObjectProperty('dialog.response', '')}
                        onChange={(e) => updateEditingObjectProperty('dialog.response', e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { key: 'dialog.allow_movement', label: 'Allow Movement' },
                        { key: 'dialog.take_a_party', label: 'Take/Release Party' },
                        { key: 'dialog.response_only', label: 'Response Only' }
                      ].map((field) => (
                        <label key={field.key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={getEditingObjectProperty(field.key, 'false') === 'true'}
                            onChange={(e) => updateEditingObjectBoolean(field.key, e.target.checked)}
                          />
                          {field.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
                    <div>
                      <h4 className="text-sm font-semibold">NPC Details</h4>
                      <p className="text-xs text-muted-foreground">Configure appearance, behavior, and requirements.</p>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">NPC Name</label>
                        <Input
                          value={getEditingObjectProperty('npc.name', editingObject.name || '')}
                          onChange={(e) => updateEditingObjectProperty('npc.name', e.target.value)}
                          placeholder="Villager"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Portrait</label>
                        <Input
                          value={getEditingObjectProperty('npc.portrait', '')}
                          onChange={(e) => updateEditingObjectProperty('npc.portrait', e.target.value)}
                          placeholder="portraits/npcs/villager.png"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Definition File</label>
                        <Input
                          value={getEditingObjectProperty('npc.filename', '')}
                          onChange={(e) => updateEditingObjectProperty('npc.filename', e.target.value)}
                          placeholder="npcs/villager.txt"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Direction</label>
                        <Input
                          value={getEditingObjectProperty('npc.direction', '')}
                          onChange={(e) => updateEditingObjectProperty('npc.direction', e.target.value)}
                          placeholder="south"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Waypoints (x,y per line)</label>
                        <textarea
                          className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                          value={getEditingObjectProperty('npc.waypoints', '')}
                          onChange={(e) => updateEditingObjectProperty('npc.waypoints', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Wander Radius</label>
                        <Input
                          type="number"
                          value={getEditingObjectProperty('npc.wander_radius', '')}
                          onChange={(e) => updateEditingObjectProperty('npc.wander_radius', e.target.value)}
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { key: 'npc.show_on_minimap', label: 'Show on Minimap', defaultValue: 'true' },
                        { key: 'npc.talker', label: 'Talkable', defaultValue: 'true' },
                        { key: 'npc.vendor', label: 'Vendor', defaultValue: 'false' }
                      ].map((field) => (
                        <label key={field.key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={getEditingObjectProperty(field.key, field.defaultValue || 'false') === 'true'}
                            onChange={(e) => updateEditingObjectBoolean(field.key, e.target.checked)}
                          />
                          {field.label}
                        </label>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Requires Status (one per line)</label>
                        <textarea
                          className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                          value={getEditingObjectProperty('npc.requires_status', '')}
                          onChange={(e) => updateEditingObjectProperty('npc.requires_status', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Requires Not Status</label>
                        <textarea
                          className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                          value={getEditingObjectProperty('npc.requires_not_status', '')}
                          onChange={(e) => updateEditingObjectProperty('npc.requires_not_status', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Requires Item (one per line)</label>
                        <textarea
                          className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                          value={getEditingObjectProperty('npc.requires_item', '')}
                          onChange={(e) => updateEditingObjectProperty('npc.requires_item', e.target.value)}
                          placeholder="items/potion:2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Requires Not Item</label>
                        <textarea
                          className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                          value={getEditingObjectProperty('npc.requires_not_item', '')}
                          onChange={(e) => updateEditingObjectProperty('npc.requires_not_item', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Requires Level ≥</label>
                        <Input
                          type="number"
                          value={getEditingObjectProperty('npc.requires_level', '')}
                          onChange={(e) => updateEditingObjectProperty('npc.requires_level', e.target.value)}
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Requires Level &lt;</label>
                        <Input
                          type="number"
                          value={getEditingObjectProperty('npc.requires_not_level', '')}
                          onChange={(e) => updateEditingObjectProperty('npc.requires_not_level', e.target.value)}
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Requires Class</label>
                        <Input
                          value={getEditingObjectProperty('npc.requires_class', '')}
                          onChange={(e) => updateEditingObjectProperty('npc.requires_class', e.target.value)}
                          placeholder="warrior"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Requires Currency ≥</label>
                        <Input
                          type="number"
                          value={getEditingObjectProperty('npc.requires_currency', '')}
                          onChange={(e) => updateEditingObjectProperty('npc.requires_currency', e.target.value)}
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Requires Currency &lt;</label>
                        <Input
                          type="number"
                          value={getEditingObjectProperty('npc.requires_not_currency', '')}
                          onChange={(e) => updateEditingObjectProperty('npc.requires_not_currency', e.target.value)}
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Requires Not Class</label>
                        <Input
                          value={getEditingObjectProperty('npc.requires_not_class', '')}
                          onChange={(e) => updateEditingObjectProperty('npc.requires_not_class', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h5 className="text-sm font-semibold">Vendor Options</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Vendor Requires Status</label>
                          <textarea
                            className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                            value={getEditingObjectProperty('npc.vendor_requires_status', '')}
                            onChange={(e) => updateEditingObjectProperty('npc.vendor_requires_status', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Vendor Requires Not Status</label>
                          <textarea
                            className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                            value={getEditingObjectProperty('npc.vendor_requires_not_status', '')}
                            onChange={(e) => updateEditingObjectProperty('npc.vendor_requires_not_status', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Constant Stock (items per line)</label>
                          <textarea
                            className="w-full min-h-[80px] text-sm rounded-md border border-border bg-background px-2 py-1"
                            value={getEditingObjectProperty('npc.constant_stock', '')}
                            onChange={(e) => updateEditingObjectProperty('npc.constant_stock', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Status Stock (status: items)</label>
                          <textarea
                            className="w-full min-h-[80px] text-sm rounded-md border border-border bg-background px-2 py-1"
                            value={getEditingObjectProperty('npc.status_stock', '')}
                            onChange={(e) => updateEditingObjectProperty('npc.status_stock', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Random Stock (loot definitions)</label>
                          <textarea
                            className="w-full min-h-[80px] text-sm rounded-md border border-border bg-background px-2 py-1"
                            value={getEditingObjectProperty('npc.random_stock', '')}
                            onChange={(e) => updateEditingObjectProperty('npc.random_stock', e.target.value)}
                          />
                        </div>
                      </div>

                      {(() => {
                        const raw = getEditingObjectProperty('npc.random_stock_count', '');
                        const [minCount = '', maxCount = ''] = raw.split(',').map((part) => part.trim());
                        return (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium mb-1">Random Stock Min</label>
                              <Input
                                type="number"
                                value={minCount}
                                min="0"
                                onChange={(e) => {
                                  const newMin = e.target.value;
                                  if (!newMin) {
                                    updateEditingObjectProperty('npc.random_stock_count', maxCount ? `0,${maxCount}` : '');
                                  } else {
                                    updateEditingObjectProperty('npc.random_stock_count', maxCount ? `${newMin},${maxCount}` : newMin);
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Random Stock Max</label>
                              <Input
                                type="number"
                                value={maxCount}
                                min="0"
                                onChange={(e) => {
                                  const newMax = e.target.value;
                                  if (!minCount) {
                                    updateEditingObjectProperty('npc.random_stock_count', '');
                                  } else {
                                    updateEditingObjectProperty('npc.random_stock_count', newMax ? `${minCount},${newMax}` : minCount);
                                  }
                                }}
                              />
                            </div>
                          </div>
                        );
                      })()}

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Buy Ratio</label>
                          <Input
                            type="number"
                            value={getEditingObjectProperty('npc.vendor_ratio_buy', '')}
                            onChange={(e) => updateEditingObjectProperty('npc.vendor_ratio_buy', e.target.value)}
                            step="0.01"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Sell Ratio</label>
                          <Input
                            type="number"
                            value={getEditingObjectProperty('npc.vendor_ratio_sell', '')}
                            onChange={(e) => updateEditingObjectProperty('npc.vendor_ratio_sell', e.target.value)}
                            step="0.01"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Sell Ratio (Old)</label>
                          <Input
                            type="number"
                            value={getEditingObjectProperty('npc.vendor_ratio_sell_old', '')}
                            onChange={(e) => updateEditingObjectProperty('npc.vendor_ratio_sell_old', e.target.value)}
                            step="0.01"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Vox Intro (one file per line)</label>
                      <textarea
                        className="w-full min-h-[60px] text-sm rounded-md border border-border bg-background px-2 py-1"
                        value={getEditingObjectProperty('npc.vox_intro', '')}
                        onChange={(e) => updateEditingObjectProperty('npc.vox_intro', e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {editingObject.type === 'event' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Activate</label>
                    <Input
                      value={editingObject.activate || 'on_trigger'}
                      onChange={(e) => setEditingObject({...editingObject, activate: e.target.value})}
                      placeholder="on_trigger, on_load, etc."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Hotspot</label>
                    <Input
                      value={editingObject.hotspot || '0,0,1,1'}
                      onChange={(e) => setEditingObject({...editingObject, hotspot: e.target.value})}
                      placeholder="x,y,width,height"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Tooltip</label>
                    <Input
                      value={editingObject.tooltip || ''}
                      onChange={(e) => setEditingObject({...editingObject, tooltip: e.target.value})}
                      placeholder="Hover text"
                    />
                  </div>
                </>
              )}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 flex-shrink-0">
            <Button variant="outline" onClick={handleObjectDialogClose}>
              Cancel
            </Button>
            <Button onClick={handleObjectDialogSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateMapDialog} onOpenChange={setShowCreateMapDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Map</DialogTitle>
            <DialogDescription>
              Set the name, dimensions, and starting status for your new map.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Map Name
              </label>
              <Input
                value={newMapName}
                onChange={(e) => setNewMapName(e.target.value)}
                placeholder="Enter map name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Width (tiles)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={newMapWidth}
                  onChange={(e) => setNewMapWidth(Math.max(1, Number.parseInt(e.target.value, 10) || 0))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Height (tiles)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={newMapHeight}
                  onChange={(e) => setNewMapHeight(Math.max(1, Number.parseInt(e.target.value, 10) || 0))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <label htmlFor="starting-map-checkbox" className="text-sm font-medium text-muted-foreground">
                  Starting Map
                </label>
                <Tooltip content="If this map is the map that players will start the game then mark this option">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
                </Tooltip>
              </div>
              <input
                id="starting-map-checkbox"
                type="checkbox"
                className="h-4 w-4 rounded border border-border accent-orange-500"
                checked={newMapStarting}
                onChange={(e) => setNewMapStarting(e.target.checked)}
                aria-checked={newMapStarting}
                aria-label="Set this map as the starting map"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateMapDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmCreateMap}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Hero Position Edit Dialog */}
      <Dialog open={showHeroEditDialog} onOpenChange={setShowHeroEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Hero Position</DialogTitle>
            <DialogDescription>
              Set the hero spawn position on the map.
            </DialogDescription>
          </DialogHeader>
          
          {heroEditData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">X Position</label>
                  <Input
                    type="number"
                    min={0}
                    max={heroEditData.mapWidth - 1}
                    defaultValue={heroEditData.currentX}
                    onChange={(e) => {
                      const newX = parseInt(e.target.value);
                      if (!isNaN(newX)) {
                        setHeroEditData({
                          ...heroEditData,
                          currentX: newX
                        });
                      }
                    }}
                  />
                  <span className="text-xs text-gray-500">
                    (0 - {heroEditData.mapWidth - 1})
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Y Position</label>
                  <Input
                    type="number"
                    min={0}
                    max={heroEditData.mapHeight - 1}
                    defaultValue={heroEditData.currentY}
                    onChange={(e) => {
                      const newY = parseInt(e.target.value);
                      if (!isNaN(newY)) {
                        setHeroEditData({
                          ...heroEditData,
                          currentY: newY
                        });
                      }
                    }}
                  />
                  <span className="text-xs text-gray-500">
                    (0 - {heroEditData.mapHeight - 1})
                  </span>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                Current position: ({heroEditData.currentX}, {heroEditData.currentY})
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={handleHeroEditCancel}>
              Cancel
            </Button>
            <Button onClick={() => heroEditData && handleHeroEditConfirm(heroEditData.currentX, heroEditData.currentY)}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
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
              Map files and tile definitions saved to 
              <span className="inline-flex items-center gap-1 font-medium text-white">
                <Folder className="w-4 h-4" />
                Export
              </span>.
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

