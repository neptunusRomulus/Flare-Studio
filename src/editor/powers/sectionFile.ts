/**
 * Line-preserving editor for Flare files made of repeated [section] blocks
 * (powers/*.txt, powers/effects.txt). Untouched lines are kept byte-for-byte:
 * an edit rewrites only the line(s) of the key it changes.
 */

export type SectionEntry = { line: number; key: string; value: string };
export type SectionBlock = { start: number; end: number; id: string; entries: SectionEntry[]; includes: string[] };
export type SectionFile = { lines: string[]; trailingNewline: boolean; blocks: SectionBlock[] };

const SECTION_RE = /^\s*\[([^\]=]+)\]\s*$/;

export function parseSectionFile(text: string, sectionName: string): SectionFile {
  const normalized = String(text || '');
  const trailingNewline = normalized.endsWith('\n');
  const lines = normalized.split('\n');
  if (trailingNewline) lines.pop();
  const blocks: SectionBlock[] = [];
  let current: SectionBlock | null = null;
  const name = sectionName.toLowerCase();
  lines.forEach((raw, index) => {
    const m = raw.match(SECTION_RE);
    if (m) {
      if (current) current.end = index;
      current = m[1].trim().toLowerCase() === name ? { start: index, end: lines.length, id: '', entries: [], includes: [] } : null;
      if (current) blocks.push(current);
      return;
    }
    if (!current) return;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    if (/^INCLUDE\s+/.test(trimmed)) {
      current.includes.push(trimmed.replace(/^INCLUDE\s+/, '').trim());
      return;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    current.entries.push({ line: index, key, value });
    if (key === 'id' && !current.id) current.id = value;
  });
  return { lines, trailingNewline, blocks };
}

export function joinSectionFile(file: SectionFile): string {
  return file.lines.join('\n') + (file.trailingNewline ? '\n' : '');
}

/** All values of a key in a block, in file order. */
export function blockValues(block: SectionBlock, key: string): string[] {
  return block.entries.filter((entry) => entry.key === key).map((entry) => entry.value);
}

export function blockFirst(block: SectionBlock, key: string): string {
  return block.entries.find((entry) => entry.key === key)?.value ?? '';
}

/** Key → values for a block (repeated keys keep every value). */
export function blockRecord(block: SectionBlock): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const entry of block.entries) (out[entry.key] = out[entry.key] || []).push(entry.value);
  return out;
}

function lastContentLine(file: SectionFile, block: SectionBlock): number {
  let last = block.start;
  for (let i = block.start + 1; i < block.end; i += 1) if (file.lines[i].trim()) last = i;
  return last;
}

/**
 * Set every value of `key` in block `blockIndex` of `text`. Existing lines are
 * rewritten in place, extra values go right after the last one, missing values
 * remove lines. Returns the same text when nothing changes.
 */
export function setBlockValues(text: string, sectionName: string, blockIndex: number, key: string, values: string[]): string {
  const file = parseSectionFile(text, sectionName);
  const block = file.blocks[blockIndex];
  if (!block) return text;
  const wanted = values.map((v) => String(v).trim()).filter((v) => v !== '');
  const existing = block.entries.filter((entry) => entry.key === key);
  if (existing.length === wanted.length && existing.every((entry, i) => entry.value === wanted[i])) return text;
  const lines = file.lines.slice();
  const remove = new Set<number>();
  existing.forEach((entry, i) => {
    if (i < wanted.length) {
      if (entry.value !== wanted[i]) lines[entry.line] = `${key}=${wanted[i]}`;
    } else remove.add(entry.line);
  });
  const extra = wanted.slice(existing.length).map((v) => `${key}=${v}`);
  const insertAfter = existing.length ? existing[existing.length - 1].line : lastContentLine(file, block);
  const out: string[] = [];
  lines.forEach((line, index) => {
    if (!remove.has(index)) out.push(line);
    if (index === insertAfter) out.push(...extra);
  });
  return joinSectionFile({ ...file, lines: out });
}

export function setBlockValue(text: string, sectionName: string, blockIndex: number, key: string, value: string | null): string {
  const file = parseSectionFile(text, sectionName);
  const block = file.blocks[blockIndex];
  if (!block) return text;
  const values = blockValues(block, key);
  const next = value == null || value === '' ? values.slice(1) : [value, ...values.slice(1)];
  return setBlockValues(text, sectionName, blockIndex, key, next);
}

/** Append a new block (blank line before it when needed). */
export function appendBlock(text: string, sectionName: string, entries: Array<[string, string]>): string {
  const base = String(text || '');
  const body = [`[${sectionName}]`, ...entries.filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}=${v}`)];
  if (!base.trim()) return `${body.join('\n')}\n`;
  const withNl = base.endsWith('\n') ? base : `${base}\n`;
  const sep = withNl.endsWith('\n\n') ? '' : '\n';
  return `${withNl}${sep}${body.join('\n')}\n`;
}

/** Remove a block and one blank line that followed it. Comments above it stay. */
export function removeBlock(text: string, sectionName: string, blockIndex: number): string {
  const file = parseSectionFile(text, sectionName);
  const block = file.blocks[blockIndex];
  if (!block) return text;
  let end = block.end;
  // Keep trailing comments that belong to the next block.
  let back = end;
  while (back > block.start + 1 && (file.lines[back - 1].trim() === '' || file.lines[back - 1].trim().startsWith('#'))) back -= 1;
  if (file.lines.slice(back, end).some((line) => line.trim().startsWith('#'))) {
    end = back;
    while (end < block.end && file.lines[end].trim() === '') end += 1;
  }
  const lines = [...file.lines.slice(0, block.start), ...file.lines.slice(end)];
  // Drop a now-doubled blank line.
  const at = block.start;
  if (at > 0 && at < lines.length && lines[at].trim() === '' && lines[at - 1].trim() === '') lines.splice(at, 1);
  if (at >= lines.length) while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  return joinSectionFile({ ...file, lines });
}
