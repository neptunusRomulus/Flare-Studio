/**
 * Write Quest "When done" rewards (set_status, reward_*) onto a turn-in NPC
 * dialog node, or onto a map event the user picked when no turn-in exists.
 * Leaves a file byte-identical when the target keys already match.
 */
import { questTurnInDialogueId } from './questFlow';

export type WhenDoneRewards = {
  set_status?: string;
  reward_xp?: string;
  reward_currency?: string;
  reward_item?: string;
  reward_loot?: string;
};

export type RewardTarget =
  | { kind: 'npc'; path: string; dialogueId: string }
  | { kind: 'event'; path: string; eventKey: string };

const REWARD_KEYS = ['set_status', 'reward_xp', 'reward_currency', 'reward_item', 'reward_loot'] as const;

export function rewardsFromWhenDone(whenDone: Record<string, unknown> | null | undefined): WhenDoneRewards {
  const src = whenDone && typeof whenDone === 'object' ? whenDone : {};
  const out: WhenDoneRewards = {};
  const setStatus = String(src.set_status ?? '').trim();
  if (setStatus) out.set_status = setStatus;
  const xp = String(src.xp ?? src.reward_xp ?? '').trim();
  if (xp) out.reward_xp = xp;
  const currency = String(src.currency ?? src.gold ?? src.reward_currency ?? '').trim();
  if (currency) out.reward_currency = currency;
  const items = src.items ?? src.reward_item;
  if (Array.isArray(items)) {
    const list = items
      .map((it) => {
        if (it && typeof it === 'object') {
          const id = String((it as { id?: unknown }).id ?? '').trim();
          const qty = String((it as { quantity?: unknown }).quantity ?? '1').trim() || '1';
          return id ? `${id}:${qty}` : '';
        }
        return String(it ?? '').trim();
      })
      .filter(Boolean);
    if (list.length) out.reward_item = list.join(',');
  } else if (String(items ?? '').trim()) {
    out.reward_item = String(items).trim();
  }
  const loot = String(src.loot ?? src.reward_loot ?? '').trim();
  if (loot) out.reward_loot = loot;
  return out;
}

function dialogIdOf(section: string[]): string {
  for (const line of section) {
    const m = line.trim().match(/^id=(.*)$/);
    if (m) return m[1].trim();
  }
  return '';
}

function sectionSetsStatus(section: string[], status: string): boolean {
  if (!status) return false;
  for (const line of section) {
    const m = line.trim().match(/^set_status=(.*)$/);
    if (!m) continue;
    if (m[1].split(',').some((tok) => tok.trim() === status)) return true;
  }
  return false;
}

function splitSections(text: string): { preamble: string[]; sections: { header: string; lines: string[] }[] } {
  const rows = String(text || '').split('\n');
  const preamble: string[] = [];
  const sections: { header: string; lines: string[] }[] = [];
  let current: { header: string; lines: string[] } | null = null;
  for (const raw of rows) {
    const header = raw.trim().match(/^\[([^\]]+)\]$/);
    if (header) {
      current = { header: header[1].trim(), lines: [raw] };
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(raw);
    else preamble.push(raw);
  }
  return { preamble, sections };
}

function joinFile(preamble: string[], sections: { header: string; lines: string[] }[]): string {
  const parts = [...preamble];
  for (const sec of sections) parts.push(...sec.lines);
  return parts.join('\n');
}

function applyKeysToSection(lines: string[], rewards: WhenDoneRewards): string[] {
  const wanted = new Map<string, string>();
  for (const key of REWARD_KEYS) {
    const val = rewards[key];
    if (val) wanted.set(key, val);
  }
  const seen = new Set<string>();
  const next: string[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0 || trimmed.startsWith('#')) {
      next.push(raw);
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (!wanted.has(key)) {
      next.push(raw);
      continue;
    }
    const indent = raw.slice(0, raw.length - raw.trimStart().length);
    next.push(`${indent}${key}=${wanted.get(key)}`);
    seen.add(key);
  }
  const missing = [...wanted.entries()].filter(([k]) => !seen.has(k));
  if (missing.length === 0) return next;
  // Insert new keys before the trailing empty lines of the section.
  let insertAt = next.length;
  while (insertAt > 0 && next[insertAt - 1].trim() === '') insertAt -= 1;
  const added = missing.map(([k, v]) => `${k}=${v}`);
  return [...next.slice(0, insertAt), ...added, ...next.slice(insertAt)];
}

export function findTurnInTarget(
  files: Record<string, string>,
  questId: string,
  completeStatus = '',
): RewardTarget | null {
  const wantId = questTurnInDialogueId(questId);
  let fallback: RewardTarget | null = null;
  for (const [path, text] of Object.entries(files)) {
    if (!path.startsWith('npcs/')) continue;
    const { sections } = splitSections(text);
    for (const sec of sections) {
      if (sec.header !== 'dialog') continue;
      const id = dialogIdOf(sec.lines);
      if (id === wantId) return { kind: 'npc', path, dialogueId: id };
      if (!fallback && sectionSetsStatus(sec.lines, completeStatus)) {
        fallback = { kind: 'npc', path, dialogueId: id || wantId };
      }
    }
  }
  return fallback;
}

export function applyWhenDoneRewards(
  files: Record<string, string>,
  target: RewardTarget,
  rewards: WhenDoneRewards,
): { files: Record<string, string>; changed: boolean } {
  const src = files[target.path];
  if (src == null) return { files, changed: false };
  const { preamble, sections } = splitSections(src);
  let hit = false;
  const nextSections = sections.map((sec) => {
    if (target.kind === 'npc') {
      if (sec.header !== 'dialog') return sec;
      const id = dialogIdOf(sec.lines);
      if (id !== target.dialogueId && !(!id && sectionSetsStatus(sec.lines, rewards.set_status || ''))) return sec;
    } else if (target.kind === 'event') {
      if (sec.header !== 'event') return sec;
      const id = dialogIdOf(sec.lines);
      const loc = sec.lines.find((l) => l.trim().startsWith('location='))?.trim().slice(9) || '';
      const key = target.eventKey;
      if (id !== key && loc !== key && `${target.path}#${id}` !== key && `${target.path}#${loc}` !== key) return sec;
    } else {
      return sec;
    }
    const lines = applyKeysToSection(sec.lines, rewards);
    if (lines.join('\n') === sec.lines.join('\n')) return sec;
    hit = true;
    return { ...sec, lines };
  });
  if (!hit) return { files, changed: false };
  const nextText = joinFile(preamble, nextSections);
  if (nextText === src) return { files, changed: false };
  return { files: { ...files, [target.path]: nextText }, changed: true };
}

/** List map events a user can attach When done rewards to. */
export function listMapEvents(files: Record<string, string>): { path: string; eventKey: string; label: string }[] {
  const out: { path: string; eventKey: string; label: string }[] = [];
  for (const [path, text] of Object.entries(files)) {
    if (!path.startsWith('maps/')) continue;
    const { sections } = splitSections(text);
    let index = 0;
    for (const sec of sections) {
      if (sec.header !== 'event') continue;
      index += 1;
      const id = dialogIdOf(sec.lines);
      const loc = sec.lines.find((l) => l.trim().startsWith('location='))?.trim().slice(9) || '';
      const eventKey = id || loc || String(index);
      out.push({ path, eventKey, label: `${path} — ${id || loc || `event ${index}`}` });
    }
  }
  return out;
}
