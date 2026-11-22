import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { X, Save } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';
import { useAppContext } from '@/context/AppContext';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import ResizeHandle from '@/components/ResizeHandle';
import { mergeEventFormProperties } from '@/editor/eventFormProperties';
import EditorPropertyList from '@/components/EditorPropertyList';
import { isStoryFlagType, STORY_FLAG_LIST_ID } from '@/editor/powers/storyFlags';
import {
  EVENT_EXTRA_CATALOG,
  eventExtraPaletteKeys,
  eventExtraPropsFrom,
  eventExtraRowsFrom,
  newEventExtraRowId,
  type EventExtraRow,
} from '@/editor/eventExtraProperties';

import {
  ACTIVATION_TO_FLARE,
  FLARE_TO_ACTIVATION,
  type EventActivation,
  type EventData,
  type EventItemRequirement,
} from '@/components/events/eventDialogModel';
import { buildEventInstanceProps } from '@/components/events/eventInstanceProps';
import { buildEventInstanceUpdate } from '@/components/events/eventInstanceUpdate';
import EventInformationSection from '@/components/events/EventInformationSection';
import EventPositioningSection from '@/components/events/EventPositioningSection';
import EventRequirementsSection from '@/components/events/EventRequirementsSection';
import EventScriptForm from '@/components/events/EventScriptForm';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import { askConfirm } from '@/components/ui/inlineConfirmCore';
import { useRegisterDirty } from '@/context/SaveHealthContext';
import { Input } from '@/components/ui/input';
import { EVENT_SCRIPT_LIST_ID } from '@/hooks/useEventScripts';
import { PROCGEN_RULES_LIST_ID, extraProcgenEvents } from '@/editor/procgenRules';
import RandomDungeonDialog from '@/components/engine/RandomDungeonDialog';
import { dungeonSlugFromIntermap, intermapForHost, parseMapHeader, type MapStyle } from '@/editor/randomDungeon';
import { projectRoot } from '@/editor/projectFiles';
import { getStoredFlarePath } from '@/flare/flarePathStore';
import useFlareEngine from '@/hooks/useFlareEngine';
import {
  actionPropertiesFrom,
  emptyEventScript,
  eventScriptRelPath,
  mergeEventScript,
  normalizeEventScriptPath,
  parseEventScript,
  instancePropertiesFrom,
  type EventScriptFile,
} from '@/editor/eventScripts';

type EventDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventLocation: { x: number; y: number } | null;
  editingEventId?: number | null;
  scriptPath?: string | null;
  scripts?: string[];
  books?: string[];
  cutscenes?: string[];
  onScriptSaved?: () => void;
  onEditScript?: (path: string) => void;
};


const EventDialog: React.FC<EventDialogProps> = ({
  open,
  onOpenChange,
  eventLocation: _eventLocation,
  editingEventId,
  scriptPath = null,
  scripts = [],
  books = [],
  cutscenes = [],
  onScriptSaved,
  onEditScript,
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { mapName: currentMapName, mapWidth, mapHeight, editor, syncMapObjectsWrapper, controls, itemsList = [], openOrCreateMapTab, openMapForRecovery } = useAppContext() as any;
  const itemGroups = useMemo(() => (itemsList as any[]).filter((item) => item.role === 'loot_groups'), [itemsList]);
  const inventoryItems = useMemo(() => (itemsList as any[]).filter((item) => item.role !== 'loot_groups'), [itemsList]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentProjectPath: string | null = (controls as any)?.currentProjectPath ?? null;
  const flareEngine = useFlareEngine({
    currentProjectPath,
    mapName: currentMapName,
    onBeforeLaunch: async () => {
      if (typeof (controls as any)?.handleManualSave === 'function') await (controls as any).handleManualSave();
    },
  });
  const [dungeonOpen, setDungeonOpen] = useState(false);
  const [dungeonSlug, setDungeonSlug] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>({});
  const [projectMaps, setProjectMaps] = useState<string[]>([]);
  const [extraRows, setExtraRows] = useState<EventExtraRow[]>([]);

  const isEditing = editingEventId != null;
  const isScript = Boolean(scriptPath);
  const [scriptFile, setScriptFile] = useState<EventScriptFile>(emptyEventScript);
  const [scriptBaseline, setScriptBaseline] = useState('');
  const skipScriptLoadRef = useRef(false);
  const [scriptError, setScriptError] = useState('');

  const parseItemValue = (value: string) => {
    const [id, quantity] = value.split(/[: ,]/).map((part) => part.trim());
    return { id: id || '', quantity: parseInt(quantity || '1', 10) || 1 };
  };

  const handleSave = async () => {
    if (isScript && scriptPath) {
      if (!currentProjectPath || !window.electronAPI?.writeFile) {
        setScriptError('No project is open.');
        return;
      }
      const abs = `${currentProjectPath.replace(/\\/g, '/')}/${normalizeEventScriptPath(scriptPath)}`;
      const previous = (window.electronAPI.readFile ? await window.electronAPI.readFile(abs) : '') || '';
      const next = mergeEventScript(previous, scriptFile);
      const ok = await window.electronAPI.writeFile(abs, next);
      if (!ok) {
        setScriptError('Could not write the script file.');
        return;
      }
      setScriptBaseline(next);
      setScriptError('');
      onScriptSaved?.();
      onOpenChange(false);
      return;
    }
    if (!editor) return;
    const { coordinates } = eventData.positioning;
    const existing = isEditing && typeof editor.getMapObjects === 'function'
      ? (editor.getMapObjects() as Array<{ id: number; properties?: Record<string, string | string[]> }>)
        .find((object) => object.id === editingEventId)
      : undefined;
    let script = normalizeEventScriptPath(eventData.engine.script || buildEventInstanceProps(eventData, extraRows).script);
    const leftover = actionPropertiesFrom(existing?.properties);
    if (!script && leftover.length && currentProjectPath && window.electronAPI?.writeFile) {
      const stamp = `${(currentMapName || 'map').replace(/[^A-Za-z0-9]+/g, '_')}_${coordinates.x}_${coordinates.y}`;
      script = eventScriptRelPath(stamp);
      const abs = `${currentProjectPath.replace(/\\/g, '/')}/${script}`;
      await window.electronAPI.writeFile(abs, mergeEventScript('', { header: '', steps: [{ components: leftover }] }));
      onScriptSaved?.();
    }

    if (isEditing && typeof editor.updateMapObject === 'function' && editingEventId != null) {
      editor.updateMapObject(editingEventId, buildEventInstanceUpdate({ eventData, extraRows, script }));
    }

    if (typeof syncMapObjectsWrapper === 'function') syncMapObjectsWrapper();
    onOpenChange(false);
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
      // NEW
      power: '',
      powerPath: '',
      powerDamage: 0,
      powerStats: '',
      powerLevel: '',
      mapmod: '',
      mapmodToggle: '',
      requiresTile: '',
      requiresNotTile: '',
      spawnLevel: '',
      intermapId: '',
      procgenFilename: '',
      procgenLink: '',
      procgenDoorLevel: '',
      restore: '',
      npc: '',
      music: '',
      book: '',
      respec: false,
      showOnMinimap: false,
      parallaxLayers: '',
      randomStatus: '',
    },
    engine: {
      chance: 100,
      autoSave: false,
      script: '',
    },
  });
  const eventPlaced = eventData.positioning.coordinates.x >= 0 && eventData.positioning.coordinates.y >= 0;


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
        setExtraRows(eventExtraRowsFrom(p));
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
          ...requiresItemValues.map((item: string) => {
            const parsed = parseItemValue(item);
            return {
              id: `item-req-${Math.random().toString(36).slice(2)}`,
              type: 'requires_item' as const,
              itemId: parsed.id,
              itemQuantity: parsed.quantity,
            };
          })
        );
        itemRequirements.push(
          ...requiresNotItemValues.map((item: string) => {
            const parsed = parseItemValue(item);
            return {
              id: `item-req-${Math.random().toString(36).slice(2)}`,
              type: 'requires_not_item' as const,
              itemId: parsed.id,
              itemQuantity: parsed.quantity,
            };
          })
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
            // NEW
            power: p.power || '',
            powerPath: p.power_path || '',
            powerDamage: parseInt(p.power_damage || '0') || 0,
            powerStats: p.power_stats || '',
            powerLevel: p.power_level || '',
            mapmod: p.mapmod || '',
            mapmodToggle: p.mapmod_toggle && p.mapmod_toggle !== 'true' ? p.mapmod_toggle : '',
            requiresTile: p.requires_tile || '',
            requiresNotTile: p.requires_not_tile || '',
            spawnLevel: p.spawn_level || '',
            intermapId: p.intermap_id || '',
            procgenFilename: p.procgen_filename || '',
            procgenLink: p.procgen_link || '',
            procgenDoorLevel: p.procgen_door_level || '',
            restore: p.restore || '',
            npc: p.npc || '',
            music: p.music || '',
            book: p.book || '',
            respec: p.respec === 'true',
            showOnMinimap: p.show_on_minimap === 'true',
            parallaxLayers: p.parallax_layers || '',
            randomStatus: p.random_status || '',
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
    if (!isEditing && !isScript) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExtraRows([]);
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
        rewards: { message: '', expReward: 0, rewardCurrency: 0, removeCurrency: 0, rewardItemId: '', rewardItemQuantity: 1, removeItemId: '', removeItemQuantity: 1, lootGroup: '', rewardLootGroup: '', rewardLootCountMin: 1, rewardLootCountMax: 1, enemySpawn: '', teleportMap: '', teleportX: 0, teleportY: 0, sound: '', power: '', powerPath: '', powerDamage: 0, powerStats: '', powerLevel: '', mapmod: '', mapmodToggle: '', requiresTile: '', requiresNotTile: '', spawnLevel: '', intermapId: '', procgenFilename: '', procgenLink: '', procgenDoorLevel: '', restore: '', npc: '', music: '', book: '', respec: false, showOnMinimap: false, parallaxLayers: '', randomStatus: '' },
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
  }, [open, onOpenChange, currentMapName, isEditing, isScript, editingEventId, editor, syncMapObjectsWrapper]);

  useEffect(() => {
    if (!open || !isScript || !scriptPath || !currentProjectPath) return;
    let cancelled = false;
    const abs = `${currentProjectPath.replace(/\\/g, '/')}/${normalizeEventScriptPath(scriptPath)}`;
    void (async () => {
      const text = window.electronAPI?.readFile ? await window.electronAPI.readFile(abs) : '';
      if (cancelled) return;
      if (skipScriptLoadRef.current) return;
      setScriptFile(parseEventScript(text || ''));
      setScriptBaseline(text || '');
      setScriptError('');
    })();
    return () => { cancelled = true; };
  }, [open, isScript, scriptPath, currentProjectPath]);

  const scriptRel = isScript && scriptPath ? normalizeEventScriptPath(scriptPath) : '';
  const scriptDraftText = scriptRel ? mergeEventScript(scriptBaseline, scriptFile) : '';
  const scriptDirty = Boolean(isScript && open && scriptRel && scriptDraftText !== scriptBaseline);
  useRegisterDirty(scriptRel ? `event-script:${scriptRel}` : 'event-script', scriptDirty, handleSave, scriptDirty ? [{ path: scriptRel, content: scriptDraftText }] : [], (incoming) => {
    const file = incoming.find((entry) => entry.path.replace(/\\/g, '/') === scriptRel) ?? incoming[0];
    if (!file) return;
    skipScriptLoadRef.current = true;
    setScriptFile(parseEventScript(file.content));
  });

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
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };


  const openRandomDungeon = async () => {
    const root = currentProjectPath ? projectRoot(currentProjectPath) : '';
    const style: MapStyle = {};
    const ground = typeof editor?.getGroundTileSize === 'function' ? editor.getGroundTileSize() : null;
    if (ground) {
      style.tilewidth = ground.width;
      style.tileheight = ground.height;
      style.orientation = ground.orientation;
    }
    if (root && currentMapName) {
      const leaf = String(currentMapName).replace(/\\/g, '/').split('/').pop() || currentMapName;
      const file = leaf.toLowerCase().endsWith('.txt') ? leaf : `${leaf}.txt`;
      const text = (await window.electronAPI?.readMapFile?.(root, file).catch(() => '')) || '';
      const header = parseMapHeader(text);
      if (header.tileset) style.tileset = header.tileset;
      if (header.tilewidth) style.tilewidth = header.tilewidth;
      if (header.tileheight) style.tileheight = header.tileheight;
      if (header.orientation) style.orientation = header.orientation;
    }
    setMapStyle(style);

    const raw = eventData.rewards.teleportMap.trim();
    const candidate = dungeonSlugFromIntermap(raw ? intermapForHost(raw) : '');
    if (candidate && root) {
      const rules = await window.electronAPI?.readFile?.(`${root}/maps/procgen_rules/${candidate}.txt`).catch(() => '');
      if (rules) {
        setDungeonSlug(candidate);
        setDungeonOpen(true);
        return;
      }
      if (raw && !(await askConfirm('Replace this map link with a new random dungeon?'))) {
        return;
      }
    }
    setDungeonSlug(null);
    setDungeonOpen(true);
  };

  const wireDungeon = (info: { slug: string; host: string; intermap: string; title: string }) => {
    setDungeonSlug(info.slug);
    setEventData((prev) => ({
      ...prev,
      name: prev.name.trim() && prev.name.trim().toLowerCase() !== 'event' ? prev.name : info.title,
      rewards: { ...prev.rewards, teleportMap: info.host, teleportX: 0, teleportY: 0 },
      timing: { ...prev.timing, activeActivation: prev.timing.activeActivation || 'Trigger' },
    }));
  };

  const openDungeonRoom = async (relPath: string) => {
    const name = relPath.replace(/\\/g, '/').replace(/^maps\//, '').replace(/\.txt$/i, '');
    if (typeof openOrCreateMapTab === 'function' && currentProjectPath) {
      await openOrCreateMapTab(name, currentProjectPath);
      return;
    }
    if (typeof openMapForRecovery === 'function') await openMapForRecovery(name);
  };

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
          <h3 className="text-lg font-semibold flex-1">{isScript ? (scriptPath || 'Event') : isEditing ? 'Event instance' : 'Event'}</h3>
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
          {isScript ? (
            <div className="space-y-3">
              {scriptError ? <div className="text-xs text-destructive">{scriptError}</div> : null}
              <EventScriptForm file={scriptFile} onChange={setScriptFile} scripts={scripts} books={books} cutscenes={cutscenes} />
            </div>
          ) : (
          <>
          <EventInformationSection
            eventData={eventData}
            setEventData={setEventData}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
          />

          <EventPositioningSection
            eventData={eventData}
            setEventData={setEventData}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
            setActivation={setActivation}
            isEditing={isEditing}
            eventPlaced={eventPlaced}
            isLocEnabled={isLocEnabled}
            isHotspotEnabled={isHotspotEnabled}
            mapWidth={mapWidth}
            mapHeight={mapHeight}
          />

          <EventRequirementsSection
            eventData={eventData}
            setEventData={setEventData}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
            inventoryItems={inventoryItems}
            addStatusRequirement={addStatusRequirement}
            updateStatusRequirement={updateStatusRequirement}
            removeStatusRequirement={removeStatusRequirement}
            addItemRequirement={addItemRequirement}
            updateItemRequirement={updateItemRequirement}
            removeItemRequirement={removeItemRequirement}
          />

          <div className="space-y-2 px-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Actions</div>
            <div className="flex flex-wrap items-center gap-2">
              <HintLabel className="text-xs font-normal w-16 shrink-0" hint="What this event does when it runs.">Actions</HintLabel>
              <Input
                width="path"
                className="h-7 text-xs"
                aria-label="Event actions"
                list={EVENT_SCRIPT_LIST_ID}
                placeholder="Choose event actions"
                value={eventData.engine.script}
                onChange={(e) => setEventData((prev) => ({ ...prev, engine: { ...prev.engine, script: e.target.value } }))}
              />
              {normalizeEventScriptPath(eventData.engine.script) ? (
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onEditScript?.(normalizeEventScriptPath(eventData.engine.script))}>
                  Edit actions
                </Button>
              ) : null}
            </div>
          </div>

          <div className="px-1">
            <FieldHint hint="Creates a dungeon map, links this door to it, and lets you draw entrance, normal and exit rooms. The rules file is written for you.">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { void openRandomDungeon(); }}>
                Random dungeon
              </Button>
            </FieldHint>
          </div>

          <div className="space-y-2 px-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Generated maps</div>
            {extraProcgenEvents((typeof editor?.getMapObjects === 'function' ? editor.getMapObjects() : []).filter((obj: { type?: string }) => obj.type === 'event'), editingEventId).length ? (
              <p className="text-[11px] leading-snug text-amber-500">
                Only one layout file is used per map. Another event already has one.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <HintLabel className="text-xs font-normal w-28 shrink-0" hint="A layout that fills this event's area when the map loads. Only one is used per map.">Layout file</HintLabel>
              <Input
                width="path"
                className="h-7 text-xs"
                list={PROCGEN_RULES_LIST_ID}
                value={eventData.rewards.procgenFilename}
                onChange={(e) => setEventData((prev) => ({ ...prev, rewards: { ...prev.rewards, procgenFilename: e.target.value } }))}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <HintLabel className="text-xs font-normal w-28 shrink-0" hint="Which side of a generated map this door connects to.">Connects to</HintLabel>
              <Input
                width="id"
                className="h-7 text-xs"
                list="procgen-link-dirs"
                value={eventData.rewards.procgenLink}
                onChange={(e) => setEventData((prev) => ({ ...prev, rewards: { ...prev.rewards, procgenLink: e.target.value } }))}
              />
              <datalist id="procgen-link-dirs">
                <option value="north" />
                <option value="south" />
                <option value="west" />
                <option value="east" />
              </datalist>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <HintLabel className="text-xs font-normal w-28 shrink-0" hint="The door levels where this event is active.">Door level</HintLabel>
              <Input
                width="id"
                className="h-7 text-xs"
                value={eventData.rewards.procgenDoorLevel}
                onChange={(e) => setEventData((prev) => ({ ...prev, rewards: { ...prev.rewards, procgenDoorLevel: e.target.value } }))}
              />
            </div>
          </div>

          <div className="px-1">
            <EditorPropertyList
              title="More"
              properties={extraRows.map((row) => {
                const entry = EVENT_EXTRA_CATALOG.find((item) => item.key === row.key);
                return {
                  key: row.id,
                  label: entry?.label || row.key,
                  value: row.value,
                  tooltip: entry?.tooltip || row.key,
                  kind: entry?.kind,
                  list: isStoryFlagType(row.key) ? STORY_FLAG_LIST_ID : row.key === 'procgen_filename' ? PROCGEN_RULES_LIST_ID : undefined,
                };
              })}
              catalog={eventExtraPaletteKeys(extraRows).map((entry) => ({
                id: entry.key,
                label: entry.label,
                tooltip: entry.tooltip,
                searchText: `${entry.key} ${entry.synonyms || ''}`,
              }))}
              onChange={(id, value) => setExtraRows((rows) => rows.map((row) => (row.id === id ? { ...row, value } : row)))}
              onAdd={(key) => {
                const entry = EVENT_EXTRA_CATALOG.find((item) => item.key === key);
                setExtraRows((rows) => [...rows, { id: newEventExtraRowId(), key, value: entry?.kind === 'toggle' ? 'true' : '' }]);
              }}
              onRemove={(id) => setExtraRows((rows) => rows.filter((row) => row.id !== id))}
            />
          </div>
          </>
          )}
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
        <ResizeHandle onMouseDown={handleResizeMouseDown} />
      </div>

      <RandomDungeonDialog
        open={dungeonOpen}
        onOpenChange={setDungeonOpen}
        projectPath={currentProjectPath}
        flarePath={getStoredFlarePath()}
        slug={dungeonSlug}
        defaultName={eventData.name?.trim() && eventData.name.trim().toLowerCase() !== 'event' ? eventData.name.trim() : 'Dungeon'}
        style={mapStyle}
        onWired={wireDungeon}
        onOpenRoom={openDungeonRoom}
        onTryInGame={async (hostRel) => {
          await flareEngine.launch('current-map', { mapName: hostRel });
        }}
      />
    </>
  );

  return createPortal(dialogContent, document.body);
};

export default EventDialog;


