import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { HelpCircle, X, Save, MapPinPlus, MousePointerClick, MapPinMinus, LogIn, LogOut, SquareCheckBig, Repeat2, ChevronDown, ChevronUp } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';
import { useAppContext } from '@/context/AppContext';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import { ACTIVATION_COLORS } from '@/editor/eventActivationColors';

type EventActivation = 'Trigger' | 'Interact' | 'Load' | 'Leave' | 'MapExit' | 'MapClear' | 'Loop';

type EventItemRequirement = {
  id: string;
  type: 'requires_item' | 'requires_not_item';
  itemId: string;
  itemQuantity: number;
};

type EventData = {
  name: string;
  description: string;
  positioning: {
    mapName: string;
    coordinates: { x: number; y: number };
    size: { width: number; height: number };
    hotspot: { x: number; y: number; width: number; height: number };
  };
  timing: {
    activeActivation: EventActivation | null;
    cooldown: number;
    delay: number;
  };
  requirements: {
    status: string[];
    minLevel: number;
    itemRequirements: EventItemRequirement[];
    currency: number;
  };
  rewards: {
    message: string;
    expReward: number;
    rewardCurrency: number;
    removeCurrency: number;
    rewardItemId: string;
    rewardItemQuantity: number;
    removeItemId: string;
    removeItemQuantity: number;
    lootGroup: string;
    rewardLootGroup: string;
    rewardLootCountMin: number;
    rewardLootCountMax: number;
    enemySpawn: string;
    teleportMap: string;
    teleportX: number;
    teleportY: number;
    sound: string;
  };
  engine: {
    chance: number;
    autoSave: boolean;
    script: string;
  };
};

type EventDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventLocation: { x: number; y: number } | null;
  editingEventId?: number | null;
};

const ACTIVATION_OPTIONS: EventActivation[] = ['Interact', 'Trigger', 'Leave', 'Load', 'MapExit', 'MapClear', 'Loop'];

const ACTIVATION_CONFIG: Record<EventActivation, { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; tooltip: string; label: string }> = {
  Interact: {
    icon: MousePointerClick,
    tooltip: 'Interact - Activated specifically when the player interacts with the hotspot',
    label: 'Interact',
  },
  Trigger: {
    icon: MapPinPlus,
    tooltip: 'Trigger - Activated when the player stands in the event area or interacts with a defined hotspot',
    label: 'Trigger',
  },
  Leave: {
    icon: MapPinMinus,
    tooltip: 'Leave - Activated as the player leaves an event spot they were previously inside',
    label: 'Leave',
  },
  Load: {
    icon: LogIn,
    tooltip: 'Load - Activated as the player enters a map',
    label: 'Load',
  },
  MapExit: {
    icon: LogOut,
    tooltip: 'Map Exit - Activated as the player leaves the map',
    label: 'Map Exit',
  },
  MapClear: {
    icon: SquareCheckBig,
    tooltip: 'Map Clear - Activated when all enemies on a map have been defeated',
    label: 'Map Clear',
  },
  Loop: {
    icon: Repeat2,
    tooltip: 'Loop - Activated constantly, every frame',
    label: 'Loop',
  },
};

// Reverse map: Flare activate values -> UI activation names
const FLARE_TO_ACTIVATION: Record<string, EventActivation> = {
  on_interact: 'Interact',
  on_trigger: 'Trigger',
  on_leave: 'Leave',
  on_load: 'Load',
  on_mapexit: 'MapExit',
  on_clear: 'MapClear',
  static: 'Loop',
};

const ACTIVATION_TO_FLARE: Record<string, string> = {
  Interact: 'on_interact',
  Trigger: 'on_trigger',
  Leave: 'on_leave',
  Load: 'on_load',
  MapExit: 'on_mapexit',
  MapClear: 'on_clear',
  Loop: 'static',
};

const EventDialog: React.FC<EventDialogProps> = ({ open, onOpenChange, eventLocation: _eventLocation, editingEventId }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { mapName: currentMapName, mapWidth, mapHeight, editor, syncMapObjectsWrapper, controls, itemsList = [] } = useAppContext() as any;
  const itemGroups = useMemo(() => (itemsList as any[]).filter((item) => item.role === 'loot_groups'), [itemsList]);
  const inventoryItems = useMemo(() => (itemsList as any[]).filter((item) => item.role !== 'loot_groups'), [itemsList]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentProjectPath: string | null = (controls as any)?.currentProjectPath ?? null;
  const [projectMaps, setProjectMaps] = useState<string[]>([]);

  const isEditing = editingEventId != null;

  const parseItemValue = (value: string) => {
    const [id, quantity] = value.split(/[: ,]/).map((part) => part.trim());
    return { id: id || '', quantity: parseInt(quantity || '1', 10) || 1 };
  };

  const buildProps = (): Record<string, string | string[]> => {
    const { coordinates, size, hotspot } = eventData.positioning;
    const flareActivate = ACTIVATION_TO_FLARE[eventData.timing.activeActivation || ''] || '';
    const props: Record<string, string | string[]> = {};

    if (flareActivate) props.activate = flareActivate;
    if (['Trigger', 'Leave'].includes(eventData.timing.activeActivation || '')) {
      props.location = `${coordinates.x},${coordinates.y},${size.width},${size.height}`;
    }
    if (['Interact', 'Trigger'].includes(eventData.timing.activeActivation || '')) {
      props.hotspot = `${hotspot.x},${hotspot.y},${hotspot.width},${hotspot.height}`;
    }
    if (eventData.timing.cooldown > 0) props.cooldown = `${eventData.timing.cooldown}ms`;
    if (eventData.timing.delay > 0) props.delay = `${eventData.timing.delay}ms`;
    const statusValues = eventData.requirements.status
      .map(status => status.trim())
      .filter(Boolean);
    if (statusValues.length === 1) {
      props.requires_status = statusValues[0];
    } else if (statusValues.length > 1) {
      props.requires_status = statusValues;
    }
    if (eventData.requirements.minLevel > 0) props.requires_level = String(eventData.requirements.minLevel);

    const requiresItemValues = eventData.requirements.itemRequirements
      .filter(req => req.type === 'requires_item' && req.itemId.trim())
      .map(req => `${req.itemId.trim()}:${req.itemQuantity}`);
    const requiresNotItemValues = eventData.requirements.itemRequirements
      .filter(req => req.type === 'requires_not_item' && req.itemId.trim())
      .map(req => `${req.itemId.trim()}:${req.itemQuantity}`);

    if (requiresItemValues.length === 1) props.requires_item = requiresItemValues[0];
    else if (requiresItemValues.length > 1) props.requires_item = requiresItemValues;

    if (requiresNotItemValues.length === 1) props.requires_not_item = requiresNotItemValues[0];
    else if (requiresNotItemValues.length > 1) props.requires_not_item = requiresNotItemValues;

    if (eventData.requirements.currency > 0) props.requires_currency = String(eventData.requirements.currency);
    if (eventData.rewards.message.trim()) props.msg = eventData.rewards.message.trim();
    if (eventData.rewards.expReward > 0) props.reward_xp = String(eventData.rewards.expReward);
    if (eventData.rewards.rewardCurrency > 0) props.reward_currency = String(eventData.rewards.rewardCurrency);
    if (eventData.rewards.removeCurrency > 0) props.remove_currency = String(eventData.rewards.removeCurrency);
    if (eventData.rewards.rewardItemId.trim()) {
      props.reward_item = `${eventData.rewards.rewardItemId.trim()}:${eventData.rewards.rewardItemQuantity}`;
    }
    if (eventData.rewards.removeItemId.trim()) {
      props.remove_item = `${eventData.rewards.removeItemId.trim()}:${eventData.rewards.removeItemQuantity}`;
    }
    if (eventData.rewards.lootGroup.trim()) {
      props.loot = eventData.rewards.lootGroup.trim();
    }
    if (eventData.rewards.rewardLootGroup.trim()) {
      props.reward_loot = eventData.rewards.rewardLootGroup.trim();
      props.reward_loot_count = `${eventData.rewards.rewardLootCountMin},${eventData.rewards.rewardLootCountMax}`;
    }
    if (eventData.rewards.enemySpawn.trim()) props.spawn = eventData.rewards.enemySpawn.trim();
    if (eventData.rewards.teleportMap.trim()) {
      let mapFile = eventData.rewards.teleportMap.trim();
      if (!mapFile.startsWith('maps/')) mapFile = `maps/${mapFile}`;
      if (!mapFile.endsWith('.txt')) mapFile = `${mapFile}.txt`;
      props.intermap = `${mapFile},${eventData.rewards.teleportX},${eventData.rewards.teleportY}`;
    }
    if (eventData.rewards.sound.trim()) props.soundfx = eventData.rewards.sound.trim();
    if (eventData.engine.chance < 100) props.chance_exec = String(eventData.engine.chance);
    if (eventData.engine.autoSave) props.save_game = 'true';
    if (eventData.engine.script.trim()) props.script = eventData.engine.script.trim();
    if (eventData.description.trim()) props._description = eventData.description.trim();
    return props;
  };

  const handleSave = () => {
    if (!editor) return;
    const { coordinates, size } = eventData.positioning;
    const flareActivate = ACTIVATION_TO_FLARE[eventData.timing.activeActivation || ''] || 'on_trigger';
    const props = buildProps();

    if (isEditing && typeof editor.updateMapObject === 'function') {
      // Update existing event
      editor.updateMapObject(editingEventId, {
        name: eventData.name || 'Event',
        description: eventData.description || '',
        type: 'event',
        activate: flareActivate,
        x: coordinates.x,
        y: coordinates.y,
        width: size.width,
        height: size.height,
        properties: props
      });
    } else if (typeof editor.addMapObject === 'function') {
      // Create new event
      const newObject = editor.addMapObject('event', coordinates.x, coordinates.y, size.width, size.height);
      if (newObject && typeof editor.updateMapObject === 'function') {
        editor.updateMapObject(newObject.id, {
          name: eventData.name || 'Event',
          description: eventData.description || '',
          type: 'event',
          activate: flareActivate,
          x: coordinates.x,
          y: coordinates.y,
          width: size.width,
          height: size.height,
          properties: props
        });
      }
    }

    // reset selection / close
    if (typeof syncMapObjectsWrapper === 'function') syncMapObjectsWrapper();
    onOpenChange(false);
  };

  const getSafeCoord = (val: number, max: number) => {
    if (isNaN(val)) return 0;
    return Math.max(0, Math.min(max - 1, val));
  };
  
  const getSafeSize = (val: number, pos: number, max: number) => {
    if (isNaN(val)) return 1;
    return Math.max(1, Math.min(max - pos, val));
  };

  const [eventData, setEventData] = useState<EventData>({
    name: '',
    description: '',
    positioning: {
      mapName: '',
      coordinates: { x: 0, y: 0 },
      size: { width: 1, height: 1 },
      hotspot: { x: 0, y: 0, width: 1, height: 1 },
    },
    timing: {
      activeActivation: null,
      cooldown: 0,
      delay: 0,
    },
    requirements: {
      status: [],
      minLevel: 0,
      itemRequirements: [],
      currency: 0,
    },
    rewards: {
      message: '',
      expReward: 0,
      rewardCurrency: 0,
      removeCurrency: 0,
      rewardItemId: '',
      rewardItemQuantity: 1,
      removeItemId: '',
      removeItemQuantity: 1,
      lootGroup: '',
      rewardLootGroup: '',
      rewardLootCountMin: 1,
      rewardLootCountMax: 1,
      enemySpawn: '',
      teleportMap: '',
      teleportX: 0,
      teleportY: 0,
      sound: '',
    },
    engine: {
      chance: 100,
      autoSave: false,
      script: '',
    },
  });

  // Dragging and resizing state
  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useDraggableResizable({ id: 'event_dialog', initialWidth: 800, initialHeight: 600 });

  useEffect(() => {
    if (!open) return;
    
    // Auto-fill mapName when opening
    if (currentMapName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEventData(prev => ({
        ...prev,
        positioning: { ...prev.positioning, mapName: currentMapName }
      }));
    }

    // Load existing event data when editing
    if (isEditing && editor && typeof editor.getMapObjects === 'function') {
      const objects = editor.getMapObjects();
      const obj = objects.find((o: { id: number }) => o.id === editingEventId);
      if (obj) {
        const p = obj.properties || {};
        // Parse hotspot "x,y,w,h"
        const hotParts = (p.hotspot || '').split(',').map(Number);
        const hotspot = hotParts.length === 4 && hotParts.every((n: number) => !isNaN(n))
          ? { x: hotParts[0], y: hotParts[1], width: hotParts[2], height: hotParts[3] }
          : { x: 0, y: 0, width: 1, height: 1 };
        const itemRequirements: EventItemRequirement[] = [];
        const requiresItemValues = Array.isArray(p.requires_item)
          ? p.requires_item
          : p.requires_item ? [p.requires_item] : [];
        const requiresNotItemValues = Array.isArray(p.requires_not_item)
          ? p.requires_not_item
          : p.requires_not_item ? [p.requires_not_item] : [];

        itemRequirements.push(
          ...requiresItemValues.map((item: string) => ({
            id: `item-req-${Math.random().toString(36).slice(2)}`,
            type: 'requires_item' as const,
            ...parseItemValue(item),
          }))
        );
        itemRequirements.push(
          ...requiresNotItemValues.map((item: string) => ({
            id: `item-req-${Math.random().toString(36).slice(2)}`,
            type: 'requires_not_item' as const,
            ...parseItemValue(item),
          }))
        );
        const rewardItemParts = parseItemValue(p.reward_item || '');
        const removeItemParts = parseItemValue(p.remove_item || '');
        const rewardLootCountParts = (p.reward_loot_count || '').split(',').map((part: string) => parseInt(part.trim(), 10) || 0);
        // Parse intermap "map,x,y"
        const intermapParts = (p.intermap || '').split(',');
        // Parse cooldown/delay (remove "ms" suffix)
        const parseCooldown = (v: string) => parseInt((v || '0').replace('ms', '')) || 0;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEventData({
          name: obj.name || '',
          description: obj.description || p._description || '',
          positioning: {
            mapName: currentMapName || '',
            coordinates: { x: obj.x ?? 0, y: obj.y ?? 0 },
            size: { width: obj.width ?? 1, height: obj.height ?? 1 },
            hotspot,
          },
          timing: {
            activeActivation: FLARE_TO_ACTIVATION[p.activate || obj.activate || ''] || null,
            cooldown: parseCooldown(p.cooldown),
            delay: parseCooldown(p.delay),
          },
          requirements: {
            status: Array.isArray(p.requires_status)
              ? p.requires_status.map(String).filter(Boolean)
              : p.requires_status
                ? [String(p.requires_status).trim()]
                : [],
            minLevel: parseInt(p.requires_level || '0') || 0,
            itemRequirements,
            currency: parseInt(p.requires_currency || '0') || 0,
          },
          rewards: {
            message: p.msg || '',
            expReward: parseInt(p.reward_xp || '0') || 0,
            rewardCurrency: parseInt(p.reward_currency || '0') || 0,
            removeCurrency: parseInt(p.remove_currency || '0') || 0,
            rewardItemId: rewardItemParts.id,
            rewardItemQuantity: rewardItemParts.quantity,
            removeItemId: removeItemParts.id,
            removeItemQuantity: removeItemParts.quantity,
            lootGroup: p.loot || '',
            rewardLootGroup: p.reward_loot || '',
            rewardLootCountMin: rewardLootCountParts[0] || 1,
            rewardLootCountMax: rewardLootCountParts[1] || (rewardLootCountParts[0] || 1),
            enemySpawn: p.spawn || '',
            teleportMap: intermapParts.length >= 3 ? intermapParts[0].replace(/^\/?(maps\/)/i, '').replace(/\.txt$/i, '') : (p.intermap || '').replace(/^\/?(maps\/)/i, '').replace(/\.txt$/i, ''),
            teleportX: intermapParts.length >= 3 ? parseInt(intermapParts[1]) || 0 : 0,
            teleportY: intermapParts.length >= 3 ? parseInt(intermapParts[2]) || 0 : 0,
            sound: p.soundfx || '',
          },
          engine: {
            chance: parseInt(p.chance_exec || '100') || 100,
            autoSave: p.save_game === 'true',
            script: p.script || '',
          },
        });
        return; // Skip default reset when editing
      }
    }

    // Reset to defaults for new event
    if (!isEditing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEventData({
        name: '',
        description: '',
        positioning: {
          mapName: currentMapName || '',
          coordinates: { x: 0, y: 0 },
          size: { width: 1, height: 1 },
          hotspot: { x: 0, y: 0, width: 1, height: 1 },
        },
        timing: { activeActivation: null, cooldown: 0, delay: 0 },
        requirements: { status: [], minLevel: 0, itemRequirements: [], currency: 0 },
        rewards: { message: '', expReward: 0, rewardCurrency: 0, removeCurrency: 0, rewardItemId: '', rewardItemQuantity: 1, removeItemId: '', removeItemQuantity: 1, lootGroup: '', rewardLootGroup: '', rewardLootCountMin: 1, rewardLootCountMax: 1, enemySpawn: '', teleportMap: '', teleportX: 0, teleportY: 0, sound: '' },
        engine: { chance: 100, autoSave: false, script: '' },
      });
    }

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (typeof syncMapObjectsWrapper === 'function') syncMapObjectsWrapper(); onOpenChange(false);
      }
    };
    
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onOpenChange, currentMapName, isEditing, editingEventId, editor, syncMapObjectsWrapper]);

  // Fetch project maps when dialog opens
  useEffect(() => {
    if (!open || !currentProjectPath) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.listMaps) {
      electronAPI.listMaps(currentProjectPath).then((maps: string[]) => {
        if (!cancelled) setProjectMaps(maps ?? []);
      }).catch(() => {
        if (!cancelled) setProjectMaps([]);
      });
    }
    return () => { cancelled = true; };
  }, [open, currentProjectPath]);

  useEffect(() => {
    if (!open) {
      window.dispatchEvent(new CustomEvent('activeEventPreview', { detail: null }));
      return;
    }
    const { x, y } = eventData.positioning.coordinates;
    const { width, height } = eventData.positioning.size;
    window.dispatchEvent(new CustomEvent('activeEventPreview', { detail: { x, y, width, height } }));
    
    return () => {
      window.dispatchEvent(new CustomEvent('activeEventPreview', { detail: null }));
    };
  }, [open, eventData.positioning.coordinates, eventData.positioning.size]);

  // Dispatch hotspot preview (pink overlay on canvas)
  useEffect(() => {
    const isHotspotActive = ['Interact', 'Trigger'].includes(eventData.timing.activeActivation || '');
    if (!open || !isHotspotActive) {
      window.dispatchEvent(new CustomEvent('activeHotspotPreview', { detail: null }));
      return;
    }
    const { x, y, width, height } = eventData.positioning.hotspot;
    window.dispatchEvent(new CustomEvent('activeHotspotPreview', { detail: { x, y, width, height } }));
    
    return () => {
      window.dispatchEvent(new CustomEvent('activeHotspotPreview', { detail: null }));
    };
  }, [open, eventData.timing.activeActivation, eventData.positioning.hotspot]);

  const setActivation = (activation: EventActivation) => {
    setEventData(prev => ({
      ...prev,
      timing: {
        ...prev.timing,
        activeActivation: prev.timing.activeActivation === activation ? null : activation,
      },
    }));
  };

  const addStatusRequirement = () => {
    setEventData(prev => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        status: [...prev.requirements.status, ''],
      },
    }));
  };

  const updateStatusRequirement = (index: number, value: string) => {
    setEventData(prev => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        status: prev.requirements.status.map((s, i) => (i === index ? value : s)),
      },
    }));
  };

  const removeStatusRequirement = (index: number) => {
    setEventData(prev => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        status: prev.requirements.status.filter((_, i) => i !== index),
      },
    }));
  };

  const addItemRequirement = () => {
    setEventData(prev => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        itemRequirements: [
          ...prev.requirements.itemRequirements,
          {
            id: `item-req-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: 'requires_item',
            itemId: '',
            itemQuantity: 1,
          },
        ],
      },
    }));
  };

  const updateItemRequirement = (id: string, updates: Partial<Omit<EventItemRequirement, 'id'>>) => {
    setEventData(prev => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        itemRequirements: prev.requirements.itemRequirements.map((req) =>
          req.id === id ? { ...req, ...updates } : req
        ),
      },
    }));
  };

  const removeItemRequirement = (id: string) => {
    setEventData(prev => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        itemRequirements: prev.requirements.itemRequirements.filter((req) => req.id !== id),
      },
    }));
  };

  const [expandedSections, setExpandedSections] = useState({
    eventInfo: true,
    positioning: true,
    requirements: true,
    rewards: true,
    engine: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const CollapsibleSection = ({ title, icon: Icon, isExpanded, onToggle, children, id }: { title: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; isExpanded: boolean; onToggle: () => void; children: React.ReactNode; id: string }) => (
    <div className="border border-border/50 rounded-lg overflow-hidden mb-4 shadow-sm" id={`section-${id}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-muted/20 hover:bg-muted/30 transition-colors select-none"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold tracking-wide">{title}</span>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {isExpanded && <div className="p-4 bg-background border-t border-border/10 animate-in slide-in-from-top-2 duration-200">{children}</div>}
    </div>
  );

  const isLocEnabled = ['Trigger', 'Leave'].includes(eventData.timing.activeActivation || '');
  const isHotspotEnabled = ['Interact', 'Trigger'].includes(eventData.timing.activeActivation || '');

  if (!open) return null;

  const dialogContent = (
    <>
      <div 
        ref={dialogRef}
        className="bg-background border border-border/70 rounded-lg flex flex-col shadow-xl"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          zIndex: 50,
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="sticky top-0 z-10 border-b border-border/50 bg-background px-6 py-3 flex items-center justify-between cursor-move select-none"
          onMouseDown={handleHeaderMouseDown}
        >
          <h3 className="text-lg font-semibold flex-1">{isEditing ? 'Edit Event' : 'Add Event'}</h3>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-6 w-6 text-foreground/60 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 px-6 py-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full">
          {/* Event Information Section */}
          <CollapsibleSection
            title="Event Information"
            icon={HelpCircle}
            id="event-information"
            isExpanded={expandedSections.eventInfo}
            onToggle={() => toggleSection('eventInfo')}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Name</label>
                <Input
                  value={eventData.name}
                  onChange={e => setEventData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Event Name (e.g. Teleport to Town, Boss Trigger)"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Description</label>
                <Input
                  value={eventData.description}
                  onChange={e => setEventData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this event"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Positioning and Timing Section */}
          <CollapsibleSection
            title="Positioning and Timing"
            icon={MapPinPlus}
            id="positioning-and-timing"
            isExpanded={expandedSections.positioning}
            onToggle={() => toggleSection('positioning')}
          >
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Positioning and Timing</h3>

              {/* Activation */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-foreground/80">Activation</label>
                  <Tooltip content="When this event executes">
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </Tooltip>
                </div>
                <div className="flex flex-wrap gap-1 items-start">
                  {ACTIVATION_OPTIONS.map(activation => {
                    const config = ACTIVATION_CONFIG[activation];
                    const IconComponent = config.icon;
                    const isActive = eventData.timing.activeActivation === activation;
                    return (
                      <Tooltip key={activation} content={config.tooltip} side="right">
                        <button
                          onClick={() => setActivation(activation)}
                          className={`rounded-md border p-2 transition-colors ${
                            isActive
                              ? (ACTIVATION_COLORS[activation]?.active ?? 'border-orange-500/50 bg-orange-500/10 text-orange-600')
                              : 'border-border/50 bg-muted/30 text-foreground/60 hover:bg-muted/50'
                          }`}
                        >
                          <IconComponent className="h-5 w-5" />
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              <div className="relative space-y-6">
                {!eventData.timing.activeActivation && (
                  <div className="absolute -inset-4 z-50 bg-black/50 backdrop-blur-[1px] rounded-lg flex items-start justify-center pt-20 pointer-events-auto">
                    <div className="bg-background border border-border/50 shadow-lg px-6 py-3 rounded-xl flex items-center justify-center">
                      <span className="text-sm font-medium text-foreground">Select an activation type</span>
                    </div>
                  </div>
                )}

                <div className="space-y-4 border-b border-border/50 pb-4">
                {/* Location and Size */}
                <div className={`space-y-2 transition-opacity ${!isLocEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-foreground/80">Location and Size</label>
                    <Tooltip content="Defines the physical area of the event">
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </Tooltip>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">X</label>
                      <Input
                        type="number"
                        min="0"
                        max={mapWidth - 1}
                        value={eventData.positioning.coordinates.x}
                        onChange={e =>
                          setEventData(prev => ({
                            ...prev,
                            positioning: {
                              ...prev.positioning,
                              coordinates: { 
                                ...prev.positioning.coordinates, 
                                x: getSafeCoord(parseInt(e.target.value), mapWidth)
                              },
                              size: {
                                ...prev.positioning.size,
                                width: getSafeSize(prev.positioning.size.width, getSafeCoord(parseInt(e.target.value), mapWidth), mapWidth)
                              }
                            },
                          }))
                        }
                        className="h-7 text-xs w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Y</label>
                      <Input
                        type="number"
                        min="0"
                        max={mapHeight - 1}
                        value={eventData.positioning.coordinates.y}
                        onChange={e =>
                          setEventData(prev => ({
                            ...prev,
                            positioning: {
                              ...prev.positioning,
                              coordinates: { 
                                ...prev.positioning.coordinates, 
                                y: getSafeCoord(parseInt(e.target.value), mapHeight)
                              },
                              size: {
                                ...prev.positioning.size,
                                height: getSafeSize(prev.positioning.size.height, getSafeCoord(parseInt(e.target.value), mapHeight), mapHeight)
                              }
                            },
                          }))
                        }
                        className="h-7 text-xs w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Width</label>
                      <Input
                        type="number"
                        min="1"
                        max={mapWidth - eventData.positioning.coordinates.x}
                        value={eventData.positioning.size.width}
                        onChange={e =>
                          setEventData(prev => ({
                            ...prev,
                            positioning: {
                              ...prev.positioning,
                              size: { 
                                ...prev.positioning.size, 
                                width: getSafeSize(parseInt(e.target.value), prev.positioning.coordinates.x, mapWidth)
                              },
                            },
                          }))
                        }
                        className="h-7 text-xs w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Height</label>
                      <Input
                        type="number"
                        min="1"
                        max={mapHeight - eventData.positioning.coordinates.y}
                        value={eventData.positioning.size.height}
                        onChange={e =>
                          setEventData(prev => ({
                            ...prev,
                            positioning: {
                              ...prev.positioning,
                              size: { 
                                ...prev.positioning.size, 
                                height: getSafeSize(parseInt(e.target.value), prev.positioning.coordinates.y, mapHeight)
                              },
                            },
                          }))
                        }
                        className="h-7 text-xs w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Hotspot */}
                <div className={`space-y-2 transition-opacity ${!isHotspotEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-foreground/80">Hotspot</label>
                    <Tooltip content="Property determines the specific clickable area for an interaction">
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </Tooltip>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">X</label>
                      <Input
                        type="number"
                        min="0"
                        value={eventData.positioning.hotspot.x}
                        onChange={e =>
                          setEventData(prev => ({
                            ...prev,
                            positioning: {
                              ...prev.positioning,
                              hotspot: { ...prev.positioning.hotspot, x: Math.max(0, parseInt(e.target.value) || 0) },
                            },
                          }))
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Y</label>
                      <Input
                        type="number"
                        min="0"
                        value={eventData.positioning.hotspot.y}
                        onChange={e =>
                          setEventData(prev => ({
                            ...prev,
                            positioning: {
                              ...prev.positioning,
                              hotspot: { ...prev.positioning.hotspot, y: Math.max(0, parseInt(e.target.value) || 0) },
                            },
                          }))
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Width</label>
                      <Input
                        type="number"
                        min="1"
                        value={eventData.positioning.hotspot.width}
                        onChange={e =>
                          setEventData(prev => ({
                            ...prev,
                            positioning: {
                              ...prev.positioning,
                              hotspot: { ...prev.positioning.hotspot, width: Math.max(1, parseInt(e.target.value) || 1) },
                            },
                          }))
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Height</label>
                      <Input
                        type="number"
                        min="1"
                        value={eventData.positioning.hotspot.height}
                        onChange={e =>
                          setEventData(prev => ({
                            ...prev,
                            positioning: {
                              ...prev.positioning,
                              hotspot: { ...prev.positioning.hotspot, height: Math.max(1, parseInt(e.target.value) || 1) },
                            },
                          }))
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Cooldown */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-foreground/80">Cooldown (ms)</label>
                    <Tooltip content="Adds a waiting period between activations">
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <Input
                        type="range"
                        min="0"
                        max="10000"
                        step="500"
                        list="cooldown-ticks"
                        value={Math.min(eventData.timing.cooldown, 10000)}
                        onChange={e =>
                          setEventData(prev => ({
                            ...prev,
                            timing: { ...prev.timing, cooldown: parseInt(e.target.value) },
                          }))
                        }
                        className="w-full"
                      />
                      <datalist id="cooldown-ticks">
                        {[0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000, 9500, 10000].map(v => (
                          <option key={v} value={v} />
                        ))}
                      </datalist>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      value={eventData.timing.cooldown}
                      onChange={e =>
                        setEventData(prev => ({
                          ...prev,
                          timing: { ...prev.timing, cooldown: Math.max(0, parseInt(e.target.value) || 0) },
                        }))
                      }
                      className="h-7 text-xs font-mono w-20"
                    />
                    <span className="text-[10px] text-muted-foreground">ms</span>
                  </div>
                </div>

                {/* Delay */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-foreground/80">Delay (ms)</label>
                    <Tooltip content="Postpones the event's execution after it is triggered">
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <Input
                        type="range"
                        min="0"
                        max="10000"
                        step="500"
                        list="delay-ticks"
                        value={Math.min(eventData.timing.delay, 10000)}
                        onChange={e =>
                          setEventData(prev => ({
                            ...prev,
                            timing: { ...prev.timing, delay: parseInt(e.target.value) },
                          }))
                        }
                        className="w-full"
                      />
                      <datalist id="delay-ticks">
                        {[0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000, 9500, 10000].map(v => (
                          <option key={v} value={v} />
                        ))}
                      </datalist>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      value={eventData.timing.delay}
                      onChange={e =>
                        setEventData(prev => ({
                          ...prev,
                          timing: { ...prev.timing, delay: Math.max(0, parseInt(e.target.value) || 0) },
                        }))
                      }
                      className="h-7 text-xs font-mono w-20"
                    />
                    <span className="text-[10px] text-muted-foreground">ms</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </CollapsibleSection>

          {/* Requirements Section */}
          <CollapsibleSection
            title="Requirements"
            icon={SquareCheckBig}
            id="requirements"
            isExpanded={expandedSections.requirements}
            onToggle={() => toggleSection('requirements')}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Requirements</h3>
                <Tooltip content="Events can check specific player conditions before firing">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </Tooltip>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-foreground/80">Status Checks</label>
                    <Tooltip content="Checks for specific campaign or quest status">
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </Tooltip>
                  </div>
                  <Button size="sm" variant="outline" onClick={addStatusRequirement} className="h-6 text-xs">
                    Add Status
                  </Button>
                </div>
                <div className="space-y-2">
                  {eventData.requirements.status.map((status, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={status}
                        onChange={e => updateStatusRequirement(index, e.target.value)}
                        placeholder="Status name"
                        className="h-7 text-xs flex-1"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeStatusRequirement(index)}
                        className="h-7 w-7"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Minimum Level */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-foreground/80">Minimum Level</label>
                  <Tooltip content="Requires a minimum player level">
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </Tooltip>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="range"
                    min="0"
                    max="999"
                    value={eventData.requirements.minLevel}
                    onChange={e =>
                      setEventData(prev => ({
                        ...prev,
                        requirements: { ...prev.requirements, minLevel: parseInt(e.target.value) },
                      }))
                    }
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="0"
                    value={eventData.requirements.minLevel}
                    onChange={e =>
                      setEventData(prev => ({
                        ...prev,
                        requirements: { ...prev.requirements, minLevel: Math.max(0, parseInt(e.target.value) || 0) },
                      }))
                    }
                    className="h-7 text-xs font-mono w-16"
                  />
                </div>
              </div>

              {/* Item Requirements */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-foreground/80">Item Requirements</label>
                    <Tooltip content="Require or forbid a specific inventory item for this event">
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </Tooltip>
                  </div>
                  <Button size="sm" variant="outline" onClick={addItemRequirement} className="h-6 text-xs">
                    + Add
                  </Button>
                </div>
                <div className="overflow-hidden rounded-md border border-border">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-2 py-2">Condition</th>
                        <th className="px-2 py-2">Item</th>
                        <th className="px-2 py-2">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {eventData.requirements.itemRequirements.map((itemReq) => (
                        <tr key={itemReq.id}>
                          <td className="px-2 py-2">
                            <Select
                              value={itemReq.type}
                              onValueChange={(value) => updateItemRequirement(itemReq.id, { type: value as EventItemRequirement['type'] })}
                            >
                              <SelectTrigger className="h-8 text-xs w-full">
                                <SelectValue placeholder="Select condition" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="requires_item" className="text-xs">Requires item</SelectItem>
                                <SelectItem value="requires_not_item" className="text-xs">Requires not item</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-2">
                            <Select
                              value={itemReq.itemId}
                              onValueChange={(value) => updateItemRequirement(itemReq.id, { itemId: value === '__none__' ? '' : value })}
                            >
                              <SelectTrigger className="h-8 text-xs w-full">
                                <SelectValue placeholder="Select item" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__" className="text-xs">None</SelectItem>
                                {inventoryItems.map((item: any) => (
                                  <SelectItem key={`extra-${itemReq.id}-${item.id}`} value={String(item.id)} className="text-xs">
                                    {String(item.id)} {item.name || item.fileName || ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="1"
                                value={itemReq.itemQuantity}
                                onChange={e => updateItemRequirement(itemReq.id, { itemQuantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                className="h-7 text-xs flex-1"
                              />
                              <Button size="icon" variant="ghost" onClick={() => removeItemRequirement(itemReq.id)} className="h-7 w-7">
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-foreground/80">Currency Requirement</label>
                  <Tooltip content="Checks if the player has enough money">
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </Tooltip>
                </div>
                <Input
                  type="number"
                  min="0"
                  value={eventData.requirements.currency}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      requirements: { ...prev.requirements, currency: Math.max(0, parseInt(e.target.value) || 0) },
                    }))
                  }
                  placeholder="Currency amount"
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Actions and Rewards Section */}
          <CollapsibleSection
            title="Actions and Rewards"
            icon={LogIn}
            id="actions-and-rewards"
            isExpanded={expandedSections.rewards}
            onToggle={() => toggleSection('rewards')}
          >
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Actions and Rewards</h3>

              {/* Message */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Message</label>
                <Input
                  value={eventData.rewards.message}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      rewards: { ...prev.rewards, message: e.target.value },
                    }))
                  }
                  placeholder="Display text message"
                  className="h-7 text-xs"
                />
              </div>

              {/* EXP Reward */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">EXP Reward</label>
                <Input
                  type="number"
                  min="0"
                  value={eventData.rewards.expReward}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      rewards: { ...prev.rewards, expReward: Math.max(0, parseInt(e.target.value) || 0) },
                    }))
                  }
                  placeholder="Experience points"
                  className="h-7 text-xs"
                />
              </div>

              {/* Inventory and Loot Effects */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-foreground/80">Inventory & Loot Effects</label>
                  <Tooltip content="Take or give items, currency, or item groups when this event triggers">
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </Tooltip>
                </div>
                <div className="overflow-hidden rounded-md border border-border">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-2 py-2">Effect</th>
                        <th className="px-2 py-2">Item / Group</th>
                        <th className="px-2 py-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="px-2 py-2">Give gold</td>
                        <td className="px-2 py-2 text-muted-foreground">Currency</td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min="0"
                            value={eventData.rewards.rewardCurrency}
                            onChange={e =>
                              setEventData(prev => ({
                                ...prev,
                                rewards: { ...prev.rewards, rewardCurrency: Math.max(0, parseInt(e.target.value) || 0) },
                              }))
                            }
                            className="h-7 text-xs w-full"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-2 py-2">Take gold</td>
                        <td className="px-2 py-2 text-muted-foreground">Currency</td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min="0"
                            value={eventData.rewards.removeCurrency}
                            onChange={e =>
                              setEventData(prev => ({
                                ...prev,
                                rewards: { ...prev.rewards, removeCurrency: Math.max(0, parseInt(e.target.value) || 0) },
                              }))
                            }
                            className="h-7 text-xs w-full"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-2 py-2">Give item</td>
                        <td className="px-2 py-2">
                          <Select
                            value={eventData.rewards.rewardItemId}
                            onValueChange={(value) =>
                              setEventData(prev => ({
                                ...prev,
                                rewards: { ...prev.rewards, rewardItemId: value === '__none__' ? '' : value },
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs w-full">
                              <SelectValue placeholder="Select item" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="text-xs">None</SelectItem>
                              {inventoryItems.map((item: any) => (
                                <SelectItem key={`give-${item.id}`} value={String(item.id)} className="text-xs">
                                  {String(item.id)} {item.name || item.fileName || ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min="1"
                            value={eventData.rewards.rewardItemQuantity}
                            onChange={e =>
                              setEventData(prev => ({
                                ...prev,
                                rewards: { ...prev.rewards, rewardItemQuantity: Math.max(1, parseInt(e.target.value) || 1) },
                              }))
                            }
                            className="h-7 text-xs w-full"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-2 py-2">Take item</td>
                        <td className="px-2 py-2">
                          <Select
                            value={eventData.rewards.removeItemId}
                            onValueChange={(value) =>
                              setEventData(prev => ({
                                ...prev,
                                rewards: { ...prev.rewards, removeItemId: value === '__none__' ? '' : value },
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs w-full">
                              <SelectValue placeholder="Select item" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="text-xs">None</SelectItem>
                              {inventoryItems.map((item: any) => (
                                <SelectItem key={`take-${item.id}`} value={String(item.id)} className="text-xs">
                                  {String(item.id)} {item.name || item.fileName || ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min="1"
                            value={eventData.rewards.removeItemQuantity}
                            onChange={e =>
                              setEventData(prev => ({
                                ...prev,
                                rewards: { ...prev.rewards, removeItemQuantity: Math.max(1, parseInt(e.target.value) || 1) },
                              }))
                            }
                            className="h-7 text-xs w-full"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-2 py-2">Loot table</td>
                        <td className="px-2 py-2" colSpan={2}>
                          <Select
                            value={eventData.rewards.lootGroup}
                            onValueChange={(value) =>
                              setEventData(prev => ({
                                ...prev,
                                rewards: { ...prev.rewards, lootGroup: value === '__none__' ? '' : value },
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs w-full">
                              <SelectValue placeholder="Select loot group" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="text-xs">None</SelectItem>
                              {itemGroups.map((group: any) => (
                                <SelectItem key={`loot-${group.id}`} value={String(group.id)} className="text-xs">
                                  {String(group.id)} {group.name || group.fileName || ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-2 py-2">Random loot reward</td>
                        <td className="px-2 py-2">
                          <Select
                            value={eventData.rewards.rewardLootGroup}
                            onValueChange={(value) =>
                              setEventData(prev => ({
                                ...prev,
                                rewards: { ...prev.rewards, rewardLootGroup: value === '__none__' ? '' : value },
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs w-full">
                              <SelectValue placeholder="Select loot group" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="text-xs">None</SelectItem>
                              {itemGroups.map((group: any) => (
                                <SelectItem key={`reward-loot-${group.id}`} value={String(group.id)} className="text-xs">
                                  {String(group.id)} {group.name || group.fileName || ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2 grid grid-cols-2 gap-1">
                          <Input
                            type="number"
                            min="1"
                            value={eventData.rewards.rewardLootCountMin}
                            onChange={e =>
                              setEventData(prev => ({
                                ...prev,
                                rewards: { ...prev.rewards, rewardLootCountMin: Math.max(1, parseInt(e.target.value) || 1) },
                              }))
                            }
                            className="h-7 text-xs w-full"
                            placeholder="Min"
                          />
                          <Input
                            type="number"
                            min="1"
                            value={eventData.rewards.rewardLootCountMax}
                            onChange={e =>
                              setEventData(prev => ({
                                ...prev,
                                rewards: { ...prev.rewards, rewardLootCountMax: Math.max(1, parseInt(e.target.value) || 1) },
                              }))
                            }
                            className="h-7 text-xs w-full"
                            placeholder="Max"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Enemy Spawn */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Enemy Spawn</label>
                <Input
                  value={eventData.rewards.enemySpawn}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      rewards: { ...prev.rewards, enemySpawn: e.target.value },
                    }))
                  }
                  placeholder="Enemy category"
                  className="h-7 text-xs"
                />
              </div>

              {/* Teleport */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Teleport</label>
                <div className="flex items-center gap-2">
                  <Select
                    value={eventData.rewards.teleportMap}
                    onValueChange={val =>
                      setEventData(prev => ({
                        ...prev,
                        rewards: { ...prev.rewards, teleportMap: val === '__none__' ? '' : val },
                      }))
                    }
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue placeholder="Select map" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" className="text-xs">None</SelectItem>
                      {projectMaps.map((mapFile: string) => {
                        const mapLabel = mapFile.replace(/\.(txt|json)$/i, '');
                        const isCurrent = mapLabel === currentMapName;
                        return (
                          <SelectItem key={mapFile} value={mapLabel} className={`text-xs ${isCurrent ? 'text-orange-400' : ''}`}>
                            {mapLabel}{isCurrent ? ' (current)' : ''}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <div>
                    <label className="text-[10px] text-muted-foreground">X</label>
                    <Input
                      type="number"
                      value={eventData.rewards.teleportX}
                      onChange={e =>
                        setEventData(prev => ({
                          ...prev,
                          rewards: { ...prev.rewards, teleportX: parseInt(e.target.value) || 0 },
                        }))
                      }
                      placeholder="Coordinate X"
                      className="h-7 text-xs w-24"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Y</label>
                    <Input
                      type="number"
                      value={eventData.rewards.teleportY}
                      onChange={e =>
                        setEventData(prev => ({
                          ...prev,
                          rewards: { ...prev.rewards, teleportY: parseInt(e.target.value) || 0 },
                        }))
                      }
                      placeholder="Coordinate Y"
                      className="h-7 text-xs w-24"
                    />
                  </div>
                </div>
              </div>

              {/* Sound */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Sound File</label>
                <Input
                  value={eventData.rewards.sound}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      rewards: { ...prev.rewards, sound: e.target.value },
                    }))
                  }
                  placeholder="Sound path"
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Engine Logic Section */}
          <CollapsibleSection
            title="Engine Logic"
            icon={Repeat2}
            id="engine-logic"
            isExpanded={expandedSections.engine}
            onToggle={() => toggleSection('engine')}
          >
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Engine Logic</h3>

              {/* Chance */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-foreground/80">Chance (%)</label>
                  <Tooltip content="Sets a percentage chance for the event to fire">
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </Tooltip>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="range"
                    min="0"
                    max="100"
                    value={eventData.engine.chance}
                    onChange={e =>
                      setEventData(prev => ({
                        ...prev,
                        engine: { ...prev.engine, chance: parseInt(e.target.value) },
                      }))
                    }
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={eventData.engine.chance}
                    onChange={e =>
                      setEventData(prev => ({
                        ...prev,
                        engine: { ...prev.engine, chance: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) },
                      }))
                    }
                    className="h-7 text-xs font-mono w-16"
                  />
                  <span className="text-[10px] text-muted-foreground">%</span>
                </div>
              </div>

              {/* Auto Save */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoSave"
                  checked={eventData.engine.autoSave}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      engine: { ...prev.engine, autoSave: e.target.checked },
                    }))
                  }
                  className="h-4 w-4 rounded border-border/70"
                />
                <label htmlFor="autoSave" className="text-xs font-medium text-foreground/80">
                  Auto Save Game
                </label>
                <Tooltip content="Automatically saves the game and updates the respawn point">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </Tooltip>
              </div>

              {/* Script */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-foreground/80">Script File</label>
                  <Tooltip content="Calls an external script file for complex logic">
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </Tooltip>
                </div>
                <Input
                  value={eventData.engine.script}
                  onChange={e =>
                    setEventData(prev => ({
                      ...prev,
                      engine: { ...prev.engine, script: e.target.value },
                    }))
                  }
                  placeholder="Script path"
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </CollapsibleSection>
        </div>

        <div className="sticky bottom-0 border-t border-border/50 bg-background px-6 py-3 flex justify-end">
          <Tooltip content="Save event">
            <Button
              size="icon"
              onClick={handleSave}
              className="h-7 w-7 text-foreground/80 hover:text-foreground hover:bg-muted"
            >
              <Save className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-40 hover:opacity-100 transition-opacity flex items-end justify-end"
          title="Drag to resize"
        >
          <div className="w-1.5 h-1.5 bg-foreground/40 rounded-sm m-1" />
        </div>
      </div>
    </>
  );

  return createPortal(dialogContent, document.body);
};

export default EventDialog;


