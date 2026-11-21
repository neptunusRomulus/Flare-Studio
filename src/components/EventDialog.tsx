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
import EventInformationSection from '@/components/events/EventInformationSection';
import EventPositioningSection from '@/components/events/EventPositioningSection';
import EventRequirementsSection from '@/components/events/EventRequirementsSection';
import EventScriptForm from '@/components/events/EventScriptForm';
import { HintLabel } from '@/components/ui/field-hint';
import { useRegisterDirty } from '@/context/SaveHealthContext';
import { Input } from '@/components/ui/input';
import { EVENT_SCRIPT_LIST_ID } from '@/hooks/useEventScripts';
import { PROCGEN_RULES_LIST_ID, extraProcgenEvents } from '@/editor/procgenRules';
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
  const { mapName: currentMapName, mapWidth, mapHeight, editor, syncMapObjectsWrapper, controls, itemsList = [] } = useAppContext() as any;
  const itemGroups = useMemo(() => (itemsList as any[]).filter((item) => item.role === 'loot_groups'), [itemsList]);
  const inventoryItems = useMemo(() => (itemsList as any[]).filter((item) => item.role !== 'loot_groups'), [itemsList]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentProjectPath: string | null = (controls as any)?.currentProjectPath ?? null;
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

  const buildProps = (): Record<string, string | string[]> => {
    const { coordinates, size, hotspot } = eventData.positioning;
    const flareActivate = ACTIVATION_TO_FLARE[eventData.timing.activeActivation || ''] || '';
    const props: Record<string, string | string[]> = {};

    if (flareActivate) props.activate = flareActivate;
    const placed = coordinates.x >= 0 && coordinates.y >= 0;
    if (placed && ['Trigger', 'Leave'].includes(eventData.timing.activeActivation || '')) {
      props.location = `${coordinates.x},${coordinates.y},${size.width},${size.height}`;
    }
    if (placed && ['Interact', 'Trigger'].includes(eventData.timing.activeActivation || '')) {
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

    // NEW: Power & spell effects
    if (eventData.rewards.power.trim()) props.power = eventData.rewards.power.trim();
    if (eventData.rewards.powerPath.trim()) props.power_path = eventData.rewards.powerPath.trim();
    if (eventData.rewards.powerDamage !== undefined && eventData.rewards.powerDamage > 0) props.power_damage = String(eventData.rewards.powerDamage);
    if (eventData.rewards.powerStats.trim()) props.power_stats = eventData.rewards.powerStats.trim();
    if (eventData.rewards.powerLevel.trim()) props.power_level = eventData.rewards.powerLevel.trim();

    // NEW: Map modification. mapmod_toggle is "layer,x,y,tileA,tileB", never the boolean true.
    if (eventData.rewards.mapmod.trim()) props.mapmod = eventData.rewards.mapmod.trim();
    if (eventData.rewards.mapmodToggle.trim() && eventData.rewards.mapmodToggle.trim().toLowerCase() !== 'true') {
      props.mapmod_toggle = eventData.rewards.mapmodToggle.trim();
    }
    if (eventData.rewards.requiresTile.trim()) props.requires_tile = eventData.rewards.requiresTile.trim();
    if (eventData.rewards.requiresNotTile.trim()) props.requires_not_tile = eventData.rewards.requiresNotTile.trim();
    if (eventData.rewards.spawnLevel.trim()) props.spawn_level = eventData.rewards.spawnLevel.trim();
    if (eventData.rewards.intermapId.trim()) props.intermap_id = eventData.rewards.intermapId.trim();
    if (eventData.rewards.procgenFilename.trim()) props.procgen_filename = eventData.rewards.procgenFilename.trim();
    if (eventData.rewards.procgenLink.trim()) props.procgen_link = eventData.rewards.procgenLink.trim();
    if (eventData.rewards.procgenDoorLevel.trim()) props.procgen_door_level = eventData.rewards.procgenDoorLevel.trim();

    // NEW: Restore
    if (eventData.rewards.restore.trim()) props.restore = eventData.rewards.restore.trim();

    // NEW: NPC / Music / Book
    if (eventData.rewards.npc.trim()) props.npc = eventData.rewards.npc.trim();
    if (eventData.rewards.music.trim()) props.music = eventData.rewards.music.trim();
    if (eventData.rewards.book.trim()) props.book = eventData.rewards.book.trim();

    // NEW: Advanced
    if (eventData.rewards.respec) props.respec = 'true';
    if (eventData.rewards.showOnMinimap) props.show_on_minimap = 'true';
    if (eventData.rewards.parallaxLayers.trim()) props.parallax_layers = eventData.rewards.parallaxLayers.trim();
    if (eventData.rewards.randomStatus.trim()) props.random_status = eventData.rewards.randomStatus.trim();

    Object.assign(props, eventExtraPropsFrom(extraRows));

    return props;
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
    const { coordinates, size } = eventData.positioning;
    const flareActivate = ACTIVATION_TO_FLARE[eventData.timing.activeActivation || ''] || 'on_trigger';
    const props = instancePropertiesFrom(buildProps());
    const existing = isEditing && typeof editor.getMapObjects === 'function'
      ? (editor.getMapObjects() as Array<{ id: number; properties?: Record<string, string | string[]> }>)
        .find((object) => object.id === editingEventId)
      : undefined;
    let script = normalizeEventScriptPath(eventData.engine.script || props.script);
    const leftover = actionPropertiesFrom(existing?.properties);
    if (!script && leftover.length && currentProjectPath && window.electronAPI?.writeFile) {
      const stamp = `${(currentMapName || 'map').replace(/[^A-Za-z0-9]+/g, '_')}_${coordinates.x}_${coordinates.y}`;
      script = eventScriptRelPath(stamp);
      const abs = `${currentProjectPath.replace(/\\/g, '/')}/${script}`;
      await window.electronAPI.writeFile(abs, mergeEventScript('', { header: '', steps: [{ components: leftover }] }));
      onScriptSaved?.();
    }
    if (script) props.script = script;
    const properties = instancePropertiesFrom(mergeEventFormProperties(existing?.properties, props));
    if (script) properties.script = script;

    if (isEditing && typeof editor.updateMapObject === 'function' && editingEventId != null) {
      editor.updateMapObject(editingEventId, {
        name: eventData.name || 'Event',
        description: eventData.description || '',
        type: 'event',
        activate: flareActivate,
        x: coordinates.x,
        y: coordinates.y,
        width: size.width,
        height: size.height,
        properties
      });
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
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Event</div>
            <div className="flex flex-wrap items-center gap-2">
              <HintLabel className="text-xs font-normal w-16 shrink-0" hint="This instance runs the event script. Changing the script changes every place that uses it.">script</HintLabel>
              <Input
                width="path"
                className="h-7 text-xs"
                list={EVENT_SCRIPT_LIST_ID}
                value={eventData.engine.script}
                onChange={(e) => setEventData((prev) => ({ ...prev, engine: { ...prev.engine, script: e.target.value } }))}
              />
              {normalizeEventScriptPath(eventData.engine.script) ? (
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onEditScript?.(normalizeEventScriptPath(eventData.engine.script))}>
                  Edit event
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-2 px-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Procgen</div>
            {extraProcgenEvents((typeof editor?.getMapObjects === 'function' ? editor.getMapObjects() : []).filter((obj: { type?: string }) => obj.type === 'event'), editingEventId).length ? (
              <p className="text-[11px] leading-snug text-amber-500">
                The engine only uses the first rules file on this map. Another event already has one.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <HintLabel className="text-xs font-normal w-28 shrink-0" hint="procgen_filename. Rules file under maps/procgen_rules. The engine fills this event's location rectangle when the map loads. Only the first event with procgen_filename on this map is used, and it must be on the map event itself, not in a script file. intermap_random is a different feature: a random teleport map list, not a procgen rules file.">Rules file</HintLabel>
              <Input
                width="path"
                className="h-7 text-xs"
                list={PROCGEN_RULES_LIST_ID}
                value={eventData.rewards.procgenFilename}
                onChange={(e) => setEventData((prev) => ({ ...prev, rewards: { ...prev.rewards, procgenFilename: e.target.value } }))}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <HintLabel className="text-xs font-normal w-28 shrink-0" hint="procgen_link. Only used on chunk maps with procgen_type=links. north, south, west, or east.">Link side</HintLabel>
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
              <HintLabel className="text-xs font-normal w-28 shrink-0" hint="procgen_door_level. For procedural generation chunks only. The event is active on these door levels (comma-separated integers).">Door level</HintLabel>
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
    </>
  );

  return createPortal(dialogContent, document.body);
};

export default EventDialog;


