/**
 * Serialization Utilities for Flare Engine 1.14 Dialog/Event Attributes
 * 
 * Converts between our internal DialogNode model and raw Flare TXT attributes.
 */

import {
  DialogNode,
  DialogCondition,
  DialogRewardEffect,
  WorldFlowConfig,
  LevelCondition,
  CurrencyCondition,
  ItemCondition,
  StatusCondition,
  ClassCondition,
  XPRewardEffect,
  CurrencyRewardEffect,
  ItemRewardEffect,
  LootRewardEffect,
  RestoreEffect,
  RestoreType
} from '../types/dialogueEditor';

// ============================================
// CONDITION SERIALIZATION
// ============================================

export function serializeCondition(condition: DialogCondition): string {
  switch (condition.type) {
    case 'requires_level':
      return `requires_level=${(condition as LevelCondition).level}`;
    case 'requires_not_level':
      return `requires_not_level=${(condition as LevelCondition).level}`;
    case 'requires_currency':
      return `requires_currency=${(condition as CurrencyCondition).amount}`;
    case 'requires_not_currency':
      return `requires_not_currency=${(condition as CurrencyCondition).amount}`;
    case 'requires_item': {
      const c = condition as ItemCondition;
      return `requires_item=${c.itemId}:${c.quantity}`;
    }
    case 'requires_not_item': {
      const c = condition as ItemCondition;
      return `requires_not_item=${c.itemId}:${c.quantity}`;
    }
    case 'requires_status':
      return `requires_status=${(condition as StatusCondition).statuses.join(',')}`;
    case 'requires_not_status':
      return `requires_not_status=${(condition as StatusCondition).statuses.join(',')}`;
    case 'requires_class':
      return `requires_class=${(condition as ClassCondition).classes.join(',')}`;
    case 'requires_not_class':
      return `requires_not_class=${(condition as ClassCondition).classes.join(',')}`;
  }
}

export function serializeConditions(conditions: DialogCondition[]): string[] {
  return conditions.map(c => serializeCondition(c));
}

export function parseCondition(line: string): DialogCondition | null {
  const match = line.match(/^(requires_\w+)=(.+)$/);
  if (!match) return null;
  
  const [, type, value] = match;
  const id = `cond_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  switch (type) {
    case 'requires_level':
    case 'requires_not_level':
      return { id, type: type as 'requires_level' | 'requires_not_level', level: parseInt(value, 10) };
    case 'requires_currency':
    case 'requires_not_currency':
      return { id, type: type as 'requires_currency' | 'requires_not_currency', amount: parseInt(value, 10) };
    case 'requires_item':
    case 'requires_not_item': {
      const [itemId, qty] = value.split(':');
      return { id, type: type as 'requires_item' | 'requires_not_item', itemId, quantity: parseInt(qty, 10) || 1 };
    }
    case 'requires_status':
    case 'requires_not_status': {
      return { id, type: type as 'requires_status' | 'requires_not_status', statuses: value.split(',').map(s => s.trim()) };
    }
    case 'requires_class':
    case 'requires_not_class': {
      return { id, type: type as 'requires_class' | 'requires_not_class', classes: value.split(',').map(s => s.trim()) };
    }
    default:
      return null;
  }
}

// ============================================
// REWARD EFFECT SERIALIZATION
// ============================================

export function serializeRewardEffect(effect: DialogRewardEffect): string[] {
  const lines: string[] = [];
  
  switch (effect.type) {
    case 'reward_xp':
      lines.push(`reward_xp=${(effect as XPRewardEffect).amount}`);
      break;
    case 'reward_currency':
      lines.push(`reward_currency=${(effect as CurrencyRewardEffect).amount}`);
      break;
    case 'remove_currency':
      lines.push(`remove_currency=${(effect as CurrencyRewardEffect).amount}`);
      break;
    case 'reward_item': {
      const e = effect as ItemRewardEffect;
      lines.push(`reward_item=${e.itemId}:${e.quantity}`);
      break;
    }
    case 'remove_item': {
      const e = effect as ItemRewardEffect;
      lines.push(`remove_item=${e.itemId}:${e.quantity}`);
      break;
    }
    case 'reward_loot': {
      const e = effect as LootRewardEffect;
      lines.push(`reward_loot=${e.lootTable}`);
      if (e.countMin !== 1 || e.countMax !== 1) {
        lines.push(`reward_loot_count=${e.countMin},${e.countMax}`);
      }
      break;
    }
    case 'restore':
      lines.push(`restore=${(effect as RestoreEffect).restoreType}`);
      break;
  }
  
  return lines;
}

export function serializeRewardEffects(effects: DialogRewardEffect[]): string[] {
  return effects.flatMap(e => serializeRewardEffect(e));
}

export function parseRewardEffect(line: string): DialogRewardEffect | null {
  const match = line.match(/^(reward_\w+|remove_\w+|restore)=(.+)$/);
  if (!match) return null;
  
  const [, type, value] = match;
  const id = `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  switch (type) {
    case 'reward_xp':
      return { id, type: 'reward_xp', amount: parseInt(value, 10) };
    case 'reward_currency':
      return { id, type: 'reward_currency', amount: parseInt(value, 10) };
    case 'remove_currency':
      return { id, type: 'remove_currency', amount: parseInt(value, 10) };
    case 'reward_item': {
      const [itemId, qty] = value.split(':');
      return { id, type: 'reward_item', itemId, quantity: parseInt(qty, 10) || 1 };
    }
    case 'remove_item': {
      const [itemId, qty] = value.split(':');
      return { id, type: 'remove_item', itemId, quantity: parseInt(qty, 10) || 1 };
    }
    case 'reward_loot':
      return { id, type: 'reward_loot', lootTable: value, countMin: 1, countMax: 1 };
    case 'restore':
      return { id, type: 'restore', restoreType: value as RestoreType };
    default:
      return null;
  }
}

// ============================================
// WORLD & FLOW SERIALIZATION
// ============================================

export function serializeWorldFlow(config: WorldFlowConfig): string[] {
  const lines: string[] = [];
  
  // Teleport
  if (config.teleport.enabled) {
    switch (config.teleport.mode) {
      case 'intramap':
        if (config.teleport.x !== undefined && config.teleport.y !== undefined) {
          lines.push(`intramap=${config.teleport.x},${config.teleport.y}`);
        }
        break;
      case 'intermap':
        if (config.teleport.mapFile) {
          let val = config.teleport.mapFile;
          if (config.teleport.x !== undefined && config.teleport.y !== undefined) {
            val += `,${config.teleport.x},${config.teleport.y}`;
          }
          lines.push(`intermap=${val}`);
        }
        break;
      case 'intermap_random':
        if (config.teleport.mapFiles && config.teleport.mapFiles.length > 0) {
          lines.push(`intermap_random=${config.teleport.mapFiles.join(';')}`);
        }
        break;
    }
  }
  
  // Spawn
  if (config.spawn.enabled && config.spawn.category) {
    let val = config.spawn.category;
    if (config.spawn.x !== undefined && config.spawn.y !== undefined) {
      val += `,${config.spawn.x},${config.spawn.y}`;
    }
    lines.push(`spawn=${val}`);
  }
  
  // Map mod
  if (config.mapMod.enabled && config.mapMod.mapModFile) {
    lines.push(`mapmod=${config.mapMod.mapModFile}`);
  }
  
  // Audio
  if (config.audio.soundFx) {
    lines.push(`soundfx=${config.audio.soundFx}`);
  }
  if (config.audio.music) {
    lines.push(`music=${config.audio.music}`);
  }
  if (config.audio.shakyCam) {
    lines.push(`shakycam=true`);
  }
  
  // Cutscene
  if (config.cutscene.enabled && config.cutscene.cutsceneFile) {
    lines.push(`cutscene=${config.cutscene.cutsceneFile}`);
  }
  
  // Status changes
  if (config.statusChange.setStatuses.length > 0) {
    lines.push(`set_status=${config.statusChange.setStatuses.join(',')}`);
  }
  if (config.statusChange.unsetStatuses.length > 0) {
    lines.push(`unset_status=${config.statusChange.unsetStatuses.join(',')}`);
  }
  
  // NPC interaction
  if (config.npcInteraction.enabled && config.npcInteraction.npcFile) {
    lines.push(`npc=${config.npcInteraction.npcFile}`);
  }
  
  // Book
  if (config.book.enabled && config.book.bookFile) {
    lines.push(`book=${config.book.bookFile}`);
  }
  
  // Stash
  if (config.stash.enabled) {
    lines.push(`stash=true`);
  }
  
  // Power
  if (config.power.enabled) {
    if (config.power.powerId) {
      lines.push(`power=${config.power.powerId}`);
    }
    if (config.power.powerPath) {
      lines.push(`power_path=${config.power.powerPath}`);
    }
    if (config.power.powerDamage !== undefined) {
      lines.push(`power_damage=${config.power.powerDamage}`);
    }
  }
  
  // Advanced misc
  const adv = config.advanced;
  if (adv.chanceExec !== undefined && adv.chanceExec < 100) {
    lines.push(`chance_exec=${adv.chanceExec}`);
  }
  if (adv.repeat) {
    lines.push(`repeat=true`);
  }
  if (adv.saveGame) {
    lines.push(`save_game=true`);
  }
  if (adv.respec) {
    lines.push(`respec=true`);
  }
  if (adv.scriptFile) {
    lines.push(`script=${adv.scriptFile}`);
  }
  if (adv.showOnMinimap) {
    lines.push(`show_on_minimap=true`);
  }
  
  return lines;
}

// ============================================
// FULL DIALOG NODE SERIALIZATION
// ============================================

export interface SerializedDialogNode {
  dialogLines: string[];
  eventLines: string[];
}

export function serializeDialogNode(node: DialogNode): SerializedDialogNode {
  const dialogLines: string[] = [];
  const eventLines: string[] = [];
  
  // Dialog content
  if (node.npcText) {
    dialogLines.push(`${node.npcGender}=${node.npcText}`);
  }
  if (node.playerText) {
    dialogLines.push(`you=${node.playerText}`);
  }
  if (node.npcPortrait) {
    dialogLines.push(`portrait_${node.npcGender}=${node.npcPortrait}`);
  }
  if (node.playerPortrait) {
    dialogLines.push(`portrait_you=${node.playerPortrait}`);
  }
  if (node.allowMovement) {
    dialogLines.push(`allow_movement=true`);
  }
  
  // Responses
  for (const response of node.responses) {
    dialogLines.push(`response=${response.text}`);
    dialogLines.push(`topic=${response.targetNodeId}`);
  }
  
  // Conditions (event.requires_*)
  eventLines.push(...serializeConditions(node.conditions));
  
  // Rewards (event.reward_*, event.remove_*, event.restore)
  eventLines.push(...serializeRewardEffects(node.rewards));
  
  // World & Flow (event.*)
  eventLines.push(...serializeWorldFlow(node.worldFlow));
  
  return { dialogLines, eventLines };
}

export function serializeDialogNodeToFlareFormat(node: DialogNode, nodeId: string): string {
  const { dialogLines, eventLines } = serializeDialogNode(node);
  
  const lines: string[] = [];
  
  // Dialog section
  lines.push(`[dialog ${nodeId}]`);
  for (const line of dialogLines) {
    lines.push(`dialog.${line}`);
  }
  
  // Event section (if there are any event attributes)
  if (eventLines.length > 0) {
    for (const line of eventLines) {
      lines.push(`event.${line}`);
    }
  }
  
  return lines.join('\n');
}

// ============================================
// RAW ATTRIBUTE PREVIEW
// ============================================

export function generateRawAttributePreview(node: DialogNode): string {
  const { dialogLines, eventLines } = serializeDialogNode(node);
  
  const lines: string[] = [];
  
  if (dialogLines.length > 0) {
    lines.push('# Dialog Attributes');
    for (const line of dialogLines) {
      lines.push(`dialog.${line}`);
    }
  }
  
  if (eventLines.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('# Event Attributes');
    for (const line of eventLines) {
      lines.push(`event.${line}`);
    }
  }
  
  return lines.join('\n');
}

// ============================================
// VALIDATION HELPERS
// ============================================

export interface ValidationError {
  field: string;
  message: string;
}

export function validateDialogNode(node: DialogNode): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Must have some text
  if (!node.npcText && !node.playerText) {
    errors.push({ field: 'text', message: 'Node must have either NPC or player text' });
  }
  
  // Validate conditions
  for (const cond of node.conditions) {
    if (cond.type === 'requires_item' || cond.type === 'requires_not_item') {
      const c = cond as ItemCondition;
      if (!c.itemId) {
        errors.push({ field: 'condition', message: 'Item condition requires an item ID' });
      }
    }
  }
  
  // Validate rewards
  for (const effect of node.rewards) {
    if (effect.type === 'reward_item' || effect.type === 'remove_item') {
      const e = effect as ItemRewardEffect;
      if (!e.itemId) {
        errors.push({ field: 'reward', message: 'Item reward requires an item ID' });
      }
    }
    if (effect.type === 'reward_loot') {
      const e = effect as LootRewardEffect;
      if (!e.lootTable) {
        errors.push({ field: 'reward', message: 'Loot reward requires a loot table' });
      }
    }
  }
  
  return errors;
}

// ============================================
// EFFECT SUMMARY FOR UI DISPLAY
// ============================================

export interface EffectSummaryItem {
  icon: 'plus' | 'minus' | 'info';
  color: 'green' | 'red' | 'blue' | 'yellow';
  text: string;
}

export function generateEffectSummary(node: DialogNode): EffectSummaryItem[] {
  const items: EffectSummaryItem[] = [];
  
  // Rewards summary
  for (const effect of node.rewards) {
    switch (effect.type) {
      case 'reward_xp':
        items.push({ icon: 'plus', color: 'blue', text: `+${(effect as XPRewardEffect).amount} XP` });
        break;
      case 'reward_currency':
        items.push({ icon: 'plus', color: 'yellow', text: `+${(effect as CurrencyRewardEffect).amount} gold` });
        break;
      case 'remove_currency':
        items.push({ icon: 'minus', color: 'red', text: `-${(effect as CurrencyRewardEffect).amount} gold` });
        break;
      case 'reward_item': {
        const e = effect as ItemRewardEffect;
        items.push({ icon: 'plus', color: 'green', text: `+${e.itemId} x${e.quantity}` });
        break;
      }
      case 'remove_item': {
        const e = effect as ItemRewardEffect;
        items.push({ icon: 'minus', color: 'red', text: `-${e.itemId} x${e.quantity}` });
        break;
      }
      case 'reward_loot': {
        const e = effect as LootRewardEffect;
        items.push({ icon: 'plus', color: 'green', text: `Random loot: ${e.lootTable}` });
        break;
      }
      case 'restore':
        items.push({ icon: 'plus', color: 'green', text: `Restore: ${(effect as RestoreEffect).restoreType}` });
        break;
    }
  }
  
  // World flow summary
  const wf = node.worldFlow;
  if (wf.teleport.enabled) {
    items.push({ icon: 'info', color: 'blue', text: `Teleport (${wf.teleport.mode})` });
  }
  if (wf.cutscene.enabled) {
    items.push({ icon: 'info', color: 'blue', text: `Cutscene: ${wf.cutscene.cutsceneFile}` });
  }
  if (wf.statusChange.setStatuses.length > 0) {
    items.push({ icon: 'plus', color: 'blue', text: `Set status: ${wf.statusChange.setStatuses.join(', ')}` });
  }
  if (wf.statusChange.unsetStatuses.length > 0) {
    items.push({ icon: 'minus', color: 'blue', text: `Clear status: ${wf.statusChange.unsetStatuses.join(', ')}` });
  }
  
  return items;
}
