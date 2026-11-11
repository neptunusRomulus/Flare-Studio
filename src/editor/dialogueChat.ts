/**
 * Pure helpers for the chat-style dialogue editor: "shows when" condition chips,
 * bubble layout (side, avatar, portrait) and deletes that keep file order.
 */
import { dialogCategory } from '@/adapters/flare/flareAdapter.cjs';
import type { DialogueLine, DialogueRequirement, DialogueTree } from '@/types';

type Entry = { key?: string; value?: string; raw?: string };
type WithComponents = { components?: Entry[] };

export type DialogConditionEntry = {
  type: DialogueRequirement['type'];
  label: string;
  flareKey: string;
  placeholder: string;
};

export const DIALOG_CONDITION_CATALOG: DialogConditionEntry[] = [
  { type: 'status', label: 'Status is on', flareKey: 'requires_status', placeholder: 'status' },
  { type: 'not_status', label: 'Status is off', flareKey: 'requires_not_status', placeholder: 'status' },
  { type: 'item', label: 'Has item', flareKey: 'requires_item', placeholder: 'item id' },
  { type: 'not_item', label: 'Lacks item', flareKey: 'requires_not_item', placeholder: 'item id' },
  { type: 'level', label: 'Level at least', flareKey: 'requires_level', placeholder: 'level' },
  { type: 'not_level', label: 'Below level', flareKey: 'requires_not_level', placeholder: 'level' },
  { type: 'currency', label: 'Has gold', flareKey: 'requires_currency', placeholder: 'amount' },
  { type: 'not_currency', label: 'Less gold than', flareKey: 'requires_not_currency', placeholder: 'amount' },
  { type: 'class', label: 'Class is', flareKey: 'requires_class', placeholder: 'class' },
  { type: 'not_class', label: 'Class is not', flareKey: 'requires_not_class', placeholder: 'class' },
  { type: 'tile', label: 'Tile is', flareKey: 'requires_tile', placeholder: 'layer,x,y,tile' },
  { type: 'not_tile', label: 'Tile is not', flareKey: 'requires_not_tile', placeholder: 'layer,x,y,tile' },
];

export function conditionEntry(type: DialogueRequirement['type']): DialogConditionEntry | undefined {
  return DIALOG_CONDITION_CATALOG.find((entry) => entry.type === type);
}

export function conditionChipLabel(req: DialogueRequirement): string {
  const entry = conditionEntry(req.type);
  const label = entry?.label || req.type;
  const value = (req.value || '').trim();
  return value ? `${label}: ${value}` : label;
}

export function conditionChipTooltip(req: DialogueRequirement): string {
  const entry = conditionEntry(req.type);
  return `${entry?.flareKey || req.type}=${req.value || ''}`;
}

/**
 * Index in `components` of the n-th entry of a dialog category (req, reward, effect),
 * the same counting exportDialogBlock uses to place list items.
 */
export function componentIndexOf(components: Entry[] | undefined, category: string, n: number): number {
  if (!components) return -1;
  let seen = -1;
  for (let i = 0; i < components.length; i++) {
    const entry = components[i];
    if (entry.raw || !entry.key) continue;
    if (dialogCategory(entry.key) !== category) continue;
    seen += 1;
    if (seen === n) return i;
  }
  return -1;
}

function dropComponent<T extends WithComponents>(tree: T, category: string, n: number): T {
  const at = componentIndexOf(tree.components, category, n);
  if (at < 0 || !tree.components) return tree;
  return { ...tree, components: [...tree.components.slice(0, at), ...tree.components.slice(at + 1)] };
}

/** Remove one condition; its own file line goes, every other line keeps its position. */
export function removeCondition<T extends DialogueTree & WithComponents>(tree: T, index: number): T {
  const requirements = tree.requirements || [];
  if (index < 0 || index >= requirements.length) return tree;
  const next = dropComponent(tree, 'req', index);
  return { ...next, requirements: requirements.filter((_, i) => i !== index) };
}

export function addCondition<T extends DialogueTree>(tree: T, type: DialogueRequirement['type'], id?: string): T {
  const req: DialogueRequirement = { id: id || `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, type, value: '' };
  return { ...tree, requirements: [...(tree.requirements || []), req] };
}

export function updateCondition<T extends DialogueTree>(tree: T, index: number, value: string): T {
  const requirements = (tree.requirements || []).map((req, i) => (i === index ? { ...req, value } : req));
  return { ...tree, requirements };
}

/** Remove a reward or effect chip without moving the file lines of the others. */
export function removeAction<T extends DialogueTree & WithComponents>(tree: T, group: 'reward' | 'effect', index: number): T {
  if (group === 'reward') {
    const rewards = tree.rewards || [];
    if (index < 0 || index >= rewards.length) return tree;
    return { ...dropComponent(tree, 'reward', index), rewards: rewards.filter((_, i) => i !== index) };
  }
  const effects = tree.worldEffects || [];
  if (index < 0 || index >= effects.length) return tree;
  return { ...dropComponent(tree, 'effect', index), worldEffects: effects.filter((_, i) => i !== index) };
}

export type ChatBubbleMeta = {
  side: 'left' | 'right';
  /** First bubble of a run from the same speaker: shows the avatar and name. */
  startsRun: boolean;
  /** Portrait in effect for this line (Flare portraits apply from their line on). */
  portrait: string;
};

/**
 * Layout of each line. NPC lines sit on the left with the NPC portrait (or the last
 * portrait_him/her set on an earlier NPC line); player lines sit on the right.
 */
export function chatBubbleMeta(lines: DialogueLine[], defaultNpcPortrait = ''): ChatBubbleMeta[] {
  let npcPortrait = defaultNpcPortrait;
  let playerPortrait = '';
  return lines.map((line, index) => {
    const player = line.speaker === 'player';
    if (line.portrait) {
      const key = line.portraitKey || (player ? 'portrait_you' : 'portrait_him');
      if (key === 'portrait_you') playerPortrait = line.portrait;
      else npcPortrait = line.portrait;
    }
    const prev = lines[index - 1];
    return {
      side: player ? 'right' : 'left',
      startsRun: !prev || (prev.speaker === 'player') !== player,
      portrait: player ? playerPortrait : npcPortrait,
    };
  });
}

/** Player answers offered after this topic: label is the target's first player line, else its topic. */
export function chatResponses(tree: DialogueTree, allTrees: DialogueTree[]): Array<{ id: string; label: string; missing: boolean }> {
  return (tree.responses || []).map((id) => {
    const target = allTrees.find((entry) => entry.dialogueId === id);
    const playerLine = target?.dialogues?.find((line) => line.speaker === 'player')?.text;
    return { id, label: playerLine || target?.topic || id, missing: !target };
  });
}
