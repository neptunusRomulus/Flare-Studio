/**
 * Dialogue Editor Types for Flare Engine 1.14
 * 
 * Mental Model:
 * - Left side: Dialog content (text, portraits, responses)
 * - Right side: Effects (conditions, rewards, world/flow)
 * 
 * Serializes to: dialog.*, event.*, quest.* attributes
 */

// ============================================
// CONDITION TYPES (event.requires_*)
// ============================================

export type ConditionType =
  | 'requires_level'
  | 'requires_not_level'
  | 'requires_currency'
  | 'requires_not_currency'
  | 'requires_item'
  | 'requires_not_item'
  | 'requires_status'
  | 'requires_not_status'
  | 'requires_class'
  | 'requires_not_class';

export interface BaseCondition {
  id: string;
  type: ConditionType;
}

export interface LevelCondition extends BaseCondition {
  type: 'requires_level' | 'requires_not_level';
  level: number;
}

export interface CurrencyCondition extends BaseCondition {
  type: 'requires_currency' | 'requires_not_currency';
  amount: number;
}

export interface ItemCondition extends BaseCondition {
  type: 'requires_item' | 'requires_not_item';
  itemId: string;
  quantity: number;
}

export interface StatusCondition extends BaseCondition {
  type: 'requires_status' | 'requires_not_status';
  statuses: string[]; // comma-separated in serialization
}

export interface ClassCondition extends BaseCondition {
  type: 'requires_class' | 'requires_not_class';
  classes: string[]; // comma-separated in serialization
}

export type DialogCondition =
  | LevelCondition
  | CurrencyCondition
  | ItemCondition
  | StatusCondition
  | ClassCondition;

// ============================================
// REWARD/EFFECT TYPES (event.reward_*, event.remove_*, event.restore)
// ============================================

export type RewardEffectType =
  | 'reward_xp'
  | 'reward_currency'
  | 'remove_currency'
  | 'reward_item'
  | 'remove_item'
  | 'reward_loot'
  | 'restore';

export interface BaseRewardEffect {
  id: string;
  type: RewardEffectType;
}

export interface XPRewardEffect extends BaseRewardEffect {
  type: 'reward_xp';
  amount: number;
}

export interface CurrencyRewardEffect extends BaseRewardEffect {
  type: 'reward_currency' | 'remove_currency';
  amount: number;
}

export interface ItemRewardEffect extends BaseRewardEffect {
  type: 'reward_item' | 'remove_item';
  itemId: string;
  quantity: number;
}

export interface LootRewardEffect extends BaseRewardEffect {
  type: 'reward_loot';
  lootTable: string;
  countMin: number;
  countMax: number;
}

export type RestoreType = 'hp' | 'mp' | 'hpmp' | 'status' | 'all';

export interface RestoreEffect extends BaseRewardEffect {
  type: 'restore';
  restoreType: RestoreType;
}

export type DialogRewardEffect =
  | XPRewardEffect
  | CurrencyRewardEffect
  | ItemRewardEffect
  | LootRewardEffect
  | RestoreEffect;

// ============================================
// WORLD & FLOW TYPES (Advanced - event.*)
// ============================================

export type TeleportMode = 'intramap' | 'intermap' | 'intermap_random';

export interface TeleportConfig {
  enabled: boolean;
  mode: TeleportMode;
  // For intramap
  x?: number;
  y?: number;
  // For intermap
  mapFile?: string;
  // For intermap_random
  mapFiles?: string[];
}

export interface SpawnConfig {
  enabled: boolean;
  category: string;
  x?: number;
  y?: number;
}

export interface MapModConfig {
  enabled: boolean;
  mapModFile: string;
}

export interface AudioConfig {
  soundFx?: string;
  music?: string;
  shakyCam?: boolean;
}

export interface CutsceneConfig {
  enabled: boolean;
  cutsceneFile: string;
}

export interface StatusChangeConfig {
  setStatuses: string[];
  unsetStatuses: string[];
}

export interface NPCInteractionConfig {
  enabled: boolean;
  npcFile: string;
}

export interface BookConfig {
  enabled: boolean;
  bookFile: string;
}

export interface StashConfig {
  enabled: boolean;
}

export interface AdvancedMiscConfig {
  chanceExec?: number; // 0-100
  repeat?: boolean;
  saveGame?: boolean;
  respec?: boolean;
  scriptFile?: string;
  showOnMinimap?: boolean;
}

export interface PowerConfig {
  enabled: boolean;
  powerId?: string;
  powerPath?: string;
  powerDamage?: number;
}

export interface WorldFlowConfig {
  teleport: TeleportConfig;
  spawn: SpawnConfig;
  mapMod: MapModConfig;
  audio: AudioConfig;
  cutscene: CutsceneConfig;
  statusChange: StatusChangeConfig;
  npcInteraction: NPCInteractionConfig;
  book: BookConfig;
  stash: StashConfig;
  power: PowerConfig;
  advanced: AdvancedMiscConfig;
}

// ============================================
// DIALOG NODE - Main Structure
// ============================================

export interface DialogResponse {
  id: string;
  text: string; // What player says to choose this
  targetNodeId: string; // Which dialog node this leads to
}

export interface DialogNode {
  id: string;
  // Dialog content (left panel)
  npcText: string; // dialog.him or dialog.her
  npcGender: 'him' | 'her';
  playerText: string; // dialog.you
  npcPortrait: string; // dialog.portrait_him or dialog.portrait_her
  playerPortrait: string; // dialog.portrait_you
  responses: DialogResponse[]; // dialog.response entries
  allowMovement: boolean; // dialog.allow_movement
  
  // Effects (right panel)
  conditions: DialogCondition[];
  rewards: DialogRewardEffect[];
  worldFlow: WorldFlowConfig;
}

// ============================================
// DIALOG TREE - Container for all nodes
// ============================================

export interface DialogTree {
  id: string;
  name: string;
  description?: string;
  rootNodeId: string;
  nodes: DialogNode[];
}

// ============================================
// UI STATE TYPES
// ============================================

export interface DialogEditorState {
  activeTree: DialogTree | null;
  activeNodeId: string | null;
  expandedPanels: {
    conditions: boolean;
    rewards: boolean;
    worldFlow: boolean;
  };
  showRawAttributes: boolean;
}

// ============================================
// FACTORY FUNCTIONS
// ============================================

export function createDefaultWorldFlowConfig(): WorldFlowConfig {
  return {
    teleport: { enabled: false, mode: 'intramap' },
    spawn: { enabled: false, category: '' },
    mapMod: { enabled: false, mapModFile: '' },
    audio: {},
    cutscene: { enabled: false, cutsceneFile: '' },
    statusChange: { setStatuses: [], unsetStatuses: [] },
    npcInteraction: { enabled: false, npcFile: '' },
    book: { enabled: false, bookFile: '' },
    stash: { enabled: false },
    power: { enabled: false },
    advanced: {}
  };
}

export function createDefaultDialogNode(id?: string): DialogNode {
  return {
    id: id || `node_${Date.now()}`,
    npcText: '',
    npcGender: 'him',
    playerText: '',
    npcPortrait: '',
    playerPortrait: '',
    responses: [],
    allowMovement: false,
    conditions: [],
    rewards: [],
    worldFlow: createDefaultWorldFlowConfig()
  };
}

export function createDefaultDialogTree(id?: string, name?: string): DialogTree {
  const rootNode = createDefaultDialogNode('root');
  return {
    id: id || `tree_${Date.now()}`,
    name: name || 'New Dialogue',
    rootNodeId: rootNode.id,
    nodes: [rootNode]
  };
}

// Condition factory helpers
export function createCondition(type: ConditionType): DialogCondition {
  const id = `cond_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  switch (type) {
    case 'requires_level':
    case 'requires_not_level':
      return { id, type, level: 1 };
    case 'requires_currency':
    case 'requires_not_currency':
      return { id, type, amount: 0 };
    case 'requires_item':
    case 'requires_not_item':
      return { id, type, itemId: '', quantity: 1 };
    case 'requires_status':
    case 'requires_not_status':
      return { id, type, statuses: [] };
    case 'requires_class':
    case 'requires_not_class':
      return { id, type, classes: [] };
  }
}

// Reward effect factory helpers
export function createRewardEffect(type: RewardEffectType): DialogRewardEffect {
  const id = `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  switch (type) {
    case 'reward_xp':
      return { id, type, amount: 0 };
    case 'reward_currency':
    case 'remove_currency':
      return { id, type, amount: 0 };
    case 'reward_item':
    case 'remove_item':
      return { id, type, itemId: '', quantity: 1 };
    case 'reward_loot':
      return { id, type, lootTable: '', countMin: 1, countMax: 1 };
    case 'restore':
      return { id, type, restoreType: 'all' };
  }
}

// ============================================
// HUMAN-READABLE LABELS
// ============================================

export const CONDITION_LABELS: Record<ConditionType, string> = {
  requires_level: 'Requires level at least',
  requires_not_level: 'Hide if level is at least',
  requires_currency: 'Requires at least gold',
  requires_not_currency: 'Hide if player has at least gold',
  requires_item: 'Requires item',
  requires_not_item: 'Hide if player has item',
  requires_status: 'Requires status',
  requires_not_status: 'Hide if has status',
  requires_class: 'Only for classes',
  requires_not_class: 'Hide for classes'
};

export const REWARD_EFFECT_LABELS: Record<RewardEffectType, string> = {
  reward_xp: 'Give XP',
  reward_currency: 'Give gold',
  remove_currency: 'Take gold',
  reward_item: 'Give item',
  remove_item: 'Take item',
  reward_loot: 'Random loot',
  restore: 'Heal / Restore'
};

export const RESTORE_TYPE_LABELS: Record<RestoreType, string> = {
  hp: 'Restore HP only',
  mp: 'Restore MP only',
  hpmp: 'Restore HP & MP',
  status: 'Clear negative status effects',
  all: 'Full restore (HP, MP, Status)'
};
