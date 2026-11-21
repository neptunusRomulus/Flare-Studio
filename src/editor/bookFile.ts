/**
 * books/*.txt parse and merge. Matches MenuBook: header pos/align/close/
 * background/soundfx_open/soundfx_close plus [text], [image], [button],
 * [event_open], [event_close]. There is no [book] section and no title key.
 * Untouched files stay byte-identical; only edited keys and added/removed
 * blocks are rewritten. Empty values are omitted. INCLUDE lines and unknown
 * keys stay. Header keys that were not in the file are not invented on save.
 */

export type BookJustify = 'left' | 'center' | 'right';

export const DEFAULT_BOOK_SIZE = { x: 0, y: 0, w: 1137, h: 700 };

export const BOOK_ALIGNMENTS = [
  'topleft', 'top', 'topright', 'left', 'center', 'right',
  'bottomleft', 'bottom', 'bottomright',
  'frame_topleft', 'frame_top', 'frame_topright', 'frame_left', 'frame_center',
  'frame_right', 'frame_bottomleft', 'frame_bottom', 'frame_bottomright',
] as const;

/** Event component keys MenuBook accepts via EventManager::loadEventComponentString. */
export const BOOK_EVENT_KEYS = [
  'tooltip', 'intermap', 'intermap_id', 'intermap_random', 'intramap',
  'mapmod', 'mapmod_toggle', 'soundfx', 'loot', 'loot_count', 'msg', 'shakycam',
  'requires_status', 'requires_not_status', 'requires_level', 'requires_not_level',
  'requires_currency', 'requires_not_currency', 'requires_item', 'requires_not_item',
  'requires_class', 'requires_not_class', 'requires_tile', 'requires_not_tile',
  'set_status', 'unset_status', 'remove_currency', 'remove_item',
  'reward_xp', 'reward_currency', 'reward_item', 'reward_loot', 'reward_loot_count',
  'restore', 'power', 'power_path', 'power_damage', 'power_stats', 'power_level',
  'spawn', 'spawn_level', 'stash', 'npc', 'music', 'cutscene', 'repeat',
  'save_game', 'book', 'script', 'chance_exec', 'respec', 'show_on_minimap',
  'parallax_layers', 'random_status', 'procgen_filename', 'procgen_link', 'procgen_door_level',
] as const;

export const BOOK_EVENT_KEY_SET = new Set<string>(BOOK_EVENT_KEYS);

export type BookHeaderKey = 'pos' | 'align' | 'background' | 'close' | 'soundfxOpen' | 'soundfxClose';
export type BookPresent = Partial<Record<BookHeaderKey, boolean>>;

export type BookEventComponent = { key: string; value: string };

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

export type BookButtonBlock = {
  kind: 'button';
  x: number;
  y: number;
  image?: string;
  text?: string;
  components: BookEventComponent[];
};

export type BookEventBlock = {
  kind: 'event';
  section: 'event_open' | 'event_close';
  components: BookEventComponent[];
};

export type BookOtherBlock = {
  kind: 'other';
  section: string;
  raw: string[];
};

export type BookBlock = BookTextBlock | BookImageBlock | BookButtonBlock | BookEventBlock | BookOtherBlock;

export type BookFile = {
  pos: { x: number; y: number; w: number; h: number };
  align: string;
  close?: { x: number; y: number };
  background: string;
  soundfxOpen?: string;
  soundfxClose?: string;
  present: BookPresent;
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

function hasKey(entries: Entry[], key: string): boolean {
  return entries.some((entry) => entry.kind === 'key' && entry.key === key);
}

function setKey(entries: Entry[], key: string, value: string, after = 0): void {
  const at = entries.findIndex((entry, i) => i >= after && entry.kind === 'key' && entry.key === key);
  if (at >= 0) {
    const entry = entries[at];
    if (entry.kind === 'key') {
      entry.value = value;
      return;
    }
  }
  let last = after;
  for (let i = after; i < entries.length; i += 1) {
    if (entries[i].kind === 'key') last = i + 1;
  }
  entries.splice(last, 0, { kind: 'key', key, value });
}

function removeKey(entries: Entry[], key: string): void {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry.kind === 'key' && entry.key === key) entries.splice(i, 1);
  }
}

function setOrRemove(entries: Entry[], key: string, value: string | undefined): void {
  if (value && value.trim()) setKey(entries, key, value.trim());
  else removeKey(entries, key);
}

function parseComponents(body: Entry[], skip: Set<string>): BookEventComponent[] {
  const components: BookEventComponent[] = [];
  for (const entry of body) {
    if (entry.kind !== 'key' || skip.has(entry.key)) continue;
    components.push({ key: entry.key, value: entry.value });
  }
  return components;
}

function writeComponents(entries: Entry[], components: BookEventComponent[], skip: Set<string>): void {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry.kind === 'key' && !skip.has(entry.key)) entries.splice(i, 1);
  }
  for (const component of components) {
    if (!component.key.trim() || !String(component.value ?? '').trim()) continue;
    entries.push({ kind: 'key', key: component.key.trim(), value: String(component.value).trim() });
  }
}

const BUTTON_LAYOUT_KEYS = new Set(['button_pos', 'button_image', 'text']);

export function parseBookText(content: string): BookFile {
  const doc = parseEntries(content);
  const first = doc.findIndex((entry) => entry.kind === 'section');
  const header = first < 0 ? doc : doc.slice(0, first);
  const present: BookPresent = {
    pos: hasKey(header, 'pos'),
    align: hasKey(header, 'align'),
    background: hasKey(header, 'background'),
    close: hasKey(header, 'close'),
    soundfxOpen: hasKey(header, 'soundfx_open'),
    soundfxClose: hasKey(header, 'soundfx_close'),
  };
  const posParts = ints(keyValue(header, 'pos') || `${DEFAULT_BOOK_SIZE.x},${DEFAULT_BOOK_SIZE.y},${DEFAULT_BOOK_SIZE.w},${DEFAULT_BOOK_SIZE.h}`, 4);
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
      const shadowRaw = keyValue(body, 'text_shadow');
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
        shadow: shadowRaw ? shadowRaw === 'true' : undefined,
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
    if (section === 'button') {
      const pos = ints(keyValue(body, 'button_pos'), 2);
      blocks.push({
        kind: 'button',
        x: pos[0],
        y: pos[1],
        image: keyValue(body, 'button_image') || undefined,
        text: keyValue(body, 'text') || undefined,
        components: parseComponents(body, BUTTON_LAYOUT_KEYS),
      });
      return;
    }
    if (section === 'event_open' || section === 'event_close') {
      blocks.push({
        kind: 'event',
        section,
        components: parseComponents(body, new Set()),
      });
      return;
    }
    blocks.push({ kind: 'other', section, raw: exportEntries(doc.slice(start, end)).replace(/\n$/, '').split('\n') });
  });
  return {
    pos: { x: posParts[0], y: posParts[1], w: posParts[2] || DEFAULT_BOOK_SIZE.w, h: posParts[3] || DEFAULT_BOOK_SIZE.h },
    align: keyValue(header, 'align') || (present.align ? '' : 'center'),
    close: closeParts ? { x: closeParts[0], y: closeParts[1] } : undefined,
    background: keyValue(header, 'background'),
    soundfxOpen: keyValue(header, 'soundfx_open') || undefined,
    soundfxClose: keyValue(header, 'soundfx_close') || undefined,
    present,
    blocks,
  };
}

export type BookEdits = {
  pos?: BookFile['pos'];
  align?: string;
  close?: BookFile['close'] | null;
  background?: string;
  soundfxOpen?: string | null;
  soundfxClose?: string | null;
  present?: BookPresent;
  /** If set, replaces the block list (add/remove/reorder/move/edit). */
  blocks?: BookBlock[];
};

function textPos(block: BookTextBlock): string {
  return `${block.x},${block.y},${block.width},${block.justify}`;
}

function textFont(block: BookTextBlock): string {
  return `${block.fontColor.r},${block.fontColor.g},${block.fontColor.b},${block.fontStyle}`;
}

function writeComponentEntries(components: BookEventComponent[]): Entry[] {
  return components
    .filter((component) => component.key.trim() && String(component.value ?? '').trim())
    .map((component) => ({ kind: 'key' as const, key: component.key.trim(), value: String(component.value).trim() }));
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

function writeButtonBlock(block: BookButtonBlock): Entry[] {
  const entries: Entry[] = [
    { kind: 'section', name: 'button' },
    { kind: 'key', key: 'button_pos', value: `${block.x},${block.y}` },
  ];
  if (block.image) entries.push({ kind: 'key', key: 'button_image', value: block.image });
  if (block.text) entries.push({ kind: 'key', key: 'text', value: block.text });
  entries.push(...writeComponentEntries(block.components));
  return entries;
}

function writeEventBlock(block: BookEventBlock): Entry[] {
  return [
    { kind: 'section', name: block.section },
    ...writeComponentEntries(block.components),
  ];
}

function sameComponents(a: BookEventComponent[], b: BookEventComponent[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((row, i) => row.key === b[i].key && row.value === b[i].value);
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

function sameButton(a: BookButtonBlock, b: BookButtonBlock): boolean {
  return a.x === b.x && a.y === b.y && (a.image || '') === (b.image || '') && (a.text || '') === (b.text || '')
    && sameComponents(a.components, b.components);
}

function sameEvent(a: BookEventBlock, b: BookEventBlock): boolean {
  return a.section === b.section && sameComponents(a.components, b.components);
}

function patchTextBody(body: Entry[], block: BookTextBlock): void {
  setKey(body, 'text_pos', textPos(block));
  setKey(body, 'text_font', textFont(block));
  setKey(body, 'text', block.text);
  setOrRemove(body, 'text_shadow', block.shadow ? 'true' : '');
  setOrRemove(body, 'requires_status', block.requiresStatus);
  setOrRemove(body, 'requires_not_status', block.requiresNotStatus);
}

function patchImageBody(body: Entry[], block: BookImageBlock): void {
  setKey(body, 'image_pos', `${block.x},${block.y}`);
  setOrRemove(body, 'image', block.image);
  setOrRemove(body, 'image_icon', block.imageIcon);
  setOrRemove(body, 'requires_status', block.requiresStatus);
  setOrRemove(body, 'requires_not_status', block.requiresNotStatus);
}

function patchButtonBody(body: Entry[], block: BookButtonBlock): void {
  setKey(body, 'button_pos', `${block.x},${block.y}`);
  setOrRemove(body, 'button_image', block.image);
  setOrRemove(body, 'text', block.text);
  writeComponents(body, block.components, BUTTON_LAYOUT_KEYS);
}

function patchEventBody(body: Entry[], block: BookEventBlock): void {
  writeComponents(body, block.components, new Set());
}

function sectionOf(block: BookBlock): string {
  if (block.kind === 'event') return block.section;
  if (block.kind === 'other') return block.section;
  return block.kind;
}

export function mergeBookText(existingText: string, edits: BookEdits = {}): string {
  const text = String(existingText || '').replace(/\r/g, '');
  if (!text.trim()) {
    const template = parseBookText(DEFAULT_BOOK_TEMPLATE);
    return exportBookFile({
      ...template,
      pos: edits.pos ?? template.pos,
      align: edits.align ?? template.align,
      close: edits.close === null ? undefined : (edits.close ?? template.close),
      background: edits.background ?? template.background,
      soundfxOpen: edits.soundfxOpen === null ? undefined : (edits.soundfxOpen ?? template.soundfxOpen),
      soundfxClose: edits.soundfxClose === null ? undefined : (edits.soundfxClose ?? template.soundfxClose),
      present: { pos: true, align: true, background: true, close: true, ...edits.present },
      blocks: edits.blocks ?? template.blocks,
    });
  }
  const original = parseBookText(text);
  const present: BookPresent = { ...original.present, ...edits.present };
  const next: BookFile = {
    ...original,
    pos: edits.pos ?? original.pos,
    align: edits.align ?? original.align,
    close: edits.close === null ? undefined : (edits.close !== undefined ? edits.close : original.close),
    background: edits.background ?? original.background,
    soundfxOpen: edits.soundfxOpen === null ? undefined : (edits.soundfxOpen !== undefined ? edits.soundfxOpen : original.soundfxOpen),
    soundfxClose: edits.soundfxClose === null ? undefined : (edits.soundfxClose !== undefined ? edits.soundfxClose : original.soundfxClose),
    present,
    blocks: edits.blocks ?? original.blocks,
  };
  const doc = parseEntries(text);
  const first = doc.findIndex((entry) => entry.kind === 'section');
  const headerEnd = first < 0 ? doc.length : first;
  const header = doc.slice(0, headerEnd);
  if (present.pos) setKey(header, 'pos', `${next.pos.x},${next.pos.y},${next.pos.w},${next.pos.h}`);
  if (present.align) setOrRemove(header, 'align', next.align);
  if (present.background) setOrRemove(header, 'background', next.background);
  if (present.close) setOrRemove(header, 'close', next.close ? `${next.close.x},${next.close.y}` : '');
  if (present.soundfxOpen) setOrRemove(header, 'soundfx_open', next.soundfxOpen);
  if (present.soundfxClose) setOrRemove(header, 'soundfx_close', next.soundfxClose);
  doc.splice(0, headerEnd, ...header);
  const nextHeaderEnd = doc.findIndex((entry) => entry.kind === 'section');
  const resolvedHeaderEnd = nextHeaderEnd < 0 ? doc.length : nextHeaderEnd;

  if (!edits.blocks) return exportEntries(doc);

  const starts: number[] = [];
  doc.forEach((entry, i) => { if (entry.kind === 'section') starts.push(i); });
  const existingBlocks = starts.map((start, index) => ({
    start,
    end: index + 1 < starts.length ? starts[index + 1] : doc.length,
  }));

  const canPatch = existingBlocks.length === next.blocks.length && existingBlocks.every((slot, i) => {
    const section = (doc[slot.start] as { name?: string }).name;
    return section === sectionOf(next.blocks[i]);
  });
  if (canPatch) {
    for (let i = existingBlocks.length - 1; i >= 0; i -= 1) {
      const slot = existingBlocks[i];
      const block = next.blocks[i];
      const parsed = original.blocks[i];
      if (block.kind === 'text' && parsed && parsed.kind === 'text' && sameText(block, parsed)) continue;
      if (block.kind === 'image' && parsed && parsed.kind === 'image' && sameImage(block, parsed)) continue;
      if (block.kind === 'button' && parsed && parsed.kind === 'button' && sameButton(block, parsed)) continue;
      if (block.kind === 'event' && parsed && parsed.kind === 'event' && sameEvent(block, parsed)) continue;
      if (block.kind === 'other') continue;
      const body = doc.slice(slot.start + 1, slot.end);
      if (block.kind === 'text') patchTextBody(body, block);
      else if (block.kind === 'image') patchImageBody(body, block);
      else if (block.kind === 'button') patchButtonBody(body, block);
      else if (block.kind === 'event') patchEventBody(body, block);
      doc.splice(slot.start + 1, slot.end - slot.start - 1, ...body);
    }
    return exportEntries(doc);
  }

  const headerEntries = doc.slice(0, resolvedHeaderEnd);
  const rebuilt: Entry[] = [...headerEntries];
  if (rebuilt.length && rebuilt[rebuilt.length - 1].kind !== 'blank') rebuilt.push({ kind: 'blank' });
  next.blocks.forEach((block, index) => {
    if (index > 0) rebuilt.push({ kind: 'blank' });
    if (block.kind === 'text') rebuilt.push(...writeTextBlock(block));
    else if (block.kind === 'image') rebuilt.push(...writeImageBlock(block));
    else if (block.kind === 'button') rebuilt.push(...writeButtonBlock(block));
    else if (block.kind === 'event') rebuilt.push(...writeEventBlock(block));
    else rebuilt.push(...parseEntries(block.raw.join('\n')));
  });
  return exportEntries(rebuilt);
}

export function exportBookFile(book: BookFile): string {
  const lines: string[] = [];
  if (book.present.pos !== false) lines.push(`pos=${book.pos.x},${book.pos.y},${book.pos.w},${book.pos.h}`);
  if (book.align) lines.push(`align=${book.align}`);
  if (book.soundfxOpen) lines.push(`soundfx_open=${book.soundfxOpen}`);
  if (book.soundfxClose) lines.push(`soundfx_close=${book.soundfxClose}`);
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
    } else if (block.kind === 'button') {
      lines.push('[button]', `button_pos=${block.x},${block.y}`);
      if (block.image) lines.push(`button_image=${block.image}`);
      if (block.text) lines.push(`text=${block.text}`);
      for (const component of writeComponentEntries(block.components)) {
        if (component.kind === 'key') lines.push(`${component.key}=${component.value}`);
      }
    } else if (block.kind === 'event') {
      lines.push(`[${block.section}]`);
      for (const component of writeComponentEntries(block.components)) {
        if (component.kind === 'key') lines.push(`${component.key}=${component.value}`);
      }
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
