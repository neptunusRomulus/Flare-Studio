/**
 * books/*.txt parse and merge. Matches MenuBook (c6772106): header pos/align/
 * close/background plus [text], [image], [button], [event_open], [event_close].
 * Untouched files stay byte-identical; only edited keys and added/removed
 * blocks are rewritten.
 */

export type BookJustify = 'left' | 'center' | 'right';

export type BookTextBlock = {
  kind: 'text';
  text: string;
  x: number;
  y: number;
  width: number;
  justify: BookJustify;
  fontColor: { r: number; g: number; b: number };
  fontStyle: string;
  shadow?: boolean;
  requiresStatus?: string;
  requiresNotStatus?: string;
};

export type BookImageBlock = {
  kind: 'image';
  x: number;
  y: number;
  image: string;
  imageIcon?: string;
  requiresStatus?: string;
  requiresNotStatus?: string;
};

export type BookOtherBlock = {
  kind: 'other';
  section: string;
  raw: string[];
};

export type BookBlock = BookTextBlock | BookImageBlock | BookOtherBlock;

export type BookFile = {
  pos: { x: number; y: number; w: number; h: number };
  align: string;
  close?: { x: number; y: number };
  background: string;
  blocks: BookBlock[];
};

export const DEFAULT_BOOK_TEMPLATE = `pos=0,0,1137,700
align=center
background=images/menus/book.png
close=932,68

[text]
text_pos=155,120,400,left
text_font=0,0,0,font_regular
text=
`;

type Entry =
  | { kind: 'blank' }
  | { kind: 'comment'; text: string }
  | { kind: 'raw'; text: string }
  | { kind: 'section'; name: string }
  | { kind: 'key'; key: string; value: string };

function parseEntries(content: string): Entry[] {
  const lines = String(content || '').replace(/\r/g, '').split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed === '') return { kind: 'blank' as const };
    if (trimmed.startsWith('#')) return { kind: 'comment' as const, text: trimmed };
    if (trimmed.startsWith('[') && trimmed.endsWith(']') && !trimmed.includes('=')) {
      return { kind: 'section' as const, name: trimmed.slice(1, -1) };
    }
    if (trimmed.includes('=') && !trimmed.toUpperCase().startsWith('INCLUDE')) {
      const eq = trimmed.indexOf('=');
      return { kind: 'key' as const, key: trimmed.slice(0, eq).trim(), value: trimmed.slice(eq + 1) };
    }
    return { kind: 'raw' as const, text: trimmed };
  });
}

function exportEntries(doc: Entry[]): string {
  const lines = doc.map((entry) => {
    if (entry.kind === 'blank') return '';
    if (entry.kind === 'comment' || entry.kind === 'raw') return entry.text;
    if (entry.kind === 'section') return `[${entry.name}]`;
    if (entry.kind === 'key') return `${entry.key}=${entry.value}`;
    return '';
  });
  return `${lines.join('\n')}\n`;
}

function ints(value: string, count: number): number[] {
  const parts = value.split(',').map((part) => part.trim());
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const n = Number(parts[i]);
    out.push(Number.isFinite(n) ? Math.trunc(n) : 0);
  }
  return out;
}

function keyValue(entries: Entry[], key: string): string {
  const found = entries.find((entry) => entry.kind === 'key' && entry.key === key);
  return found && found.kind === 'key' ? found.value : '';
}

function setKey(entries: Entry[], key: string, value: string, after = 0): void {
  const at = entries.findIndex((entry, i) => i >= after && entry.kind === 'key' && entry.key === key);
  if (at >= 0 && entries[at].kind === 'key') {
    entries[at].value = value;
    return;
  }
  let last = after;
  for (let i = after; i < entries.length; i += 1) {
    if (entries[i].kind === 'key') last = i + 1;
  }
  entries.splice(last, 0, { kind: 'key', key, value });
}

export function parseBookText(content: string): BookFile {
  const doc = parseEntries(content);
  const first = doc.findIndex((entry) => entry.kind === 'section');
  const header = first < 0 ? doc : doc.slice(0, first);
  const posParts = ints(keyValue(header, 'pos') || '0,0,1137,700', 4);
  const closeParts = keyValue(header, 'close') ? ints(keyValue(header, 'close'), 2) : undefined;
  const blocks: BookBlock[] = [];
  const starts: number[] = [];
  doc.forEach((entry, i) => { if (entry.kind === 'section') starts.push(i); });
  starts.forEach((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : doc.length;
    const section = (doc[start] as { name: string }).name;
    const body = doc.slice(start + 1, end);
    if (section === 'text') {
      const pos = keyValue(body, 'text_pos');
      const parts = pos.split(',').map((part) => part.trim());
      const font = keyValue(body, 'text_font');
      const fontParts = font.split(',').map((part) => part.trim());
      const justify = (parts[3] === 'center' || parts[3] === 'right' ? parts[3] : 'left') as BookJustify;
      blocks.push({
        kind: 'text',
        text: keyValue(body, 'text'),
        x: Number(parts[0]) || 0,
        y: Number(parts[1]) || 0,
        width: Number(parts[2]) || 0,
        justify,
        fontColor: {
          r: Number(fontParts[0]) || 0,
          g: Number(fontParts[1]) || 0,
          b: Number(fontParts[2]) || 0,
        },
        fontStyle: fontParts[3] || 'font_regular',
        shadow: keyValue(body, 'text_shadow') ? keyValue(body, 'text_shadow') === 'true' : undefined,
        requiresStatus: keyValue(body, 'requires_status') || undefined,
        requiresNotStatus: keyValue(body, 'requires_not_status') || undefined,
      });
      return;
    }
    if (section === 'image') {
      const pos = ints(keyValue(body, 'image_pos'), 2);
      blocks.push({
        kind: 'image',
        x: pos[0],
        y: pos[1],
        image: keyValue(body, 'image'),
        imageIcon: keyValue(body, 'image_icon') || undefined,
        requiresStatus: keyValue(body, 'requires_status') || undefined,
        requiresNotStatus: keyValue(body, 'requires_not_status') || undefined,
      });
      return;
    }
    blocks.push({ kind: 'other', section, raw: exportEntries(doc.slice(start, end)).replace(/\n$/, '').split('\n') });
  });
  return {
    pos: { x: posParts[0], y: posParts[1], w: posParts[2] || 1137, h: posParts[3] || 700 },
    align: keyValue(header, 'align') || 'center',
    close: closeParts ? { x: closeParts[0], y: closeParts[1] } : undefined,
    background: keyValue(header, 'background'),
    blocks,
  };
}

export type BookEdits = {
  pos?: BookFile['pos'];
  align?: string;
  close?: BookFile['close'];
  background?: string;
  /** If set, replaces the block list (add/remove/reorder/move/edit). */
  blocks?: BookBlock[];
};

function textPos(block: BookTextBlock): string {
  return `${block.x},${block.y},${block.width},${block.justify}`;
}

function textFont(block: BookTextBlock): string {
  return `${block.fontColor.r},${block.fontColor.g},${block.fontColor.b},${block.fontStyle}`;
}

function writeTextBlock(block: BookTextBlock): Entry[] {
  const entries: Entry[] = [
    { kind: 'section', name: 'text' },
    { kind: 'key', key: 'text_pos', value: textPos(block) },
    { kind: 'key', key: 'text_font', value: textFont(block) },
  ];
  if (block.shadow) entries.push({ kind: 'key', key: 'text_shadow', value: 'true' });
  entries.push({ kind: 'key', key: 'text', value: block.text });
  if (block.requiresStatus) entries.push({ kind: 'key', key: 'requires_status', value: block.requiresStatus });
  if (block.requiresNotStatus) entries.push({ kind: 'key', key: 'requires_not_status', value: block.requiresNotStatus });
  return entries;
}

function writeImageBlock(block: BookImageBlock): Entry[] {
  const entries: Entry[] = [
    { kind: 'section', name: 'image' },
    { kind: 'key', key: 'image_pos', value: `${block.x},${block.y}` },
  ];
  if (block.image) entries.push({ kind: 'key', key: 'image', value: block.image });
  if (block.imageIcon) entries.push({ kind: 'key', key: 'image_icon', value: block.imageIcon });
  if (block.requiresStatus) entries.push({ kind: 'key', key: 'requires_status', value: block.requiresStatus });
  if (block.requiresNotStatus) entries.push({ kind: 'key', key: 'requires_not_status', value: block.requiresNotStatus });
  return entries;
}

function sameText(a: BookTextBlock, b: BookTextBlock): boolean {
  return textPos(a) === textPos(b) && textFont(a) === textFont(b) && a.text === b.text
    && Boolean(a.shadow) === Boolean(b.shadow)
    && (a.requiresStatus || '') === (b.requiresStatus || '')
    && (a.requiresNotStatus || '') === (b.requiresNotStatus || '');
}

function sameImage(a: BookImageBlock, b: BookImageBlock): boolean {
  return a.x === b.x && a.y === b.y && a.image === b.image && (a.imageIcon || '') === (b.imageIcon || '')
    && (a.requiresStatus || '') === (b.requiresStatus || '')
    && (a.requiresNotStatus || '') === (b.requiresNotStatus || '');
}

export function mergeBookText(existingText: string, edits: BookEdits = {}): string {
  const text = String(existingText || '').replace(/\r/g, '');
  if (!text.trim()) return exportBookFile({ ...parseBookText(DEFAULT_BOOK_TEMPLATE), ...edits, blocks: edits.blocks ?? parseBookText(DEFAULT_BOOK_TEMPLATE).blocks });
  const original = parseBookText(text);
  const next: BookFile = {
    ...original,
    pos: edits.pos ?? original.pos,
    align: edits.align ?? original.align,
    close: edits.close !== undefined ? edits.close : original.close,
    background: edits.background ?? original.background,
    blocks: edits.blocks ?? original.blocks,
  };
  const doc = parseEntries(text);
  const first = doc.findIndex((entry) => entry.kind === 'section');
  const headerEnd = first < 0 ? doc.length : first;
  setKey(doc, 'pos', `${next.pos.x},${next.pos.y},${next.pos.w},${next.pos.h}`);
  setKey(doc, 'align', next.align);
  if (next.background) setKey(doc, 'background', next.background);
  if (next.close) setKey(doc, 'close', `${next.close.x},${next.close.y}`);

  if (!edits.blocks) return exportEntries(doc);

  const starts: number[] = [];
  doc.forEach((entry, i) => { if (entry.kind === 'section') starts.push(i); });
  const existingBlocks = starts.map((start, index) => ({
    start,
    end: index + 1 < starts.length ? starts[index + 1] : doc.length,
  }));

  // If counts and kinds align, patch in place so comments and unknown keys stay.
  const canPatch = existingBlocks.length === next.blocks.length && existingBlocks.every((slot, i) => {
    const section = (doc[slot.start] as { name?: string }).name;
    const block = next.blocks[i];
    if (block.kind === 'text' || block.kind === 'image') return section === block.kind;
    return section === block.section;
  });
  if (canPatch) {
    for (let i = existingBlocks.length - 1; i >= 0; i -= 1) {
      const slot = existingBlocks[i];
      const block = next.blocks[i];
      const parsed = original.blocks[i];
      if (block.kind === 'text' && parsed && parsed.kind === 'text' && sameText(block, parsed)) continue;
      if (block.kind === 'image' && parsed && parsed.kind === 'image' && sameImage(block, parsed)) continue;
      if (block.kind === 'text') {
        const body = doc.slice(slot.start + 1, slot.end);
        setKey(body, 'text_pos', textPos(block));
        setKey(body, 'text_font', textFont(block));
        setKey(body, 'text', block.text);
        doc.splice(slot.start + 1, slot.end - slot.start - 1, ...body);
      } else if (block.kind === 'image') {
        const body = doc.slice(slot.start + 1, slot.end);
        setKey(body, 'image_pos', `${block.x},${block.y}`);
        if (block.image) setKey(body, 'image', block.image);
        doc.splice(slot.start + 1, slot.end - slot.start - 1, ...body);
      }
    }
    return exportEntries(doc);
  }

  const header = doc.slice(0, headerEnd);
  const rebuilt: Entry[] = [...header];
  if (rebuilt.length && rebuilt[rebuilt.length - 1].kind !== 'blank') rebuilt.push({ kind: 'blank' });
  next.blocks.forEach((block, index) => {
    if (index > 0) rebuilt.push({ kind: 'blank' });
    if (block.kind === 'text') rebuilt.push(...writeTextBlock(block));
    else if (block.kind === 'image') rebuilt.push(...writeImageBlock(block));
    else if (block.kind === 'other') rebuilt.push(...parseEntries(block.raw.join('\n')));
  });
  return exportEntries(rebuilt);
}

export function exportBookFile(book: BookFile): string {
  const lines = [
    `pos=${book.pos.x},${book.pos.y},${book.pos.w},${book.pos.h}`,
    `align=${book.align || 'center'}`,
  ];
  if (book.background) lines.push(`background=${book.background}`);
  if (book.close) lines.push(`close=${book.close.x},${book.close.y}`);
  book.blocks.forEach((block) => {
    lines.push('');
    if (block.kind === 'text') {
      lines.push('[text]', `text_pos=${textPos(block)}`, `text_font=${textFont(block)}`);
      if (block.shadow) lines.push('text_shadow=true');
      lines.push(`text=${block.text}`);
      if (block.requiresStatus) lines.push(`requires_status=${block.requiresStatus}`);
      if (block.requiresNotStatus) lines.push(`requires_not_status=${block.requiresNotStatus}`);
    } else if (block.kind === 'image') {
      lines.push('[image]', `image_pos=${block.x},${block.y}`);
      if (block.image) lines.push(`image=${block.image}`);
      if (block.imageIcon) lines.push(`image_icon=${block.imageIcon}`);
      if (block.requiresStatus) lines.push(`requires_status=${block.requiresStatus}`);
      if (block.requiresNotStatus) lines.push(`requires_not_status=${block.requiresNotStatus}`);
    } else {
      lines.push(...block.raw);
    }
  });
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

export function bookRelPath(name: string): string {
  const slug = String(name || 'book')
    .trim()
    .toLowerCase()
    .replace(/\.txt$/i, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'book';
  return `books/${slug}.txt`;
}
