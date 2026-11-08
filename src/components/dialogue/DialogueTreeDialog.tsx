import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlignLeft, ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Coins, Eye, EyeOff, Fingerprint, Gift, HelpCircle, Image, Link2, MessageSquare, Package, Plus, Save, Shield, Tag, User, Volume2, X, Zap } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';
import { useDraggableResizable } from '@/hooks/useDraggableResizable';
import { useAppContext } from '@/context/AppContext';
import type { DialogueLine, DialogueRequirement, DialogueReward, DialogueWorldEffect, DialogueTree, MapObject } from '@/types';
import { InlineConfirm } from '@/components/ui/inline-confirm';
import { AnchoredConfirm } from '@/components/ui/inline-confirm';

/** Generate a short unique dialogue ID like "dlg_a3f9" */
function generateDialogueId(): string {
  return 'dlg_' + Math.random().toString(36).substring(2, 6);
}

/** Requirement type config for labels/placeholders */
const REQ_CONFIG: Record<DialogueRequirement['type'], { label: string; placeholder: string }> = {
  status: { label: 'Has Status', placeholder: 'e.g. quest_started' },
  not_status: { label: 'Missing Status', placeholder: 'e.g. quest_completed' },
  item: { label: 'Has Item', placeholder: 'Item ID:qty (e.g. 1002:1)' },
  not_item: { label: 'Has Not Item', placeholder: 'Item ID:qty (e.g. 1002:1)' },
  level: { label: 'Min Level', placeholder: 'e.g. 5' },
  not_level: { label: 'Max Level', placeholder: 'e.g. 10' },
  currency: { label: 'Min Currency', placeholder: 'e.g. 100' },
  not_currency: { label: 'Max Currency', placeholder: 'e.g. 500' },
  class: { label: 'Has Class', placeholder: 'e.g. warrior' },
  not_class: { label: 'Has Not Class', placeholder: 'e.g. ranger' },
  tile: { label: 'Has Tile', placeholder: 'layer,x,y,tile_id' },
  not_tile: { label: 'Has Not Tile', placeholder: 'layer,x,y,tile_id' },
};

/** Visual branching panel: shows arrow connections between nodes */
const BranchingPanel: React.FC<{
  trees: DialogueTree[];
  activeTab: number;
  onNavigate: (index: number) => void;
}> = ({ trees, activeTab, onNavigate }) => {
  // Build links: for each tree that has responses, find target trees
  const links = useMemo(() => {
    const result: { fromIdx: number; fromTopic: string; toIdx: number; toTopic: string; toDialogueId: string }[] = [];
    for (let i = 0; i < trees.length; i++) {
      const responses = trees[i].responses || [];
      for (const respId of responses) {
        if (!respId) continue;
        const targetIdx = trees.findIndex(t => t.dialogueId === respId);
        if (targetIdx !== -1) {
          result.push({
            fromIdx: i,
            fromTopic: trees[i].topic || `Dialogue ${i + 1}`,
            toIdx: targetIdx,
            toTopic: trees[targetIdx].topic || `Dialogue ${targetIdx + 1}`,
            toDialogueId: respId,
          });
        }
      }
    }
    return result;
  }, [trees]);

  // Also find which trees reference the active tab as a response target
  const incomingLinks = useMemo(() => {
    const activeDialogueId = trees[activeTab]?.dialogueId;
    if (!activeDialogueId) return [];
    return links.filter(l => l.toDialogueId === activeDialogueId);
  }, [links, trees, activeTab]);

  const outgoingLinks = useMemo(() => {
    return links.filter(l => l.fromIdx === activeTab);
  }, [links, activeTab]);

  if (links.length === 0) return null;

  return (
    <div className="border rounded-md bg-muted/20 p-2 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Link2 className="w-3 h-3" />
        Response Links
      </div>
      {incomingLinks.length > 0 && (
        <div className="space-y-1">
          {incomingLinks.map((link, i) => (
            <button
              key={`in-${i}`}
              type="button"
              onClick={() => onNavigate(link.fromIdx)}
              className="w-full flex items-center gap-1.5 text-[11px] px-2 py-1 rounded hover:bg-muted/50 transition-colors"
            >
              <ArrowLeft className="w-3 h-3 text-blue-400 shrink-0" />
              <span className="text-blue-500 font-medium truncate">{link.fromTopic}</span>
              <ArrowRight className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate">this</span>
            </button>
          ))}
        </div>
      )}
      {outgoingLinks.length > 0 && (
        <div className="space-y-1">
          {outgoingLinks.map((link, i) => (
            <button
              key={`out-${i}`}
              type="button"
              onClick={() => onNavigate(link.toIdx)}
              className="w-full flex items-center gap-1.5 text-[11px] px-2 py-1 rounded hover:bg-muted/50 transition-colors"
            >
              <span className="text-muted-foreground truncate">this</span>
              <ArrowRight className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
              <span className="text-emerald-500 font-medium truncate">{link.toTopic}</span>
              <span className="text-muted-foreground/60 ml-auto text-[10px] shrink-0">{link.toDialogueId}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const parseTeleportValue = (value: string) => {
  const parts = value.split(',');
  const mapFile = parts[0] || '';
  return {
    map: mapFile.replace(/^\/?(maps\/)/i, '').replace(/\.txt$/i, ''),
    x: parseInt(parts[1] || '0', 10) || 0,
    y: parseInt(parts[2] || '0', 10) || 0,
  };
};

const buildTeleportValue = (map: string, x: number, y: number) => {
  const normalizedMap = map.replace(/^\/?(maps\/)/i, '').replace(/\.txt$/i, '');
  if (!normalizedMap) return '';
  return `maps/${normalizedMap}.txt,${x},${y}`;
};

const parseIntramap = (value: string) => {
  const [x = '0', y = '0'] = String(value || '').split(',');
  return { x: parseInt(x, 10) || 0, y: parseInt(y, 10) || 0 };
};
const buildIntramap = (x: number, y: number) => `${x},${y}`;

type AllowMovementTree = { passthrough?: Array<{ key: string; value: string }> };
/** Flare default: movement allowed unless allow_movement=false. */
function allowMovementOf(tree: AllowMovementTree): boolean {
  const entry = [...(tree.passthrough || [])].reverse().find((p) => p.key === 'allow_movement');
  return !entry || !/^(false|0)$/i.test(entry.value.trim());
}
function withAllowMovement(tree: AllowMovementTree, allowed: boolean): Array<{ key: string; value: string }> {
  const list = tree.passthrough || [];
  const has = list.some((p) => p.key === 'allow_movement');
  if (has) return list.map((p) => (p.key === 'allow_movement' ? { ...p, value: String(allowed) } : p));
  return allowed ? list : [...list, { key: 'allow_movement', value: 'false' }];
}

/** take_a_party: NPC joins the player's party while this dialog runs (Flare key). */
function takePartyOf(tree: AllowMovementTree): boolean {
  const entry = [...(tree.passthrough || [])].reverse().find((p) => p.key === 'take_a_party');
  return !!entry && /^(true|1)$/i.test(entry.value.trim());
}
function withTakeParty(tree: AllowMovementTree, joins: boolean): Array<{ key: string; value: string }> {
  const list = tree.passthrough || [];
  const has = list.some((p) => p.key === 'take_a_party');
  if (has) return list.map((p) => (p.key === 'take_a_party' ? { ...p, value: String(joins) } : p));
  return joins ? [...list, { key: 'take_a_party', value: 'true' }] : list;
}

/** reward_loot_count is node-wide in Flare (first one wins); kept in passthrough so its position survives. */
function lootCountOf(tree: AllowMovementTree): { min: string; max: string } {
  const entry = [...(tree.passthrough || [])].reverse().find((p) => p.key === 'reward_loot_count');
  if (!entry) return { min: '', max: '' };
  const [min = '', max = ''] = String(entry.value).split(',');
  return { min: min.trim(), max: max.trim() };
}
function withLootCount(tree: AllowMovementTree, min: string, max: string): Array<{ key: string; value: string }> {
  const list = tree.passthrough || [];
  const value = min.trim() ? (max.trim() ? `${min.trim()},${max.trim()}` : min.trim()) : '';
  const has = list.some((p) => p.key === 'reward_loot_count');
  if (!value) return list.filter((p) => p.key !== 'reward_loot_count');
  if (has) return list.map((p) => (p.key === 'reward_loot_count' ? { ...p, value } : p));
  return [...list, { key: 'reward_loot_count', value }];
}

/** loot_count is node-wide like reward_loot_count, but counts dropped loot (loot=). */
function groundLootCountOf(tree: AllowMovementTree): { min: string; max: string } {
  const entry = [...(tree.passthrough || [])].reverse().find((p) => p.key === 'loot_count');
  if (!entry) return { min: '', max: '' };
  const [min = '', max = ''] = String(entry.value).split(',');
  return { min: min.trim(), max: max.trim() };
}
function withGroundLootCount(tree: AllowMovementTree, min: string, max: string): Array<{ key: string; value: string }> {
  const list = tree.passthrough || [];
  const value = min.trim() ? (max.trim() ? `${min.trim()},${max.trim()}` : min.trim()) : '';
  const has = list.some((p) => p.key === 'loot_count');
  if (!value) return list.filter((p) => p.key !== 'loot_count');
  if (has) return list.map((p) => (p.key === 'loot_count' ? { ...p, value } : p));
  return [...list, { key: 'loot_count', value }];
}

const parseRespec = (value: string) => {
  const [mode = 'stats', ignoreDefaults = ''] = String(value || '').split(',');
  return { mode: mode.trim() || 'stats', ignoreDefaults: /^(true|1)$/i.test(ignoreDefaults.trim()) };
};
const buildRespec = (mode: string, ignoreDefaults: boolean) => `${mode}${ignoreDefaults ? ',true' : ''}`;

/** mapmod: "layer x,y,tile_id"; mapmod_toggle adds a second tile id. */
const parseMapmod = (value: string) => {
  const [layer = '', coords = ''] = String(value || '').trim().split(/\s+/);
  const [x = '0', y = '0', tile = '0', tileB = '0'] = coords.split(',');
  return { layer, x, y, tile, tileB };
};
const buildMapmod = (layer: string, x: string, y: string, tile: string, tileB?: string) => {
  const name = layer.trim();
  if (!name) return '';
  const coords = [x, y, tile].map((v) => (v.trim() === '' ? '0' : v.trim())).join(',');
  return `${name} ${coords}${tileB === undefined ? '' : `,${tileB.trim() === '' ? '0' : tileB.trim()}`}`;
};

/** power_path: "src_x,src_y,hero" or "src_x,src_y,dest_x,dest_y". */
const parsePowerPath = (value: string) => {
  const parts = String(value || '').split(',').map((p) => p.trim());
  const isHero = (parts[2] || '').toLowerCase() === 'hero';
  return {
    srcX: parts[0] || '',
    srcY: parts[1] || '',
    target: isHero ? ('hero' as const) : ('point' as const),
    destX: isHero ? '' : parts[2] || '',
    destY: isHero ? '' : parts[3] || '',
  };
};
const buildPowerPath = (path: ReturnType<typeof parsePowerPath>) =>
  `${path.srcX || 0},${path.srcY || 0},${path.target === 'hero' ? 'hero' : `${path.destX || 0},${path.destY || 0}`}`;

const parsePair = (value: string) => {
  const [a = '', b = ''] = String(value || '').split(',');
  return { a: a.trim(), b: b.trim() };
};
const buildPair = (a: string, b: string) => (a.trim() ? (b.trim() ? `${a.trim()},${b.trim()}` : a.trim()) : '');

/** spawn_level / power_level: "mode", "mode,multiplier" or "mode,multiplier,stat". */
const LEVEL_MODES = [
  { value: 'default', label: 'Default' },
  { value: 'fixed', label: 'Fixed level' },
  { value: 'source_level', label: 'Source level ×' },
  { value: 'hero_level', label: 'Hero level ×' },
  { value: 'source_stat', label: 'Source stat ×' },
  { value: 'hero_stat', label: 'Hero stat ×' },
] as const;
const parseLevelValue = (value: string) => {
  const [mode = 'default', multiplier = '', stat = ''] = String(value || '').split(',').map((p) => p.trim());
  return { mode: LEVEL_MODES.some((m) => m.value === mode) ? mode : 'default', multiplier, stat };
};
const buildLevelValue = (mode: string, multiplier: string, stat: string) => {
  if (mode === 'default') return 'default';
  const mult = multiplier.trim() || '1';
  return mode.endsWith('_stat') ? `${mode},${mult},${stat.trim()}` : `${mode},${mult}`;
};

const EFFECT_GROUPS: Array<{ label: string; options: Array<{ value: DialogueWorldEffect['type']; label: string }> }> = [
  {
    label: 'Player',
    options: [
      { value: 'set_status', label: 'Set Status' },
      { value: 'unset_status', label: 'Clear Status' },
      { value: 'respec', label: 'Respec' },
      { value: 'save_game', label: 'Save Game' },
      { value: 'stash', label: 'Open Stash' },
    ],
  },
  {
    label: 'Travel',
    options: [
      { value: 'teleport', label: 'Teleport to Map' },
      { value: 'intermap_random', label: 'Teleport to Random Map' },
      { value: 'intermap_id', label: 'Spawn Point ID' },
      { value: 'intramap', label: 'Teleport in Map' },
    ],
  },
  {
    label: 'World',
    options: [
      { value: 'spawn', label: 'Spawn Enemy' },
      { value: 'spawn_level', label: 'Spawned Enemy Level' },
      { value: 'cutscene', label: 'Cutscene' },
      { value: 'sound', label: 'Play Sound' },
      { value: 'music', label: 'Change Music' },
      { value: 'shakycam', label: 'Shake Camera' },
      { value: 'npc', label: 'NPC Dialog' },
      { value: 'book', label: 'Open Book' },
      { value: 'script', label: 'Run Script' },
      { value: 'visual_effect', label: 'Visual Effect' },
      { value: 'chance_exec', label: 'Chance to Run' },
    ],
  },
  {
    label: 'Map & Loot',
    options: [
      { value: 'mapmod', label: 'Change Map Tile' },
      { value: 'mapmod_toggle', label: 'Toggle Map Tile' },
      { value: 'loot', label: 'Drop Loot' },
    ],
  },
  {
    label: 'Powers',
    options: [
      { value: 'power', label: 'Cast Power' },
      { value: 'power_path', label: 'Power Path' },
      { value: 'power_damage', label: 'Power Damage' },
      { value: 'power_stats', label: 'Power Stats File' },
      { value: 'power_level', label: 'Power Level' },
    ],
  },
];

const DialogueTreeDialog = ({
  showDialogueTreeDialog,
  dialogueTrees = [],
  setDialogueTrees,
  activeDialogueTab,
  setActiveDialogueTab,
  dialogueTabToDelete,
  setDialogueTabToDelete,
  onClose,
  editingObject,
  updateEditingObjectProperty,
  projectMaps = [],
}: {
  showDialogueTreeDialog: boolean;
  dialogueTrees?: DialogueTree[];
  setDialogueTrees: React.Dispatch<React.SetStateAction<DialogueTree[]>>;
  activeDialogueTab: number;
  setActiveDialogueTab: React.Dispatch<React.SetStateAction<number>>;
  dialogueTabToDelete: number | null;
  setDialogueTabToDelete: React.Dispatch<React.SetStateAction<number | null>>;
  onClose: () => void;
  editingObject: MapObject | null;
  updateEditingObjectProperty: (key: string, value: string | null) => void;
  projectMaps?: string[];
}) => {
  const [editingIdIndex, setEditingIdIndex] = useState<number | null>(null);
  const [pendingIdValue, setPendingIdValue] = useState('');
  const [idConfirmShown, setIdConfirmShown] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { controls } = useAppContext() as any;
  const currentProjectPath = controls?.currentProjectPath ?? null;

  // Fetch project maps locally
  const [localMaps, setLocalMaps] = useState<string[]>([]);
  useEffect(() => {
    if (!showDialogueTreeDialog) return;
    
    if (projectMaps.length > 0) {
      setLocalMaps(projectMaps);
      return;
    }

    if (!currentProjectPath) return;

    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.listMaps) {
      electronAPI.listMaps(currentProjectPath).then((maps: string[]) => {
        if (!cancelled) setLocalMaps(maps ?? []);
      }).catch(() => {
        if (!cancelled) setLocalMaps([]);
      });
    }

    return () => { cancelled = true; };
  }, [showDialogueTreeDialog, projectMaps, currentProjectPath]);


  const {
    position,
    size,
    dialogRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useDraggableResizable({ id: 'dialogue_tree_dialog', initialWidth: 900, initialHeight: 620, minWidth: 700, minHeight: 450 });

  // Escape to close
  useEffect(() => {
    if (!showDialogueTreeDialog) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingIdIndex(null);
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showDialogueTreeDialog, onClose]);

  // Helper to update a tree at the active tab
  const updateTree = useCallback((index: number, updates: Partial<DialogueTree>) => {
    const newTrees = [...dialogueTrees];
    newTrees[index] = { ...newTrees[index], ...updates };
    setDialogueTrees(newTrees);
  }, [dialogueTrees, setDialogueTrees]);

  const setWorldEffect = useCallback((index: number, updates: Partial<DialogueWorldEffect>) => {
    const newTrees = [...dialogueTrees];
    const newWfs = [...(newTrees[activeDialogueTab].worldEffects || [])];
    newWfs[index] = { ...newWfs[index], ...updates };
    newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], worldEffects: newWfs };
    setDialogueTrees(newTrees);
  }, [dialogueTrees, activeDialogueTab, setDialogueTrees]);

  const activeTree = dialogueTrees[activeDialogueTab];

  // Visual effect ids defined in the NPC's [visual_effect] sections (edited property first).
  const visualEffectIds = useMemo(() => {
    try {
      const raw = editingObject?.properties?.npc_visual_effects;
      const text = Array.isArray(raw) ? raw[0] : raw;
      const parsed = JSON.parse(String(text || '[]'));
      if (!Array.isArray(parsed)) return [] as string[];
      return parsed
        .map((fx: unknown) => (Array.isArray(fx) ? (fx.find((e) => e && typeof e === 'object' && (e as { key?: string }).key === 'id') as { value?: string } | undefined)?.value : ''))
        .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
    } catch {
      return [] as string[];
    }
  }, [editingObject]);

  const lootCount = activeTree ? lootCountOf(activeTree) : { min: '', max: '' };
  const groundLootCount = activeTree ? groundLootCountOf(activeTree) : { min: '', max: '' };

  // Collect all dialogueIds for response dropdown
  const allDialogueIds = useMemo(() => {
    return dialogueTrees
      .map((t, i) => ({ dialogueId: t.dialogueId, topic: t.topic, index: i }))
      .filter(t => t.dialogueId);
  }, [dialogueTrees]);

  return (
<>
  {!showDialogueTreeDialog ? null : createPortal(
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
        className="flex items-center justify-between px-4 py-3 border-b border-border cursor-move select-none"
        onMouseDown={handleHeaderMouseDown}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold">Dialogue Trees</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-6 h-6 p-0 hover:bg-transparent"
          onClick={() => { setEditingIdIndex(null); onClose(); }}
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>
    
    <div className="flex-1 flex gap-4 overflow-hidden p-4">
      {/* Tab sidebar */}
      <div className="w-52 flex flex-col border-r pr-4">
        <AnchoredConfirm
          open={dialogueTabToDelete !== null}
          onCancel={() => setDialogueTabToDelete(null)}
          onConfirm={() => {
            const index = dialogueTabToDelete;
            if (index === null) return;
                        const deletedId = dialogueTrees[index].dialogueId;
                        const newTrees = dialogueTrees.filter((_, i) => i !== index).map(t => ({
                          ...t,
                          responses: (t.responses || []).filter(r => r !== deletedId)
                        }));
                        setDialogueTrees(newTrees);
                        setDialogueTabToDelete(null);
                        if (activeDialogueTab >= newTrees.length) {
                          setActiveDialogueTab(Math.max(0, newTrees.length - 1));
                        }
          }}
        />
        <div className="flex-1 space-y-1 overflow-y-auto minimal-scroll">
          {dialogueTrees.map((tree, index) => {
            const hasResponses = (tree.responses || []).length > 0;
            const isResponseOnly = tree.responseOnly;
            const isResponseTarget = dialogueTrees.some(t => (t.responses || []).includes(tree.dialogueId));
            return (
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
                  setEditingIdIndex(null);
                }
              }}
              className={`w-full px-3 py-2 text-left text-sm rounded-md transition-colors ${
                activeDialogueTab === index
                  ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/50'
                  : 'hover:bg-muted border border-transparent'
              }`}
            >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">{tree.topic || `Dialogue ${index + 1}`}</span>
                    {isResponseOnly && <EyeOff className="w-3 h-3 text-amber-500 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1">
                    {tree.dialogueId && (
                      <span className="text-[9px] text-muted-foreground/70 font-mono truncate">{tree.dialogueId}</span>
                    )}
                    {(hasResponses || isResponseTarget) && (
                      <Link2 className="w-2.5 h-2.5 text-blue-400 shrink-0 ml-auto" />
                    )}
                  </div>
                </div>
            </button>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            className="mt-1 w-full gap-1"
            onClick={() => {
              const newTree: DialogueTree = {
                id: String(Date.now()),
                dialogueId: generateDialogueId(),
                topic: '',
                group: undefined,
                responseOnly: false,
                responses: [],
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
        {activeTree && (
          <div className="space-y-4">
            {/* ID & Topic row */}
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <label className="text-xs text-muted-foreground font-medium">Topic</label>
                  <Tooltip content="topic — The name of this dialog topic. Displayed to the player when picking a dialog tree.">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
                <Input
                  value={activeTree.topic}
                  onChange={(e) => updateTree(activeDialogueTab, { topic: e.target.value })}
                  placeholder="Enter dialogue topic..."
                  className="h-8"
                />
              </div>
              <div className="w-20">
                <div className="flex items-center gap-1">
                  <label className="text-xs text-muted-foreground font-medium">Group</label>
                  <Tooltip content="group — Dialogs in the same group are selected randomly (only one is shown). Leave empty for no grouping.">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
                <Input
                  value={activeTree.group || ''}
                  onChange={(e) => updateTree(activeDialogueTab, { group: e.target.value || undefined })}
                  placeholder="—"
                  className="h-8 text-xs"
                />
              </div>
              <div className="w-36">
                <div className="flex items-center gap-1">
                  <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Fingerprint className="w-3 h-3" /> ID
                  </label>
                  <Tooltip content="id — A unique identifier used to reference this dialog node. Other nodes can link to it via response connections.">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                  </Tooltip>
                </div>
                {editingIdIndex === activeDialogueTab ? (
                  <div className="space-y-1">
                    <InlineConfirm
                      open={idConfirmShown}
                      onCancel={() => { setEditingIdIndex(null); setIdConfirmShown(false); }}
                      onConfirm={() => {
                              const oldId = activeTree.dialogueId;
                              // Update all trees that reference the old ID
                              const newTrees = dialogueTrees.map((t, i) => {
                                if (i === activeDialogueTab) {
                                  return { ...t, dialogueId: pendingIdValue };
                                }
                                return {
                                  ...t,
                                  responses: (t.responses || []).map(r => r === oldId ? pendingIdValue : r)
                                };
                              });
                              setDialogueTrees(newTrees);
                              setEditingIdIndex(null);
                              setIdConfirmShown(false);
                      }}
                    >
                    <Input
                      value={pendingIdValue}
                      onChange={(e) => setPendingIdValue(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && pendingIdValue.trim()) {
                          setIdConfirmShown(true);
                        } else if (e.key === 'Escape') {
                          setEditingIdIndex(null);
                          setIdConfirmShown(false);
                        }
                      }}
                      className="h-8 text-xs font-mono"
                      autoFocus
                    />
                    </InlineConfirm>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingIdIndex(activeDialogueTab);
                      setPendingIdValue(activeTree.dialogueId || '');
                      setIdConfirmShown(false);
                    }}
                    className="h-8 w-full px-2 text-xs font-mono text-left border rounded-md bg-background hover:bg-muted/50 truncate"
                    title={activeTree.dialogueId || 'No ID'}
                  >
                    {activeTree.dialogueId || '—'}
                  </button>
                )}
              </div>
            </div>

            {/* Response Only toggle */}
            <div className="flex items-center gap-2">
              <Switch
                checked={activeTree.responseOnly || false}
                onCheckedChange={(checked) => updateTree(activeDialogueTab, { responseOnly: checked })}
                className="scale-75"
              />
              <span className="text-xs text-muted-foreground">
                Response Only
              </span>
              <span className="text-[10px] text-muted-foreground/60">
                — hidden from topic list, only reachable via response link
              </span>
            </div>

            {/* allow_movement (kept in passthrough so its file position is unchanged) */}
            <div className="flex items-center gap-2">
              <Switch
                checked={allowMovementOf(activeTree)}
                onCheckedChange={(checked) => updateTree(activeDialogueTab, { passthrough: withAllowMovement(activeTree, checked) })}
                className="scale-75"
              />
              <Tooltip content="allow_movement: when off, the player can't move while this dialog is open.">
                <span className="text-xs text-muted-foreground">Allow Movement</span>
              </Tooltip>
            </div>

            {/* take_a_party (passthrough keeps the original line position) */}
            <div className="flex items-center gap-2">
              <Switch
                checked={takePartyOf(activeTree)}
                onCheckedChange={(checked) => updateTree(activeDialogueTab, { passthrough: withTakeParty(activeTree, checked) })}
                className="scale-75"
              />
              <Tooltip content="take_a_party: the NPC joins or leaves the player's party while this dialog runs.">
                <span className="text-xs text-muted-foreground">Take a Party</span>
              </Tooltip>
            </div>

            {/* Response Links (outgoing) */}
            <div className="border rounded-md">
              <button
                type="button"
                onClick={() => updateTree(activeDialogueTab, { _respExpanded: !((activeTree as any)._respExpanded) } as any)}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium hover:bg-muted/50 rounded-t-md"
              >
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-blue-400" />
                  <span>Player Responses ({(activeTree.responses || []).filter(Boolean).length})</span>
                </div>
                {(activeTree as any)._respExpanded
                  ? <ChevronUp className="w-4 h-4" />
                  : <ChevronDown className="w-4 h-4" />}
              </button>
              {(activeTree as any)._respExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-xs text-muted-foreground">After this dialog text, show these as clickable player choices:</p>
                  {(activeTree.responses || []).map((respId, respIndex) => (
                    <div key={respIndex} className="flex gap-2 items-center bg-blue-500/5 border-l-2 border-l-blue-500/50 rounded-md p-2">
                      <ArrowRight className="w-3 h-3 text-blue-400 shrink-0" />
                      <select
                        value={respId}
                        onChange={(e) => {
                          const newResponses = [...(activeTree.responses || [])];
                          newResponses[respIndex] = e.target.value;
                          updateTree(activeDialogueTab, { responses: newResponses });
                        }}
                        className="h-7 px-2 rounded border text-[11px] bg-background cursor-pointer flex-1"
                      >
                        <option value="">Select target...</option>
                        {allDialogueIds
                          .filter(t => t.index !== activeDialogueTab)
                          .map(t => (
                            <option key={t.dialogueId} value={t.dialogueId}>
                              {t.topic || `Dialogue ${t.index + 1}`} ({t.dialogueId})
                            </option>
                          ))}
                      </select>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          const newResponses = (activeTree.responses || []).filter((_, i) => i !== respIndex);
                          updateTree(activeDialogueTab, { responses: newResponses });
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
                      updateTree(activeDialogueTab, { responses: [...(activeTree.responses || []), ''] });
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    Add Response Link
                  </Button>
                </div>
              )}
            </div>

            {/* Visual branching arrows */}
            <BranchingPanel
              trees={dialogueTrees}
              activeTab={activeDialogueTab}
              onNavigate={(idx) => { setActiveDialogueTab(idx); setEditingIdIndex(null); }}
            />
            
            {/* Requirements - Expandable */}
            <div className="border rounded-md">
              <button
                type="button"
                onClick={() => updateTree(activeDialogueTab, { _reqExpanded: !activeTree._reqExpanded })}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium hover:bg-muted/50 rounded-t-md"
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                  <span>Visibility Conditions ({activeTree.requirements.length})</span>
                </div>
                {activeTree._reqExpanded 
                  ? <ChevronUp className="w-4 h-4" /> 
                  : <ChevronDown className="w-4 h-4" />}
              </button>
              {activeTree._reqExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  {activeTree.requirements.length === 0 && (
                    <p className="text-xs text-muted-foreground py-1">Everyone can see this dialogue. Add conditions to restrict it.</p>
                  )}
                  {activeTree.requirements.map((req, reqIndex) => {
                    const config = REQ_CONFIG[req.type] || REQ_CONFIG.status;
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
                          <optgroup label="Status">
                            <option value="status">Has Status</option>
                            <option value="not_status">Missing Status</option>
                          </optgroup>
                          <optgroup label="Items">
                            <option value="item">Has Item</option>
                            <option value="not_item">Has Not Item</option>
                          </optgroup>
                          <optgroup label="Level">
                            <option value="level">Min Level</option>
                            <option value="not_level">Max Level</option>
                          </optgroup>
                          <optgroup label="Currency">
                            <option value="currency">Min Currency</option>
                            <option value="not_currency">Max Currency</option>
                          </optgroup>
                          <optgroup label="Class">
                            <option value="class">Has Class</option>
                            <option value="not_class">Has Not Class</option>
                          </optgroup>
                          <optgroup label="Map">
                            <option value="tile">Has Tile</option>
                            <option value="not_tile">Has Not Tile</option>
                          </optgroup>
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
                onClick={() => updateTree(activeDialogueTab, { _dlgExpanded: !activeTree._dlgExpanded })}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium hover:bg-muted/50 rounded-t-md"
              >
                <div className="flex items-center gap-2">
                  <AlignLeft className="w-4 h-4 text-blue-400" />
                  <span>Dialogues ({activeTree.dialogues.length})</span>
                </div>
                {activeTree._dlgExpanded 
                  ? <ChevronUp className="w-4 h-4" /> 
                  : <ChevronDown className="w-4 h-4" />}
              </button>
              {activeTree._dlgExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  {activeTree.dialogues.map((dlg, dlgIndex) => (
                    <div key={dlg.id} className="space-y-1">
                      <div className="flex gap-2 items-start">
                        <Tooltip content="Click to cycle: NPC (him=), NPC (her=), Player (you=). him and her behave the same in Flare.">
                        <button
                          type="button"
                          onClick={() => {
                            const newTrees = [...dialogueTrees];
                            const newDlgs = [...newTrees[activeDialogueTab].dialogues];
                            const cur = newDlgs[dlgIndex];
                            const { key: _k, ...rest } = cur;
                            newDlgs[dlgIndex] = cur.speaker === 'player'
                              ? { ...rest, speaker: 'npc' }
                              : cur.key === 'her' ? { ...rest, speaker: 'player' } : { ...rest, speaker: 'npc', key: 'her' };
                            newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], dialogues: newDlgs };
                            setDialogueTrees(newTrees);
                          }}
                          className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${
                            dlg.speaker === 'npc'
                              ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/50'
                              : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/50'
                          }`}
                        >
                          {dlg.speaker === 'npc' ? (dlg.key === 'her' ? 'NPC·her' : 'NPC') : 'Player'}
                        </button>
                        </Tooltip>
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
                      {/* Optional voice/portrait for this line */}
                      {(dlg.voice || dlg.portrait) ? (
                        <div className="flex gap-2 ml-14">
                          <div className="flex items-center gap-1 flex-1">
                            <Volume2 className="w-3 h-3 text-muted-foreground shrink-0" />
                            <Input
                              value={dlg.voice || ''}
                              onChange={(e) => {
                                const newTrees = [...dialogueTrees];
                                const newDlgs = [...newTrees[activeDialogueTab].dialogues];
                                newDlgs[dlgIndex] = { ...newDlgs[dlgIndex], voice: e.target.value || undefined };
                                newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], dialogues: newDlgs };
                                setDialogueTrees(newTrees);
                              }}
                              placeholder="Voice file (e.g. intro.ogg)"
                              className="h-6 text-[10px] flex-1"
                            />
                          </div>
                          <div className="flex items-center gap-1 flex-1">
                            <Tooltip content="Portrait side: NPC (portrait_him/her) or Player (portrait_you). Applies from this line on.">
                              <button
                                type="button"
                                className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground shrink-0"
                                onClick={() => {
                                  const newTrees = [...dialogueTrees];
                                  const newDlgs = [...newTrees[activeDialogueTab].dialogues];
                                  const cur = newDlgs[dlgIndex];
                                  const isYou = (cur.portraitKey || (cur.speaker === 'player' ? 'portrait_you' : 'portrait_him')) === 'portrait_you';
                                  newDlgs[dlgIndex] = { ...cur, portraitKey: isYou ? (cur.key === 'her' ? 'portrait_her' : 'portrait_him') : 'portrait_you' };
                                  newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], dialogues: newDlgs };
                                  setDialogueTrees(newTrees);
                                }}
                              >
                                <Image className="w-3 h-3" />
                                {(dlg.portraitKey || (dlg.speaker === 'player' ? 'portrait_you' : 'portrait_him')) === 'portrait_you' ? 'You' : 'NPC'}
                              </button>
                            </Tooltip>
                            <Input
                              value={dlg.portrait || ''}
                              onChange={(e) => {
                                const newTrees = [...dialogueTrees];
                                const newDlgs = [...newTrees[activeDialogueTab].dialogues];
                                newDlgs[dlgIndex] = { ...newDlgs[dlgIndex], portrait: e.target.value || undefined };
                                newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], dialogues: newDlgs };
                                setDialogueTrees(newTrees);
                              }}
                              placeholder="Portrait override"
                              className="h-6 text-[10px] flex-1"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 shrink-0 text-muted-foreground"
                            onClick={() => {
                              const newTrees = [...dialogueTrees];
                              const newDlgs = [...newTrees[activeDialogueTab].dialogues];
                              newDlgs[dlgIndex] = { ...newDlgs[dlgIndex], voice: undefined, portrait: undefined };
                              newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], dialogues: newDlgs };
                              setDialogueTrees(newTrees);
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="ml-14 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          onClick={() => {
                            const newTrees = [...dialogueTrees];
                            const newDlgs = [...newTrees[activeDialogueTab].dialogues];
                            newDlgs[dlgIndex] = { ...newDlgs[dlgIndex], voice: '', portrait: '' };
                            newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], dialogues: newDlgs };
                            setDialogueTrees(newTrees);
                          }}
                        >
                          + voice / portrait
                        </button>
                      )}
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
                onClick={() => updateTree(activeDialogueTab, { _rewExpanded: !activeTree._rewExpanded })}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium hover:bg-muted/50 rounded-t-md"
              >
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-emerald-500" />
                  <span>Rewards ({activeTree.rewards?.length || 0})</span>
                </div>
                {activeTree._rewExpanded 
                  ? <ChevronUp className="w-4 h-4" /> 
                  : <ChevronDown className="w-4 h-4" />}
              </button>
              {activeTree._rewExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-xs text-muted-foreground">What does the player gain or lose?</p>
                  {(activeTree.rewards || []).map((rew, rewIndex) => (
                    <div key={rew.id} className={`flex gap-2 items-center p-2 rounded-md ${
                      rew.type === 'msg' ? 'bg-sky-500/10 border-l-2 border-l-sky-500/50' :
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
                        <option value="msg">Notification</option>
                        <option value="loot">Random loot</option>
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
                        placeholder={
                          rew.type === 'item' || rew.type === 'remove_item' ? 'Item ID...' :
                          rew.type === 'restore' ? 'hp/mp/all' :
                          rew.type === 'msg' ? 'e.g. Quest added.' :
                          rew.type === 'loot' ? 'Loot table or inline loot' :
                          'Amount...'
                        }
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
                      {rew.type === 'loot' && (
                        <>
                          <span className="text-xs text-muted-foreground">×</span>
                          <Input
                            type="number"
                            min={1}
                            value={lootCount.min}
                            placeholder="1"
                            onChange={(e) => updateTree(activeDialogueTab, { passthrough: withLootCount(activeTree, e.target.value, lootCount.max) })}
                            className="h-7 w-14 text-xs"
                            aria-label="Minimum random loot"
                          />
                          <span className="text-xs text-muted-foreground">–</span>
                          <Input
                            type="number"
                            min={1}
                            value={lootCount.max}
                            placeholder="max"
                            onChange={(e) => updateTree(activeDialogueTab, { passthrough: withLootCount(activeTree, lootCount.min || '1', e.target.value) })}
                            className="h-7 w-14 text-xs"
                            aria-label="Maximum random loot"
                          />
                          <Tooltip content="reward_loot_count — minimum and optional maximum amount of random items. In Flare the first count line applies to all reward_loot lines in this dialog.">
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
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
                onClick={() => updateTree(activeDialogueTab, { _wfExpanded: !activeTree._wfExpanded })}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium hover:bg-muted/50 rounded-t-md"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-500" />
                  <span>World Effects ({activeTree.worldEffects?.length || 0})</span>
                  <span className="text-xs text-muted-foreground">(Advanced)</span>
                </div>
                {activeTree._wfExpanded 
                  ? <ChevronUp className="w-4 h-4" /> 
                  : <ChevronDown className="w-4 h-4" />}
              </button>
              {activeTree._wfExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-xs text-muted-foreground">What happens in the world after this?</p>
                  <datalist id="dialogue-visual-effect-ids">
                    {visualEffectIds.map((id) => <option key={id} value={id} />)}
                  </datalist>
                  {(activeTree.worldEffects || []).map((wf, wfIndex) => (
                    <div key={wf.id} className="flex gap-2 items-center p-2 rounded-md bg-purple-500/10 border-l-2 border-l-purple-500/50">
                      <select
                        value={wf.type}
                        onChange={(e) => {
                          const nextType = e.target.value as DialogueWorldEffect['type'];
                          const defaultValue =
                            nextType === 'stash' || nextType === 'save_game' ? 'true'
                            : nextType === 'respec' ? 'stats'
                            : nextType === 'spawn_level' || nextType === 'power_level' ? 'default'
                            : '';
                          setWorldEffect(wfIndex, { type: nextType, value: defaultValue });
                        }}
                        className="h-8 px-2 py-1 rounded-md border text-[11px] bg-background min-w-[110px] cursor-pointer"
                      >
                        {EFFECT_GROUPS.map((group) => (
                          <optgroup key={group.label} label={group.label}>
                            {group.options.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {wf.type === 'teleport' ? (
                        <div className="flex gap-2 flex-1 items-center">
                          <Select
                            value={parseTeleportValue(wf.value).map || '__none__'}
                            onValueChange={(selectedMap) => {
                              const current = parseTeleportValue(wf.value);
                              const mapValue = selectedMap === '__none__' ? '' : selectedMap;
                              const newValue = buildTeleportValue(mapValue, current.x, current.y);
                              const newTrees = [...dialogueTrees];
                              const newWfs = [...(newTrees[activeDialogueTab].worldEffects || [])];
                              newWfs[wfIndex] = { ...newWfs[wfIndex], value: newValue };
                              newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], worldEffects: newWfs };
                              setDialogueTrees(newTrees);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs min-w-[170px]">
                              <SelectValue placeholder="Select map" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="text-xs">None</SelectItem>
                              {localMaps?.map((mapFile) => {
                                const mapLabel = mapFile.replace(/\.(txt|json)$/i, '');
                                return (
                                  <SelectItem key={mapFile} value={mapLabel} className="text-xs">
                                    {mapLabel}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-2 items-center">
                            <div>
                              <label className="text-[10px] text-muted-foreground">X</label>
                              <Input
                                type="number"
                                value={parseTeleportValue(wf.value).x}
                                onChange={(e) => {
                                  const current = parseTeleportValue(wf.value);
                                  const newValue = buildTeleportValue(current.map, parseInt(e.target.value, 10) || 0, current.y);
                                  const newTrees = [...dialogueTrees];
                                  const newWfs = [...(newTrees[activeDialogueTab].worldEffects || [])];
                                  newWfs[wfIndex] = { ...newWfs[wfIndex], value: newValue };
                                  newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], worldEffects: newWfs };
                                  setDialogueTrees(newTrees);
                                }}
                                className="h-7 w-20 text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">Y</label>
                              <Input
                                type="number"
                                value={parseTeleportValue(wf.value).y}
                                onChange={(e) => {
                                  const current = parseTeleportValue(wf.value);
                                  const newValue = buildTeleportValue(current.map, current.x, parseInt(e.target.value, 10) || 0);
                                  const newTrees = [...dialogueTrees];
                                  const newWfs = [...(newTrees[activeDialogueTab].worldEffects || [])];
                                  newWfs[wfIndex] = { ...newWfs[wfIndex], value: newValue };
                                  newTrees[activeDialogueTab] = { ...newTrees[activeDialogueTab], worldEffects: newWfs };
                                  setDialogueTrees(newTrees);
                                }}
                                className="h-7 w-20 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ) : wf.type === 'intramap' ? (
                        <div className="flex gap-2 flex-1 items-center">
                          <label className="text-[10px] text-muted-foreground">X</label>
                          <Input
                            type="number"
                            value={parseIntramap(wf.value).x}
                            onChange={(e) => setWorldEffect(wfIndex, { value: buildIntramap(parseInt(e.target.value, 10) || 0, parseIntramap(wf.value).y) })}
                            className="h-7 w-20 text-xs"
                          />
                          <label className="text-[10px] text-muted-foreground">Y</label>
                          <Input
                            type="number"
                            value={parseIntramap(wf.value).y}
                            onChange={(e) => setWorldEffect(wfIndex, { value: buildIntramap(parseIntramap(wf.value).x, parseInt(e.target.value, 10) || 0) })}
                            className="h-7 w-20 text-xs"
                          />
                          <Tooltip content="intramap — teleports the player within the current map (X, Y).">
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                      ) : wf.type === 'stash' ? (
                        <div className="flex gap-2 flex-1 items-center">
                          <select
                            value={wf.value === 'false' ? 'false' : 'true'}
                            onChange={(e) => setWorldEffect(wfIndex, { value: e.target.value })}
                            className="h-8 px-2 py-1 rounded-md border text-[11px] bg-background cursor-pointer"
                          >
                            <option value="true">Open stash</option>
                            <option value="false">Close stash</option>
                          </select>
                          <Tooltip content="stash — opens the player's stash menu during this dialog.">
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                      ) : wf.type === 'save_game' ? (
                        <div className="flex gap-2 flex-1 items-center">
                          <select
                            value={wf.value === 'true' ? 'true' : 'false'}
                            onChange={(e) => setWorldEffect(wfIndex, { value: e.target.value })}
                            className="h-8 px-2 py-1 rounded-md border text-[11px] bg-background cursor-pointer"
                          >
                            <option value="true">Save game</option>
                            <option value="false">Do not save</option>
                          </select>
                          <Tooltip content="save_game — saves the game and sets the respawn position here.">
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                      ) : wf.type === 'respec' ? (
                        <div className="flex gap-2 flex-1 items-center">
                          <select
                            value={parseRespec(wf.value).mode}
                            onChange={(e) => setWorldEffect(wfIndex, { value: buildRespec(e.target.value, parseRespec(wf.value).ignoreDefaults) })}
                            className="h-8 px-2 py-1 rounded-md border text-[11px] bg-background cursor-pointer"
                          >
                            <option value="stats">Stats</option>
                            <option value="powers">Powers</option>
                            <option value="xp">XP</option>
                          </select>
                          <label className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={parseRespec(wf.value).ignoreDefaults}
                              onChange={(e) => setWorldEffect(wfIndex, { value: buildRespec(parseRespec(wf.value).mode, e.target.checked) })}
                            />
                            Engine defaults
                          </label>
                          <Tooltip content="respec — resets XP, stats or powers. Resetting stats also resets powers; resetting XP also resets stats.">
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                      ) : wf.type === 'visual_effect' ? (
                        <Input
                          list="dialogue-visual-effect-ids"
                          value={wf.value}
                          onChange={(e) => setWorldEffect(wfIndex, { value: e.target.value })}
                          placeholder="Effect ID"
                          className="h-7 text-xs flex-1"
                        />
                      ) : wf.type === 'intermap_id' ? (
                        <div className="flex gap-2 flex-1 items-center">
                          <Input
                            value={wf.value}
                            onChange={(e) => setWorldEffect(wfIndex, { value: e.target.value })}
                            placeholder="Spawn point ID"
                            className="h-7 text-xs flex-1"
                          />
                          <Tooltip content="intermap_id — names this spot so other intermap events can spawn the player here.">
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                      ) : wf.type === 'intermap_random' ? (
                        <div className="flex gap-2 flex-1 items-center">
                          <Input
                            value={wf.value}
                            onChange={(e) => setWorldEffect(wfIndex, { value: e.target.value })}
                            placeholder="Map list file (maps/lists/...)"
                            className="h-7 text-xs flex-1"
                          />
                          <Tooltip content="intermap_random — teleports the player to a random map from a map list file.">
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                      ) : wf.type === 'mapmod' || wf.type === 'mapmod_toggle' ? (
                        <div className="flex gap-1.5 flex-1 items-center">
                          <Input
                            value={parseMapmod(wf.value).layer}
                            onChange={(e) => {
                              const m = parseMapmod(wf.value);
                              setWorldEffect(wfIndex, { value: buildMapmod(e.target.value, m.x, m.y, m.tile, wf.type === 'mapmod_toggle' ? m.tileB : undefined) });
                            }}
                            placeholder="layer"
                            className="h-7 w-24 text-xs"
                          />
                          {(['x', 'y', 'tile'] as const).map((part) => (
                            <Input
                              key={part}
                              type="number"
                              value={parseMapmod(wf.value)[part]}
                              onChange={(e) => {
                                const m = parseMapmod(wf.value);
                                setWorldEffect(wfIndex, { value: buildMapmod(m.layer, part === 'x' ? e.target.value : m.x, part === 'y' ? e.target.value : m.y, part === 'tile' ? e.target.value : m.tile, wf.type === 'mapmod_toggle' ? m.tileB : undefined) });
                              }}
                              placeholder={part === 'tile' ? 'tile' : part.toUpperCase()}
                              className="h-7 w-14 text-xs"
                              aria-label={part}
                            />
                          ))}
                          {wf.type === 'mapmod_toggle' && (
                            <Input
                              type="number"
                              value={parseMapmod(wf.value).tileB}
                              onChange={(e) => {
                                const m = parseMapmod(wf.value);
                                setWorldEffect(wfIndex, { value: buildMapmod(m.layer, m.x, m.y, m.tile, e.target.value) });
                              }}
                              placeholder="alt tile"
                              className="h-7 w-16 text-xs"
                              aria-label="Alternate tile"
                            />
                          )}
                          <Tooltip content={wf.type === 'mapmod_toggle' ? 'mapmod_toggle — layer x,y,tile_a,tile_b: flips between two tiles each time.' : 'mapmod — layer x,y,tile_id: paints one map tile.'}>
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                      ) : wf.type === 'loot' ? (
                        <div className="flex gap-1.5 flex-1 items-center">
                          <Input
                            value={wf.value}
                            onChange={(e) => setWorldEffect(wfIndex, { value: e.target.value })}
                            placeholder="Loot table or inline loot"
                            className="h-7 text-xs flex-1"
                          />
                          <Input
                            type="number"
                            min={1}
                            value={groundLootCount.min}
                            placeholder="1"
                            onChange={(e) => updateTree(activeDialogueTab, { passthrough: withGroundLootCount(activeTree, e.target.value, groundLootCount.max) })}
                            className="h-7 w-14 text-xs"
                            aria-label="Minimum dropped loot"
                          />
                          <span className="text-xs text-muted-foreground">–</span>
                          <Input
                            type="number"
                            min={1}
                            value={groundLootCount.max}
                            placeholder="max"
                            onChange={(e) => updateTree(activeDialogueTab, { passthrough: withGroundLootCount(activeTree, groundLootCount.min || '1', e.target.value) })}
                            className="h-7 w-14 text-xs"
                            aria-label="Maximum dropped loot"
                          />
                          <Tooltip content="loot + loot_count — drops items on the ground near the player (reward_loot puts them in the inventory instead).">
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                      ) : wf.type === 'shakycam' ? (
                        <div className="flex gap-2 flex-1 items-center">
                          <Input
                            type="number"
                            step="0.1"
                            min={0}
                            value={wf.value}
                            onChange={(e) => setWorldEffect(wfIndex, { value: e.target.value })}
                            placeholder="Amplitude"
                            className="h-7 w-24 text-xs"
                          />
                          <Tooltip content="shakycam — shakes the camera; the value is the amplitude.">
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                      ) : wf.type === 'chance_exec' ? (
                        <div className="flex gap-2 flex-1 items-center">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={wf.value}
                            onChange={(e) => setWorldEffect(wfIndex, { value: e.target.value })}
                            placeholder="0–100"
                            className="h-7 w-24 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                          <Tooltip content="chance_exec — percentage chance that the actions in this dialog node run.">
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                      ) : wf.type === 'power' ? (
                        <div className="flex gap-2 flex-1 items-center">
                          <Input
                            type="number"
                            min={0}
                            value={wf.value}
                            onChange={(e) => setWorldEffect(wfIndex, { value: e.target.value })}
                            placeholder="Power ID"
                            className="h-7 w-24 text-xs"
                          />
                          <Tooltip content="power — casts the power from this dialog at the NPC. Add power_path, power_damage, power_stats or power_level rows to shape it.">
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                      ) : wf.type === 'power_path' ? (
                        <div className="flex gap-1.5 flex-1 items-center">
                          {(() => {
                            const path = parsePowerPath(wf.value);
                            const write = (next: Partial<typeof path>) => setWorldEffect(wfIndex, { value: buildPowerPath({ ...path, ...next }) });
                            return (
                              <>
                                <Input type="number" value={path.srcX} onChange={(e) => write({ srcX: e.target.value })} placeholder="src X" className="h-7 w-16 text-xs" aria-label="Source X" />
                                <Input type="number" value={path.srcY} onChange={(e) => write({ srcY: e.target.value })} placeholder="src Y" className="h-7 w-16 text-xs" aria-label="Source Y" />
                                <select
                                  value={path.target}
                                  onChange={(e) => write({ target: e.target.value === 'hero' ? 'hero' : 'point' })}
                                  className="h-8 px-2 rounded-md border text-[11px] bg-background cursor-pointer"
                                  aria-label="Path target"
                                >
                                  <option value="point">To point</option>
                                  <option value="hero">To hero</option>
                                </select>
                                {path.target === 'point' && (
                                  <>
                                    <Input type="number" value={path.destX} onChange={(e) => write({ destX: e.target.value })} placeholder="X" className="h-7 w-16 text-xs" aria-label="Destination X" />
                                    <Input type="number" value={path.destY} onChange={(e) => write({ destY: e.target.value })} placeholder="Y" className="h-7 w-16 text-xs" aria-label="Destination Y" />
                                  </>
                                )}
                                <Tooltip content="power_path — source X/Y then either the hero or a destination tile.">
                                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </Tooltip>
                              </>
                            );
                          })()}
                        </div>
                      ) : wf.type === 'power_damage' ? (
                        <div className="flex gap-1.5 flex-1 items-center">
                          <Input
                            type="number"
                            value={parsePair(wf.value).a}
                            onChange={(e) => setWorldEffect(wfIndex, { value: buildPair(e.target.value, parsePair(wf.value).b) })}
                            placeholder="min"
                            className="h-7 w-20 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">–</span>
                          <Input
                            type="number"
                            value={parsePair(wf.value).b}
                            onChange={(e) => setWorldEffect(wfIndex, { value: buildPair(parsePair(wf.value).a, e.target.value) })}
                            placeholder="max"
                            className="h-7 w-20 text-xs"
                          />
                          <Tooltip content="power_damage — min and max damage of the cast power.">
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                      ) : wf.type === 'power_stats' ? (
                        <div className="flex gap-2 flex-1 items-center">
                          <Input
                            value={wf.value}
                            onChange={(e) => setWorldEffect(wfIndex, { value: e.target.value })}
                            placeholder="Stat file for the spawner"
                            className="h-7 text-xs flex-1"
                          />
                          <Tooltip content="power_stats — stat file the power spawner uses.">
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                      ) : wf.type === 'power_level' || wf.type === 'spawn_level' ? (
                        <div className="flex gap-1.5 flex-1 items-center">
                          {(() => {
                            const level = parseLevelValue(wf.value);
                            const write = (next: Partial<typeof level>) => setWorldEffect(wfIndex, { value: buildLevelValue(next.mode ?? level.mode, next.multiplier ?? level.multiplier, next.stat ?? level.stat) });
                            return (
                              <>
                                <select
                                  value={level.mode}
                                  onChange={(e) => write({ mode: e.target.value })}
                                  className="h-8 px-2 rounded-md border text-[11px] bg-background cursor-pointer"
                                  aria-label="Level mode"
                                >
                                  {LEVEL_MODES.map((mode) => (
                                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                                  ))}
                                </select>
                                {level.mode !== 'default' && (
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={level.multiplier}
                                    onChange={(e) => write({ multiplier: e.target.value })}
                                    placeholder="×"
                                    className="h-7 w-16 text-xs"
                                    aria-label="Multiplier"
                                  />
                                )}
                                {level.mode.endsWith('_stat') && (
                                  <Input
                                    value={level.stat}
                                    onChange={(e) => write({ stat: e.target.value })}
                                    placeholder="stat id"
                                    className="h-7 w-24 text-xs"
                                    aria-label="Primary stat"
                                  />
                                )}
                                <Tooltip content={wf.type === 'spawn_level' ? 'spawn_level — level of the enemies spawned by this dialog.' : 'power_level — level of this dialog power\'s spawner.'}>
                                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </Tooltip>
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <Input
                          value={wf.value}
                          onChange={(e) => setWorldEffect(wfIndex, { value: e.target.value })}
                          placeholder={
                            wf.type === 'set_status' || wf.type === 'unset_status' ? 'Status tag...' :
                            wf.type === 'spawn' ? 'Enemy category' :
                            wf.type === 'cutscene' ? 'Cutscene file...' :
                            wf.type === 'sound' ? 'Sound file...' :
                            wf.type === 'music' ? 'Music file...' :
                            wf.type === 'book' ? "Book file or 'close'" :
                            wf.type === 'script' ? 'Event file...' :
                            wf.type === 'npc' ? 'NPC file...' : 'Value...'
                          }
                          className="h-7 text-xs flex-1"
                        />
                      )}
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
    
    <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
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
              // fields Studio doesn't edit (passthrough, components, ...) ride along
              ...Object.fromEntries(Object.entries(tree).filter(([k]) => !k.startsWith('_'))),
              id: tree.id,
              dialogueId: tree.dialogueId || '',
              topic: tree.topic,
              group: tree.group || undefined,
              responseOnly: tree.responseOnly || false,
              responses: (tree.responses || []).filter(Boolean),
              requirements: tree.requirements.filter(r => r.value.trim()),
              dialogues: tree.dialogues.filter(d => d.text.trim() || d.keepEmpty).map(d => ({
                ...d,
                id: d.id,
                speaker: d.speaker,
                text: d.text,
                ...(d.voice ? { voice: d.voice } : {}),
                ...(d.portrait ? { portrait: d.portrait } : {}),
              })),
              rewards: (tree.rewards || []).filter(r => r.value.trim() || r.type === 'restore'),
              worldEffects: (tree.worldEffects || []).filter(w => w.value.trim())
            }));
            updateEditingObjectProperty('dialogueTrees', JSON.stringify(cleanTrees));
          }
          onClose();
        }}
      >
        <Save className="w-4 h-4" />
      </Button>
    </div>

    {/* Resize handle */}
    <div
      onMouseDown={handleResizeMouseDown}
      className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-40 hover:opacity-100 transition-opacity flex items-end justify-end"
      title="Drag to resize"
    >
      <div className="w-1.5 h-1.5 bg-foreground/40 rounded-sm m-1" />
    </div>
  </div>,
  document.body
  )}
</>
  );
};

export default DialogueTreeDialog;
