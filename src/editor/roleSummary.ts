/**
 * One-line summaries for the NPC role cards: "Dialogue · 6 topics, 14 lines".
 * Counts come from the same fields the editors write, so the card never lies.
 */
type Props = Record<string, unknown> | undefined;

const text = (value: unknown): string =>
  Array.isArray(value) ? value.map((v) => String(v)).join('\n') : value == null ? '' : String(value);

const lineList = (value: string): string[] =>
  value.split('\n').map((line) => line.trim()).filter(Boolean);

/** Item count of "1001,1002:3" style lists (status_stock lines carry a leading status). */
const countItems = (line: string): number => line.split(',').map((part) => part.trim()).filter(Boolean).length;

export type NpcDialogueSummary = { topics: number; lines: number };
export type NpcVendorSummary = { products: number; unlocks: number; random: number };
export type NpcQuestSummary = { name: string; acceptStatus: string } | null;

export function dialogueSummary(props: Props): NpcDialogueSummary {
  const raw = text(props?.dialogueTrees);
  if (!raw) return { topics: 0, lines: 0 };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { topics: 0, lines: 0 };
    const lines = parsed.reduce((sum, tree) => sum + (Array.isArray(tree?.dialogues) ? tree.dialogues.length : 0), 0);
    return { topics: parsed.length, lines };
  } catch {
    return { topics: 0, lines: 0 };
  }
}

export function vendorSummary(props: Props): NpcVendorSummary {
  const p = props || {};
  let products = 0;
  let unlocks = 0;
  let random = 0;

  for (const key of ['constant_stock', 'craft_constant_stock']) {
    for (const line of lineList(text(p[key]))) products += countItems(line);
  }
  for (const key of ['status_stock', 'craft_status_stock']) {
    for (const line of lineList(text(p[key]))) {
      const parts = line.split(',').map((part) => part.trim()).filter(Boolean);
      if (parts.length < 2) continue;
      unlocks += 1;
      products += parts.length - 1;
    }
  }
  for (const key of ['random_stock', 'craft_random_stock']) {
    random += lineList(text(p[key])).length;
  }
  // Stock group ids (Studio's reusable palettes) count as one shelf each.
  for (const key of ['constant_stock_group', 'status_stock_group', 'random_stock_group', 'craft_stock_group']) {
    if (text(p[key]).trim()) products += 1;
  }
  return { products, unlocks, random };
}

/** Quest name/accept status as written by the quest editor (read straight from the dialog topics). */
export function questSummary(props: Props): NpcQuestSummary {
  const raw = text(props?.dialogueTrees);
  if (!raw) return null;
  try {
    const trees = JSON.parse(raw);
    if (!Array.isArray(trees)) return null;
    const accept = trees.find((tree) => typeof tree?.dialogueId === 'string' && tree.dialogueId.endsWith('_accept'));
    if (!accept) return null;
    const requires = (accept.requirements || []).find((req: { type?: string }) => req?.type === 'status');
    return {
      name: String(accept.topic || '').trim() || accept.dialogueId,
      acceptStatus: String(requires?.value || '').trim(),
    };
  } catch {
    return null;
  }
}

export const dialogueSummaryText = (summary: NpcDialogueSummary): string =>
  summary.topics === 0 ? 'No topics yet' : `${summary.topics} topic${summary.topics === 1 ? '' : 's'} · ${summary.lines} line${summary.lines === 1 ? '' : 's'}`;

export const vendorSummaryText = (summary: NpcVendorSummary): string => {
  const parts: string[] = [];
  if (summary.products) parts.push(`${summary.products} product${summary.products === 1 ? '' : 's'}`);
  if (summary.unlocks) parts.push(`${summary.unlocks} unlock${summary.unlocks === 1 ? '' : 's'}`);
  if (summary.random) parts.push(`${summary.random} random`);
  return parts.length ? parts.join(' · ') : 'Empty shelf';
};

export const questSummaryText = (summary: NpcQuestSummary): string =>
  summary ? summary.name : 'No quest yet';
