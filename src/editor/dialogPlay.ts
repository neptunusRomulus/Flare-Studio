/**
 * Editor-only dialog Play simulation. Pure: never reads or writes files.
 */
import type { DialogueRequirement, DialogueReward, DialogueTree, DialogueWorldEffect } from '@/types';

export type PlayState = {
  statuses: string[];
  level: number;
  currency: number;
  items: Record<string, number>;
  heroClass: string;
  randomPool: string[];
};

export type PlayRng = () => number;

export function emptyPlayState(partial?: Partial<PlayState>): PlayState {
  return {
    statuses: unique(partial?.statuses || []),
    level: partial?.level ?? 1,
    currency: partial?.currency ?? 0,
    items: { ...(partial?.items || {}) },
    heroClass: partial?.heroClass ?? '',
    randomPool: [...(partial?.randomPool || [])],
  };
}

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

function hasStatus(state: PlayState, status: string): boolean {
  return state.statuses.includes(status);
}

function itemCount(state: PlayState, itemId: string): number {
  return Number(state.items[itemId] || 0);
}

function parseItem(value: string): { id: string; quantity: number } {
  const [id, qty] = clean(value).split(':');
  return { id: clean(id), quantity: qty ? Math.max(1, Number(qty) || 1) : 1 };
}

/** Whether a topic is visible in the current simulated player state. */
export function topicIsVisible(tree: DialogueTree, state: PlayState): boolean {
  if (tree.responseOnly) return false;
  for (const req of tree.requirements || []) {
    if (!requirementMet(req, state)) return false;
  }
  return true;
}

export function requirementMet(req: DialogueRequirement, state: PlayState): boolean {
  const values = splitList(req.value);
  if (!values.length) return true;
  switch (req.type) {
    case 'status':
      return values.every((value) => hasStatus(state, value));
    case 'not_status':
      return values.every((value) => !hasStatus(state, value));
    case 'item':
      return values.every((token) => {
        const item = parseItem(token);
        return itemCount(state, item.id) >= item.quantity;
      });
    case 'not_item':
      return values.every((token) => {
        const item = parseItem(token);
        return itemCount(state, item.id) < item.quantity;
      });
    case 'level':
      return values.every((value) => state.level >= Number(value));
    case 'not_level':
      return values.every((value) => state.level < Number(value));
    case 'currency':
      return values.every((value) => state.currency >= Number(value));
    case 'not_currency':
      return values.every((value) => state.currency < Number(value));
    case 'class':
      if (!state.heroClass) return true;
      return values.includes(state.heroClass);
    case 'not_class':
      if (!state.heroClass) return true;
      return !values.includes(state.heroClass);
    case 'tile':
    case 'not_tile':
      return true;
    default:
      return true;
  }
}

export function visibleTopics(trees: DialogueTree[], state: PlayState): DialogueTree[] {
  return trees.filter((tree) => topicIsVisible(tree, state));
}

function setStatus(state: PlayState, status: string): PlayState {
  if (!status || hasStatus(state, status)) return state;
  return { ...state, statuses: [...state.statuses, status] };
}

function unsetStatus(state: PlayState, status: string): PlayState {
  if (!status || !hasStatus(state, status)) return state;
  return { ...state, statuses: state.statuses.filter((value) => value !== status) };
}

function addItem(state: PlayState, itemId: string, quantity: number): PlayState {
  if (!itemId) return state;
  const next = { ...state.items, [itemId]: itemCount(state, itemId) + quantity };
  return { ...state, items: next };
}

function takeItem(state: PlayState, itemId: string, quantity: number): PlayState {
  if (!itemId) return state;
  const nextCount = Math.max(0, itemCount(state, itemId) - quantity);
  const items = { ...state.items };
  if (nextCount) items[itemId] = nextCount;
  else delete items[itemId];
  return { ...state, items };
}

/** Apply a topic's rewards and world effects to a play state. Does not write files. */
export function applyTopicActions(tree: DialogueTree, state: PlayState, rng: PlayRng = Math.random): PlayState {
  let next = { ...state, statuses: [...state.statuses], items: { ...state.items }, randomPool: [...state.randomPool] };
  for (const reward of tree.rewards || []) next = applyReward(reward, next);
  for (const effect of tree.worldEffects || []) next = applyEffect(effect, next, rng);
  return next;
}

export function applyReward(reward: DialogueReward, state: PlayState): PlayState {
  const value = clean(reward.value);
  const qty = Math.max(1, Number(reward.quantity) || 1);
  switch (reward.type) {
    case 'gold':
      return { ...state, currency: state.currency + (Number(value) || 0) };
    case 'remove_gold':
      return { ...state, currency: Math.max(0, state.currency - (Number(value) || 0)) };
    case 'item':
      return addItem(state, value, qty);
    case 'remove_item':
      return takeItem(state, parseItem(value).id || value, parseItem(value).quantity || qty);
    default:
      return state;
  }
}

export function applyEffect(effect: DialogueWorldEffect, state: PlayState, rng: PlayRng = Math.random): PlayState {
  const value = clean(effect.value);
  switch (effect.type) {
    case 'set_status':
      return splitList(value).reduce((current, status) => setStatus(current, status), state);
    case 'unset_status':
      return splitList(value).reduce((current, status) => unsetStatus(current, status), state);
    case 'random_status':
      return applyRandomStatus(value, state, rng);
    default:
      return state;
  }
}

function applyRandomStatus(value: string, state: PlayState, rng: PlayRng): PlayState {
  const [command, ...rest] = value.split(',').map((part) => part.trim()).filter(Boolean);
  const action = (command || '').toLowerCase();
  if (action === 'clear') return { ...state, randomPool: [] };
  if (action === 'append') {
    return { ...state, randomPool: unique([...state.randomPool, ...rest]) };
  }
  if (action === 'roll') {
    if (!state.randomPool.length) return state;
    const index = Math.min(state.randomPool.length - 1, Math.max(0, Math.floor(rng() * state.randomPool.length)));
    return setStatus(state, state.randomPool[index]);
  }
  if (value) return setStatus(state, value);
  return state;
}

export function togglePlayStatus(state: PlayState, status: string, on?: boolean): PlayState {
  const shouldOn = on ?? !hasStatus(state, status);
  return shouldOn ? setStatus(state, status) : unsetStatus(state, status);
}
