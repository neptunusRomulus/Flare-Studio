/**
 * Role center Moments: NPC states derived from requires_status /
 * requires_not_status, the Quest role, and journal steps.
 */
import type { DialogueRequirement, DialogueTree } from '@/types';
import { questClaimedStatus, type QuestFlowFound } from '@/editor/questFlow';
import { slugQuestId, stepCardTitle, type QuestStep } from '@/editor/questSteps';

export type MomentSource = 'first-meeting' | 'quest-given' | 'quest-step' | 'quest-done' | 'after' | 'custom' | 'other';

export type RoleMoment = {
  id: string;
  title: string;
  /** Auto status key (tooltip only). Empty when the moment is defined only by "not" conditions. */
  key: string;
  requiresStatus: string[];
  requiresNotStatus: string[];
  source: MomentSource;
  isOther?: boolean;
};

export type MomentAssignment = {
  moments: RoleMoment[];
  other: RoleMoment;
  /** dialogueId → moment id (or the Other id) */
  topicMoment: Record<string, string>;
};

const clean = (value: unknown) => String(value ?? '').trim();

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values.map(clean).filter(Boolean)) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function splitList(value: string): string[] {
  return unique(value.split(','));
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((value) => set.has(value));
}

function isSubset(inner: string[], outer: string[]): boolean {
  const set = new Set(outer);
  return inner.every((value) => set.has(value));
}

export function statusConditions(requirements: DialogueRequirement[] | undefined): { has: string[]; not: string[] } {
  const has: string[] = [];
  const not: string[] = [];
  for (const req of requirements || []) {
    if (req.type === 'status') has.push(...splitList(req.value));
    if (req.type === 'not_status') not.push(...splitList(req.value));
  }
  return { has: unique(has), not: unique(not) };
}

function signatureKey(has: string[], not: string[]): string {
  return `has:${[...has].sort().join(',')}|not:${[...not].sort().join(',')}`;
}

function momentId(prefix: string, has: string[], not: string[]): string {
  const slug = `${prefix}-${signatureKey(has, not)}`.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || prefix;
}

export const OTHER_MOMENT_ID = 'moment-other';

export function otherMoment(): RoleMoment {
  return {
    id: OTHER_MOMENT_ID,
    title: 'Other',
    key: '',
    requiresStatus: [],
    requiresNotStatus: [],
    source: 'other',
    isOther: true,
  };
}

function pushMoment(list: RoleMoment[], moment: RoleMoment) {
  const duplicate = list.find((entry) => sameSet(entry.requiresStatus, moment.requiresStatus) && sameSet(entry.requiresNotStatus, moment.requiresNotStatus));
  if (duplicate) return;
  list.push(moment);
}

export type MomentsInput = {
  npcName?: string;
  quest?: Pick<QuestFlowFound, 'questId' | 'acceptStatus' | 'completeStatus' | 'oneTimeReward'> | null;
  steps?: QuestStep[];
  custom?: RoleMoment[];
};

/** Build the moment list from the Quest role, journal steps, and any custom moments. */
export function buildMoments(input: MomentsInput = {}): RoleMoment[] {
  const moments: RoleMoment[] = [];
  const questId = clean(input.quest?.questId);
  const accept = clean(input.quest?.acceptStatus);
  const complete = clean(input.quest?.completeStatus);
  const claimed = input.quest?.oneTimeReward && questId ? questClaimedStatus(questId) : '';

  if (accept) {
    pushMoment(moments, {
      id: momentId('first-meeting', [], [accept]),
      title: 'First meeting',
      key: '',
      requiresStatus: [],
      requiresNotStatus: [accept],
      source: 'first-meeting',
    });
  }

  const steps = input.steps || [];
  if (steps.length) {
    steps.forEach((step, index) => {
      const has = unique(splitList(step.requires_status));
      const not = unique(splitList(step.requires_not_status));
      if (!has.length && !not.length) return;
      const isFirst = index === 0;
      pushMoment(moments, {
        id: momentId(isFirst ? 'quest-given' : `quest-step-${index + 1}`, has, not),
        title: isFirst ? 'Quest given' : stepCardTitle(step.quest_text, index).replace(/^\d+\.\s*/, '') || `Step ${index + 1}`,
        key: has[0] || '',
        requiresStatus: has,
        requiresNotStatus: not,
        source: isFirst ? 'quest-given' : 'quest-step',
      });
    });
  } else if (accept) {
    pushMoment(moments, {
      id: momentId('quest-given', [accept], complete ? [complete] : []),
      title: 'Quest given',
      key: accept,
      requiresStatus: [accept],
      requiresNotStatus: complete ? [complete] : [],
      source: 'quest-given',
    });
  }

  if (complete) {
    pushMoment(moments, {
      id: momentId('quest-done', [complete], []),
      title: 'Quest done',
      key: complete,
      requiresStatus: [complete],
      requiresNotStatus: [],
      source: 'quest-done',
    });
  }

  if (claimed) {
    pushMoment(moments, {
      id: momentId('after', [claimed], []),
      title: 'After',
      key: claimed,
      requiresStatus: [claimed],
      requiresNotStatus: [],
      source: 'after',
    });
  }

  for (const custom of input.custom || []) {
    if (!custom || custom.isOther) continue;
    pushMoment(moments, { ...custom, source: 'custom', isOther: false });
  }

  return moments;
}

/**
 * Pick the moment a topic belongs to. Exact signatures win, then the most
 * specific moment whose required statuses are a subset of the topic's.
 * Unmatched topics go to Other.
 */
export function matchMoment(requirements: DialogueRequirement[] | undefined, moments: RoleMoment[]): RoleMoment {
  const { has, not } = statusConditions(requirements);
  const real = moments.filter((moment) => !moment.isOther);
  const exact = real.find((moment) => sameSet(moment.requiresStatus, has) && sameSet(moment.requiresNotStatus, not));
  if (exact) return exact;

  const sameHas = real.filter((moment) => moment.requiresStatus.length > 0 && sameSet(moment.requiresStatus, has));
  if (sameHas.length === 1) return sameHas[0];
  if (sameHas.length > 1) {
    const overlappingNot = sameHas
      .map((moment) => ({ moment, score: moment.requiresNotStatus.filter((value) => not.includes(value)).length }))
      .sort((a, b) => b.score - a.score);
    return overlappingNot[0].moment;
  }

  const subsets = real
    .filter((moment) => moment.requiresStatus.length > 0 && isSubset(moment.requiresStatus, has))
    .map((moment, index) => ({
      moment,
      index,
      score: moment.requiresStatus.length * 10 + moment.requiresNotStatus.filter((value) => not.includes(value)).length,
    }))
    .sort((a, b) => b.score - a.score || b.index - a.index);
  if (subsets.length) return subsets[0].moment;

  if (!has.length) {
    const first = real.find((moment) => moment.source === 'first-meeting');
    if (first && not.some((value) => first.requiresNotStatus.includes(value))) return first;
  }

  return otherMoment();
}

export function assignTopicsToMoments(trees: DialogueTree[], moments: RoleMoment[]): MomentAssignment {
  const other = otherMoment();
  const topicMoment: Record<string, string> = {};
  for (const tree of trees) {
    const matched = matchMoment(tree.requirements, moments);
    topicMoment[tree.dialogueId || tree.id] = matched.isOther ? other.id : matched.id;
  }
  return { moments, other, topicMoment };
}

export function topicsForMoment(trees: DialogueTree[], assignment: MomentAssignment, momentId: string): DialogueTree[] {
  return trees.filter((tree) => assignment.topicMoment[tree.dialogueId || tree.id] === momentId);
}

/** Write a moment's status conditions onto a topic, keeping non-status requirements. */
export function applyMomentToTopic(tree: DialogueTree, moment: RoleMoment): DialogueTree {
  if (moment.isOther) {
    return {
      ...tree,
      requirements: (tree.requirements || []).filter((req) => req.type !== 'status' && req.type !== 'not_status'),
    };
  }
  const kept = (tree.requirements || []).filter((req) => req.type !== 'status' && req.type !== 'not_status');
  const statusReqs: DialogueRequirement[] = [
    ...moment.requiresStatus.map((value, index) => ({ id: `${tree.dialogueId || tree.id}-moment-status-${index}`, type: 'status' as const, value })),
    ...moment.requiresNotStatus.map((value, index) => ({ id: `${tree.dialogueId || tree.id}-moment-not-${index}`, type: 'not_status' as const, value })),
  ];
  return { ...tree, requirements: [...statusReqs, ...kept] };
}

export function customMomentKey(npcName: string, existing: RoleMoment[]): string {
  const base = slugQuestId(npcName || 'npc');
  let n = existing.filter((moment) => moment.source === 'custom').length + 1;
  const used = new Set(existing.map((moment) => moment.key).filter(Boolean));
  let key = `${base}_moment_${n}`;
  while (used.has(key)) {
    n += 1;
    key = `${base}_moment_${n}`;
  }
  return key;
}

/** Create a new custom moment with an auto status key (shown only in a tooltip). */
export function addCustomMoment(moments: RoleMoment[], npcName: string, title?: string): RoleMoment[] {
  const key = customMomentKey(npcName, moments);
  const index = moments.filter((moment) => moment.source === 'custom').length + 1;
  const moment: RoleMoment = {
    id: momentId(`custom-${key}`, [key], []),
    title: title || `Moment ${index}`,
    key,
    requiresStatus: [key],
    requiresNotStatus: [],
    source: 'custom',
  };
  return [...moments, moment];
}


function splitCsv(value: string): string[] {
  return unique(String(value || '').split(','));
}

/** Whether the shop is open in this moment, given vendor_requires_status / vendor_requires_not_status. */
export function shopOpenInMoment(
  moment: RoleMoment,
  vendor: { requiresStatus?: string; requiresNotStatus?: string },
): boolean {
  if (moment.isOther) return false;
  const need = splitCsv(vendor.requiresStatus || '');
  const needNot = splitCsv(vendor.requiresNotStatus || '');
  const on = new Set(moment.requiresStatus);
  const off = new Set(moment.requiresNotStatus);
  if (need.some((status) => off.has(status) || !on.has(status))) return false;
  if (needNot.some((status) => on.has(status))) return false;
  return true;
}
