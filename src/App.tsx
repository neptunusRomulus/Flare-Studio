import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Tooltip from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Upload, Download, Undo2, Redo2, X, ZoomIn, ZoomOut, RotateCcw, Map, Minus, Square, Settings, Mouse, MousePointer2, Eye, EyeOff, Move, Circle, Paintbrush2, PaintBucket, Eraser, MousePointer, Wand2, Target, Shapes, Pen, Stamp, Pipette, Sun, Moon, Blend, MapPin, MapPinOff, Save, Scan, Link2, Scissors, Trash2, Check, HelpCircle, Folder, Shield, Plus, Image, Grid, Box, Users, User, Locate, Clock, Menu, ChevronLeft, ChevronRight, GripVertical, MessageSquare, ChevronDown, ChevronUp, ArrowLeft, Gift, Coins, Sparkles, Heart, Zap, Volume2, Film, Tag, Package, AlignLeft, Sword, ChevronsUpDown, AlertTriangle, Book, GitBranch, Apple, Skull, Swords, RefreshCw, Repeat, Dices, Timer, UserPlus } from 'lucide-react';
import { TileMapEditor } from './editor/TileMapEditor';
import type { EditorProjectData } from './editor/TileMapEditor';
import { TileLayer, MapObject, DialogueLine, DialogueRequirement, DialogueReward, DialogueWorldEffect, DialogueTree, FlareNPC } from './types';
import { serializeNpcToFlare } from './utils/flareNpcUtils';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import WelcomeScreen from './components/WelcomeScreen';
import OverwriteExportDialog from './components/OverwriteExportDialog';
import flareIconUrl from '/flare-ico.png?url';

interface MapConfig {
  name: string;
  width: number;
  height: number;
  tileSize: number;
  location: string;
  isStartingMap?: boolean;
}

interface EditorTab {
  id: string;
  name: string;
  projectPath?: string | null;
  config?: EditorProjectData | MapConfig | null;
}

type PropertyType =
  | 'int'
  | 'float'
  | 'bool'
  | 'filename'
  | 'duration'
  | 'intPair'
  | 'floatPair'
  | 'direction'
  | 'point'
  | 'predefined'
  | 'list'
  | 'string';

interface PropertySpec {
  type: PropertyType;
  min?: number;
  max?: number;
  options?: string[];
}

type ItemRole = 'equipment' | 'consumable' | 'quest' | 'resource' | 'book' | 'unspecified';
type ItemResourceSubtype = 'currency' | 'material' | '';

const ITEM_ROLE_META: Record<ItemRole, { label: string; badgeClass: string; description?: string }> = {
  equipment: { label: 'Equipment', badgeClass: 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30', description: 'Weapons, armor, wearable gear' },
  consumable: { label: 'Consumable', badgeClass: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', description: 'Potions, scrolls, buffs' },
  quest: { label: 'Quest / Key Item', badgeClass: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30', description: 'Quest progression items' },
  resource: { label: 'Resource', badgeClass: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30', description: 'Currency or crafting mats' },
  book: { label: 'Book / Lore', badgeClass: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30', description: 'Readable lore items' },
  unspecified: { label: 'Unspecified', badgeClass: 'bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30', description: 'No role set' }
};

const ITEM_ROLE_SELECTIONS: Array<{ id: ItemRole; label: string; description: string }> = [
  { id: 'equipment', label: 'Equipment', description: 'Wearable gear with stats, damage/absorb, requirements' },
  { id: 'consumable', label: 'Consumable', description: 'Usable items that trigger a power; can stack' },
  { id: 'quest', label: 'Quest / Key Item', description: 'Progression items; usually unsellable and single stack' },
  { id: 'resource', label: 'Resource (Currency / Material)', description: 'Currencies or crafting materials; stackable loot' },
  { id: 'book', label: 'Book / Lore', description: 'Readable items that open a book file' }
];

const RESOURCE_SUBTYPE_META: Record<Exclude<ItemResourceSubtype, ''>, { label: string; hint: string; badgeClass: string }> = {
  currency: { label: 'Currency', hint: 'Gold, coins; high stack, symmetric price', badgeClass: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' },
  material: { label: 'Material', hint: 'Crafting mats or generic loot', badgeClass: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' }
};

// Helper sets used by validation
const CARDINAL_DIRECTIONS = new Set(['N','NE','E','SE','S','SW','W','NW']);
const BOOLEAN_STRINGS = new Set(['true','false','1','0']);

const STARTING_MAP_INVALID_NAMES = new Set(['', 'untitled map', 'map name', 'untitled_map']);

const sanitizeMapFileBase = (rawName: string): string => {
  const sanitized = rawName
    .replace(/[<>:"/|?*]/g, '_')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_');
  return sanitized || 'Untitled_Map';
};

const computeIntermapTarget = (starting: boolean, rawName: string | undefined | null): string | null => {
  if (!starting) return null;
  const name = (rawName ?? '').trim();
  if (!name) return null;
  if (STARTING_MAP_INVALID_NAMES.has(name.toLowerCase())) return null;
  const sanitized = sanitizeMapFileBase(name);
  return `maps/${sanitized}.txt`;
};

const buildSpawnContent = (intermapTarget: string | null): string => [
  '# this file is automatically loaded when a New Game starts.',
  "# it's a dummy map to send the player to the actual starting point.",
  '',
  '[header]',
  'width=1',
  'height=1',
  'hero_pos=0,0',
  '',
  '[event]',
  'type=event',
  'location=0,0,1,1',
  'activate=on_load',
  `intermap=${intermapTarget ?? ''}`,
  ''
].join('\n');

const extractSpawnIntermapValue = (content: string | null | undefined): string | null => {
  if (!content) return null;
  const match = content.match(/^\s*intermap\s*=\s*(.*)$/m);
  if (!match) return null;
  const value = match[1].trim();
  return value ? value : null;
};

function validateValue(key: string, trimmed: string, spec: PropertySpec): string | null {
  switch (spec.type) {
    case 'int': {
      const parsed = Number.parseInt(trimmed, 10);
      if (Number.isNaN(parsed)) return `${key} must be an integer.`;
      if (spec.min !== undefined && parsed < spec.min) return `${key} must be greater than or equal to ${spec.min}.`;
      if (spec.max !== undefined && parsed > spec.max) return `${key} must be less than or equal to ${spec.max}.`;
      return null;
    }
    case 'float': {
      const parsed = Number.parseFloat(trimmed);
      if (Number.isNaN(parsed)) return `${key} must be a number.`;
      if (spec.min !== undefined && parsed < spec.min) return `${key} must be greater than or equal to ${spec.min}.`;
      if (spec.max !== undefined && parsed > spec.max) return `${key} must be less than or equal to ${spec.max}.`;
      return null;
    }
    case 'bool': {
      if (!BOOLEAN_STRINGS.has(trimmed.toLowerCase())) return `${key} must be true or false.`;
      return null;
    }
    case 'filename': {
      if (!trimmed) return `${key} cannot be empty.`;
      return null;
    }
    case 'duration': {
      if (!/^\d+(ms|s)?$/i.test(trimmed)) return `${key} must be a duration such as 200ms or 2s.`;
      return null;
    }
    case 'intPair': {
      const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length === 0 || parts.length > 2) return `${key} must contain one or two comma-separated integers.`;
      for (const part of parts) {
        if (!/^-?\d+$/.test(part)) return `${key} must contain valid integers.`;
        const parsed = Number.parseInt(part, 10);
        if (spec.min !== undefined && parsed < spec.min) return `${key} values must be greater than or equal to ${spec.min}.`;
        if (spec.max !== undefined && parsed > spec.max) return `${key} values must be less than or equal to ${spec.max}.`;
      }
      return null;
    }
    case 'floatPair': {
      const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length === 0 || parts.length > 2) return `${key} must contain one or two comma-separated numbers.`;
      for (const part of parts) {
        const parsed = Number.parseFloat(part);
        if (Number.isNaN(parsed)) return `${key} must contain valid numbers.`;
        if (spec.min !== undefined && parsed < spec.min) return `${key} values must be greater than or equal to ${spec.min}.`;
        if (spec.max !== undefined && parsed > spec.max) return `${key} values must be less than or equal to ${spec.max}.`;
      }
      return null;
    }
    case 'direction': {
      const upper = trimmed.toUpperCase();
      if (CARDINAL_DIRECTIONS.has(upper)) return null;
      const parsed = Number.parseInt(trimmed, 10);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 7) return null;
      return `${key} must be a direction (N, NE, ... , NW) or a number between 0 and 7.`;
    }
    case 'point': {
      const parts = trimmed.split(',').map(p => p.trim());
      if (parts.length !== 2 || !parts.every(part => /^-?\d+$/.test(part))) return `${key} must be two comma-separated integers.`;
      return null;
    }
    case 'predefined': {
      if (spec.options && !spec.options.includes(trimmed)) return `${key} must be one of: ${spec.options.join(', ')}.`;
      return null;
    }
    case 'list':
    case 'string':
    default:
      return null;
  }
}

// Property specs for NPCs and enemies (left empty for now).
const ENEMY_PROPERTY_SPECS: Record<string, PropertySpec> = {};
const NPC_PROPERTY_SPECS: Record<string, PropertySpec> = {};

type RuleStartType = 'player' | 'game';

interface RuleTriggerOption {
  id: string;
  label: string;
  tooltip: string;
  icon: React.ComponentType<{ className?: string }>;
  startType: RuleStartType;
}

const PLAYER_TRIGGER_OPTIONS: RuleTriggerOption[] = [
  { id: 'item-used', label: 'Item Used', tooltip: 'When an item is used', icon: Apple, startType: 'player' },
  { id: 'skill-used', label: 'Skill Used', tooltip: 'When a skill is used', icon: Zap, startType: 'player' },
  { id: 'npc-interaction', label: 'NPC Interaction', tooltip: 'When an NPC option is chosen', icon: UserPlus, startType: 'player' }
];

const GAME_TRIGGER_OPTIONS: RuleTriggerOption[] = [
  { id: 'enemy-dies', label: 'Enemy dies', tooltip: 'Enemy dies', icon: Skull, startType: 'game' },
  { id: 'player-enters-area', label: 'Player enters area', tooltip: 'Player enters area', icon: MapPin, startType: 'game' },
  { id: 'combat-starts', label: 'Combat starts', tooltip: 'Combat starts', icon: Swords, startType: 'game' },
  { id: 'player-hit', label: 'Player is hit', tooltip: 'Player is hit', icon: Zap, startType: 'game' },
  { id: 'health-low', label: 'Health very low', tooltip: 'Health very low', icon: Heart, startType: 'game' },
  { id: 'effect-used', label: 'Another effect is used', tooltip: 'Another effect is used', icon: Repeat, startType: 'game' },
  { id: 'after-delay', label: 'After a delay', tooltip: 'After a delay', icon: Clock, startType: 'game' },
  { id: 'repeats-while-active', label: 'Repeats while active', tooltip: 'Repeats while active', icon: RefreshCw, startType: 'game' },
  { id: 'random-chance', label: 'Random chance', tooltip: 'Random chance', icon: Dices, startType: 'game' },
  { id: 'every-x-seconds', label: 'Every X seconds', tooltip: 'Every X seconds', icon: Timer, startType: 'game' }
];

const ALL_RULE_TRIGGER_OPTIONS: RuleTriggerOption[] = [...PLAYER_TRIGGER_OPTIONS, ...GAME_TRIGGER_OPTIONS];
const RULE_TRIGGER_LOOKUP: Record<string, RuleTriggerOption> = ALL_RULE_TRIGGER_OPTIONS.reduce((acc, option) => {
  acc[option.id] = option;
  return acc;
}, {} as Record<string, RuleTriggerOption>);

interface RuleActionGroup {
  id: string;
  title: string;
  subtitle?: string;
  actions: Array<{ id: string; label: string }>;
}

const RULE_ACTION_GROUPS: RuleActionGroup[] = [
  {
    id: 'items',
    title: 'Give or take items',
    subtitle: 'Modify player inventory',
    actions: [
      { id: 'give-loot', label: 'Give loot' },
      { id: 'remove-item', label: 'Remove item' }
    ]
  },
  {
    id: 'flags',
    title: 'Change a game flag',
    subtitle: 'Toggle world state',
    actions: [
      { id: 'set-flag', label: 'Set flag' },
      { id: 'clear-flag', label: 'Clear flag' }
    ]
  },
  {
    id: 'quests',
    title: 'Advance a quest',
    subtitle: 'Progress quest state',
    actions: [
      { id: 'complete-quest', label: 'Complete quest' },
      { id: 'next-step', label: 'Next step' }
    ]
  },
  {
    id: 'advanced',
    title: '(Advanced) Run advanced logic',
    subtitle: 'Custom or scripted logic',
    actions: [
      { id: 'advanced-logic', label: 'Run advanced logic' }
    ]
  }
];

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
  const [createMapError, setCreateMapError] = useState<string | null>(null);
  const [reservedMapNames, setReservedMapNames] = useState<string[]>([]);
  const [newMapStarting, setNewMapStarting] = useState(false);
  // Editor tabs
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

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
  // Layers panel expand/collapse state
  const [layersPanelExpanded, setLayersPanelExpanded] = useState(false);
  // Individual layer hover state
  const [hoveredLayerId, setHoveredLayerId] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [activeHelpTab, setActiveHelpTab] = useState('engine');
  const [showTooltip, setShowTooltip] = useState(true);
  // Force refresh counter to trigger re-render when editor-managed tabs change
  const [tabTick, setTabTick] = useState(0);
  const [toolbarExpanded, setToolbarExpanded] = useState(true);
  const toolbarCollapseTimer = useRef<number | null>(null);
  const toolbarContainerRef = useRef<HTMLDivElement | null>(null);
  const [bottomToolbarExpanded, setBottomToolbarExpanded] = useState(true);
  const bottomToolbarCollapseTimer = useRef<number | null>(null);
  const bottomToolbarContainerRef = useRef<HTMLDivElement | null>(null);
  const [brushToolbarExpanded, setBrushToolbarExpanded] = useState(true);
  const brushToolbarCollapseTimer = useRef<number | null>(null);
  const brushToolbarContainerRef = useRef<HTMLDivElement | null>(null);
  // Left sidebar buttons expand/collapse (independent)
  // Left bottom action buttons are always expanded now; no local state required.
  const [pendingMapConfig, setPendingMapConfig] = useState<EditorProjectData | null>(null);
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

  // Left bottom action buttons are always expanded now; collapse behavior removed.

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

  const clearBrushToolbarCollapseTimer = useCallback(() => {
    if (brushToolbarCollapseTimer.current !== null) {
      window.clearTimeout(brushToolbarCollapseTimer.current);
      brushToolbarCollapseTimer.current = null;
    }
  }, []);

  const scheduleBrushToolbarCollapse = useCallback(() => {
    // Intentionally disabled: keep brush toolbar expanded permanently.
    clearBrushToolbarCollapseTimer();
  }, [clearBrushToolbarCollapseTimer]);

  const showBrushToolbarTemporarily = useCallback(() => {
    setBrushToolbarExpanded(true);
    scheduleBrushToolbarCollapse();
  }, [scheduleBrushToolbarCollapse]);
  const setBrushToolbarNode = useCallback((node: HTMLDivElement | null) => {
    brushToolbarContainerRef.current = node;
  }, []);

  const setBottomToolbarNode = useCallback((node: HTMLDivElement | null) => {
    toolbarRef.current = node;
    bottomToolbarContainerRef.current = node;
  }, []);

  const handleSelectTool = useCallback((tool: 'brush' | 'selection' | 'shape' | 'stamp' | 'eyedropper') => {
    setSelectedTool(tool);
    showBottomToolbarTemporarily();
  }, [showBottomToolbarTemporarily]);

  const handleToggleBrushTool = useCallback((tool: 'move' | 'merge' | 'separate' | 'remove') => {
    setBrushTool((current) => (current === tool ? 'none' : tool));
    showBrushToolbarTemporarily();
  }, [showBrushToolbarTemporarily]);

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
  const [confirmAction, setConfirmAction] = useState<null | { type: 'removeBrush' | 'removeTileset' | 'removeTab'; payload?: number | { layerType: string; tabId: number } }>(null);
  // Keep a stable React state for the tab that was requested to be deleted so
  // the confirmation handler can use the exact intended tab (avoids stale refs).
  const [tabToDelete, setTabToDelete] = useState<null | { layerType: string; tabId: number }>(null);
  // Keep an optional ref as a fallback for older flows
  const confirmPayloadRef = React.useRef<null | { layerType: string; tabId: number }>(null);
  
  // Settings states
  const [mapName, setMapName] = useState('Untitled Map');
  const [isStartingMap, setIsStartingMap] = useState(false);
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
  const [startingMapIntermap, setStartingMapIntermap] = useState<string | null>(null);
  const previousMapNameRef = useRef(mapName);

  // Ensure a tab is always selected when tabs exist but activeTabId is null
  // This handles the case where the UI shows tabs but none appears selected
  useEffect(() => {
    if (tabs.length > 0 && !activeTabId) {
      // Find tabs for the current project
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
        // Fallback: select first available tab
        console.log('Auto-selecting first available tab:', tabs[0].name);
        setActiveTabId(tabs[0].id);
      }
    }
  }, [tabs, activeTabId, currentProjectPath]);

  // Auto-save session to project folder when tabs or activeTabId changes
  useEffect(() => {
    const saveSession = async () => {
      if (!currentProjectPath || !window.electronAPI?.writeSession) return;
      if (tabs.length === 0) return;
      
      try {
        // Only save tabs that belong to this project
        const normalizedProjectPath = currentProjectPath.replace(/\\/g, '/').toLowerCase();
        const projectTabs = tabs
          .filter(t => {
            const normalizedTabPath = t.projectPath?.replace(/\\/g, '/').toLowerCase() || '';
            return normalizedTabPath === normalizedProjectPath;
          })
          .map(t => ({
            id: t.id,
            name: t.name,
            projectPath: t.projectPath ?? undefined // Convert null to undefined for type compatibility
          }));
        
        if (projectTabs.length === 0) return;
        
        // Deduplicate tabs by name (keep only the first occurrence of each map name)
        const seenNames = new Set<string>();
        const uniqueTabs = projectTabs.filter(t => {
          const lowerName = t.name.toLowerCase();
          if (seenNames.has(lowerName)) {
            console.log('Session save: removing duplicate tab:', t.name);
            return false;
          }
          seenNames.add(lowerName);
          return true;
        });
        
        // Only save activeTabId if it's a valid tab in this project
        // This prevents saving null during the brief moment between setTabs and setActiveTabId
        const validActiveTabId = activeTabId && uniqueTabs.some(t => t.id === activeTabId) 
          ? activeTabId 
          : (uniqueTabs.length > 0 ? uniqueTabs[0].id : null);
        
        const sessionData = {
          tabs: uniqueTabs,
          activeTabId: validActiveTabId,
          lastOpened: new Date().toISOString()
        };
        
        await window.electronAPI.writeSession(currentProjectPath, sessionData);
        console.log('Session saved to project:', currentProjectPath, uniqueTabs.length, 'tabs');
      } catch (e) {
        console.warn('Failed to save session to project:', e);
      }
    };
    
    saveSession();
  }, [tabs, activeTabId, currentProjectPath]);

  const writeSpawnFile = useCallback(async (starting: boolean, mapNameOverride?: string) => {
    const effectiveName = mapNameOverride ?? mapName;
    const intermapTarget = computeIntermapTarget(starting, effectiveName);
    if (!currentProjectPath || !window.electronAPI?.updateSpawnFile) {
      setStartingMapIntermap(intermapTarget);
      return;
    }
    const spawnContent = buildSpawnContent(intermapTarget);
    try {
      const success = await window.electronAPI.updateSpawnFile(currentProjectPath, spawnContent);
      if (success) {
        setStartingMapIntermap(intermapTarget);
      }
    } catch (error) {
      console.error('Failed to update spawn file:', error);
    }
  }, [mapName, currentProjectPath]);

  const updateStartingMap = useCallback(
    (nextValue: boolean, options?: { propagate?: boolean; mapNameOverride?: string }) => {
      setIsStartingMap(nextValue);
      if (options?.propagate === false) return;
      void writeSpawnFile(nextValue, options?.mapNameOverride);
    },
    [writeSpawnFile]
  );
  
  // Tab helpers
  const createTabFor = (name: string, projectPath?: string | null, config?: EditorProjectData | MapConfig | null) => {
    const id = Date.now().toString();
    const safeConfig = config ? JSON.parse(JSON.stringify(config)) : null;
    const tab: EditorTab = { id, name, projectPath: projectPath ?? null, config: safeConfig };
    console.log('Creating tab:', { id, name, projectPath, hasConfig: !!safeConfig });
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(id);
    setCurrentProjectPath(projectPath ?? null);
    return tab;
  };
  
  const switchToTab = async (tabId: string) => {
    if (tabId === activeTabId) return;
    const prevTab = tabs.find(t => t.id === activeTabId);
    const nextTab = tabs.find(t => t.id === tabId);
    try {
      if (editor && prevTab) {
        // Always save a snapshot to the tab's config for quick restoration
        try {
          await editor.ensureTilesetsLoaded();
          const snapshot = await editor.getProjectData();
          const safeSnapshot = JSON.parse(JSON.stringify(snapshot));
          setTabs((prev) => prev.map(t => t.id === prevTab.id ? { ...t, config: safeSnapshot } : t));
          console.log('Snapshot saved into prevTab.config during tab switch:', { tabId: prevTab.id, snapshotKeys: Object.keys(safeSnapshot || {}) });
        } catch (err) {
          console.warn('Failed to snapshot tab before switching:', err);
        }
        
        // Also save to disk if it's a disk-based project
        if (prevTab.projectPath) {
          try {
            await editor.saveProjectData(prevTab.projectPath);
          } catch (e) {
            console.warn('Failed to save to disk before switching tabs:', e);
          }
        }
      }
    } catch (e) {
      console.warn('Error during tab switch save:', e);
    }

    if (!nextTab) {
      setActiveTabId(null);
      return;
    }

    setActiveTabId(tabId);
    setCurrentProjectPath(nextTab.projectPath ?? null);

    // If the tab contains a preloaded in-memory config, prefer restoring it
    // (this can include tileset images that haven't been written to disk yet).
    // However, if this tab belongs to a project on disk and the in-memory
    // config does not include any tileset images, and we DON'T have an editor
    // instance yet, prefer opening the map file from disk (pass the map name)
    // so embedded project map files that have tileset images are used instead.
    // NOTE: If editor already exists, skip this and use the in-memory restore path below.
    if (nextTab.config && !editor) {
      try {
        const cfgCheck = nextTab.config as EditorProjectData;
        if (nextTab.projectPath && (!cfgCheck.tilesetImages || Object.keys(cfgCheck.tilesetImages || {}).length === 0) && nextTab.name) {
          console.log('In-memory config missing tileset images and no editor; preferring disk open for tab', tabId, nextTab.name);
          await handleOpenMap(nextTab.projectPath, false, nextTab.name);
          if (editor) setupAutoSave(editor);
          return;
        }
      } catch (e) {
        // ignore and fall back to normal restore
      }

    }

    
    // If the tab contains a preloaded in-memory config, prefer restoring it
    // (this can include tileset images that haven't been written to disk yet).
    if (nextTab.config) {
      console.log('Switching to tab with in-memory config, attempting to restore for tab:', tabId, { hasProjectPath: !!nextTab.projectPath, configKeys: Object.keys(nextTab.config || {}) });
      // If an editor instance exists, restore directly into it for a more
      // immediate and reliable update (avoids race conditions creating a new editor).
          try {
            if (editor) {
              console.log('Restoring config into existing editor for tab:', tabId);
              // DON'T call resetForNewProject - just load the new project data directly
              // The editor's loadProjectData will replace layers, tilesets etc.
              // Just clear localStorage backup to prevent old data loading
              editor.clearLocalStorageBackup();
              
              if (nextTab.config.name) {
                editor.setMapName((nextTab.config as any).name);
                setMapName((nextTab.config as any).name);
              }
              if ((nextTab.config as any).width && (nextTab.config as any).height) {
                editor.setMapSize((nextTab.config as any).width ?? 20, (nextTab.config as any).height ?? 15);
                setMapWidth((nextTab.config as any).width ?? 20);
                setMapHeight((nextTab.config as any).height ?? 15);
              }
              const cfg = nextTab.config as EditorProjectData;

              // If the in-memory config includes tileset images, apply them into
              // the live editor first so loadProjectData can make use of them.
              try {
                if (cfg.tilesetImages && Object.keys(cfg.tilesetImages).length > 0) {
                  if (typeof (editor as any).setTilesetImages === 'function') {
                    (editor as any).setTilesetImages(cfg.tilesetImages);
                  } else {
                    // best-effort fallback: attach to editor for later use
                    // @ts-ignore
                    editor.tilesetImages = JSON.parse(JSON.stringify(cfg.tilesetImages));
                  }
                  console.log('Applied tilesetImages to editor for tab', tabId, Object.keys(cfg.tilesetImages));
                } else {
                  console.log('No tilesetImages present in config for tab', tabId);
                }
              } catch (e) {
                console.warn('Failed to apply tilesetImages into editor:', e);
              }

              // After a short delay, attempt to discover tileset images from the
              // project folder and apply any matching images. This handles the
              // case where the original import referenced a file saved inside
              // the project (images/tilesets or assets) and the in-memory
              // snapshot didn't include the image data URL.
              try {
                await new Promise(r => setTimeout(r, 150));
                if (currentProjectPath && window.electronAPI?.discoverTilesetImages) {
                  const discovered = await window.electronAPI.discoverTilesetImages(currentProjectPath);
                  const discoveredImages = discovered?.tilesetImages || {};
                  if (Object.keys(discoveredImages).length > 0) {
                    // Determine which filenames we care about from the config
                    const cfgNames = new Set<string>();
                    if (cfg.tilesets && Array.isArray(cfg.tilesets)) {
                      for (const t of cfg.tilesets) {
                        if (t.fileName) cfgNames.add(t.fileName);
                        if ((t as any).sourcePath) {
                          const s = (t as any).sourcePath as string;
                          const parts = s.split(/[\\/]/);
                          const maybe = parts[parts.length - 1];
                          if (maybe) cfgNames.add(maybe);
                        }
                      }
                    }

                    // Merge discovered images for matching names
                    const toApply: Record<string, string> = {};
                    for (const name of Object.keys(discoveredImages)) {
                      if (cfgNames.has(name)) {
                        toApply[name] = discoveredImages[name];
                      }
                    }
                    if (Object.keys(toApply).length > 0) {
                      if (typeof (editor as any).setTilesetImages === 'function') {
                        (editor as any).setTilesetImages(toApply);
                        console.log('Applied discovered project tileset images for tab', tabId, Object.keys(toApply));
                      } else {
                        // attach to editor as fallback
                        // @ts-ignore
                        editor.tilesetImages = { ...(editor as any).tilesetImages || {}, ...toApply };
                        console.log('Attached discovered project tileset images to editor.tilesetImages for tab', tabId, Object.keys(toApply));
                      }
                    }
                    
                    // If some tilesets still missing, attempt to read sourcePath files
                    // referenced in the config directly from disk (supports absolute
                    // or external paths). This uses the new preload IPC
                    // `readFileAsDataURL` implemented in the main process.
                    const stillMissing = (cfg.tilesets || []).filter((t: any) => {
                      const name = t.fileName || (t.sourcePath ? t.sourcePath.split(/[\\/]/).pop() : null);
                      return name && !((editor as any).tilesetImages || {}).hasOwnProperty(name) && !toApply[name];
                    });
                    const electronAPIAny = window.electronAPI as any;
                    if (stillMissing.length > 0 && electronAPIAny?.readFileAsDataURL) {
                      for (const t of stillMissing) {
                        try {
                          let candidatePath: string | null = t.sourcePath ?? null;
                          if (candidatePath && currentProjectPath && window.electronAPI?.resolvePathRelative) {
                            try {
                              const rel = await window.electronAPI.resolvePathRelative(currentProjectPath, candidatePath);
                              if (rel && rel.trim()) candidatePath = rel;
                            } catch {}
                          }
                          if (!candidatePath) continue;
                          const exists = await window.electronAPI.fileExists?.(candidatePath);
                          if (!exists) continue;
                          const dataUrl = await electronAPIAny.readFileAsDataURL(candidatePath);
                          if (!dataUrl) continue;
                          const key = t.fileName || candidatePath.split(/[\\/]/).pop();
                          if (key) toApply[key] = dataUrl;
                          console.log('Loaded tileset from sourcePath for tab', tabId, key);
                        } catch (e) {
                          console.warn('Failed to load tileset from sourcePath for', t, e);
                        }
                      }
                      if (Object.keys(toApply).length > 0) {
                        if (typeof (editor as any).setTilesetImages === 'function') {
                          (editor as any).setTilesetImages(toApply);
                          console.log('Applied discovered/project-source tileset images for tab', tabId, Object.keys(toApply));
                        } else {
                          // @ts-ignore
                          editor.tilesetImages = { ...(editor as any).tilesetImages || {}, ...toApply };
                        }
                      }
                    }
                  }
                }
              } catch (e) {
                console.warn('Failed to discover/apply project tileset images:', e);
              }

              // Wait for any in-flight image loads then load the rest of the project data
              try {
                if (typeof (editor as any).ensureTilesetsLoaded === 'function') {
                  await (editor as any).ensureTilesetsLoaded(2000);
                } else {
                  await new Promise((r) => setTimeout(r, 50));
                }
              } catch (e) {
                console.warn('ensureTilesetsLoaded failed or timed out:', e);
              }

              const loaded = await loadProjectData(editor, nextTab.config as EditorProjectData);

              // Force palette rebuild after images and layers settle
              try {
                const activeLayerType = typeof (editor as any).getActiveLayerType === 'function'
                  ? (editor as any).getActiveLayerType()
                  : null;
                if (activeLayerType && typeof (editor as any).updateCurrentTileset === 'function') {
                  (editor as any).updateCurrentTileset(activeLayerType);
                }
                if (typeof (editor as any).refreshTilePalette === 'function') {
                  (editor as any).refreshTilePalette(true);
                }
                console.log('Forced palette rebuild after restoring tab', tabId);
              } catch (e) {
                console.warn('Palette rebuild after restore failed', e);
              }

              console.log('Loaded tab config into editor, result:', loaded);
              setupAutoSave(editor);
              updateLayersList();
              syncMapObjects();
              setPendingMapConfig(null);
              setMapInitialized(true);
              
              // Force canvas redraw after loading
              try {
                if (typeof (editor as any).draw === 'function') {
                  (editor as any).draw();
                  console.log('Forced canvas redraw after tab switch');
                }
              } catch (e) {
                console.warn('Failed to force redraw:', e);
              }
              return;
            }
          } catch (err) {
            console.warn('Failed to restore tab.config into existing editor, falling back to pendingMapConfig:', err);
          }

      // Fall back to pendingMapConfig which triggers editor creation/restoration
      setPendingMapConfig(nextTab.config);
      return;
    }

    // If the tab references a project path, open it from disk. Pass the
    // tab's map name when available so the main process can open the
    // specific map file (e.g. `MyMap.json`) instead of the project's
    // default/first JSON file.
    if (nextTab.projectPath) {
      // If the tab has a cached config (from previous switch), prefer using that
      // This is handled above in the nextTab.config block, so we only reach here
      // if there's no cached config (first time opening this tab in this session)
      
      console.log('=== TAB SWITCH: Loading from disk ===');
      console.log('Tab:', nextTab.name, 'Project:', nextTab.projectPath);
      console.log('Current tabs before handleOpenMap:', tabs.map(t => t.name));
      
      // DON'T call handleOpenMap - it rebuilds tabs from scratch!
      // Instead, just load the map config directly
      if (window.electronAPI?.openMapProject) {
        try {
          const mapConfig = await (window.electronAPI.openMapProject as (path: string, mapName?: string) => Promise<EditorProjectData | null>)(nextTab.projectPath, nextTab.name);
          if (mapConfig) {
            console.log('Loaded map config for tab:', nextTab.name, Object.keys(mapConfig));
            setPendingMapConfig(mapConfig);
            setMapName(mapConfig.name || nextTab.name);
            setMapWidth(mapConfig.width ?? 20);
            setMapHeight(mapConfig.height ?? 15);
            setMapInitialized(true);
            setShowWelcome(false);
            setShowCreateMapDialog(false);
          } else {
            // Map file doesn't exist on disk - create a fresh empty map
            console.warn('Map file not found for tab:', nextTab.name, '- creating fresh map');
            const freshConfig: EditorProjectData = {
              name: nextTab.name,
              width: 20,
              height: 15,
              tileSize: 64,
              layers: [],
              version: '1.0'
            };
            setPendingMapConfig(freshConfig);
            setMapName(nextTab.name);
            setMapWidth(20);
            setMapHeight(15);
            setMapInitialized(true);
            setShowWelcome(false);
            setShowCreateMapDialog(false);
            
            // Also update the tab's config so it has something to work with
            setTabs(prev => prev.map(t => t.id === nextTab.id ? { ...t, config: freshConfig } : t));
          }
        } catch (e) {
          console.error('Error loading map for tab switch:', e);
        }
      }
      if (editor) setupAutoSave(editor);
    }
  };

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
    } catch (e) {
      // ignore storage errors
    }
  }, [showSidebarToggle]);
  
  // Auto-save states
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error' | 'unsaved'>('saved');
  const [autoSaveEnabled, setAutoSaveEnabledState] = useState(true);
  const [lastSaveTime, setLastSaveTime] = useState<number>(0);
  const [isManuallySaving, setIsManuallySaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // Reload spawn metadata whenever project selection changes
  useEffect(() => {
    let cancelled = false;
    const loadSpawnFile = async () => {
      if (!currentProjectPath || !window.electronAPI?.readSpawnFile) {
        if (!cancelled) {
          setStartingMapIntermap(null);
        }
        return;
      }
      try {
        const content = await window.electronAPI.readSpawnFile(currentProjectPath);
        if (!cancelled) {
          setStartingMapIntermap(extractSpawnIntermapValue(content));
        }
      } catch (error) {
        console.warn('Failed to read spawn file:', error);
        if (!cancelled) {
          setStartingMapIntermap(null);
        }
      }
    };
    loadSpawnFile();
    return () => {
      cancelled = true;
    };
  }, [currentProjectPath]);

  useEffect(() => {
    const previous = previousMapNameRef.current;
    if (previous === mapName) {
      return;
    }
    previousMapNameRef.current = mapName;
    if (!isStartingMap) {
      return;
    }
    const previousTarget = computeIntermapTarget(true, previous);
    const nextTarget = computeIntermapTarget(true, mapName);
    if (previousTarget !== nextTarget) {
      updateStartingMap(true, { mapNameOverride: mapName });
    }
  }, [mapName, isStartingMap, updateStartingMap]);

  useEffect(() => {
    if (editor) {
      editor.setMapName(mapName);
    }
  }, [editor, mapName]);

  // When true, we're in the middle of opening an existing project
  // and should avoid creating a blank editor instance.
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  
  // Export loading state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [isPreparingNewMap, setIsPreparingNewMap] = useState(false);
  
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
  const [showDeleteNpcConfirm, setShowDeleteNpcConfirm] = useState(false);
  const [actorDialogState, setActorDialogState] = useState<{
    type: 'npc' | 'enemy';
    name: string;
    tilesetPath: string;
    portraitPath: string;
    isTalker: boolean;
    isVendor: boolean;
    isQuestGiver: boolean;
  } | null>(null);
  const [actorDialogError, setActorDialogError] = useState<string | null>(null);
  
  // Dialogue Tree state
  const [showDialogueTreeDialog, setShowDialogueTreeDialog] = useState(false);
  const [dialogueTrees, setDialogueTrees] = useState<DialogueTree[]>([]);
  const [activeDialogueTab, setActiveDialogueTab] = useState(0);
  const [dialogueTabToDelete, setDialogueTabToDelete] = useState<number | null>(null);
  
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
  const [ruleNameInput, setRuleNameInput] = useState('');
  const [ruleStartType, setRuleStartType] = useState<RuleStartType>('player');
  const [ruleTriggerId, setRuleTriggerId] = useState<string>(PLAYER_TRIGGER_OPTIONS[0]?.id ?? '');
  const [ruleDialogError, setRuleDialogError] = useState<string | null>(null);
  const [ruleDialogStep, setRuleDialogStep] = useState<'start' | 'actions'>('start');
  // Items list for display
  const [itemsList, setItemsList] = useState<Array<{ id: number; name: string; category: string; filePath: string; fileName: string; role: ItemRole; resourceSubtype?: ItemResourceSubtype }>>([]);
  // Expanded item categories for accordion
  const [expandedItemCategories, setExpandedItemCategories] = useState<Set<string>>(new Set());
  // Vendor stock dialog
  const [showVendorStockDialog, setShowVendorStockDialog] = useState(false);
  const [vendorStockSelection, setVendorStockSelection] = useState<Record<number, number>>({});
  // Vendor unlockable stock dialog
  const [showVendorUnlockDialog, setShowVendorUnlockDialog] = useState(false);
  const [vendorUnlockEntries, setVendorUnlockEntries] = useState<Array<{ id: string; requirement: string; items: Record<number, number> }>>([]);
  // Vendor random offers dialog
  const [showVendorRandomDialog, setShowVendorRandomDialog] = useState(false);
  const [vendorRandomSelection, setVendorRandomSelection] = useState<Record<number, { chance: number; min: number; max: number }>>({});
  const [vendorRandomCount, setVendorRandomCount] = useState<{ min: number; max: number }>({ min: 1, max: 1 });

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
  }, [autoSaveEnabled, currentProjectPath, handleSelectTool]);

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
      clearBrushToolbarCollapseTimer();
    };
  }, [clearBrushToolbarCollapseTimer]);

  useEffect(() => {
    if (!showWelcome && mapInitialized) {
      showBrushToolbarTemporarily();
    }
  }, [showWelcome, mapInitialized, showBrushToolbarTemporarily]);

  useEffect(() => {
    if (showWelcome || !mapInitialized) {
      setBrushToolbarExpanded(true);
      clearBrushToolbarCollapseTimer();
    }
  }, [showWelcome, mapInitialized, clearBrushToolbarCollapseTimer]);
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
    
    // Trigger autosave after NPC attributes are edited
    editor.triggerAutoSave(true);
  }, [editor, syncMapObjects]);

  const handleOpenActorDialog = useCallback((type: 'npc' | 'enemy') => {
    setActorDialogState({
      type,
      name: '',
      tilesetPath: '',
      portraitPath: '',
      isTalker: true,
      isVendor: false,
      isQuestGiver: false
    });
    setActorDialogError(null);
  }, []);

  const handleActorFieldChange = useCallback((field: 'name' | 'tilesetPath' | 'portraitPath', value: string) => {
    setActorDialogState((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
    setActorDialogError(null);
  }, []);

  const handleActorRoleToggle = useCallback((role: 'isTalker' | 'isVendor' | 'isQuestGiver') => {
    setActorDialogState((prev) => {
      if (!prev) return prev;
      return { ...prev, [role]: !prev[role] };
    });
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

  const handleCloseActorDialog = useCallback(() => {
    setActorDialogState(null);
    setActorDialogError(null);
  }, []);

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
    setRuleStartType('player');
    setRuleTriggerId(PLAYER_TRIGGER_OPTIONS[0]?.id ?? '');
    setRuleNameInput(`Rule ${rulesList.length + 1}`);
    setRuleDialogStep('start');
    setShowRuleDialog(true);
  }, [rulesList.length]);

  const handleSaveRule = useCallback(() => {
    const trimmedName = ruleNameInput.trim();
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
    setRuleStartType('player');
    setRuleTriggerId(PLAYER_TRIGGER_OPTIONS[0]?.id ?? '');
  }, [ruleNameInput, ruleStartType, ruleTriggerId]);

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
        const result = await window.electronAPI.createItemFile(currentProjectPath, {
          name: itemDialogState.name.trim(),
          id: itemId,
          category: selectedCategory,
          role: itemDialogState.role,
          resourceSubtype: itemDialogState.resourceSubtype
        } as any);
        
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
            price: 0,
            price_sell: 0,
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

  const updateEditingItemField = useCallback(<K extends keyof NonNullable<typeof editingItem>>(key: K, value: NonNullable<typeof editingItem>[K]) => {
    setEditingItem(prev => prev ? { ...prev, [key]: value } : null);
  }, []);

  const handleRemoveActor = useCallback((objectId: number) => {
    if (!editor) return;
    editor.removeMapObject(objectId);
    syncMapObjects();
  }, [editor, syncMapObjects]);

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

  const handleActorSubmit = useCallback(async () => {
    if (!editor || !actorDialogState) {
      return;
    }

    // Zorunlu alanları kontrol et
    if (!actorDialogState.name.trim()) {
      setActorDialogError('Name is required.');
      return;
    }

    const name = actorDialogState.name.trim();
    const tilesetPath = actorDialogState.tilesetPath.trim();
    const portraitPath = actorDialogState.portraitPath.trim();
    const { isTalker, isVendor, isQuestGiver } = actorDialogState;

    // Determine primary role for NPC file creation
    const role = isVendor ? 'vendor' : isQuestGiver ? 'quest' : isTalker ? 'talker' : 'static';

    // Proje klasöründe NPC dosyası oluştur (eğer electronAPI varsa)
    let npcFilename: string | undefined;
    if (currentProjectPath && window.electronAPI?.createNpcFile) {
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

    // Rol bazlı properties oluştur
    const roleProperties: Record<string, string> = {};
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

    // NPC'yi harita dışında (-1, -1) konumunda oluştur
    // Kullanıcı isterse sonra haritaya yerleştirebilir
    const unplacedX = -1;
    const unplacedY = -1;

    // NPC'yi listeye ekle ama haritada görünmez (database olarak)
    // Not: addMapObject 'enemy' | 'event' kabul ediyor, sonra type'ı güncelliyoruz
    const newObject = editor.addMapObject('enemy', unplacedX, unplacedY, 1, 1);
    editor.updateMapObject(newObject.id, {
      name,
      x: unplacedX,
      y: unplacedY,
      type: actorDialogState.type,
      category: actorDialogState.type === 'npc' ? 'npc' : 'enemy',
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
    handleCloseActorDialog();
    
    // Trigger autosave after NPC is added
    editor.triggerAutoSave(true);
  }, [actorDialogState, editor, handleCloseActorDialog, syncMapObjects, currentProjectPath]);

  const handleObjectDialogClose = useCallback(() => {
    setShowObjectDialog(false);
    setEditingObject(null);
    setObjectValidationErrors([]);
    setShowDeleteNpcConfirm(false);
  }, []);

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
          const npcFilenameClean = existingFilename.replace(/^npcs[\/\\]/, '');
          
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
  }, [editingObject, handleUpdateObject, currentProjectPath]);

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

  const handleOpenVendorStockDialog = useCallback(() => {
    if (!editingObject) return;
    const parsed = parseConstantStock(editingObject.properties?.constant_stock as string | undefined);
    setVendorStockSelection(parsed);
    setShowVendorStockDialog(true);
  }, [editingObject, parseConstantStock]);

  const handleOpenVendorUnlockDialog = useCallback(() => {
    if (!editingObject) return;
    const parsed = parseStatusStockEntries(editingObject.properties?.status_stock_entries as string | undefined);
    if (parsed.length === 0) {
      setVendorUnlockEntries([{ id: `req-${Date.now()}`, requirement: '', items: {} }]);
    } else {
      setVendorUnlockEntries(parsed);
    }
    setShowVendorUnlockDialog(true);
  }, [editingObject, parseStatusStockEntries]);

  const handleOpenVendorRandomDialog = useCallback(() => {
    if (!editingObject) return;
    const parsed = parseRandomStock(editingObject.properties?.random_stock as string | undefined);
    setVendorRandomSelection(parsed);
    const parsedCount = parseRandomStockCount(editingObject.properties?.random_stock_count as string | undefined);
    setVendorRandomCount(parsedCount);
    setShowVendorRandomDialog(true);
  }, [editingObject, parseRandomStock, parseRandomStockCount]);

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
  }, [editingObject, buildConstantStockString, vendorStockSelection]);

  const handleAddVendorUnlockRequirement = useCallback(() => {
    setVendorUnlockEntries((prev) => [...prev, { id: `req-${Date.now()}-${Math.random()}`, requirement: '', items: {} }]);
  }, []);

  const handleUpdateVendorUnlockRequirement = useCallback((id: string, requirement: string) => {
    setVendorUnlockEntries((prev) => prev.map((entry) => entry.id === id ? { ...entry, requirement } : entry));
  }, []);

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
  }, []);

  const handleVendorUnlockQtyChange = useCallback((reqId: string, itemId: number, qty: number) => {
    setVendorUnlockEntries((prev) => prev.map((entry) => {
      if (entry.id !== reqId) return entry;
      const items = { ...entry.items };
      items[itemId] = Math.max(1, qty || 1);
      return { ...entry, items };
    }));
  }, []);

  const handleRemoveVendorUnlockRequirement = useCallback((id: string) => {
    setVendorUnlockEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

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
  }, [editingObject, vendorUnlockEntries]);

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
  }, []);

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
  }, []);

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
  }, []);

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
  }, [editingObject, vendorRandomSelection, vendorRandomCount, buildRandomStockString, buildRandomStockCountString]);

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
        hasNonZeroData: l.data?.some((d: any) => d !== 0) || false
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
  }, [pendingMapConfig, showWelcome, currentProjectPath, setupAutoSave, updateLayersList]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const isDuplicateMapName = useCallback((candidate: string) => {
    const normalized = candidate.trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    const knownNames = new Set<string>();

    reservedMapNames.forEach((name) => {
      if (name) {
        knownNames.add(name);
      }
    });

    if (mapName.trim()) {
      knownNames.add(mapName.trim().toLowerCase());
    }

    try {
      const stored = localStorage.getItem('recentMaps');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach((entry) => {
            if (entry && typeof entry.name === 'string') {
              const name = entry.name.trim().toLowerCase();
              if (name) {
                knownNames.add(name);
              }
            }
          });
        }
      }
    } catch (error) {
      console.warn('Failed to read recent map names for duplicate check:', error);
    }

    return knownNames.has(normalized);
  }, [mapName, reservedMapNames]);

  const handleOpenCreateMapDialog = useCallback(() => {
    setNewMapWidth(mapWidth > 0 ? mapWidth : 20);
    setNewMapHeight(mapHeight > 0 ? mapHeight : 15);
    setNewMapStarting(isStartingMap);
    setCreateMapError(null);
    setShowCreateMapDialog(true);
  }, [mapWidth, mapHeight, isStartingMap]);

  // Only reset newMapName the first time dialog is opened after mount
  const hasOpenedCreateMapDialog = useRef(false);
  useEffect(() => {
    if (showCreateMapDialog && !hasOpenedCreateMapDialog.current) {
      setNewMapName('Map Name');
      hasOpenedCreateMapDialog.current = true;
    }
    if (!showCreateMapDialog) {
      hasOpenedCreateMapDialog.current = false;
    }
  }, [showCreateMapDialog, mapName]);

  const handleConfirmCreateMap = async () => {
    if (isPreparingNewMap) return;

    const width = Math.max(1, Math.floor(newMapWidth) || 0);
    const height = Math.max(1, Math.floor(newMapHeight) || 0);
    const trimmedName = newMapName.trim();
    const resolvedName = trimmedName ? trimmedName : 'Untitled Map';

    if (isDuplicateMapName(resolvedName)) {
      setCreateMapError("There can't be maps that have the same name. Please type another name.");
      return;
    }

    setCreateMapError(null);
    setIsPreparingNewMap(true);

    try {
      // No export on map creation. Only set reserved map names.
      setReservedMapNames((prev) => {
        const normalized = resolvedName.trim().toLowerCase();
        if (!normalized || prev.includes(normalized)) {
          return prev;
        }
        return [...prev, normalized];
      });


      setLayers([]);
      setActiveLayerId(null);
      setStamps([]);
      setSelectedStamp(null);
      setMapObjects([]);
      setHoverCoords(null);
      setBrushTool('none');
      setShowSeparateDialog(false);
      setBrushToSeparate(null);
      setSaveStatus('saved');
      setHasUnsavedChanges(false);

      let targetEditor = editor;


      if (!targetEditor && canvasRef.current) {
        targetEditor = new TileMapEditor(canvasRef.current);
        targetEditor.setDarkMode(isDarkMode);
        setupAutoSave(targetEditor);
      }

      if (targetEditor) {

        // Before resetting the editor for the new map, persist the current
        // editor state into the active tab's config so the current map's
        // tilesets/brushes are preserved when the shared editor instance is
        // reused. This avoids losing the uploaded tileset from the previous map.
        if (editor && activeTabId) {
          try {
            await editor.ensureTilesetsLoaded();
            const snapshot = await editor.getProjectData();
            const safeSnapshot = JSON.parse(JSON.stringify(snapshot));
            setTabs((prev) => prev.map(t => t.id === activeTabId ? { ...t, config: safeSnapshot } : t));
            console.log('Snapshot saved into activeTab.config before resetForNewProject:', { activeTabId, snapshotKeys: Object.keys(safeSnapshot || {}) });
            
            // ALSO save to disk so the map data persists across app restarts
            // Without this, switching maps or restarting would lose the previous map's data
            if (currentProjectPath) {
              await editor.saveProjectData(currentProjectPath);
              console.log('Previous map saved to disk before creating new map');
            }
          } catch (err) {
            console.warn('Failed to snapshot current tab before creating a new map:', err);
          }
        }

        // Set projectName to the user-typed project name at creation
        targetEditor.projectName = resolvedName;

        targetEditor.resetForNewProject();
        targetEditor.setMapName(resolvedName);
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
      updateStartingMap(newMapStarting, { mapNameOverride: resolvedName });
      setNewMapStarting(newMapStarting);
      setHasSelection(false);
      setSelectionCount(0);
      setCreateMapError(null);
      // Create a tab for this newly created map inside the current project
      try {
        createTabFor(resolvedName, currentProjectPath ?? null, { name: resolvedName, width, height, tileSize: 64, location: currentProjectPath ?? '' });
      } catch (e) {
        console.warn('Failed to create tab for new in-project map:', e);
      }
      
      // Immediately save the new map to disk to ensure it exists
      // This prevents issues where switching tabs or restarting before autosave
      // would cause the map to be "lost"
      if (targetEditor && currentProjectPath) {
        try {
          await targetEditor.saveProjectData(currentProjectPath);
          console.log('New map saved to disk immediately:', resolvedName);
        } catch (e) {
          console.warn('Failed to immediately save new map to disk:', e);
        }
      }
      
      setShowCreateMapDialog(false);
    } finally {
      setIsPreparingNewMap(false);
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

  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [pendingExport, setPendingExport] = useState<null | (() => Promise<boolean>)>(null);

  const checkExportFilesExist = useCallback(async (mapName: string) => {
    if (!window.electronAPI?.resolvePathRelative || !currentProjectPath) return false;
    const sanitizedMapName = mapName.replace(/[<>:"/\\|?*]/g, '_').trim().replace(/\s+/g, '_').replace(/_{2,}/g, '_') || 'Map_Name';
    const mapFilePath = `${currentProjectPath}/maps/${sanitizedMapName}.txt`;
    const tilesetFilePath = `${currentProjectPath}/tilesetdefs/tileset_${sanitizedMapName}.txt`;
    try {
      const mapExists = await window.electronAPI.fileExists?.(mapFilePath);
      const tilesetExists = await window.electronAPI.fileExists?.(tilesetFilePath);
      return !!mapExists || !!tilesetExists;
    } catch {
      return false;
    }
  }, [currentProjectPath]);

  const performExport = useCallback(
    async ({ silent = false, forceOverwrite = false }: { silent?: boolean, forceOverwrite?: boolean } = {}) => {
      if (!editor || !currentProjectPath) {
        toast({
          title: "Export Failed",
          description: "No project loaded or editor not initialized.",
          variant: "destructive",
        });
        return false;
      }
      const trimmedName = mapName.trim();
      if (!trimmedName || STARTING_MAP_INVALID_NAMES.has(trimmedName.toLowerCase())) {
        if (!silent) {
          toast({
            title: "Export Skipped",
            description: "Please create and name your map before exporting.",
            variant: "destructive",
          });
        }
        return false;
      }

      if (!startingMapIntermap) {
        if (!silent) {
          toast({
            title: "Export Failed",
            description: "No starting map selected.",
            variant: "destructive",
          });
        }
        return false;
      }

      if (!silent) {
        setIsExporting(true);
        setExportProgress(0);
      }

      const spawnContent = buildSpawnContent(startingMapIntermap);

      const tilesetExportInfo = editor.getTilesetExportInfo();
      let pathOverrides: Record<string, string> | undefined;
      if (tilesetExportInfo.length > 0) {
        const overrides: Record<string, string> = {};
        for (const info of tilesetExportInfo) {
          const keys = [info.id];
          if (info.sourcePath) keys.push(info.sourcePath);
          if (info.fileName) keys.push(info.fileName);
          let candidate = info.sourcePath ?? null;
          if (currentProjectPath && info.sourcePath && window.electronAPI?.resolvePathRelative) {
            try {
              const relative = await window.electronAPI.resolvePathRelative(currentProjectPath, info.sourcePath);
              if (relative && relative.trim()) {
                candidate = relative;
              }
            } catch (error) {
              console.warn('Failed to resolve tileset path relative to project:', error);
            }
          }
          if (!candidate && info.fileName) {
            candidate = info.fileName;
          }
          if (candidate) {
            const normalized = candidate.replace(/\\/g, '/');
            for (const key of keys) {
              if (key) {
                overrides[key] = normalized;
              }
            }
          }
        }
        if (Object.keys(overrides).length > 0) {
          pathOverrides = overrides;
        }
      }

      try {
        // Overwrite confirmation logic
        if (!forceOverwrite && !silent) {
          const exists = await checkExportFilesExist(mapName);
          if (exists) {
            setPendingExport(() => () => performExport({ silent, forceOverwrite: true }));
            setShowOverwriteDialog(true);
            return false;
          }
        }
        if (!silent) {
          setExportProgress(25);
        }

        const mapTxt = editor.generateFlareMapTxt({ pathOverrides, mapName });

        if (!silent) {
          setExportProgress(50);
        }

        const tilesetDef = editor.generateFlareTilesetDef({ pathOverrides });

        if (!silent) {
          setExportProgress(75);
        }

        if (window.electronAPI?.saveExportFiles) {
          // Collect tileset images (data URLs) to include in the export so Electron can write PNGs
          const tilesetImages: Record<string, string> = {};
          type MaybeTilesetEntry = { fileName?: string; image?: HTMLImageElement | null };
          try {
            const exportInfo = editor.getTilesetExportInfo();
            for (const info of exportInfo) {
              // Attempt to get the image element from the editor's layerTilesets by matching fileName
              let matchedEntry: MaybeTilesetEntry | undefined;
              if (editor['layerTilesets'] && typeof editor['layerTilesets'].forEach === 'function') {
                editor['layerTilesets'].forEach((val: unknown) => {
                  const candidate = val as MaybeTilesetEntry | undefined;
                  if (candidate?.fileName === info.fileName) {
                    matchedEntry = candidate;
                  }
                });
              }
              // Fallback: try to access editor.tilesetImage when fileName matches
              let imgEl: HTMLImageElement | null = null;
              const entryImage = matchedEntry?.image ?? null;
              if (entryImage) {
                imgEl = entryImage;
              }
              if (!imgEl && editor['tilesetFileName'] === info.fileName) {
                const editorImage = editor['tilesetImage'] as HTMLImageElement | null | undefined;
                if (editorImage) {
                  imgEl = editorImage;
                }
              }
              if (imgEl) {
                try {
                  const dataUrl = editor['canvasToDataURL'](imgEl);
                  tilesetImages[info.fileName] = dataUrl;
                } catch (imgErr) {
                  console.warn('Failed to serialize tileset image', info.fileName, imgErr);
                }
              }
            }
          } catch (err) {
            console.warn('Failed to collect tileset images for export:', err);
          }

          // Collect NPC files from mapObjects
          const npcFiles: Array<{ filename: string; content: string }> = [];
          try {
            const npcObjects = mapObjects.filter(obj => obj.type === 'npc');
            for (const npc of npcObjects) {
              const npcName = npc.name || `npc_${npc.id}`;
              // Sanitize filename
              const sanitizedName = npcName
                .toLowerCase()
                .replace(/[<>:"/\\|?*]/g, '_')
                .trim()
                .replace(/\s+/g, '_')
                .replace(/_{2,}/g, '_') || 'unnamed_npc';
              
              const filename = `${sanitizedName}.txt`;
              
              // Build NPC file content in Flare format
              const lines: string[] = [];
              
              // Name
              lines.push(`name=${npcName}`);
              lines.push('');
              
              // Portrait (if provided)
              if (npc.properties?.portraitPath) {
                lines.push(`portrait=${npc.properties.portraitPath}`);
                lines.push('');
              }
              
              // Role-based attributes
              const isTalker = npc.properties?.talker === 'true';
              const isVendor = npc.properties?.vendor === 'true';
              const isQuestGiver = npc.properties?.questGiver === 'true';
              
              if (isVendor) {
                lines.push(`# shop info`);
                lines.push(`vendor=true`);
                if (npc.properties?.constant_stock) {
                  lines.push(`constant_stock=${npc.properties.constant_stock}`);
                }
                if (npc.properties?.status_stock_entries) {
                  try {
                    const entries = JSON.parse(npc.properties.status_stock_entries as string);
                    if (Array.isArray(entries)) {
                      for (const entry of entries) {
                        if (!entry?.requirement || !entry.items) continue;
                        const stockStr = buildConstantStockString(entry.items);
                        if (stockStr) {
                          lines.push(`status_stock=${entry.requirement},${stockStr}`);
                        }
                      }
                    }
                  } catch (err) {
                    console.warn('Failed to parse status_stock_entries for export', err);
                  }
                }
                if (npc.properties?.random_stock) {
                  lines.push(`random_stock=${npc.properties.random_stock}`);
                }
                if (npc.properties?.random_stock_count) {
                  lines.push(`random_stock_count=${npc.properties.random_stock_count}`);
                }
                lines.push(`# TODO: Add stock items`);
                lines.push(`# constant_stock=item_id:count,item_id:count`);
                lines.push('');
              }
              
              // Animation/Tileset (if provided)
              if (npc.properties?.tilesetPath) {
                lines.push(`# animation info`);
                lines.push(`animations=${npc.properties.tilesetPath}`);
                lines.push('');
              }
              
              if (isTalker || isVendor || isQuestGiver) {
                lines.push(`talker=true`);
                lines.push('');
              }
              
              // Quest giver note
              if (isQuestGiver) {
                lines.push(`# This NPC is marked as a Quest Giver in the editor.`);
                lines.push(`# Quest assignments are defined in quests/*.txt files with giver=npcs/${sanitizedName}.txt`);
                lines.push('');
              }
              
              // Static NPC note
              if (!isTalker && !isVendor && !isQuestGiver) {
                lines.push(`# This NPC is decorative and has no interaction.`);
                lines.push('');
              }
              
              // Placeholder for dialog
              if (isTalker || isVendor || isQuestGiver) {
                lines.push(`# Dialog sections`);
                lines.push(`# [dialog]`);
                lines.push(`# topic=Talk`);
                lines.push(`# him=Hello, traveler!`);
                lines.push('');
              }
              
              npcFiles.push({ filename, content: lines.join('\n') });
            }
            if (npcFiles.length > 0) {
              console.log(`Export: prepared ${npcFiles.length} NPC files`);
            }
          } catch (npcErr) {
            console.warn('Failed to collect NPC files for export:', npcErr);
          }

          const success = await window.electronAPI.saveExportFiles(
            currentProjectPath,
            mapName,
            mapTxt,
            tilesetDef,
            {
              spawn: {
                enabled: true,
                content: spawnContent,
                filename: 'spawn.txt'
              },
              tilesetImages,
              npcFiles
            }
          );

          if (!success) {
            throw new Error("Failed to save export files");
          }

          if (!silent) {
            setExportProgress(100);
            setTimeout(() => {
              setShowExportSuccess(true);
            }, 1500);
          }
        } else {
          editor.exportFlareMap();
          console.warn('Spawn file creation skipped: Electron API unavailable.');
          if (!silent) {
            setExportProgress(100);
          }
        }

        return true;
      } catch (error) {
        console.error('Export failed:', error);
        toast({
          title: "Export Failed",
          description: "An error occurred while exporting the map.",
          variant: "destructive",
        });
        return false;
      } finally {
        if (!silent) {
          setTimeout(() => {
            setIsExporting(false);
            setExportProgress(0);
          }, 1000);
        }
      }
    },
  [editor, currentProjectPath, mapName, startingMapIntermap, toast, checkExportFilesExist]
  );

  const handleExportMap = useCallback(async () => {
    await performExport();
  }, [performExport]);

  // Overwrite dialog handlers
  const handleOverwriteConfirm = useCallback(() => {
    setShowOverwriteDialog(false);
    if (pendingExport) {
      pendingExport();
      setPendingExport(null);
    }
  }, [pendingExport]);

  const handleOverwriteCancel = useCallback(() => {
    setShowOverwriteDialog(false);
    setPendingExport(null);
  }, []);

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
  }, [currentProjectPath, performExport, handleManualSave, editor, updateLayersList, syncMapObjects, toast]);

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

  const handleOpenMap = useCallback(async (projectDir: string, createTab: boolean = false, mapName?: string) => {
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
  }, [editor, setupAutoSave, updateLayersList, startingMapIntermap, updateStartingMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep a ref to handleOpenMap so IPC listeners can call the latest implementation
  useEffect(() => { handleOpenMapRef.current = handleOpenMap; }, [handleOpenMap]);

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

  const isCollisionLayer = activeLayer?.type === 'collision';
  const isNpcLayer = activeLayer?.type === 'npc';
  const isEnemyLayer = activeLayer?.type === 'enemy';
  const isItemsLayer = activeLayer?.type === 'items';
  const isRulesLayer = activeLayer?.type === 'rules';
  const availableRuleTriggers = ruleStartType === 'player' ? PLAYER_TRIGGER_OPTIONS : GAME_TRIGGER_OPTIONS;

  const actorEntries = useMemo(() => {
    if (isNpcLayer) {
      return mapObjects.filter((obj) => obj.type === 'npc');
    }
    if (isEnemyLayer) {
      return mapObjects.filter((obj) => obj.type === 'enemy');
    }
    return [];
  }, [mapObjects, isNpcLayer, isEnemyLayer]);

  // Settings modal tab state
  const [settingsTab, setSettingsTab] = useState<'map' | 'other'>('map');

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
              src={flareIconUrl} 
              alt="Flare Studio Logo" 
              className="w-4 h-6"
            />
            <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">Flare Studio</span>
          </div>
          {/* Tabs */}
          <div className="ml-4 flex items-center gap-2 overflow-x-auto max-w-[60vw] no-drag">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { void switchToTab(tab.id); }}
                className={`px-3 py-1 rounded-t-md border border-b-0 text-sm truncate max-w-xs no-drag transition-all duration-200 ${tab.id === activeTabId ? 'bg-orange-500 text-white border-orange-500' : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-neutral-700'}`}
                title={tab.name}
              >
                {tab.name}
              </button>
            ))}
            <Tooltip content="Create a new map" side="right">
              <button
                onClick={() => setShowCreateMapDialog(true)}
                className="ml-1 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-neutral-800 no-drag"
                aria-label="Create new map"
              >
                <Plus className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </button>
            </Tooltip>
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
          <button 
            onClick={handleMinimize}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded transition-colors"
            aria-label="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button 
            onClick={handleMaximize}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded transition-colors"
            aria-label="Maximize"
          >
            <Square className="w-4 h-4" />
          </button>
          <button 
            onClick={handleClose}
            className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      {/* Left-edge collapse/expand toggle - placed outside the aside so it remains clickable when the sidebar is hidden */}
      {showSidebarToggle && (
        <button
          onClick={() => {
            setLeftTransitioning(true);
            if (editor && typeof editor.setSidebarTransitioning === 'function') {
              try { editor.setSidebarTransitioning(true); } catch (e) { /* ignore */ }
            }
            setLeftCollapsed((s) => !s);
            // keep the transitioning flag for slightly longer than the CSS transition
            window.setTimeout(() => {
              setLeftTransitioning(false);
              if (editor && typeof editor.setSidebarTransitioning === 'function') {
                try { editor.setSidebarTransitioning(false); } catch (e) { /* ignore */ }
              }
            }, 380);
          }}
          aria-label={leftCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          // Position the toggle at the outer right edge of the left sidebar.
          // When expanded the sidebar width is 14rem (224px), otherwise it's 0.
          style={{ left: leftCollapsed ? 0 : 224 }}
          className="no-drag no-press-shift press-fill-effect fixed top-1/2 transform -translate-y-1/2 z-50 bg-white/90 dark:bg-neutral-900/90 border border-border rounded-l-md p-1 shadow-md hover:bg-white dark:hover:bg-neutral-800"
        >
          {leftCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      )}

      <main className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        <aside
          className={
            `relative border-r border-border bg-muted/30 p-2 overflow-visible flex flex-col transition-all duration-200 ease-in-out app-sidebar ` +
            (leftCollapsed ? 'sidebar-collapsed' : '')
          }
          aria-hidden={leftCollapsed}
        >
          <div className="sidebar-inner flex flex-col h-full">
          {/* Hover handle / visual affordance when collapsed (removed) */}
          {/* collapse toggle is provided on the outer edge (see edge button) */}
          {/* Tileset Brushes Section */}
          <section className="flex flex-col flex-1">
            {/* If this is an NPC, Enemy, Event, Rules, or Items layer render a header and controls */}
            {(() => {
              // Keep actor entries for NPC/Enemy layers but remove the header and its add-button.
              const isEventLayer = activeLayer?.type === 'event';
              if (isNpcLayer || isEnemyLayer || isEventLayer) {
                return (
                  <>
                    {/* Actor entries shown only for NPC/Enemy layers (header removed per UX request) */}
                    {(isNpcLayer || isEnemyLayer) && (
                      <div className="flex-1 min-h-0">
                        {actorEntries.length === 0 ? (
                          <div className="h-full border border-dashed border-border rounded-md flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
                            {isNpcLayer ? 'No NPCs added yet. Use the Add control to create your first NPC.' : 'No enemies added yet. Use the Add control to place an enemy.'}
                          </div>
                        ) : (
                          <div className="space-y-2 overflow-y-auto pr-1">
                            {actorEntries.map((actor) => {
                              // NPC rol tag'lerini hesapla
                              const isTalker = actor.properties?.talker === 'true' || actor.properties?.talker === '1';
                              const isVendor = actor.properties?.vendor === 'true' || actor.properties?.vendor === '1';
                              const isQuestGiver = actor.properties?.questGiver === 'true' || actor.properties?.questGiver === '1';
                              // Static = hiçbir rol atanmamış
                              const isStatic = !isTalker && !isVendor && !isQuestGiver;
                              // Portrait path
                              const portraitPath = actor.properties?.portraitPath;
                              // Haritada yerleştirilmiş mi?
                              const isPlacedOnMap = actor.x >= 0 && actor.y >= 0;
                              
                              return (
                              <div
                                key={actor.id}
                                className={`rounded-md px-2 py-2 hover:bg-background transition-colors cursor-pointer ${
                                  isPlacedOnMap 
                                    ? 'border-2 border-orange-500 bg-background/50' 
                                    : 'border border-dashed border-gray-400 dark:border-gray-600 bg-muted/20'
                                } ${draggingNpcId === actor.id ? 'opacity-50' : ''}`}
                                onClick={() => handleEditObject(actor.id)}
                                onMouseMove={(e) => setNpcHoverTooltip({ x: e.clientX, y: e.clientY })}
                                onMouseLeave={() => setNpcHoverTooltip(null)}
                              >
                                <div className="flex items-center gap-2">
                                    {/* Portrait thumbnail */}
                                    <div className={`flex-shrink-0 w-10 h-10 rounded border bg-muted/50 flex items-center justify-center overflow-hidden ${
                                      isPlacedOnMap ? 'border-border' : 'border-dashed border-muted-foreground/40'
                                    }`}>
                                      {portraitPath ? (
                                        <img
                                          src={portraitPath}
                                          alt={actor.name || 'NPC portrait'}
                                          className={`w-full h-full object-cover ${!isPlacedOnMap ? 'opacity-50' : ''}`}
                                          onError={(e) => {
                                            // Resim yüklenemezse soru işareti göster
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                          }}
                                        />
                                      ) : null}
                                      <HelpCircle className={`w-5 h-5 text-muted-foreground ${portraitPath ? 'hidden' : ''} ${!isPlacedOnMap ? 'opacity-50' : ''}`} />
                                    </div>
                                    {/* NPC bilgileri */}
                                    <div className="space-y-1 text-sm flex-1 min-w-0">
                                    <div className={`font-medium ${isPlacedOnMap ? 'text-foreground' : 'text-muted-foreground'}`} title={actor.name || `${actor.type === 'npc' ? 'NPC' : 'Enemy'} #${actor.id}`}>
                                      <span className={leftCollapsed ? 'sr-only' : ''}>{actor.name || `${actor.type === 'npc' ? 'NPC' : 'Enemy'} #${actor.id}`}</span>
                                      {!actor.name && leftCollapsed && <span className="text-xs text-muted-foreground">#{actor.id}</span>}
                                    </div>
                                    {/* NPC Rol Tag'leri */}
                                    {isNpcLayer && !leftCollapsed && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {isTalker && (
                                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                                            Talker
                                          </span>
                                        )}
                                        {isVendor && (
                                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                            Vendor
                                          </span>
                                        )}
                                        {isQuestGiver && (
                                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                            Quest
                                          </span>
                                        )}
                                        {isStatic && (
                                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-gray-500/20 text-gray-600 dark:text-gray-400 border border-gray-500/30">
                                            Static
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {/* Drag handle for NPC - centered vertically */}
                                  {isNpcLayer && (
                                    <Tooltip content="Drag and drop to place NPC on map">
                                      <div
                                        draggable
                                        onDragStart={(e) => handleNpcDragStart(e, actor.id)}
                                        onDragEnd={handleNpcDragEnd}
                                        className="w-8 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <GripVertical className="w-5 h-5" />
                                      </div>
                                    </Tooltip>
                                  )}
                                </div>
                              </div>
                            );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Add NPC/Enemy button for actor layers - placed below the list, above layers */}
                    {(isNpcLayer || isEnemyLayer) && (
                      <div className="flex justify-center py-2">
                        <Tooltip content={isNpcLayer ? 'Add NPC' : 'Add Enemy'} side="bottom">
                          <Button
                            variant="default"
                            size="sm"
                            aria-label={isNpcLayer ? 'Add NPC' : 'Add Enemy'}
                            className="text-xs px-3 py-1 h-7 shadow-sm bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleOpenActorDialog(isNpcLayer ? 'npc' : 'enemy');
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            {isNpcLayer ? 'Add NPC' : 'Add Enemy'}
                          </Button>
                        </Tooltip>
                      </div>
                    )}
                  </>
                );
              }
              return null;
            })()}

            {/* Rules Layer - list and add button (similar UX to NPC layer) */}
            {isRulesLayer && (
              <div className="flex flex-col flex-1">
                <div className="flex-1 min-h-0 border border-dashed border-border rounded-md overflow-y-auto">
                  {rulesList.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground px-4 text-center">
                      Click &quot;+ Rule&quot; to create your first rule.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 p-2">
                      {rulesList.map((rule) => {
                        const triggerMeta = RULE_TRIGGER_LOOKUP[rule.triggerId];
                        const TriggerIcon = triggerMeta?.icon;
                        return (
                          <div
                            key={rule.id}
                            className="flex items-center gap-3 p-2 bg-muted/50 hover:bg-muted rounded-md border border-border cursor-pointer transition-colors w-full"
                            title={rule.name}
                          >
                            <GitBranch className="w-4 h-4 text-orange-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{rule.name}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className="text-[11px] px-2 py-0.5">
                                  {rule.startType === 'player' ? 'Started by player' : 'Started by the game'}
                                </Badge>
                                {TriggerIcon && (
                                  <Tooltip content={triggerMeta?.tooltip || triggerMeta?.label || 'Trigger'}>
                                    <div className="w-7 h-7 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground">
                                      <TriggerIcon className="w-4 h-4" />
                                    </div>
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex justify-center py-2">
                  <Tooltip content="Add Rule" side="bottom">
                    <Button
                      variant="default"
                      size="sm"
                      aria-label="Add Rule"
                      className="text-xs px-3 py-1 h-7 shadow-sm bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleAddRule();
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Rule
                    </Button>
                  </Tooltip>
                </div>
              </div>
            )}

            {/* Items Layer - Add Item button only */}
            {isItemsLayer && (
              <div className="flex flex-col flex-1">
                <div className="flex-1 min-h-0 border border-dashed border-border rounded-md overflow-y-auto">
                  {itemsList.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground px-4 text-center">
                      Click "+ Item" to create a new item definition file.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 p-2">
                      {/* Group items by role (mirroring Add Item roles) */}
                      {(() => {
                        const roleOrder = ITEM_ROLE_SELECTIONS.map(r => r.id).concat('unspecified' as ItemRole);
                        const roleMetaLookup = ITEM_ROLE_SELECTIONS.reduce((acc, r) => ({ ...acc, [r.id]: ITEM_ROLE_META[r.id] }), {} as Record<ItemRole, { label: string; badgeClass: string }>);

                        return roleOrder.map((roleId) => {
                          const items = itemsList.filter((item) => item.role === roleId);
                          if (items.length === 0) return null;
                          const meta = roleMetaLookup[roleId] || ITEM_ROLE_META.unspecified;
                          const isExpanded = expandedItemCategories.has(roleId) || (roleId === 'equipment' && expandedItemCategories.size === 0);
                          return (
                            <div key={roleId} className="flex flex-col w-full">
                              <Tooltip content="Click to expand" side="right">
                                <div
                                  className="flex items-center gap-2 p-2 bg-muted/30 hover:bg-muted/50 rounded-md border border-border cursor-pointer transition-colors w-full"
                                  onClick={() => {
                                    setExpandedItemCategories(prev => {
                                      const newSet = new Set(prev);
                                      if (newSet.has(roleId)) {
                                        newSet.delete(roleId);
                                      } else {
                                        newSet.add(roleId);
                                      }
                                      return newSet;
                                    });
                                  }}
                                >
                                  <Folder className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                  <span className="flex items-center gap-2 flex-1 text-sm font-medium truncate">
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border ${meta.badgeClass}`}>
                                      {meta.label}
                                    </span>
                                  </span>
                                  <span className="text-xs text-muted-foreground">({items.length})</span>
                                  <ChevronsUpDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                              </Tooltip>
                              <div
                                className={`grid transition-all duration-200 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                              >
                                <div className="overflow-hidden">
                                  <div className="flex flex-col gap-1 mt-1">
                                    {items.map((item) => (
                                      <div
                                        key={item.id}
                                        className="flex items-center gap-2 p-2 bg-muted/50 hover:bg-muted rounded-md border border-border cursor-pointer transition-colors w-full"
                                        title={`${item.name} (ID: ${item.id}) - Click to edit`}
                                        onClick={() => handleOpenItemEdit(item)}
                                      >
                                        <Sword className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-medium truncate">{item.name}</div>
                                          <div className="text-xs text-muted-foreground truncate">
                                            ID: {item.id}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
                <div className="flex justify-center py-2">
                  <Tooltip content="Add Item" side="bottom">
                    <Button
                      variant="default"
                      size="sm"
                      aria-label="Add Item"
                      className="text-xs px-3 py-1 h-7 shadow-sm bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleOpenItemDialog();
                      }}
                    >
                      <Plus className="w-3 h-3" />
                      Item
                    </Button>
                  </Tooltip>
                </div>
              </div>
            )}

            {/* Tileset Brushes Window - render for all layers except NPC and Items */}
            {!isNpcLayer && !isItemsLayer && !isRulesLayer && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-0 m-0">
              {/* Layer Tabs (background / object only) */}
              {(() => {
                const activeLayerType = activeLayer?.type;
                const showTabs = activeLayerType === 'background' || activeLayerType === 'object';
                console.log('[DEBUG UI] Rendering tabs - activeLayerType:', activeLayerType, 'showTabs:', showTabs);
                if (editor && activeLayerType) {
                  const tabs = editor.getLayerTabs ? editor.getLayerTabs(activeLayerType) : [];
                  const activeTabId = editor.getActiveLayerTabId ? editor.getActiveLayerTabId(activeLayerType) : null;
                  console.log('[DEBUG UI] tabs for', activeLayerType, ':', tabs.length, 'tabs', JSON.stringify(tabs.map((t: any) => ({ id: t.id, name: t.name }))));
                  console.log('[DEBUG UI] activeTabId for', activeLayerType, ':', activeTabId);
                  console.log('[DEBUG UI] Tab ID match check: tab IDs are', tabs.map((t: any) => t.id), 'and looking for active ID', activeTabId);
                }
                if (!showTabs) return null;
        return (
          <div key={tabTick} className="flex items-center gap-2 px-2 py-2">
        <div
          className={`flex-1 flex items-center gap-1 overflow-x-auto tabs-scroll ${(() => {
            try {
              const tabs = editor && activeLayerType ? (editor.getLayerTabs ? editor.getLayerTabs(activeLayerType) : []) : [];
              return tabs && tabs.length > 7 ? 'tabs-limited' : '';
            } catch (e) { return ''; }
          })()}`}
          onWheel={(e: React.WheelEvent<HTMLDivElement>) => {
            const el = e.currentTarget as HTMLDivElement;
            if (el.scrollWidth > el.clientWidth) {
              e.preventDefault();
              // vertical wheel scroll -> horizontal scroll
              el.scrollLeft += e.deltaY;
            }
          }}
        >
                      {/* Render simple tabs using editor state when available (no import/add controls here) */}
                      {editor ? (
                        (editor.getLayerTabs ? editor.getLayerTabs(activeLayerType!) : []).map((tab: { id: number; name?: string; }, idx: number) => {
                          console.log('[DEBUG UI] Rendering button for tab:', tab.id, 'index:', idx, 'isActive:', editor.getActiveLayerTabId && editor.getActiveLayerTabId(activeLayerType) === tab.id);
                          return (
                          <button
                            key={tab.id}
                            className={`w-5 h-5 flex items-center justify-center rounded-full text-white text-xs font-medium transition-colors shadow-sm ${editor && editor.getCurrentLayerType() === activeLayerType && editor.getActiveLayerTabId && editor.getActiveLayerTabId(activeLayerType) === tab.id ? 'opacity-100 scale-100 ring-2 ring-offset-1' : 'opacity-90 scale-95'}`}
                            onClick={() => {
                              if (!editor) return;
                              editor.setActiveLayerTab(activeLayerType!, tab.id);
                              try { editor.refreshTilePalette(true); } catch (err) { /* ignore */ }
                              setTabTick(t => t + 1);
                            }}
                            style={{
                              background: (editor && editor.getActiveLayerTabId && editor.getActiveLayerTabId(activeLayerType) === tab.id) ? '#ea580c' : '#f97316'
                            }}
                          >
                            {idx + 1}
                          </button>
                        );
                        })
                      ) : (
                        <div className="text-xs text-muted-foreground">No tabs</div>
                      )}
                    </div>
                  </div>
                );
              })()}
              <div className="relative flex-1 min-h-0 overflow-auto flex flex-col">
                <div
                  id="tilesContainer"
                  className="tile-palette flex flex-col flex-1 min-h-0 overflow-y-auto p-0 m-0 justify-start pb-12"
                  onWheel={(e: React.WheelEvent<HTMLDivElement>) => {
                    // If content overflows horizontally, use the vertical wheel to scroll left/right
                    const el = e.currentTarget as HTMLDivElement;
                    if (el.scrollWidth > el.clientWidth) {
                      e.preventDefault();
                      // deltaY positive -> scroll right, negative -> scroll left
                      el.scrollLeft += e.deltaY;
                    }
                  }}
                ></div>
                {/* Hidden element to track brush tool state */}
                <div data-brush-tool={brushTool} className="hidden"></div>
              </div>
              {/* Active GID moved to canvas area (see Hover Coordinates Display) */}
            </div>
            )}
            {/* Brush Tools - stick to bottom so palette can fill remaining space */}
            {!isNpcLayer && !isItemsLayer && !isRulesLayer && (
            <div className="sticky bottom-0 z-10 bg-transparent py-2">
              <div className="text-xs text-muted-foreground"></div>
              <div className="w-full flex justify-center">
                <div
                  ref={setBrushToolbarNode}
                  className={`flex items-center transition-all duration-300 ease-in-out gap-1 transform -translate-x-1 mt-2 mb-2`}
                >
                  {!isCollisionLayer && (
                    <>
                  <div className="flex-shrink-0 flex items-center gap-1">
                    {/* Add Tab button (visible for background/object) */}
                    { (activeLayer?.type === 'background' || activeLayer?.type === 'object') && (
                      <Tooltip content="Add tab" side="bottom">
                          <Button
                          variant="outline"
                          size="sm"
                          className="text-xs px-1 py-1 h-6"
                          onClick={() => {
                            if (!editor || !activeLayer) return;
                            const tabs = editor.getLayerTabs ? editor.getLayerTabs(activeLayer.type) : [];
                            if (tabs && tabs.length >= 8) {
                              toast({ title: 'Maximum tabs reached', description: 'You can have up to 8 tabs per layer.', variant: 'destructive' });
                              return;
                            }
                            const newId = editor.createLayerTab(activeLayer.type);
                            editor.setActiveLayerTab(activeLayer.type, newId);
                            // Trigger React render so tabs appear immediately
                            setTabTick(t => t + 1);
                          }}
                        >
                          +
                        </Button>
                      </Tooltip>
                    )}

                    {/* Existing Import button: now imports into active tab for background/object layers, falls back to existing layer tileset behavior for actor layers */}
                    {(() => {
                      const isNpc = activeLayer?.type === 'npc';
                      const isEnemy = activeLayer?.type === 'enemy';
                      const isEventLayer = activeLayer?.type === 'event';
                      const isActorLayer = isNpc || isEnemy || isEventLayer;
                      const tooltip = isActorLayer ? `Add ${isEventLayer ? 'Event' : isNpc ? 'NPC' : 'Enemy'}` : 'Import a PNG tileset or brush for the active layer tab';
                      if (isNpc || isEnemy || isEventLayer) {
                        return (
                          <Tooltip content={tooltip} side="bottom">
                            <Button
                              variant="default"
                              size="sm"
                              aria-label={tooltip}
                              className="relative z-20 text-xs px-1 py-1 h-6 shadow-sm bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (isNpc || isEnemy) {
                                  handleOpenActorDialog(isNpc ? 'npc' : 'enemy');
                                } else {
                                  toast({ title: 'Not implemented', description: 'Create Event will be implemented later.' });
                                }
                              }}
                              role="button"
                            >
                              <Upload className="w-3 h-3 text-white" />
                            </Button>
                          </Tooltip>
                        );
                      }

                      return (
                        <Tooltip content={tooltip} side="bottom">
                          <Button
                            variant="default"
                            size="sm"
                            aria-label={tooltip}
                            className="relative text-xs px-1 py-1 h-6 shadow-sm bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
                          >
                            <Upload className="w-3 h-3 text-white" />
                            <input
                              type="file"
                              accept="image/png"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={async (e) => {
                                // For background/object: import into active tab; otherwise fall back to layer tileset import
                                if (!editor || !activeLayer) return;
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const layerType = activeLayer.type;
                                if (layerType === 'background' || layerType === 'object') {
                                  // Import into the currently active tab if available. If there is
                                  // no active tab yet, create one (respect the 8-tab limit).
                                  const tabs = editor.getLayerTabs ? editor.getLayerTabs(layerType) : [];
                                  let targetTabId = editor.getActiveLayerTabId ? editor.getActiveLayerTabId(layerType) : null;
                                  if (typeof targetTabId !== 'number' || targetTabId === null) {
                                    // No active tab -> create one, but respect the limit
                                    if (tabs && tabs.length >= 8) {
                                      toast({ title: 'Maximum tabs reached', description: 'You can have up to 8 tabs per layer.', variant: 'destructive' });
                                      return;
                                    }
                                    targetTabId = editor.createLayerTab(layerType);
                                    editor.setActiveLayerTab(layerType, targetTabId);
                                  }
                                  // Import into the active/target tab
                                  await editor.importBrushImageToLayerTab(layerType, targetTabId, file);
                                  // Refresh palette to show newly-added brush/tiles
                                  editor.refreshTilePalette(true);
                                  // Trigger UI update so changes appear immediately
                                  setTabTick(t => t + 1);
                                } else {
                                  // Non-tab layers: keep legacy behavior
                                  handleFileUpload(e as React.ChangeEvent<HTMLInputElement>, 'layerTileset');
                                }
                              }}
                            />
                          </Button>
                        </Tooltip>
                      );
                    })()}
                  </div>
                  <div
                    className={`flex-shrink-0 overflow-visible transition-all duration-300 ease-out opacity-100 scale-100 max-w-[2.5rem] w-auto`}
                  >
                    <Tooltip content="Move/Reorder brushes">
                      <Button
                        variant={brushTool === 'move' ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs px-1 py-1 h-6 shadow-sm"
                        onClick={() => handleToggleBrushTool('move')}
                      >
                        <Scan className="w-3 h-3" />
                      </Button>
                    </Tooltip>
                  </div>
                  <div
                    className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-out ${brushToolbarExpanded || brushTool === 'merge' ? 'opacity-100 scale-100 max-w-[2.5rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
                  >
                    <Tooltip content="Merge brushes">
                      <Button
                        variant={brushTool === 'merge' ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs px-1 py-1 h-6 shadow-sm"
                        onClick={() => handleToggleBrushTool('merge')}
                      >
                        <Link2 className="w-3 h-3" />
                      </Button>
                    </Tooltip>
                  </div>
                  <div
                    className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-out ${brushToolbarExpanded || brushTool === 'separate' ? 'opacity-100 scale-100 max-w-[2.5rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
                  >
                    <Tooltip content="Separate brushes">
                      <Button
                        variant={brushTool === 'separate' ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs px-1 py-1 h-6 shadow-sm"
                        onClick={() => handleToggleBrushTool('separate')}
                      >
                        <Scissors className="w-3 h-3" />
                      </Button>
                    </Tooltip>
                  </div>
                  <div
                    className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-out ${brushToolbarExpanded || brushTool === 'remove' ? 'opacity-100 scale-100 max-w-[2.5rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
                  >
                    <Tooltip content="Remove brushes">
                      <Button
                        variant={brushTool === 'remove' ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs px-1 py-1 h-6 shadow-sm"
                        onClick={() => handleToggleBrushTool('remove')}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </Tooltip>
                  </div>
                  <div
                    className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-out ${brushToolbarExpanded ? 'opacity-100 scale-100 max-w-[2.5rem] w-auto' : 'opacity-0 scale-90 max-w-0 w-0 pointer-events-none'}`}
                  >
                    <Tooltip content="Delete tileset tab">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs px-1 py-1 h-6 border-red-500 hover:border-red-600 hover:bg-red-50 shadow-sm"
                        onClick={() => {
                          showBrushToolbarTemporarily();
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
                          // Prompt confirmation to remove the active tab
                          const payload = { layerType, tabId: activeTabId };
                          confirmPayloadRef.current = payload;
                          setTabToDelete(payload);
                          setConfirmAction({ type: 'removeTab', payload });
                        }}
                      >
                        <X className="w-3 h-3 text-red-500" />
                      </Button>
                    </Tooltip>
                  </div>
                    </>
                  )}
                </div>
              </div>
            </div>
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
                  {layers.map((layer) => {
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
          </div>

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
                              className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 text-xs flex items-center justify-between gap-2"
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

              <Tooltip content="Map Settings">
                <Button onClick={() => setShowSettings(true)} className="w-7 h-7 p-0 shadow-sm" variant="outline" size="sm">
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
                <h3 className="text-lg font-semibold">Settings</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowSettings(false)}
                  className="w-8 h-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex border-b mb-4">
                <button
                  className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${settingsTab === 'map' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'}`}
                  onClick={() => setSettingsTab('map')}
                >
                  Current Map Settings
                </button>
                <button
                  className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${settingsTab === 'other' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'}`}
                  onClick={() => setSettingsTab('other')}
                >
                  Other Options
                </button>
              </div>
              {settingsTab === 'map' ? (
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
                      checked={isStartingMap}
                      onChange={(e) => updateStartingMap(e.target.checked)}
                      aria-checked={isStartingMap}
                      aria-label="Set this map as the starting map"
                    />
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
              ) : (
                <div className="space-y-4">
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
                  <div>
                    <label className="block text-sm font-medium mb-2">Active GID Indicator</label>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Show</span>
                      <button
                        onClick={() => {
                          const newVal = !showActiveGid;
                          setShowActiveGid(newVal);
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          showActiveGid ? 'bg-orange-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            showActiveGid ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                        <span className="sr-only">Toggle Active GID Indicator</span>
                      </button>
                      <span className="text-sm">{showActiveGid ? 'Shown' : 'Hidden'}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Toggle whether the Active GID badge is visible next to the hover coordinates.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Sidebar Collapse Button</label>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Show toggle</span>
                      <button
                        onClick={() => setShowSidebarToggle((s: boolean) => !s)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          showSidebarToggle ? 'bg-orange-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            showSidebarToggle ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                        <span className="sr-only">Toggle sidebar collapse button</span>
                      </button>
                      <span className="text-sm">{showSidebarToggle ? 'Shown' : 'Hidden'}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Show or hide the left-edge sidebar collapse/expand toggle.</p>
                  </div>
                  <div className="flex gap-2 mt-6">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowSettings(false)}
                      className="flex-1"
                    >
                      Close
                    </Button>
                    <Button
                      onClick={() => {
                        setShowHelp(true);
                        setShowSettings(false);
                      }}
                      className="flex-1 flex items-center justify-center gap-2"
                    >
                      <HelpCircle className="w-4 h-4" />
                      <span>Help & Docs</span>
                    </Button>
                  </div>
                </div>
              )}
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
                <Button variant="outline" onClick={() => setShowClearLayerDialog(false)}>
                  Cancel
                </Button>
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
                      <h4 className="text-xl font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
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
                    Flare Studio | GUI for Flare Engine by ism.
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
            onDragLeave={(e) => {
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
            {/* Canvas Tooltip Panel - always mounted; visibility via classes */}
            <div
              className={`absolute top-4 left-4 z-20 p-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-lg border border-border shadow-lg transition-opacity duration-300 ${showTooltip ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
              aria-hidden={!showTooltip}
            >
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
              <div className={`ml-2 transition-opacity duration-200 ${hoverCoords && showActiveGid ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
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

      {/* Vendor Unlockable Items Dialog */}
      <Dialog open={showVendorUnlockDialog} onOpenChange={(open) => setShowVendorUnlockDialog(open)} zIndex={80}>
        <DialogContent className="max-w-4xl w-full z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-500" />
              Unlockable Items
            </DialogTitle>
            <DialogDescription>
              Add status-based stock. Each requirement creates its own stock list.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {vendorUnlockEntries.length === 0 && (
              <div className="text-sm text-muted-foreground">
                No requirements yet. Use &quot;Add Requirement&quot; to start.
              </div>
            )}

            {vendorUnlockEntries.map((entry) => (
              <div key={entry.id} className="space-y-2 rounded-md border border-border p-3 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1 h-9 text-sm"
                    placeholder="Requirement status (e.g., emp_perdition_trader1)"
                    value={entry.requirement}
                    onChange={(e) => handleUpdateVendorUnlockRequirement(entry.id, e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleRemoveVendorUnlockRequirement(entry.id)}
                    aria-label="Remove requirement"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {itemsList.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No items found. Create items in the Items layer to add them here.
                    </p>
                  ) : (
                    itemsList.map((item) => {
                      const selected = entry.items[item.id] !== undefined;
                      const qty = entry.items[item.id] ?? 1;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 p-2 rounded-md border transition-all ${
                            selected
                              ? 'border-amber-500 ring-2 ring-amber-200 dark:ring-amber-900/60 bg-amber-50/40 dark:bg-amber-900/10'
                              : 'border-border bg-muted/30 hover:bg-muted/50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleVendorUnlockItem(entry.id, item.id)}
                            className="flex-1 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <Badge className="text-[10px] font-semibold px-2 py-0.5">
                                ID {item.id}
                              </Badge>
                              <span className="font-medium text-sm">{item.name || `Item ${item.id}`}</span>
                              <span className="text-xs text-muted-foreground">({item.role})</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {item.category || 'Default'} • {item.fileName}
                            </div>
                          </button>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Qty</span>
                            <Input
                              type="number"
                              className="h-8 w-20 text-xs"
                              min={1}
                              disabled={!selected}
                              value={qty}
                              onChange={(e) => handleVendorUnlockQtyChange(entry.id, item.id, Number.parseInt(e.target.value, 10) || 1)}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Button type="button" variant="secondary" size="sm" onClick={handleAddVendorUnlockRequirement}>
              Add Requirement
            </Button>
          <DialogFooter className="justify-between w-auto gap-2">
            <Button variant="outline" size="icon" onClick={() => setShowVendorUnlockDialog(false)} aria-label="Cancel unlockable items">
              <X className="w-4 h-4" />
            </Button>
            <Button size="icon" onClick={handleSaveVendorUnlock} aria-label="Save unlockable items">
              <Save className="w-4 h-4" />
            </Button>
          </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vendor Random Offers Dialog */}
      <Dialog open={showVendorRandomDialog} onOpenChange={(open) => setShowVendorRandomDialog(open)} zIndex={80}>
        <DialogContent className="max-w-4xl w-full z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Random Offers
            </DialogTitle>
            <DialogDescription>
              Pick random offer candidates with chance and quantity ranges.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {itemsList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No items found. Create items in the Items layer to add them here.
              </p>
            ) : (
              itemsList.map((item) => {
                const selected = vendorRandomSelection[item.id] !== undefined;
                const entry = vendorRandomSelection[item.id] || { chance: 100, min: 1, max: 1 };
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-2 rounded-md border transition-all ${
                      selected
                        ? 'border-purple-500 ring-2 ring-purple-200 dark:ring-purple-900/60 bg-purple-50/40 dark:bg-purple-900/10'
                        : 'border-border bg-muted/30 hover:bg-muted/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleVendorRandomItem(item.id)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Badge className="text-[10px] font-semibold px-2 py-0.5">
                          ID {item.id}
                        </Badge>
                        <span className="font-medium text-sm">{item.name || `Item ${item.id}`}</span>
                        <span className="text-xs text-muted-foreground">({item.role})</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {item.category || 'Default'} · {item.fileName}
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Chance</span>
                      <select
                        className="h-8 text-xs border rounded px-2 bg-background"
                        disabled={!selected}
                        value={entry.chance.toString()}
                        onChange={(e) => handleVendorRandomFieldChange(item.id, 'chance', parseInt(e.target.value, 10) || 1)}
                      >
                        {[100, 50, 25, 10, 5].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Min</span>
                      <Input
                        type="number"
                        className="h-8 w-16 text-xs"
                        min={1}
                        disabled={!selected}
                        value={entry.min}
                        onChange={(e) => handleVendorRandomFieldChange(item.id, 'min', parseInt(e.target.value, 10) || 1)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Max</span>
                      <Input
                        type="number"
                        className="h-8 w-16 text-xs"
                        min={1}
                        disabled={!selected}
                        value={entry.max}
                        onChange={(e) => handleVendorRandomFieldChange(item.id, 'max', parseInt(e.target.value, 10) || 1)}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Min item number</span>
                <Tooltip content="How many of these items can appear in total?">
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </Tooltip>
                <Input
                  type="number"
                  className="h-8 w-20 text-xs"
                  min={1}
                  value={vendorRandomCount.min}
                  onChange={(e) => handleRandomCountChange('min', parseInt(e.target.value, 10) || 1)}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Max item number</span>
                <Tooltip content="How many of these items can appear in total?">
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </Tooltip>
                <Input
                  type="number"
                  className="h-8 w-20 text-xs"
                  min={1}
                  value={vendorRandomCount.max}
                  onChange={(e) => handleRandomCountChange('max', parseInt(e.target.value, 10) || 1)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setShowVendorRandomDialog(false)} aria-label="Cancel random offers">
                <X className="w-4 h-4" />
              </Button>
              <Button size="icon" onClick={handleSaveVendorRandom} aria-label="Save random offers">
                <Save className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rule Creation Dialog */}
      <Dialog
        open={showRuleDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowRuleDialog(false);
            setRuleDialogError(null);
            setRuleDialogStep('start');
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-orange-500" />
              Add Rule
            </DialogTitle>
            <DialogDescription>Give the rule a name and pick how it begins.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {ruleDialogStep === 'start' ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Rule Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={ruleNameInput}
                    onChange={(event) => setRuleNameInput(event.target.value)}
                    placeholder="Rule name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">How does this rule start?</label>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {[
                      { id: 'player', label: 'Started by player', hint: 'Triggered by player actions', icon: User },
                      { id: 'game', label: 'Started by the game', hint: 'Triggered by world or system', icon: Shield }
                    ].map((option) => {
                      const IconComp = option.icon;
                      const isActive = ruleStartType === option.id;
                      return (
                        <Tooltip
                          key={option.id}
                          content={
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-sm">{option.label}</span>
                              <span className="text-xs text-muted-foreground">{option.hint}</span>
                            </div>
                          }
                        >
                          <button
                            type="button"
                            onClick={() => setRuleStartType(option.id as RuleStartType)}
                            className={`flex items-center justify-center rounded-md border p-3 transition-all ${
                              isActive
                                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-sm'
                                : 'border-border hover:bg-muted/60'
                            }`}
                            aria-label={option.label}
                          >
                            <span className={`w-10 h-10 rounded-md flex items-center justify-center ${isActive ? 'bg-white dark:bg-orange-900/40' : 'bg-muted'}`}>
                              <IconComp className="w-5 h-5" />
                            </span>
                            <span className="sr-only">{option.label}</span>
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Pick a trigger</label>
                    <span className="text-xs text-muted-foreground">
                      {ruleStartType === 'player' ? 'Player driven events' : 'Game driven events'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {availableRuleTriggers.map((option) => {
                      const IconComp = option.icon;
                      const isActive = ruleTriggerId === option.id;
                      return (
                        <Tooltip key={option.id} content={option.tooltip || option.label}>
                          <button
                            type="button"
                            onClick={() => setRuleTriggerId(option.id)}
                            className={`flex flex-col items-center gap-1 rounded-md border p-2 transition-colors ${
                              isActive ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-200' : 'border-border hover:bg-muted/50'
                            }`}
                            aria-pressed={isActive}
                            aria-label={option.label}
                          >
                            <span className="w-9 h-9 rounded-md flex items-center justify-center bg-background">
                              <IconComp className="w-5 h-5" />
                            </span>
                            <span className="sr-only">{option.label}</span>
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">What happens</h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  {RULE_ACTION_GROUPS.map((group) => (
                    <div
                      key={group.id}
                      className="rounded-lg border border-border bg-muted/30 p-3 flex flex-col gap-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{group.title}</span>
                        {group.subtitle && <span className="text-xs text-muted-foreground">{group.subtitle}</span>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.actions.map((action) => (
                          <button
                            key={action.id}
                            type="button"
                            className="px-3 py-1.5 text-xs rounded-md border border-border bg-background hover:bg-muted/60 transition-colors"
                            aria-label={action.label}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground flex items-center gap-3">
              <span className="font-semibold text-foreground">Preview</span>
              <span className="truncate">
                When {RULE_TRIGGER_LOOKUP[ruleTriggerId]?.tooltip || RULE_TRIGGER_LOOKUP[ruleTriggerId]?.label || '...'} → // this will be filled later
              </span>
            </div>

            {ruleDialogError && (
              <div className="text-sm text-red-500">{ruleDialogError}</div>
            )}
          </div>

          <DialogFooter className="justify-between">
            <Button onClick={handleSaveRule}>Save Rule</Button>
            <Button
              variant="outline"
              onClick={() => setRuleDialogStep('actions')}
            >
              Next &gt;
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
              Define the details for this {actorDialogState?.type === 'npc' ? 'NPC' : 'enemy'}.
            </DialogDescription>
          </DialogHeader>
          {actorDialogState && (
            <div className="space-y-4">
              {/* Name (zorunlu) */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={actorDialogState.name}
                  onChange={(event) => handleActorFieldChange('name', event.target.value)}
                  placeholder={actorDialogState.type === 'npc' ? 'Village Elder' : 'Goblin Scout'}
                />
              </div>

              {/* Role (toggle buttons) */}
              <div>
                <label className="block text-sm font-medium mb-1">Roles</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleActorRoleToggle('isTalker')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      actorDialogState.isTalker
                        ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/50'
                        : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
                    }`}
                  >
                    Talker
                  </button>
                  <button
                    type="button"
                    onClick={() => handleActorRoleToggle('isVendor')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      actorDialogState.isVendor
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/50'
                        : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
                    }`}
                  >
                    Vendor
                  </button>
                  <button
                    type="button"
                    onClick={() => handleActorRoleToggle('isQuestGiver')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      actorDialogState.isQuestGiver
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/50'
                        : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
                    }`}
                  >
                    Quest
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {!actorDialogState.isTalker && !actorDialogState.isVendor && !actorDialogState.isQuestGiver
                    ? 'Static NPC with no interaction.'
                    : 'Select one or more roles for this NPC.'}
                </p>
              </div>

              {/* Tileset Location (opsiyonel) */}
              <div>
                <label className="block text-sm font-medium mb-1">Tileset Location</label>
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    value={actorDialogState.tilesetPath}
                    onChange={(event) => handleActorFieldChange('tilesetPath', event.target.value)}
                    placeholder="npcs/merchant.png (optional)"
                    readOnly={canUseTilesetDialog}
                    onClick={canUseTilesetDialog ? () => { void handleActorTilesetBrowse(); } : undefined}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 px-3 gap-2"
                    onClick={() => { void handleActorTilesetBrowse(); }}
                    disabled={!canUseTilesetDialog}
                  >
                    <Image className="w-4 h-4" />
                    <span>Browse</span>
                  </Button>
                </div>
              </div>

              {/* Portrait Location (opsiyonel) */}
              <div>
                <label className="block text-sm font-medium mb-1">Portrait Location</label>
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    value={actorDialogState.portraitPath}
                    onChange={(event) => handleActorFieldChange('portraitPath', event.target.value)}
                    placeholder="portraits/merchant.png (optional)"
                    readOnly={canUseTilesetDialog}
                    onClick={canUseTilesetDialog ? () => { void handleActorPortraitBrowse(); } : undefined}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 px-3 gap-2"
                    onClick={() => { void handleActorPortraitBrowse(); }}
                    disabled={!canUseTilesetDialog}
                  >
                    <User className="w-4 h-4" />
                    <span>Browse</span>
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

      {/* Item Creation Dialog */}
      <Dialog
        open={!!itemDialogState}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseItemDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sword className="w-5 h-5 text-orange-500" />
              Add Item
            </DialogTitle>
            <DialogDescription>Create a new item definition.</DialogDescription>
          </DialogHeader>
          {itemDialogState && (
            <div className="space-y-4">
              {/* Item Name (required) */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={itemDialogState.name}
                  onChange={(event) => handleItemFieldChange('name', event.target.value)}
                  placeholder="Health Potion"
                />
              </div>

              {/* Item role presets (tagged like NPC roles) */}
              <div>
                <label className="block text-sm font-medium mb-1">What is this item for?</label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {ITEM_ROLE_SELECTIONS.map((roleOption) => {
                    const isActive = itemDialogState.role === roleOption.id;
                    const roleMeta = ITEM_ROLE_META[roleOption.id];
                    return (
                      <button
                        key={roleOption.id}
                        type="button"
                        onClick={() => {
                          handleItemFieldChange('role', roleOption.id);
                          if (roleOption.id !== 'resource') {
                            handleItemFieldChange('resourceSubtype', '');
                          } else if (!itemDialogState.resourceSubtype) {
                            handleItemFieldChange('resourceSubtype', 'material');
                          }
                        }}
                        className={`text-left border rounded-md px-3 py-2 transition-colors ${isActive ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30' : 'border-border hover:bg-muted/60'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${roleMeta.badgeClass}`}>
                            {roleMeta.label}
                          </span>
                          <Check className={`w-4 h-4 transition-opacity ${isActive ? 'opacity-100 text-orange-500' : 'opacity-0'}`} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-snug">{roleOption.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Resource subtype helper */}
              {itemDialogState.role === 'resource' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Resource subtype</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(RESOURCE_SUBTYPE_META) as Array<Exclude<ItemResourceSubtype, ''>>).map((key) => {
                      const meta = RESOURCE_SUBTYPE_META[key];
                      const isActive = itemDialogState.resourceSubtype === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleItemFieldChange('resourceSubtype', key)}
                          className={`text-left border rounded-md px-3 py-2 transition-colors ${isActive ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/30' : 'border-border hover:bg-muted/60'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.badgeClass}`}>
                              {meta.label}
                            </span>
                            <Check className={`w-4 h-4 transition-opacity ${isActive ? 'opacity-100 text-purple-500' : 'opacity-0'}`} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-snug">{meta.hint}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {itemDialogError && (
                <div className="text-sm text-red-500">
                  {itemDialogError}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="relative">
            {pendingDuplicateItem && (
              <div className="absolute -top-24 right-4 w-[280px]">
                <div className="rounded-md border border-amber-500/50 bg-background shadow-lg text-xs p-2.5 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-foreground text-left">Heads up</div>
                    <div className="mt-1 space-y-1 text-left">
                      {pendingDuplicateItem.kind === 'same-role' ? (
                        <div className="text-[11px] text-muted-foreground">
                          An item with this name already exists in this role.
                        </div>
                      ) : (
                        <>
                          <div className="text-[11px] text-muted-foreground leading-snug">
                            Same name in another role. Create anyway?
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-snug">
                            Existing: {ITEM_ROLE_META[pendingDuplicateItem.conflictRole]?.label || pendingDuplicateItem.conflictRole}<br />
                            New: {ITEM_ROLE_META[pendingDuplicateItem.targetRole]?.label || pendingDuplicateItem.targetRole}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPendingDuplicateItem(null)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                    {pendingDuplicateItem.kind === 'other-role' && (
                      <Button size="icon" className="h-7 w-7 bg-amber-500 text-white hover:bg-amber-600" onClick={handleConfirmDuplicateItem}>
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
            <Button variant="outline" onClick={handleCloseItemDialog}>
              Cancel
            </Button>
            <Button onClick={handleItemSubmit}>
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Edit Dialog */}
      <Dialog open={showItemEditDialog} onOpenChange={(open) => !open && handleCloseItemEdit()}>
        <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col">
          <DialogHeader className="mb-2">
            <DialogTitle className="flex items-center gap-2">
              <Sword className="w-5 h-5 text-orange-500" />
              Edit Item: {editingItem?.name || 'Unknown'}
            </DialogTitle>
          </DialogHeader>
          
          {editingItem && (
            <div className="flex-1 overflow-y-auto pr-2 minimal-scroll">
              {(() => {
                const role = editingItem.role || 'unspecified';
                const isUnspecified = role === 'unspecified';
                const isEquipment = role === 'equipment' || isUnspecified;
                const isConsumable = role === 'consumable';
                const isQuest = role === 'quest';
                const isResource = role === 'resource';
                const isBook = role === 'book';
                return (
              <div className="space-y-4 pb-4">
                {/* Basic Identifier Properties */}
                <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Tag className="w-4 h-4 text-orange-500" />
                    Basic Identifier Properties
                  </h4>
                      <div className="grid grid-cols-2 gap-3 items-start">
                        <div className="space-y-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">ID</label>
                            <Badge variant="secondary" className="w-fit text-xs px-2 py-1 border border-border bg-muted/60">
                              {editingItem.id}
                            </Badge>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Name</label>
                            <Input
                              value={editingItem.name}
                              onChange={(e) => updateEditingItemField('name', e.target.value)}
                              placeholder="Item name"
                              className="h-8"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Description</label>
                            <Input
                              value={editingItem.flavor}
                              onChange={(e) => updateEditingItemField('flavor', e.target.value)}
                              placeholder="Item description shown in tooltips"
                              className="h-16"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Level</label>
                            <Input
                              type="text"
                              value={editingItem.level}
                              onChange={(e) => updateEditingItemField('level', parseInt(e.target.value, 10) || 1)}
                              className="h-8 w-24"
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              <label className="text-xs text-muted-foreground">Quality (Rarity)</label>
                              <Tooltip content="Controls rarity color & overlay; does not affect stats." side="right">
                                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                              </Tooltip>
                            </div>
                            {(() => {
                              const qualityOptions = [
                                { value: '', label: 'None', swatch: '#d4d4d8' },
                                { value: 'low', label: 'Low', swatch: 'rgb(127,127,127)' },
                                { value: 'normal', label: 'Normal', swatch: 'rgb(255,255,255)' },
                                { value: 'high', label: 'High', swatch: 'rgb(64,255,64)' },
                                { value: 'epic', label: 'Epic', swatch: 'rgb(64,128,255)' },
                                { value: 'rare', label: 'Rare', swatch: 'rgb(160,64,255)' },
                                { value: 'unique', label: 'Unique', swatch: 'rgb(255,192,64)' },
                                { value: 'one_time_use', label: 'One-time Use', swatch: 'rgb(64,255,255)' },
                                { value: 'currency', label: 'Currency', swatch: 'rgb(255,232,156)' }
                              ];
                              const currentValue = editingItem.quality || '';
                              return (
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-1.5">
                                    {qualityOptions.map((opt) => {
                                      const isActive = currentValue === opt.value;
                                      return (
                                        <Button
                                          key={opt.value ?? 'none'}
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-8 px-2 text-xs flex items-center gap-2 border-border bg-card text-foreground hover:border-muted-foreground/60"
                                          onClick={() => updateEditingItemField('quality', opt.value)}
                                          style={isActive ? { borderColor: opt.swatch } : undefined}
                                        >
                                          <span
                                            className="h-3 w-3 rounded-full border border-border"
                                            style={{ backgroundColor: opt.swatch }}
                                          ></span>
                                          <span className="truncate">{opt.label}</span>
                                        </Button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                </div>

                {/* Trade and Inventory Properties */}
                <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Coins className="w-4 h-4 text-orange-500" />
                Trade and Inventory Properties
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                <div className="md:col-span-1">
                  {(() => {
                    const noStash = editingItem.no_stash || 'ignore';
                    const allowPrivate = !(noStash === 'private' || noStash === 'all');
                    const allowShared = !(noStash === 'shared' || noStash === 'all');
                    const updateStash = (nextAllowPrivate: boolean, nextAllowShared: boolean) => {
                      let next: 'ignore' | 'private' | 'shared' | 'all';
                      if (nextAllowPrivate && nextAllowShared) next = 'ignore';
                      else if (!nextAllowPrivate && nextAllowShared) next = 'private';
                      else if (nextAllowPrivate && !nextAllowShared) next = 'shared';
                      else next = 'all';
                      updateEditingItemField('no_stash', next);
                    };
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">Stash</span>
                          <Tooltip content="Where this can be stored?" side="right">
                            <HelpCircle className="w-4 h-4 text-muted-foreground" />
                          </Tooltip>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="flex items-center gap-2 text-xs text-foreground">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={allowPrivate}
                              onChange={(e) => updateStash(e.target.checked, allowShared)}
                            />
                            <span className="leading-tight">
                              Private stash
                              <span className="block text-muted-foreground text-[11px]">Character-only storage</span>
                            </span>
                          </label>
                          <label className="flex items-center gap-2 text-xs text-foreground">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={allowShared}
                              onChange={(e) => updateStash(allowPrivate, e.target.checked)}
                            />
                            <span className="leading-tight">
                              Shared stash
                              <span className="block text-muted-foreground text-[11px]">Account-wide storage</span>
                            </span>
                          </label>
                        </div>
                        {editingItem.quest_item && (
                          <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded px-2 py-1">
                            Quest items are not stashable by default. Adjust the checkboxes above if you want to allow stashing this quest item.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                    <div className="md:col-span-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <div>
                            <div className="flex items-center gap-1">
                              <label className="text-xs text-muted-foreground">Buy Price</label>
                              <Tooltip content="0 = vendors won’t buy this item (unsellable)." side="right">
                                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                              </Tooltip>
                            </div>
                            <input
                              type="text"
                              value={editingItem.price ?? ''}
                              onChange={(e) => updateEditingItemField('price', e.target.value)}
                              placeholder="10"
                              className="h-8 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              inputMode="numeric"
                              pattern="[0-9]*"
                            />
                          </div>
                          <div>
                            {(() => {
                              const autoSell = editingItem.price_sell === '0' || editingItem.price_sell === '' || editingItem.price_sell === undefined;
                              return (
                                <>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1">
                                      <label className="text-xs text-muted-foreground">Sell Price</label>
                                      <Tooltip content="0 = use automatic sell price (price * vendor_ratio_sell)." side="right">
                                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                                      </Tooltip>
                                    </div>
                                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <input
                                        type="checkbox"
                                        className="h-3.5 w-3.5"
                                        checked={autoSell}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            updateEditingItemField('price_sell', '0');
                                          } else {
                                            const fallbackValue = editingItem.price_sell && editingItem.price_sell !== '0'
                                              ? editingItem.price_sell
                                              : (editingItem.price && Number(editingItem.price) > 0 ? Math.max(1, Number(editingItem.price) / 2) : 1);
                                            updateEditingItemField('price_sell', fallbackValue.toString());
                                          }
                                        }}
                                      />
                                      Use automatic sell price
                                    </label>
                                  </div>
                                  <input
                                    type="text"
                                    value={editingItem.price_sell ?? ''}
                                    onChange={(e) => updateEditingItemField('price_sell', e.target.value)}
                                    placeholder="5"
                                    className="h-8 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    disabled={autoSell}
                                  />
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-muted-foreground">Max stack size</label>
                            <Tooltip content="Maximum items per stack. 1 = no stacking." side="right">
                              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                            </Tooltip>
                          </div>
                          <input
                            type="text"
                            value={editingItem.max_quantity}
                            onChange={(e) => updateEditingItemField('max_quantity', parseInt(e.target.value, 10) || 1)}
                            className="h-8 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            inputMode="numeric"
                            pattern="[0-9]*"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resource-specific */}
                {isResource && (
                  <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Box className="w-4 h-4 text-orange-500" />
                      Resource
                    </h4>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {(Object.keys(RESOURCE_SUBTYPE_META) as Array<Exclude<ItemResourceSubtype, ''>>).map((key) => {
                        const meta = RESOURCE_SUBTYPE_META[key];
                        const isActive = editingItem.resourceSubtype === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => updateEditingItemField('resourceSubtype', key)}
                            className={`text-left border rounded-md px-3 py-2 transition-colors ${isActive ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/30' : 'border-border hover:bg-muted/60'}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.badgeClass}`}>
                                {meta.label}
                              </span>
                              <Check className={`w-4 h-4 transition-opacity ${isActive ? 'opacity-100 text-purple-500' : 'opacity-0'}`} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-snug">{meta.hint}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Equipment and Requirement Properties */}
                {isEquipment && (
                <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-orange-500" />
                    Equipment and Requirements
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Item Type (equipment slot)</label>
                      <Input
                        value={editingItem.item_type}
                        onChange={(e) => updateEditingItemField('item_type', e.target.value)}
                        placeholder="items/types.txt ID"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Equip Flags</label>
                      <Input
                        value={editingItem.equip_flags}
                        onChange={(e) => updateEditingItemField('equip_flags', e.target.value)}
                        placeholder="flag1,flag2"
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Requires Level</label>
                      <Input
                        type="number"
                        value={editingItem.requires_level}
                        onChange={(e) => updateEditingItemField('requires_level', parseInt(e.target.value) || 0)}
                        min={0}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Requires Stat</label>
                      <Input
                        value={editingItem.requires_stat}
                        onChange={(e) => updateEditingItemField('requires_stat', e.target.value)}
                        placeholder="physical,6"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Requires Class</label>
                      <Input
                        value={editingItem.requires_class}
                        onChange={(e) => updateEditingItemField('requires_class', e.target.value)}
                        placeholder="warrior"
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Disable Slots</label>
                      <Input
                        value={editingItem.disable_slots}
                        onChange={(e) => updateEditingItemField('disable_slots', e.target.value)}
                        placeholder="slot1,slot2"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">GFX (Animation)</label>
                      <Input
                        value={editingItem.gfx}
                        onChange={(e) => updateEditingItemField('gfx', e.target.value)}
                        placeholder="animations/item.txt"
                        className="h-8"
                      />
                    </div>
                  </div>
                </div>
                )}

                {/* Status and Effect Properties (Bonuses) */}
                {isEquipment && (
                <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-orange-500" />
                    Bonuses and Effects
                  </h4>
                  <div>
                    <label className="text-xs text-muted-foreground">Bonus (stat bonuses)</label>
                    <Input
                      value={editingItem.bonus}
                      onChange={(e) => updateEditingItemField('bonus', e.target.value)}
                      placeholder="hp,50 or speed,10"
                      className="h-8"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Bonus Power Level</label>
                    <Input
                      value={editingItem.bonus_power_level}
                      onChange={(e) => updateEditingItemField('bonus_power_level', e.target.value)}
                      placeholder="power_id,level"
                      className="h-8"
                    />
                  </div>
                </div>
                )}

                    {/* Usage and Power Properties */}
                    {(isEquipment || isConsumable) && (
                    <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-500" />
                    Usage and Power (TODO IN FUTURE)
                  </h4>
                  {isEquipment && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Damage (dmg)</label>
                      <Input
                        value={editingItem.dmg}
                        onChange={(e) => updateEditingItemField('dmg', e.target.value)}
                        placeholder="melee,1,10"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Absorb (abs)</label>
                      <Input
                        value={editingItem.abs}
                        onChange={(e) => updateEditingItemField('abs', e.target.value)}
                        placeholder="1,5"
                        className="h-8"
                      />
                    </div>
                  </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Power ID</label>
                      <Input
                            value={editingItem.power}
                            onChange={(e) => updateEditingItemField('power', e.target.value)}
                            placeholder="power_id"
                            className="h-8"
                          />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Power Description</label>
                      <Input
                        value={editingItem.power_desc}
                        onChange={(e) => updateEditingItemField('power_desc', e.target.value)}
                            placeholder="Description text"
                            className="h-8"
                          />
                        </div>
                      </div>
                      {/* TODO: When equipment power presets are finalized, add configuration controls here. */}
                      <div>
                        <label className="text-xs text-muted-foreground">Replace Power</label>
                        <Input
                      value={editingItem.replace_power}
                      onChange={(e) => updateEditingItemField('replace_power', e.target.value)}
                      placeholder="old_power_id,new_power_id"
                      className="h-8"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Script</label>
                    <Input
                      value={editingItem.script}
                      onChange={(e) => updateEditingItemField('script', e.target.value)}
                      placeholder="scripts/item_script.txt"
                      className="h-8"
                    />
                  </div>
                </div>
                )}

                {/* Quest-only */}
                {isQuest && (
                  <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      Quest Item Settings
                    </h4>
                    <div className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        id="quest_item_lock"
                        checked={!!editingItem.quest_item}
                        disabled
                        className="h-4 w-4"
                      />
                      <label htmlFor="quest_item_lock" className="text-xs text-muted-foreground">Quest item (always on for this role)</label>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Pickup Status</label>
                      <Input
                        value={editingItem.pickup_status}
                        onChange={(e) => updateEditingItemField('pickup_status', e.target.value)}
                        placeholder="campaign_status_id"
                        className="h-8"
                      />
                    </div>
                  </div>
                )}

                {/* Book / Lore */}
                {isBook && (
                  <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Book className="w-4 h-4 text-orange-500" />
                      Book / Lore
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Book File</label>
                        <Input
                          value={editingItem.book}
                          onChange={(e) => updateEditingItemField('book', e.target.value)}
                          placeholder="books/lore.txt"
                          className="h-8"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-foreground mt-6">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={editingItem.book_is_readable}
                          onChange={(e) => updateEditingItemField('book_is_readable', e.target.checked)}
                        />
                        Show "Read" instead of "Use"
                      </label>
                    </div>
                  </div>
                )}

                {/* Visual and Audio Properties */}
                <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-orange-500" />
                    Visual and Audio
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Sound FX</label>
                      <Input
                        value={editingItem.soundfx}
                        onChange={(e) => updateEditingItemField('soundfx', e.target.value)}
                        placeholder="sounds/item.ogg"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Step FX (for armor)</label>
                      <Input
                        value={editingItem.stepfx}
                        onChange={(e) => updateEditingItemField('stepfx', e.target.value)}
                        placeholder="step_fx_id"
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Loot Animation</label>
                    <Input
                      value={editingItem.loot_animation}
                      onChange={(e) => updateEditingItemField('loot_animation', e.target.value)}
                      placeholder="loot/animation.txt,min,max"
                      className="h-8"
                    />
                  </div>
                </div>

                {/* Randomization and Loot Properties */}
                {!isQuest && (
                <div className="space-y-3 border border-border rounded-md p-3 bg-muted/20">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Gift className="w-4 h-4 text-orange-500" />
                    Randomization and Loot
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Randomizer Definition</label>
                      <Input
                        value={editingItem.randomizer_def}
                        onChange={(e) => updateEditingItemField('randomizer_def', e.target.value)}
                        placeholder="randomizer/def.txt"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Loot Drops Max</label>
                      <Input
                        type="number"
                        value={editingItem.loot_drops_max}
                        onChange={(e) => updateEditingItemField('loot_drops_max', parseInt(e.target.value) || 1)}
                        min={1}
                        className="h-8"
                      />
                    </div>
                  </div>
                </div>
                )}

              </div>
                );
              })()}
            </div>
          )}
          
          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={handleCloseItemEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveItemEdit} className="bg-orange-500 hover:bg-orange-600 text-white">
              Save Item
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
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2">
              {editingObject?.type === 'npc' && (
                <User className="w-5 h-5 text-orange-500" />
              )}
              {editingObject ? `Edit ${editingObject.type.toUpperCase()}` : 'Add Object'}
            </DialogTitle>
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
            <div className="space-y-3 pb-4">
              {/* Basic Info Row */}
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Name</label>
                  <Input
                    value={editingObject.name || ''}
                    onChange={(e) => setEditingObject({...editingObject, name: e.target.value})}
                    placeholder="Object name"
                    className="h-8"
                  />
                </div>
                <div className="w-24">
                  <label className="text-xs text-muted-foreground">Position</label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={editingObject.x}
                      onChange={(e) => setEditingObject({...editingObject, x: Number(e.target.value)})}
                      disabled={editingObject.type === 'npc'}
                      className={`h-8 w-11 px-1 text-center ${editingObject.type === 'npc' ? 'opacity-50' : ''}`}
                    />
                    <span className="text-muted-foreground text-xs">,</span>
                    <Input
                      type="number"
                      value={editingObject.y}
                      onChange={(e) => setEditingObject({...editingObject, y: Number(e.target.value)})}
                      disabled={editingObject.type === 'npc'}
                      className={`h-8 w-11 px-1 text-center ${editingObject.type === 'npc' ? 'opacity-50' : ''}`}
                    />
                  </div>
                </div>
              </div>

              {/* NPC Roles */}
              {editingObject.type === 'npc' && (
                <div className="flex gap-1.5">
                  {[
                    { key: 'talker', label: 'Talker', color: 'blue' },
                    { key: 'vendor', label: 'Vendor', color: 'emerald' },
                    { key: 'questGiver', label: 'Quest', color: 'amber' }
                  ].map(role => (
                    <button
                      key={role.key}
                      type="button"
                      onClick={() => {
                        const newProps = { ...editingObject.properties };
                        if (newProps[role.key] === 'true') {
                          delete newProps[role.key];
                        } else {
                          newProps[role.key] = 'true';
                        }
                        setEditingObject({ ...editingObject, properties: newProps });
                      }}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        editingObject.properties?.[role.key] === 'true'
                          ? role.color === 'blue' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/50'
                          : role.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/50'
                          : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/50'
                          : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted'
                      }`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Tileset & Portrait for NPC/Enemy */}
              {(editingObject.type === 'npc' || editingObject.type === 'enemy') && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                  <Input
                    className="h-8 flex-1 text-xs"
                    value={getEditingObjectProperty('tilesetPath', '')}
                    onChange={(e) => updateEditingObjectProperty('tilesetPath', e.target.value)}
                    placeholder="Tileset path..."
                      readOnly={canUseTilesetDialog}
                      onClick={canUseTilesetDialog ? () => { void handleEditingTilesetBrowse(); } : undefined}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 gap-2"
                      onClick={() => { void handleEditingTilesetBrowse(); }}
                      disabled={!canUseTilesetDialog}
                    >
                      <Image className="w-4 h-4" />
                      <span className="text-xs">Tileset</span>
                    </Button>
                  </div>
                  {editingObject.type === 'npc' && (
                    <div className="flex gap-2">
                      <Input
                        className="h-8 flex-1 text-xs"
                        value={getEditingObjectProperty('portraitPath', '')}
                        onChange={(e) => updateEditingObjectProperty('portraitPath', e.target.value)}
                        placeholder="Portrait path..."
                        readOnly={canUseTilesetDialog}
                        onClick={canUseTilesetDialog ? () => { void handleEditingPortraitBrowse(); } : undefined}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 gap-2"
                        onClick={() => { void handleEditingPortraitBrowse(); }}
                        disabled={!canUseTilesetDialog}
                      >
                        <User className="w-4 h-4" />
                        <span className="text-xs">Portrait</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Role-specific compact options */}
              {editingObject.type === 'npc' && editingObject.properties?.talker === 'true' && (
                <div className="pl-2 border-l-2 border-blue-500/50">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full text-xs gap-2"
                    onClick={() => {
                      // Load existing dialogue trees from properties if any
                      const existingTrees = editingObject.properties?.dialogueTrees;
                      if (existingTrees) {
                        try {
                          const parsed = JSON.parse(existingTrees as string);
                          // Ensure rewards and worldEffects exist for backward compatibility
                          const normalized = parsed.map((t: DialogueTree) => ({
                            ...t,
                            rewards: t.rewards || [],
                            worldEffects: t.worldEffects || []
                          }));
                          setDialogueTrees(normalized);
                        } catch {
                          setDialogueTrees([{ id: '1', topic: '', requirements: [], dialogues: [], rewards: [], worldEffects: [] }]);
                        }
                      } else {
                        setDialogueTrees([{ id: '1', topic: '', requirements: [], dialogues: [], rewards: [], worldEffects: [] }]);
                      }
                      setActiveDialogueTab(0);
                      setShowDialogueTreeDialog(true);
                    }}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Edit Dialogue Trees
                  </Button>
                </div>
              )}

              {editingObject.type === 'npc' && editingObject.properties?.vendor === 'true' && (
                <div className="pl-2 border-l-2 border-emerald-500/50">
                  <div className="space-y-1.5 flex flex-col">
                    <div className="w-full">
                      <Tooltip content="Items that are always in this vendor's shop.">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-full text-xs gap-2 justify-start"
                          onClick={handleOpenVendorStockDialog}
                        >
                          <Package className="w-3.5 h-3.5" />
                          Edit Always Available Items
                        </Button>
                      </Tooltip>
                    </div>
                    <div className="w-full">
                      <Tooltip content="Extra items that appear after certain quests or story steps.">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-full text-xs gap-2 justify-start"
                          onClick={handleOpenVendorUnlockDialog}
                        >
                          <Gift className="w-3.5 h-3.5" />
                          Edit Unlockable Items
                        </Button>
                      </Tooltip>
                    </div>
                    <div className="w-full">
                      <Tooltip content="Extra items randomly picked from a loot table each time.">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-full text-xs gap-2 justify-start"
                          onClick={handleOpenVendorRandomDialog}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Edit Random Offers
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              )}

              {editingObject.type === 'npc' && editingObject.properties?.questGiver === 'true' && (
                <div className="pl-2 border-l-2 border-amber-500/50 space-y-1.5">
                  <Input
                    className="h-7 text-xs"
                    value={getEditingObjectProperty('questRequiresStatus', '')}
                    onChange={(e) => updateEditingObjectProperty('questRequiresStatus', e.target.value)}
                    placeholder="Requires status..."
                  />
                  <Input
                    className="h-7 text-xs"
                    value={getEditingObjectProperty('questSetStatus', '')}
                    onChange={(e) => updateEditingObjectProperty('questSetStatus', e.target.value)}
                    placeholder="Set status on accept..."
                  />
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
            <div className="flex w-full justify-between">
              {/* Delete button - only for NPC */}
              {editingObject?.type === 'npc' && (
                <div className="flex items-center gap-2">
                  {showDeleteNpcConfirm ? (
                    <>
                      <span className="text-xs text-muted-foreground">Delete?</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => {
                          if (editingObject) {
                            editor?.removeMapObject(editingObject.id);
                            syncMapObjects();
                            setShowObjectDialog(false);
                            setEditingObject(null);
                            setShowDeleteNpcConfirm(false);
                          }
                        }}
                      >
                        Yes
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => setShowDeleteNpcConfirm(false)}
                      >
                        No
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setShowDeleteNpcConfirm(true)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
              {editingObject?.type !== 'npc' && <div />}
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleObjectDialogClose}>
                  Cancel
                </Button>
                <Button onClick={handleObjectDialogSave}>
                  Save
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue Tree Dialog */}
      <Dialog
        open={showDialogueTreeDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowDialogueTreeDialog(false);
            setDialogueTabToDelete(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              Dialogue Trees
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Tab sidebar */}
            <div className="w-48 flex flex-col border-r pr-4">
              <div className="flex-1 space-y-1 overflow-y-auto minimal-scroll">
                {dialogueTrees.map((tree, index) => (
                  <button
                    key={tree.id}
                    type="button"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (dialogueTrees.length > 1) {
                        setDialogueTabToDelete(index);
                      }
                    }}
                    onClick={() => {
                      if (dialogueTabToDelete === index) {
                        setDialogueTabToDelete(null);
                      } else {
                        setActiveDialogueTab(index);
                      }
                    }}
                    className={`w-full px-3 py-2 text-left text-sm rounded-md transition-colors ${
                      dialogueTabToDelete === index
                        ? 'bg-red-500/20 border border-red-500/50 text-red-600 dark:text-red-400'
                        : activeDialogueTab === index
                        ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/50'
                        : 'hover:bg-muted border border-transparent'
                    }`}
                  >
                    {dialogueTabToDelete === index ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs">Delete?</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="p-0.5 rounded hover:bg-red-500/30"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newTrees = dialogueTrees.filter((_, i) => i !== index);
                              setDialogueTrees(newTrees);
                              setDialogueTabToDelete(null);
                              if (activeDialogueTab >= newTrees.length) {
                                setActiveDialogueTab(Math.max(0, newTrees.length - 1));
                              }
                            }}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            className="p-0.5 rounded hover:bg-muted"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDialogueTabToDelete(null);
                            }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span>Dialogue {index + 1}</span>
                    )}
                  </button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 w-full gap-1"
                  onClick={() => {
                    const newTree: DialogueTree = {
                      id: String(Date.now()),
                      topic: '',
                      requirements: [],
                      dialogues: [],
                      rewards: [],
                      worldEffects: []
                    };
                    setDialogueTrees([...dialogueTrees, newTree]);
                    setActiveDialogueTab(dialogueTrees.length);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </Button>
              </div>
            </div>
            
            {/* Tab content */}
            <div className="flex-1 overflow-y-auto minimal-scroll pr-2">
              {dialogueTrees[activeDialogueTab] && (
                <div className="space-y-4">
                  {/* Topic */}
                  <div>
                    <label className="text-xs text-muted-foreground font-medium">Topic</label>
                    <Input
                      value={dialogueTrees[activeDialogueTab].topic}
                      onChange={(e) => {
                        const newTrees = [...dialogueTrees];
                        newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], topic: e.target.value };
                        setDialogueTrees(newTrees);
                      }}
                      placeholder="Enter dialogue topic..."
                      className="h-8"
                    />
                  </div>
                  
                  {/* Requirements - Expandable */}
                  <div className="border rounded-md">
                    <button
                      type="button"
                      onClick={() => {
                        const tree = dialogueTrees[activeDialogueTab];
                        const newTrees = [...dialogueTrees];
                        newTrees[activeDialogueTab] = {
                          ...tree,
                          _reqExpanded: !tree._reqExpanded
                        };
                        setDialogueTrees(newTrees);
                      }}
                      className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium hover:bg-muted/50 rounded-t-md"
                    >
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-blue-400" />
                        <span>Dialogue is visible when player has ({dialogueTrees[activeDialogueTab].requirements.length})</span>
                      </div>
                      {dialogueTrees[activeDialogueTab]._reqExpanded 
                        ? <ChevronUp className="w-4 h-4" /> 
                        : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {dialogueTrees[activeDialogueTab]._reqExpanded && (
                      <div className="px-3 pb-3 space-y-2">
                        {dialogueTrees[activeDialogueTab].requirements.length === 0 && (
                          <p className="text-xs text-muted-foreground py-1">Everyone can see this dialogue. Add conditions to restrict it.</p>
                        )}
                        {dialogueTrees[activeDialogueTab].requirements.map((req, reqIndex) => {
                          const reqConfig: Record<DialogueRequirement['type'], { icon: React.ReactNode; label: string; placeholder: string; color: string }> = {
                            status: { icon: <Tag className="w-3.5 h-3.5" />, label: 'Status', placeholder: 'e.g. quest_started', color: 'text-green-400' },
                            not_status: { icon: <Tag className="w-3.5 h-3.5" />, label: 'Missing Status', placeholder: 'e.g. quest_completed', color: 'text-red-400' },
                            item: { icon: <Package className="w-3.5 h-3.5" />, label: 'Item', placeholder: 'Item ID (e.g. 1)', color: 'text-yellow-400' },
                            level: { icon: <Zap className="w-3.5 h-3.5" />, label: 'Min Level', placeholder: 'e.g. 5', color: 'text-cyan-400' },
                            class: { icon: <User className="w-3.5 h-3.5" />, label: 'Class', placeholder: 'e.g. warrior', color: 'text-purple-400' }
                          };
                          const config = reqConfig[req.type];
                          return (
                            <div key={req.id} className="flex gap-2 items-center bg-muted/30 rounded-md p-2">
                              <select
                                value={req.type}
                                onChange={(e) => {
                                  const newTrees = [...dialogueTrees];
                                  const newReqs = [...newTrees[activeDialogueTab].requirements];
                                  newReqs[reqIndex] = { ...newReqs[reqIndex], type: e.target.value as DialogueRequirement['type'], value: '' };
                                  newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], requirements: newReqs };
                                  setDialogueTrees(newTrees);
                                }}
                                className="h-8 px-2 py-1 rounded border text-[11px] bg-background cursor-pointer hover:border-primary/50 transition-colors min-w-[130px]"
                              >
                                <option value="status">Status</option>
                                <option value="not_status">Missing Status</option>
                                <option value="item">Item</option>
                                <option value="level">Min Level</option>
                                <option value="class">Class</option>
                              </select>
                              <Input
                                value={req.value}
                                onChange={(e) => {
                                  const newTrees = [...dialogueTrees];
                                  const newReqs = [...newTrees[activeDialogueTab].requirements];
                                  newReqs[reqIndex] = { ...newReqs[reqIndex], value: e.target.value };
                                  newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], requirements: newReqs };
                                  setDialogueTrees(newTrees);
                                }}
                                placeholder={config.placeholder}
                                className="h-8 text-xs flex-1"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 hover:bg-destructive/20 hover:text-destructive"
                                onClick={() => {
                                  const newTrees = [...dialogueTrees];
                                  const newReqs = dialogueTrees[activeDialogueTab].requirements.filter((_, i) => i !== reqIndex);
                                  newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], requirements: newReqs };
                                  setDialogueTrees(newTrees);
                                }}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            const newTrees = [...dialogueTrees];
                            const newReq: DialogueRequirement = { id: String(Date.now()), type: 'status', value: '' };
                            newTrees[activeDialogueTab] = {
                              ...newTrees[activeDialogueTab],
                              requirements: [...newTrees[activeDialogueTab].requirements, newReq]
                            };
                            setDialogueTrees(newTrees);
                          }}
                        >
                          <Plus className="w-3 h-3" />
                          Add Condition
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {/* Dialogues - Expandable */}
                  <div className="border rounded-md">
                    <button
                      type="button"
                      onClick={() => {
                        const tree = dialogueTrees[activeDialogueTab];
                        const newTrees = [...dialogueTrees];
                        newTrees[activeDialogueTab] = {
                          ...tree,
                          _dlgExpanded: !tree._dlgExpanded
                        };
                        setDialogueTrees(newTrees);
                      }}
                      className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium hover:bg-muted/50 rounded-t-md"
                    >
                      <div className="flex items-center gap-2">
                        <AlignLeft className="w-4 h-4 text-blue-400" />
                        <span>Dialogues ({dialogueTrees[activeDialogueTab].dialogues.length})</span>
                      </div>
                      {dialogueTrees[activeDialogueTab]._dlgExpanded 
                        ? <ChevronUp className="w-4 h-4" /> 
                        : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {dialogueTrees[activeDialogueTab]._dlgExpanded && (
                      <div className="px-3 pb-3 space-y-2">
                        {dialogueTrees[activeDialogueTab].dialogues.map((dlg, dlgIndex) => (
                          <div key={dlg.id} className="flex gap-2 items-start">
                            <button
                              type="button"
                              onClick={() => {
                                const newTrees = [...dialogueTrees];
                                const newDlgs = [...newTrees[activeDialogueTab].dialogues];
                                newDlgs[dlgIndex] = { ...newDlgs[dlgIndex], speaker: dlg.speaker === 'npc' ? 'player' : 'npc' };
                                newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], dialogues: newDlgs };
                                setDialogueTrees(newTrees);
                              }}
                              className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${
                                dlg.speaker === 'npc'
                                  ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/50'
                                  : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/50'
                              }`}
                            >
                              {dlg.speaker === 'npc' ? 'NPC' : 'Player'}
                            </button>
                            <Input
                              value={dlg.text}
                              onChange={(e) => {
                                const newTrees = [...dialogueTrees];
                                const newDlgs = [...newTrees[activeDialogueTab].dialogues];
                                newDlgs[dlgIndex] = { ...newDlgs[dlgIndex], text: e.target.value };
                                newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], dialogues: newDlgs };
                                setDialogueTrees(newTrees);
                              }}
                              placeholder={dlg.speaker === 'npc' ? 'NPC says...' : 'Player says...'}
                              className="h-7 text-xs flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 shrink-0"
                              onClick={() => {
                                const newTrees = [...dialogueTrees];
                                const newDlgs = dialogueTrees[activeDialogueTab].dialogues.filter((_, i) => i !== dlgIndex);
                                newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], dialogues: newDlgs };
                                setDialogueTrees(newTrees);
                              }}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 flex-1"
                            onClick={() => {
                              const newTrees = [...dialogueTrees];
                              const newDlg: DialogueLine = { id: String(Date.now()), speaker: 'npc', text: '' };
                              newTrees[activeDialogueTab] = {
                                ...newTrees[activeDialogueTab],
                                dialogues: [...newTrees[activeDialogueTab].dialogues, newDlg]
                              };
                              setDialogueTrees(newTrees);
                            }}
                          >
                            <Plus className="w-3 h-3" />
                            NPC Line
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 flex-1"
                            onClick={() => {
                              const newTrees = [...dialogueTrees];
                              const newDlg: DialogueLine = { id: String(Date.now()) + 1, speaker: 'player', text: '' };
                              newTrees[activeDialogueTab] = {
                                ...newTrees[activeDialogueTab],
                                dialogues: [...newTrees[activeDialogueTab].dialogues, newDlg]
                              };
                              setDialogueTrees(newTrees);
                            }}
                          >
                            <Plus className="w-3 h-3" />
                            Player Line
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rewards - Expandable */}
                  <div className="border rounded-md">
                    <button
                      type="button"
                      onClick={() => {
                        const tree = dialogueTrees[activeDialogueTab];
                        const newTrees = [...dialogueTrees];
                        newTrees[activeDialogueTab] = {
                          ...tree,
                          _rewExpanded: !tree._rewExpanded
                        };
                        setDialogueTrees(newTrees);
                      }}
                      className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium hover:bg-muted/50 rounded-t-md"
                    >
                      <div className="flex items-center gap-2">
                        <Gift className="w-4 h-4 text-emerald-500" />
                        <span>Rewards ({dialogueTrees[activeDialogueTab].rewards?.length || 0})</span>
                      </div>
                      {dialogueTrees[activeDialogueTab]._rewExpanded 
                        ? <ChevronUp className="w-4 h-4" /> 
                        : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {dialogueTrees[activeDialogueTab]._rewExpanded && (
                      <div className="px-3 pb-3 space-y-2">
                        <p className="text-xs text-muted-foreground">What does the player gain or lose?</p>
                        {(dialogueTrees[activeDialogueTab].rewards || []).map((rew, rewIndex) => (
                          <div key={rew.id} className={`flex gap-2 items-center p-2 rounded-md ${
                            rew.type.includes('remove') ? 'bg-red-500/10 border-l-2 border-l-red-500/50' : 'bg-emerald-500/10 border-l-2 border-l-emerald-500/50'
                          }`}>
                            <select
                              value={rew.type}
                              onChange={(e) => {
                                const newTrees = [...dialogueTrees];
                                const newRews = [...(newTrees[activeDialogueTab].rewards || [])];
                                newRews[rewIndex] = { ...newRews[rewIndex], type: e.target.value as DialogueReward['type'] };
                                newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], rewards: newRews };
                                setDialogueTrees(newTrees);
                              }}
                              className="h-8 px-2 py-1 rounded-md border text-[11px] bg-background min-w-[110px] cursor-pointer"
                            >
                              <option value="xp">Give XP</option>
                              <option value="gold">Give Gold</option>
                              <option value="item">Give Item</option>
                              <option value="remove_gold">Take Gold</option>
                              <option value="remove_item">Take Item</option>
                              <option value="restore">Restore HP/MP</option>
                            </select>
                            <Input
                              value={rew.value}
                              onChange={(e) => {
                                const newTrees = [...dialogueTrees];
                                const newRews = [...(newTrees[activeDialogueTab].rewards || [])];
                                newRews[rewIndex] = { ...newRews[rewIndex], value: e.target.value };
                                newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], rewards: newRews };
                                setDialogueTrees(newTrees);
                              }}
                              placeholder={rew.type === 'item' || rew.type === 'remove_item' ? 'Item ID...' : rew.type === 'restore' ? 'hp/mp/all' : 'Amount...'}
                              className="h-7 text-xs flex-1"
                            />
                            {(rew.type === 'item' || rew.type === 'remove_item') && (
                              <>
                                <span className="text-xs text-muted-foreground">×</span>
                                <Input
                                  type="number"
                                  min={1}
                                  value={rew.quantity || 1}
                                  onChange={(e) => {
                                const newTrees = [...dialogueTrees];
                                const newRews = [...(newTrees[activeDialogueTab].rewards || [])];
                                newRews[rewIndex] = { ...newRews[rewIndex], quantity: parseInt(e.target.value, 10) || 1 };
                                newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], rewards: newRews };
                                setDialogueTrees(newTrees);
                              }}
                                  className="h-7 w-14 text-xs"
                                />
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                const newTrees = [...dialogueTrees];
                                const newRews = (dialogueTrees[activeDialogueTab].rewards || []).filter((_, i) => i !== rewIndex);
                                newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], rewards: newRews };
                                setDialogueTrees(newTrees);
                              }}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            const newTrees = [...dialogueTrees];
                            const newRew: DialogueReward = { id: String(Date.now()), type: 'xp', value: '' };
                            newTrees[activeDialogueTab] = {
                              ...newTrees[activeDialogueTab],
                              rewards: [...(newTrees[activeDialogueTab].rewards || []), newRew]
                            };
                            setDialogueTrees(newTrees);
                          }}
                        >
                          <Plus className="w-3 h-3" />
                          Add Reward
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* World Effects - Expandable (Advanced) */}
                  <div className="border rounded-md">
                    <button
                      type="button"
                      onClick={() => {
                        const tree = dialogueTrees[activeDialogueTab];
                        const newTrees = [...dialogueTrees];
                        newTrees[activeDialogueTab] = {
                          ...tree,
                          _wfExpanded: !tree._wfExpanded
                        };
                        setDialogueTrees(newTrees);
                      }}
                      className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium hover:bg-muted/50 rounded-t-md"
                    >
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-purple-500" />
                        <span>World Effects ({dialogueTrees[activeDialogueTab].worldEffects?.length || 0})</span>
                        <span className="text-xs text-muted-foreground">(Advanced)</span>
                      </div>
                      {dialogueTrees[activeDialogueTab]._wfExpanded 
                        ? <ChevronUp className="w-4 h-4" /> 
                        : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {dialogueTrees[activeDialogueTab]._wfExpanded && (
                      <div className="px-3 pb-3 space-y-2">
                        <p className="text-xs text-muted-foreground">What happens in the world after this?</p>
                        {(dialogueTrees[activeDialogueTab].worldEffects || []).map((wf, wfIndex) => (
                          <div key={wf.id} className="flex gap-2 items-center p-2 rounded-md bg-purple-500/10 border-l-2 border-l-purple-500/50">
                            <select
                              value={wf.type}
                              onChange={(e) => {
                                const newTrees = [...dialogueTrees];
                                const newWfs = [...(newTrees[activeDialogueTab].worldEffects || [])];
                                newWfs[wfIndex] = { ...newWfs[wfIndex], type: e.target.value as DialogueWorldEffect['type'] };
                                newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], worldEffects: newWfs };
                                setDialogueTrees(newTrees);
                              }}
                              className="h-8 px-2 py-1 rounded-md border text-[11px] bg-background min-w-[110px] cursor-pointer"
                            >
                              <option value="set_status">Set Status</option>
                              <option value="unset_status">Clear Status</option>
                              <option value="teleport">Teleport</option>
                              <option value="spawn">Spawn Enemy</option>
                              <option value="cutscene">Cutscene</option>
                              <option value="sound">Play Sound</option>
                              <option value="npc">NPC Dialog</option>
                            </select>
                            <Input
                              value={wf.value}
                              onChange={(e) => {
                                const newTrees = [...dialogueTrees];
                                const newWfs = [...(newTrees[activeDialogueTab].worldEffects || [])];
                                newWfs[wfIndex] = { ...newWfs[wfIndex], value: e.target.value };
                                newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], worldEffects: newWfs };
                                setDialogueTrees(newTrees);
                              }}
                              placeholder={
                                wf.type === 'set_status' || wf.type === 'unset_status' ? 'Status tag...' :
                                wf.type === 'teleport' ? 'map.txt,x,y' :
                                wf.type === 'spawn' ? 'Enemy category' :
                                wf.type === 'cutscene' ? 'Cutscene file...' :
                                wf.type === 'sound' ? 'Sound file...' :
                                wf.type === 'npc' ? 'NPC file...' : 'Value...'
                              }
                              className="h-7 text-xs flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                const newTrees = [...dialogueTrees];
                                const newWfs = (dialogueTrees[activeDialogueTab].worldEffects || []).filter((_, i) => i !== wfIndex);
                                newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], worldEffects: newWfs };
                                setDialogueTrees(newTrees);
                              }}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            const newTrees = [...dialogueTrees];
                            const newWf: DialogueWorldEffect = { id: String(Date.now()), type: 'set_status', value: '' };
                            newTrees[activeDialogueTab] = {
                              ...newTrees[activeDialogueTab],
                              worldEffects: [...(newTrees[activeDialogueTab].worldEffects || []), newWf]
                            };
                            setDialogueTrees(newTrees);
                          }}
                        >
                          <Plus className="w-3 h-3" />
                          Add Effect
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setShowDialogueTreeDialog(false)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button 
              size="icon" 
              className="h-9 w-9" 
              disabled={!dialogueTrees.some(tree => tree.topic.trim() && tree.dialogues.some(d => d.text.trim()))}
              title={!dialogueTrees.some(tree => tree.topic.trim() && tree.dialogues.some(d => d.text.trim())) 
                ? "Each dialogue needs a topic and at least one dialogue line" 
                : "Save dialogues"}
              onClick={() => {
                // Validate: at least one tree must have topic and at least one dialogue
                const validTrees = dialogueTrees.filter(tree => 
                  tree.topic.trim() && tree.dialogues.some(d => d.text.trim())
                );
                
                if (validTrees.length === 0) {
                  return; // Button should be disabled anyway
                }
                
                // Save dialogue trees to editing object properties
                if (editingObject) {
                  // Clean up expanded state before saving, only save valid trees
                  const cleanTrees = validTrees.map(tree => ({
                    id: tree.id,
                    topic: tree.topic,
                    requirements: tree.requirements.filter(r => r.value.trim()), // Only save requirements with values
                    dialogues: tree.dialogues.filter(d => d.text.trim()), // Only save dialogues with text
                    rewards: (tree.rewards || []).filter(r => r.value.trim()), // Only save rewards with values
                    worldEffects: (tree.worldEffects || []).filter(w => w.value.trim()) // Only save effects with values
                  }));
                  updateEditingObjectProperty('dialogueTrees', JSON.stringify(cleanTrees));
                }
                setShowDialogueTreeDialog(false);
              }}
            >
              <Save className="w-4 h-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Always-Available Items Dialog */}
      <Dialog open={showVendorStockDialog} onOpenChange={(open) => setShowVendorStockDialog(open)} zIndex={80}>
        <DialogContent className="max-w-3xl w-full z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-500" />
              Always Available Items
            </DialogTitle>
            <DialogDescription>
              Select items to keep in this vendor's shop and set their quantities.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {itemsList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No items found. Create items in the Items layer to add them here.
              </p>
            ) : (
              itemsList.map((item) => {
                const selected = vendorStockSelection[item.id] !== undefined;
                const qty = vendorStockSelection[item.id] ?? 1;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-2 rounded-md border transition-all ${selected
                      ? 'border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-900/10'
                      : 'border-border bg-muted/30 hover:bg-muted/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleVendorStockItem(item.id)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Badge className="text-[10px] font-semibold px-2 py-0.5">
                          ID {item.id}
                        </Badge>
                        <span className="font-medium text-sm">{item.name || `Item ${item.id}`}</span>
                        <span className="text-xs text-muted-foreground">({item.role})</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {item.category || 'Default'} • {item.fileName}
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Qty</span>
                      <Input
                        type="number"
                        className="h-8 w-20 text-xs"
                        min={1}
                        disabled={!selected}
                        value={qty}
                        onChange={(e) => handleVendorStockQtyChange(item.id, Number.parseInt(e.target.value, 10) || 1)}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="justify-between">
            <Button variant="outline" size="icon" onClick={() => setShowVendorStockDialog(false)} aria-label="Cancel vendor items">
              <X className="w-4 h-4" />
            </Button>
            <Button size="icon" onClick={handleSaveVendorStock} aria-label="Save vendor items">
              <Save className="w-4 h-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showCreateMapDialog}
        onOpenChange={(open) => {
          setShowCreateMapDialog(open);
          if (!open) {
            setCreateMapError(null);
          }
        }}
      >
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
                onChange={(e) => {
                  setNewMapName(e.target.value);
                  if (createMapError) {
                    setCreateMapError(null);
                  }
                }}
                onKeyDown={(e) => {
                  // Allow editing keys to work even if parent handlers exist
                  e.stopPropagation();
                }}
                placeholder="Enter map name"
                autoFocus
              />
              {createMapError && (
                <p className="mt-1 text-xs text-red-500">{createMapError}</p>
              )}
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
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateMapDialog(false);
                setCreateMapError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmCreateMap}
              disabled={isPreparingNewMap}
              className="flex items-center gap-2"
            >
              {isPreparingNewMap ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create</span>
              )}
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
