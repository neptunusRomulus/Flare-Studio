import type { DialogueRequirement, DialogueReward, DialogueTree, DialogueWorldEffect } from '@/types';

/**
 * Quest role → real Flare 1.15 dialog actions.
 *
 * Flare has no "quest" key on NPCs: a quest is accepted by setting a status and
 * shown in the journal by a quests/<id>.txt file whose [quest] section requires
 * that status. Turn-in is another dialog node that gives the rewards.
 * `questRequiresStatus` / `questSetStatus` / `quest_loot` were Studio-only props
 * and never reached the engine; they are only read here for migration.
 */

export type QuestTurnInMode = 'accept' | 'complete';

export type QuestFlowItem = {
  id: string;
  quantity: string;
};

export type QuestFlowInput = {
  questId: string;
  questName: string;
  acceptStatus: string;
  completeStatus: string;
  prereqStatus: string;
  turnInMode: QuestTurnInMode;
  oneTimeReward: boolean;
  acceptLine: string;
  turnInLine: string;
  xp: string;
  currency: string;
  items: QuestFlowItem[];
};

const ACCEPT_SUFFIX = '_accept';
const TURN_IN_SUFFIX = '_turnin';
const TREE_PREFIX = 'quest_';

export const questAcceptDialogueId = (questId: string) => `${TREE_PREFIX}${questId}${ACCEPT_SUFFIX}`;
export const questTurnInDialogueId = (questId: string) => `${TREE_PREFIX}${questId}${TURN_IN_SUFFIX}`;
export const questClaimedStatus = (questId: string) => `${questId}_rewarded`;

const clean = (value: unknown) => String(value ?? '').trim();

function byDialogueId(trees: DialogueTree[], dialogueId: string) {
  return trees.find((tree) => tree.dialogueId === dialogueId);
}

/** Keep dialog data the quest form does not own (extra lines, portraits, unknown effects, ...). */
function preservedRequirements(existing?: DialogueTree): DialogueRequirement[] {
  return (existing?.requirements || []).filter((req) => req.type !== 'status' && req.type !== 'not_status');
}

function preservedEffects(existing?: DialogueTree): DialogueWorldEffect[] {
  return (existing?.worldEffects || []).filter((effect) => effect.type !== 'set_status');
}

function preservedRewards(existing?: DialogueTree): DialogueReward[] {
  return (existing?.rewards || []).filter((reward) => !['xp', 'gold', 'item'].includes(reward.type));
}

function rewardList(input: QuestFlowInput): DialogueReward[] {
  const rewards: DialogueReward[] = [];
  const xp = clean(input.xp);
  if (xp) rewards.push({ id: 'quest-xp', type: 'xp', value: xp });
  const currency = clean(input.currency);
  if (currency) rewards.push({ id: 'quest-currency', type: 'gold', value: currency });
  (input.items || []).forEach((item, index) => {
    const id = clean(item.id);
    if (!id) return;
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    rewards.push({ id: `quest-item-${index}`, type: 'item', value: id, quantity });
  });
  return rewards;
}

/** Build/update the two dialog topics for a quest, preserving everything Studio does not manage. */
export function buildQuestFlowTrees(input: QuestFlowInput, existingTrees: DialogueTree[] = []): DialogueTree[] {
  const questId = clean(input.questId);
  const acceptId = questAcceptDialogueId(questId);
  const turnInId = questTurnInDialogueId(questId);
  const topic = clean(input.questName) || 'Quest';
  const acceptStatus = clean(input.acceptStatus) || `${questId}_started`;
  const completeStatus = clean(input.completeStatus) || `${questId}_complete`;
  const claimedStatus = questClaimedStatus(questId);
  const prereq = clean(input.prereqStatus);
  const oneTime = input.oneTimeReward;

  const oldAccept = byDialogueId(existingTrees, acceptId);
  const oldTurnIn = byDialogueId(existingTrees, turnInId);

  const acceptRequirements: DialogueRequirement[] = [];
  if (prereq) acceptRequirements.push({ id: `${acceptId}-req-prereq`, type: 'status', value: prereq });
  if (oneTime) acceptRequirements.push({ id: `${acceptId}-req-open`, type: 'not_status', value: completeStatus });
  acceptRequirements.push(...preservedRequirements(oldAccept));

  const acceptFirst = oldAccept?.dialogues?.[0];
  const acceptTree: DialogueTree = {
    ...(oldAccept || {}),
    id: oldAccept?.id || acceptId,
    dialogueId: acceptId,
    topic,
    responses: oldAccept?.responses || [],
    requirements: acceptRequirements,
    dialogues: [
      {
        ...(acceptFirst || {}),
        id: acceptFirst?.id || `${acceptId}-line`,
        speaker: 'npc',
        text: clean(input.acceptLine) || 'I have a task for you.',
      },
      ...(oldAccept?.dialogues?.slice(1) || []),
    ],
    rewards: preservedRewards(oldAccept),
    worldEffects: [
      ...preservedEffects(oldAccept),
      { id: `${acceptId}-set-status`, type: 'set_status', value: acceptStatus },
    ],
  };

  const turnInRequirements: DialogueRequirement[] = [];
  const turnInEffects: DialogueWorldEffect[] = [];
  const mode: QuestTurnInMode = input.turnInMode === 'complete' ? 'complete' : 'accept';
  if (mode === 'complete') {
    turnInRequirements.push({ id: `${turnInId}-req-complete`, type: 'status', value: completeStatus });
    if (oneTime) {
      turnInRequirements.push({ id: `${turnInId}-req-claimed`, type: 'not_status', value: claimedStatus });
      turnInEffects.push({ id: `${turnInId}-set-claimed`, type: 'set_status', value: claimedStatus });
    }
  } else {
    turnInRequirements.push({ id: `${turnInId}-req-accepted`, type: 'status', value: acceptStatus });
    if (oneTime) turnInRequirements.push({ id: `${turnInId}-req-done`, type: 'not_status', value: completeStatus });
    turnInEffects.push({ id: `${turnInId}-set-complete`, type: 'set_status', value: completeStatus });
  }
  turnInRequirements.push(...preservedRequirements(oldTurnIn));

  const turnInFirst = oldTurnIn?.dialogues?.[0];
  const turnInTree: DialogueTree = {
    ...(oldTurnIn || {}),
    id: oldTurnIn?.id || turnInId,
    dialogueId: turnInId,
    topic: `${topic} (turn in)`,
    responses: oldTurnIn?.responses || [],
    requirements: turnInRequirements,
    dialogues: [
      {
        ...(turnInFirst || {}),
        id: turnInFirst?.id || `${turnInId}-line`,
        speaker: 'npc',
        text: clean(input.turnInLine) || 'Well done. Here is your reward.',
      },
      ...(oldTurnIn?.dialogues?.slice(1) || []),
    ],
    rewards: [...rewardList(input), ...preservedRewards(oldTurnIn)],
    worldEffects: [...turnInEffects, ...preservedEffects(oldTurnIn)],
  };

  const replaceAt = (trees: DialogueTree[], dialogueId: string, next: DialogueTree) => {
    const index = trees.findIndex((tree) => tree.dialogueId === dialogueId);
    if (index < 0) return [...trees, next];
    return trees.map((tree, i) => (i === index ? next : tree));
  };

  return replaceAt(replaceAt([...existingTrees], acceptId, acceptTree), turnInId, turnInTree);
}

export type QuestFlowFound = Partial<QuestFlowInput> & { questId: string };

function statusOf(requirements: DialogueRequirement[] | undefined, type: 'status' | 'not_status') {
  return clean((requirements || []).find((req) => req.type === type)?.value);
}

function setStatusOf(effects: DialogueWorldEffect[] | undefined) {
  return clean((effects || []).find((effect) => effect.type === 'set_status')?.value);
}

/** Read the generated topics back into the form. Returns null when the NPC has no quest topics. */
export function readQuestFlowTrees(trees: DialogueTree[]): QuestFlowFound | null {
  const accept = trees.find((tree) => tree.dialogueId.startsWith(TREE_PREFIX) && tree.dialogueId.endsWith(ACCEPT_SUFFIX));
  const turnIn = trees.find((tree) => tree.dialogueId.startsWith(TREE_PREFIX) && tree.dialogueId.endsWith(TURN_IN_SUFFIX));
  if (!accept && !turnIn) return null;

  const source = accept || turnIn!;
  const questId = source.dialogueId.slice(TREE_PREFIX.length, source.dialogueId.length - (accept ? ACCEPT_SUFFIX : TURN_IN_SUFFIX).length);
  const acceptStatus = setStatusOf(accept?.worldEffects) || clean(`${questId}_started`);
  const turnInAcceptStatus = statusOf(turnIn?.requirements, 'status');

  let mode: QuestTurnInMode = 'accept';
  let completeStatus = clean(`${questId}_complete`);
  let oneTimeReward = false;

  if (turnIn) {
    mode = turnInAcceptStatus === acceptStatus ? 'accept' : 'complete';
    if (mode === 'accept') {
      completeStatus = setStatusOf(turnIn.worldEffects) || completeStatus;
      oneTimeReward = Boolean(statusOf(turnIn.requirements, 'not_status'));
    } else {
      completeStatus = turnInAcceptStatus || completeStatus;
      oneTimeReward = Boolean(statusOf(turnIn.requirements, 'not_status'));
    }
  }

  const rewards = turnIn?.rewards || [];
  const items = rewards
    .filter((reward) => reward.type === 'item' && reward.value)
    .map((reward) => ({ id: reward.value, quantity: String(reward.quantity || 1) }));

  return {
    questId,
    questName: clean(accept?.topic || turnIn?.topic).replace(/\s*\(turn in\)$/i, ''),
    acceptStatus,
    completeStatus,
    prereqStatus: statusOf(accept?.requirements, 'status'),
    turnInMode: mode,
    oneTimeReward,
    acceptLine: accept?.dialogues?.[0]?.text || '',
    turnInLine: turnIn?.dialogues?.[0]?.text || '',
    xp: clean(rewards.find((reward) => reward.type === 'xp')?.value),
    currency: clean(rewards.find((reward) => reward.type === 'gold')?.value),
    items,
  };
}

/** Legacy Studio-only props (never written to npcs/*.txt) → form values. */
export function questFlowFromLegacy(npcName: string, legacy: { requires?: string; set?: string; loot?: string }): QuestFlowInput {
  const baseQuestId = `${npcName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'npc'}_quest`;
  const lootParts = clean(legacy.loot).split(',').map((part) => part.trim());
  const legacyItem = lootParts.length >= 3 ? lootParts[2] : '';
  return {
    questId: baseQuestId,
    questName: `${npcName || 'NPC'}'s quest`,
    acceptStatus: clean(legacy.set) || `${baseQuestId}_started`,
    completeStatus: `${baseQuestId}_complete`,
    prereqStatus: clean(legacy.requires),
    turnInMode: 'accept',
    oneTimeReward: true,
    acceptLine: 'I have a task for you.',
    turnInLine: 'Well done. Here is your reward.',
    xp: '',
    currency: '',
    items: legacyItem ? [{ id: legacyItem, quantity: '1' }] : [],
  };
}
