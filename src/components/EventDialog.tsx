import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/context/AppContext';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import {
  eventExtraRowsFrom,
  type EventExtraRow,
} from '@/editor/eventExtraProperties';

import {
  ACTIVATION_TO_FLARE,
  type EventActivation,
  type EventData,
  type EventItemRequirement,
} from '@/components/events/eventDialogModel';
import { buildEventInstanceProps } from '@/components/events/eventInstanceProps';
import { buildEventInstanceUpdate } from '@/components/events/eventInstanceUpdate';
import { writeEventScript } from '@/components/events/eventScriptSave';
import { eventDataFromObject } from '@/components/events/eventDataFromObject';
import EventActionsSection from '@/components/events/EventActionsSection';
import {
  withItemRequirementAdded,
  withItemRequirementRemoved,
  withItemRequirementUpdated,
  withStatusAdded,
  withStatusRemoved,
  withStatusUpdated,
} from '@/components/events/eventRequirementsEdit';
import EventDialogFrame from '@/components/events/EventDialogFrame';
import EventExtraPropertiesSection from '@/components/events/EventExtraPropertiesSection';
import EventGeneratedMapsSection from '@/components/events/EventGeneratedMapsSection';
import EventInformationSection from '@/components/events/EventInformationSection';
import EventPositioningSection from '@/components/events/EventPositioningSection';
import EventRequirementsSection from '@/components/events/EventRequirementsSection';
import EventScriptForm from '@/components/events/EventScriptForm';
import { FieldHint, HintLabel } from '@/components/ui/field-hint';
import { askConfirm } from '@/components/ui/inlineConfirmCore';
import { useRegisterDirty } from '@/context/SaveHealthContext';
import { Input } from '@/components/ui/input';
import { EVENT_SCRIPT_LIST_ID } from '@/hooks/useEventScripts';
import { extraProcgenEvents } from '@/editor/procgenRules';
import RandomDungeonDialog from '@/components/engine/RandomDungeonDialog';
import { parseMapHeader, type MapStyle } from '@/editor/randomDungeon';
import { currentMapFile, dungeonRoomMapName, dungeonSlugForLink, mapStyleFrom } from '@/components/events/dungeonLink';
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

  const handleSave = async () => {
    if (isScript && scriptPath) {
      const result = await writeEventScript({
        projectPath: currentProjectPath,
        scriptPath,
        file: scriptFile,
        io: window.electronAPI,
      });
      if (!result.ok) {
        setScriptError(result.error);
        return;
      }
      setScriptBaseline(result.content);
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
        setEventData(eventDataFromObject({
          properties: p,
          name: obj.name,
          description: obj.description,
          x: obj.x,
          y: obj.y,
          width: obj.width,
          height: obj.height,
          activate: obj.activate,
          mapName: currentMapName,
        }));
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

  const editRequirements = (fn: (reqs: EventData['requirements']) => EventData['requirements']) =>
    setEventData((prev) => ({ ...prev, requirements: fn(prev.requirements) }));

  const addStatusRequirement = () => editRequirements(withStatusAdded);
  const updateStatusRequirement = (index: number, value: string) => editRequirements((reqs) => withStatusUpdated(reqs, index, value));
  const removeStatusRequirement = (index: number) => editRequirements((reqs) => withStatusRemoved(reqs, index));
  const addItemRequirement = () =>
    editRequirements((reqs) => withItemRequirementAdded(reqs, `item-req-${Date.now()}-${Math.random().toString(36).slice(2)}`));
  const updateItemRequirement = (id: string, updates: Partial<Omit<EventItemRequirement, 'id'>>) =>
    editRequirements((reqs) => withItemRequirementUpdated(reqs, id, updates));
  const removeItemRequirement = (id: string) => editRequirements((reqs) => withItemRequirementRemoved(reqs, id));

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
    const ground = typeof editor?.getGroundTileSize === 'function' ? editor.getGroundTileSize() : null;
    let header = null;
    if (root && currentMapName) {
      const text = (await window.electronAPI?.readMapFile?.(root, currentMapFile(currentMapName)).catch(() => '')) || '';
      header = parseMapHeader(text);
    }
    setMapStyle(mapStyleFrom({ ground, header }));

    const raw = eventData.rewards.teleportMap.trim();
    const candidate = dungeonSlugForLink(raw);
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
    const name = dungeonRoomMapName(relPath);
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
      <EventDialogFrame
        title={isScript ? (scriptPath || 'Event') : isEditing ? 'Event instance' : 'Event'}
        position={position}
        size={size}
        dialogRef={dialogRef}
        onHeaderMouseDown={handleHeaderMouseDown}
        onResizeMouseDown={handleResizeMouseDown}
        onClose={() => onOpenChange(false)}
        onSave={handleSave}
      >
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

          <EventActionsSection
            script={eventData.engine.script}
            onScriptChange={(script) => setEventData((prev) => ({ ...prev, engine: { ...prev.engine, script } }))}
            onEditScript={onEditScript}
          />

          <div className="px-1">
            <FieldHint hint="Creates a dungeon, links this event to it, and lets you draw the rooms.">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { void openRandomDungeon(); }}>
                Random dungeon
              </Button>
            </FieldHint>
          </div>

          <EventGeneratedMapsSection
            values={{
              filename: eventData.rewards.procgenFilename,
              link: eventData.rewards.procgenLink,
              doorLevel: eventData.rewards.procgenDoorLevel,
            }}
            conflicting={extraProcgenEvents((typeof editor?.getMapObjects === 'function' ? editor.getMapObjects() : []).filter((obj: { type?: string }) => obj.type === 'event'), editingEventId).length > 0}
            onChange={(patch) => setEventData((prev) => ({ ...prev, rewards: { ...prev.rewards, ...patch } }))}
          />

          <EventExtraPropertiesSection rows={extraRows} onRowsChange={setExtraRows} />
          </>
          )}
      </EventDialogFrame>

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


