/**
 * Multi-stage quest journal helpers: step cards, "shows when" chips,
 * auto status keys, and lining those steps up with an NPC Quest role.
 */

export const QUEST_STEP_KEYS = [
  'requires_status',
  'requires_not_status',
  'requires_level',
  'requires_not_level',
  'requires_currency',
  'requires_not_currency',
  'requires_item',
  'requires_not_item',
  'requires_class',
  'requires_not_class',
  'quest_text',
  'show_status',
] as const;

export type QuestStepKey = (typeof QUEST_STEP_KEYS)[number];

export type QuestConditionKind =
  | 'requires_status'
  | 'requires_not_status'
  | 'requires_level'
  | 'requires_not_level'
  | 'requires_currency'
  | 'requires_not_currency'
  | 'requires_item'
  | 'requires_not_item'
  | 'requires_class'
  | 'requires_not_class'
  | 'show_status';

export type QuestStep = {
  id: string;
  blockIndex?: number;
  quest_text: string;
  requires_status: string;
  requires_not_status: string;
  requires_level: string;
  requires_not_level: string;
  requires_currency: string;
  requires_not_currency: string;
  requires_item: string;
  requires_not_item: string;
  requires_class: string;
  requires_not_class: string;
  show_status: string;
};

export type QuestConditionChip = {
  id: string;
  kind: QuestConditionKind;
  value: string;
  /** Quantity for item conditions (requires_item / requires_not_item). */
  quantity?: number;
};

export type QuestConditionCatalogEntry = {
  kind: QuestConditionKind;
  label: string;
  flareKey: string;
  description: string;
  synonyms: string[];
};

export type QuestStepContext = {
  questId: string;
  acceptStatus?: string;
  completeStatus?: string;
  itemName?: (itemId: string) => string;
};

export const QUEST_CONDITION_CATALOG: QuestConditionCatalogEntry[] = [
  {
    kind: 'requires_status',
    label: 'Has status',
    flareKey: 'requires_status',
    description: 'Show this step when this status is set.',
    synonyms: ['status', 'accepted', 'quest accepted'],
  },
  {
    kind: 'requires_not_status',
    label: 'Does not have status',
    flareKey: 'requires_not_status',
    description: 'Hide this step when this status is set.',
    synonyms: ['not status', 'done', 'quest done'],
  },
  {
    kind: 'requires_level',
    label: 'Level',
    flareKey: 'requires_level',
    description: 'Show this step at this player level or higher.',
    synonyms: ['level', 'xp'],
  },
  {
    kind: 'requires_not_level',
    label: 'Not level',
    flareKey: 'requires_not_level',
    description: 'Hide this step at this player level or higher.',
    synonyms: ['not level'],
  },
  {
    kind: 'requires_currency',
    label: 'Currency',
    flareKey: 'requires_currency',
    description: 'Show this step when the player has at least this much currency.',
    synonyms: ['gold', 'money'],
  },
  {
    kind: 'requires_not_currency',
    label: 'Not currency',
    flareKey: 'requires_not_currency',
    description: 'Hide this step at this currency amount or higher.',
    synonyms: ['not gold'],
  },
  {
    kind: 'requires_item',
    label: 'Has item',
    flareKey: 'requires_item',
    description: 'Show this step when the player has this item.',
    synonyms: ['item', 'has', 'inventory'],
  },
  {
    kind: 'requires_not_item',
    label: 'Does not have item',
    flareKey: 'requires_not_item',
    description: 'Hide this step when the player has this item.',
    synonyms: ['not item'],
  },
  {
    kind: 'requires_class',
    label: 'Class',
    flareKey: 'requires_class',
    description: 'Show this step only for this hero class.',
    synonyms: ['class', 'hero'],
  },
  {
    kind: 'requires_not_class',
    label: 'Not class',
    flareKey: 'requires_not_class',
    description: 'Hide this step for this hero class.',
    synonyms: ['not class'],
  },
  {
    kind: 'show_status',
    label: 'Also show when',
    flareKey: 'show_status',
    description: 'Also show this step when this status is set.',
    synonyms: ['show status', 'also'],
  },
];

const clean = (value: unknown) => String(value ?? '').trim();

export function emptyQuestStep(partial?: Partial<QuestStep>): QuestStep {
  return {
    id: partial?.id || newStepId(),
    blockIndex: partial?.blockIndex,
    quest_text: clean(partial?.quest_text),
    requires_status: clean(partial?.requires_status),
    requires_not_status: clean(partial?.requires_not_status),
    requires_level: clean(partial?.requires_level),
    requires_not_level: clean(partial?.requires_not_level),
    requires_currency: clean(partial?.requires_currency),
    requires_not_currency: clean(partial?.requires_not_currency),
    requires_item: clean(partial?.requires_item),
    requires_not_item: clean(partial?.requires_not_item),
    requires_class: clean(partial?.requires_class),
    requires_not_class: clean(partial?.requires_not_class),
    show_status: clean(partial?.show_status),
  };
}

export function newStepId(): string {
  return `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Readable status key derived from the quest id plus step number (1-based). */
export function stepStatusKey(questId: string, stepNumber: number): string {
  const id = slugQuestId(questId);
  if (stepNumber <= 1) return `${id}_started`;
  return `${id}_step_${stepNumber}`;
}

export function completeStatusKey(questId: string): string {
  return `${slugQuestId(questId)}_complete`;
}


/** Comma or semicolon lists, the way CampaignManager::parseStatusList tokenizes them. */
export function splitStatusList(value: string | null | undefined): string[] {
  return String(value ?? '')
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

export function joinStatusList(values: Array<string | null | undefined>): string {
  return values.map((value) => String(value ?? '').trim()).filter(Boolean).join(',');
}

export function slugQuestId(questId: string): string {
  const slug = clean(questId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'quest';
}

/** Short card title from the journal text the player sees. */
export function stepCardTitle(text: string, index: number): string {
  const first = clean(text).split(/[.!?\n]/)[0].trim();
  const clipped = first.length > 72 ? `${first.slice(0, 69).trim()}…` : first;
  return `${index + 1}. ${clipped || 'Step'}`;
}

export function filterConditionCatalog(query: string): QuestConditionCatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return QUEST_CONDITION_CATALOG.slice();
  return QUEST_CONDITION_CATALOG.filter((entry) => {
    const hay = [entry.label, entry.flareKey, entry.description, ...entry.synonyms].join(' ').toLowerCase();
    return hay.includes(q) || q.split(/\s+/).every((part) => hay.includes(part));
  });
}

function splitCsv(value: string): string[] {
  return clean(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinCsv(values: string[]): string {
  return values.filter(Boolean).join(',');
}

function parseItemToken(token: string): { id: string; quantity: number } {
  const [id, qty] = token.split(':');
  return { id: clean(id), quantity: qty ? Math.max(1, Number(qty) || 1) : 1 };
}

function formatItemToken(id: string, quantity?: number): string {
  const qty = quantity && quantity > 1 ? `:${quantity}` : '';
  return `${clean(id)}${qty}`;
}

export function chipsFromStep(step: QuestStep): QuestConditionChip[] {
  const chips: QuestConditionChip[] = [];
  const push = (kind: QuestConditionKind, value: string, quantity?: number) => {
    chips.push({
      id: `${step.id}-${kind}-${chips.length}`,
      kind,
      value,
      ...(quantity && quantity > 1 ? { quantity } : {}),
    });
  };
  for (const kind of [
    'requires_status',
    'requires_not_status',
    'requires_level',
    'requires_not_level',
    'requires_currency',
    'requires_not_currency',
    'requires_class',
    'requires_not_class',
    'show_status',
  ] as QuestConditionKind[]) {
    for (const value of splitCsv(step[kind])) push(kind, value);
  }
  for (const token of splitCsv(step.requires_item)) {
    const item = parseItemToken(token);
    if (item.id) push('requires_item', item.id, item.quantity);
  }
  for (const token of splitCsv(step.requires_not_item)) {
    const item = parseItemToken(token);
    if (item.id) push('requires_not_item', item.id, item.quantity);
  }
  return chips;
}

export function applyChipsToStep(step: QuestStep, chips: QuestConditionChip[]): QuestStep {
  const next = emptyQuestStep({ ...step, id: step.id, blockIndex: step.blockIndex, quest_text: step.quest_text });
  const lists: Record<QuestConditionKind, string[]> = {
    requires_status: [],
    requires_not_status: [],
    requires_level: [],
    requires_not_level: [],
    requires_currency: [],
    requires_not_currency: [],
    requires_item: [],
    requires_not_item: [],
    requires_class: [],
    requires_not_class: [],
    show_status: [],
  };
  for (const chip of chips) {
    if (chip.kind === 'requires_item' || chip.kind === 'requires_not_item') {
      if (chip.value) lists[chip.kind].push(formatItemToken(chip.value, chip.quantity));
    } else if (chip.value) {
      lists[chip.kind].push(chip.value);
    }
  }
  (Object.keys(lists) as QuestConditionKind[]).forEach((kind) => {
    next[kind] = joinCsv(lists[kind]);
  });
  return next;
}

function humanizeKey(value: string): string {
  return clean(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function chipLabel(chip: QuestConditionChip, ctx: QuestStepContext = { questId: '' }): string {
  const value = clean(chip.value);
  const itemLabel = chip.kind.includes('item') ? (ctx.itemName?.(value) || value || 'item') : value;
  const qty = chip.quantity && chip.quantity > 1 ? ` ×${chip.quantity}` : '';

  const statusName = (raw: string) => {
    if (ctx.acceptStatus && raw === ctx.acceptStatus) return 'Quest accepted';
    if (ctx.completeStatus && raw === ctx.completeStatus) return 'Quest done';
    const id = slugQuestId(ctx.questId);
    if (raw === `${id}_started`) return 'Quest accepted';
    if (raw === `${id}_complete`) return 'Quest done';
    const stepMatch = raw.match(new RegExp(`^${id}_step_(\\d+)$`));
    if (stepMatch) return `Step ${stepMatch[1]}`;
    return humanizeKey(raw) || 'Status';
  };

  switch (chip.kind) {
    case 'requires_status':
      return statusName(value);
    case 'requires_not_status':
      return `Not: ${statusName(value)}`;
    case 'requires_level':
      return value ? `Level ${value}+` : 'Level';
    case 'requires_not_level':
      return value ? `Not: Level ${value}+` : 'Not: Level';
    case 'requires_currency':
      return value ? `Currency ${value}+` : 'Currency';
    case 'requires_not_currency':
      return value ? `Not: Currency ${value}+` : 'Not: Currency';
    case 'requires_item':
      return `Has ${itemLabel}${qty}`;
    case 'requires_not_item':
      return `Not: ${itemLabel}${qty}`;
    case 'requires_class':
      return value ? `Class: ${humanizeKey(value)}` : 'Class';
    case 'requires_not_class':
      return value ? `Not: ${humanizeKey(value)}` : 'Not: Class';
    case 'show_status':
      return value ? `Also: ${statusName(value)}` : 'Also show when';
    default:
      return value;
  }
}

export function chipTooltip(chip: QuestConditionChip): string {
  const qty = chip.quantity && chip.quantity > 1 ? `:${chip.quantity}` : '';
  const value = chip.kind.includes('item') ? `${chip.value}${qty}` : chip.value;
  return `${chip.kind}=${value}`;
}

/** First new journal step, lined up with an optional NPC Quest role. */
export function createFirstStep(ctx: QuestStepContext, journalText = ''): QuestStep {
  const accept = clean(ctx.acceptStatus) || stepStatusKey(ctx.questId, 1);
  const complete = clean(ctx.completeStatus) || completeStatusKey(ctx.questId);
  return emptyQuestStep({
    quest_text: journalText,
    requires_status: accept,
    requires_not_status: complete,
  });
}

/**
 * Append a step and chain statuses: the previous last step is hidden by the
 * new step's enter status, and the new step is hidden by the quest-done status.
 */
export function addQuestStep(steps: QuestStep[], ctx: QuestStepContext): QuestStep[] {
  const complete = clean(ctx.completeStatus) || completeStatusKey(ctx.questId);
  if (!steps.length) return [createFirstStep(ctx)];
  const nextNumber = steps.length + 1;
  const enter = stepStatusKey(ctx.questId, nextNumber);
  const previous = steps[steps.length - 1];
  const prevNot = splitCsv(previous.requires_not_status).filter((value) => value !== complete);
  if (!prevNot.includes(enter)) prevNot.push(enter);
  const updatedPrevious = { ...previous, requires_not_status: joinCsv(prevNot) };
  const next = emptyQuestStep({
    requires_status: enter,
    requires_not_status: complete,
  });
  return [...steps.slice(0, -1), updatedPrevious, next];
}

export function reorderQuestSteps(steps: QuestStep[], fromIndex: number, toIndex: number): QuestStep[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= steps.length || toIndex >= steps.length) {
    return steps;
  }
  const next = steps.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function replaceToken(list: string, from: string, to: string): string {
  if (!from || from === to) return list;
  return joinCsv(splitCsv(list).map((value) => (value === from ? to : value)));
}

function ensureToken(list: string, token: string): string {
  if (!token) return list;
  const values = splitCsv(list);
  if (!values.includes(token)) values.push(token);
  return joinCsv(values);
}

/**
 * Keep the first step's enter status and every step's "not done" status lined
 * up with the NPC Quest role's accept and complete statuses.
 */
export function alignStepsWithRole(
  steps: QuestStep[],
  role: { acceptStatus: string; completeStatus: string; previousAccept?: string; previousComplete?: string },
  questId: string,
): QuestStep[] {
  const accept = clean(role.acceptStatus) || stepStatusKey(questId, 1);
  const complete = clean(role.completeStatus) || completeStatusKey(questId);
  const prevAccept = clean(role.previousAccept);
  const prevComplete = clean(role.previousComplete);
  const list = steps.length ? steps.map((step) => emptyQuestStep(step)) : [createFirstStep({ questId, acceptStatus: accept, completeStatus: complete })];
  return list.map((step, index) => {
    let requires_status = step.requires_status;
    let requires_not_status = step.requires_not_status;
    if (index === 0) {
      if (prevAccept && splitCsv(requires_status).includes(prevAccept)) {
        requires_status = replaceToken(requires_status, prevAccept, accept);
      } else if (!requires_status) {
        requires_status = accept;
      } else if (!splitCsv(requires_status).includes(accept) && !prevAccept) {
        requires_status = ensureToken(requires_status, accept);
      }
    }
    if (prevComplete && splitCsv(requires_not_status).includes(prevComplete)) {
      requires_not_status = replaceToken(requires_not_status, prevComplete, complete);
    } else if (index === list.length - 1 && !splitCsv(requires_not_status).includes(complete)) {
      requires_not_status = ensureToken(requires_not_status, complete);
    }
    return { ...step, requires_status, requires_not_status };
  });
}

export function stepsFromImported(raw: unknown): QuestStep[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((entry, index) => {
    const record = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    return emptyQuestStep({
      id: typeof record.id === 'string' && record.id ? record.id : `imported-${index}`,
      blockIndex: Number.isInteger(record.blockIndex) ? (record.blockIndex as number) : index,
      quest_text: String(record.quest_text ?? ''),
      requires_status: String(record.requires_status ?? ''),
      requires_not_status: String(record.requires_not_status ?? ''),
      requires_level: String(record.requires_level ?? ''),
      requires_not_level: String(record.requires_not_level ?? ''),
      requires_currency: String(record.requires_currency ?? ''),
      requires_not_currency: String(record.requires_not_currency ?? ''),
      requires_item: String(record.requires_item ?? ''),
      requires_not_item: String(record.requires_not_item ?? ''),
      requires_class: String(record.requires_class ?? ''),
      requires_not_class: String(record.requires_not_class ?? ''),
      show_status: String(record.show_status ?? ''),
    });
  });
}

/** Flatten first-step fields for callers that still read the old single-stage shape. */
export function flattenFirstStep(steps: QuestStep[]): Partial<QuestStep> & { itemRequirements?: never } {
  const first = steps[0] || emptyQuestStep();
  return {
    quest_text: first.quest_text,
    requires_status: first.requires_status,
    requires_not_status: first.requires_not_status,
    requires_level: first.requires_level,
    requires_not_level: first.requires_not_level,
    requires_currency: first.requires_currency,
    requires_not_currency: first.requires_not_currency,
    requires_item: first.requires_item,
    requires_not_item: first.requires_not_item,
    requires_class: first.requires_class,
    requires_not_class: first.requires_not_class,
    show_status: first.show_status,
  };
}
