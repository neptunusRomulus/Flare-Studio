/**
 * Add or remove a spoken line in a dialog tree without shifting later
 * components (rewards, statuses, portraits) that sit between the lines.
 */
export type DialogEntry = { key?: string; value?: string; raw?: string };
export type DialogLine = { speaker?: string; key?: string; text?: string; voice?: string; portrait?: string; portraitKey?: string; keepEmpty?: boolean; id?: string };
export type DialogTreeLike = { dialogues?: DialogLine[]; components?: DialogEntry[] };

const LINE_KEYS = new Set(['him', 'her', 'you']);
const PREFIX_KEYS = new Set(['voice', 'portrait_him', 'portrait_her', 'portrait_you', 'portrait']);

function isLine(entry: DialogEntry): boolean {
  return !entry.raw && !!entry.key && LINE_KEYS.has(entry.key);
}
function isPrefix(entry: DialogEntry): boolean {
  return !entry.raw && !!entry.key && PREFIX_KEYS.has(entry.key);
}

/** Indexes in `components` of the i-th spoken line, including its voice/portrait prefixes. */
export function lineComponentSpan(components: DialogEntry[] | undefined, lineIndex: number): { start: number; end: number } | null {
  if (!components || lineIndex < 0) return null;
  let seen = -1;
  let prefixStart = -1;
  for (let i = 0; i < components.length; i++) {
    const entry = components[i];
    if (isPrefix(entry)) {
      if (prefixStart < 0) prefixStart = i;
      continue;
    }
    if (isLine(entry)) {
      seen += 1;
      if (seen === lineIndex) {
        const start = prefixStart >= 0 ? prefixStart : i;
        return { start, end: i + 1 };
      }
      prefixStart = -1;
      continue;
    }
    prefixStart = -1;
  }
  return null;
}

/** Remove one spoken line and the file-order components that belong to it. */
export function removeDialogueLine<T extends DialogTreeLike>(tree: T, lineIndex: number): T {
  const dialogues = [...(tree.dialogues || [])];
  if (lineIndex < 0 || lineIndex >= dialogues.length) return tree;
  dialogues.splice(lineIndex, 1);
  const components = tree.components;
  if (!components || !components.length) return { ...tree, dialogues };
  const span = lineComponentSpan(components, lineIndex);
  if (!span) return { ...tree, dialogues };
  return { ...tree, dialogues, components: [...components.slice(0, span.start), ...components.slice(span.end)] };
}
