/** Power tree files (powers/trees/*.txt): tabs, power slots, and upgrade chains. */

export const POWER_TREE_PATH = 'powers/trees/default.txt';

export type KeyVal = { key: string; value: string };

export type PowerTreeTab = {
  kind: 'tab';
  raw: string;
  commentsBefore: string;
  title: string;
  background: string;
  entries: KeyVal[];
};

export type PowerTreeNode = {
  kind: 'power' | 'upgrade';
  raw: string;
  commentsBefore: string;
  id: string;
  tab: string;
  position: string;
  requires_point?: boolean;
  requires_level: string;
  requires_primary: string[];
  requires_power: string[];
  requires_status: string[];
  requires_not_status: string[];
  upgrades: string[];
  visible?: boolean;
  visible_check_locked?: boolean;
  visible_check_status?: boolean;
  entries: KeyVal[];
};

export type PowerTreeUnknown = {
  kind: 'unknown';
  section: string;
  raw: string;
  commentsBefore: string;
  body: string;
};

export type PowerTreeItem = PowerTreeTab | PowerTreeNode | PowerTreeUnknown;

export type PowerTreeFile = {
  background: string;
  headerRaw: string;
  headerEntries: KeyVal[];
  items: PowerTreeItem[];
  trailing: string;
};

const STRUCTURED = new Set([
  'id', 'tab', 'position', 'requires_point', 'requires_level',
  'requires_primary', 'requires_power', 'requires_status', 'requires_not_status',
  'upgrades', 'visible', 'visible_check_locked', 'visible_check_status',
  'title', 'background',
]);

export const DEPRECATED_TREE_KEYS = new Set([
  'visible_requires_status',
  'visible_requires_not_status',
]);

function splitLines(text: string): string[] {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

function isSectionHeader(line: string): string | null {
  const trimmed = line.trim();
  const m = trimmed.match(/^\[([^\]]+)\]$/);
  return m ? m[1].trim() : null;
}

function parseKeyVal(line: string): KeyVal | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) return null;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) return null;
  return { key: trimmed.slice(0, eq).trim(), value: trimmed.slice(eq + 1).trim() };
}

function parseBool(value: string): boolean | undefined {
  const s = value.trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return undefined;
}

function formatBool(value: boolean): string {
  return value ? 'true' : 'false';
}

export function valuesOf(entries: KeyVal[], key: string): string[] {
  return entries.filter((entry) => entry.key === key).map((entry) => entry.value);
}

export function firstValue(entries: KeyVal[], key: string, fallback = ''): string {
  return valuesOf(entries, key)[0] || fallback;
}

/** Replace every occurrence of key, keeping the first slot and inserting extras after it. */
export function setValues(entries: KeyVal[], key: string, next: string[]): KeyVal[] {
  const wanted = next.map((value) => String(value ?? '').trim()).filter((value) => value !== '');
  const out: KeyVal[] = [];
  let placed = false;
  for (const entry of entries) {
    if (entry.key !== key) {
      out.push(entry);
      continue;
    }
    if (!placed) {
      if (wanted.length === 0) {
        continue;
      }
      wanted.forEach((value) => out.push({ key, value }));
      placed = true;
      continue;
    }
    // drop leftover original lines for this key
  }
  if (!placed && wanted.length) {
    wanted.forEach((value) => out.push({ key, value }));
  }
  return out;
}

function commaList(value: string): string[] {
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}

function nodeFromEntries(kind: 'power' | 'upgrade', commentsBefore: string, raw: string, entries: KeyVal[]): PowerTreeNode {
  const upgradesLine = firstValue(entries, 'upgrades');
  const point = firstValue(entries, 'requires_point');
  const visible = firstValue(entries, 'visible');
  const visLocked = firstValue(entries, 'visible_check_locked');
  const visStatus = firstValue(entries, 'visible_check_status');
  return {
    kind,
    raw,
    commentsBefore,
    id: firstValue(entries, 'id'),
    tab: firstValue(entries, 'tab'),
    position: firstValue(entries, 'position'),
    requires_point: point === '' ? undefined : parseBool(point),
    requires_level: firstValue(entries, 'requires_level'),
    requires_primary: valuesOf(entries, 'requires_primary'),
    requires_power: valuesOf(entries, 'requires_power'),
    requires_status: valuesOf(entries, 'requires_status'),
    requires_not_status: valuesOf(entries, 'requires_not_status'),
    upgrades: upgradesLine ? commaList(upgradesLine) : [],
    visible: visible === '' ? undefined : parseBool(visible),
    visible_check_locked: visLocked === '' ? undefined : parseBool(visLocked),
    visible_check_status: visStatus === '' ? undefined : parseBool(visStatus),
    entries,
  };
}

function tabFromEntries(commentsBefore: string, raw: string, entries: KeyVal[]): PowerTreeTab {
  return {
    kind: 'tab',
    raw,
    commentsBefore,
    title: firstValue(entries, 'title'),
    background: firstValue(entries, 'background'),
    entries,
  };
}

function blockText(commentsBefore: string, section: string, entries: KeyVal[], previousRaw?: string): string {
  const lines: string[] = [];
  if (commentsBefore) {
    const commentLines = splitLines(commentsBefore);
    if (commentLines[commentLines.length - 1] === '') commentLines.pop();
    lines.push(...commentLines);
  }
  lines.push(`[${section}]`);
  for (const entry of entries) {
    if (!entry.key) continue;
    lines.push(`${entry.key}=${entry.value}`);
  }
  const prev = previousRaw ?? '';
  const extraBlank = /\n\n+$/.test(prev) || !prev ? '\n\n' : '\n';
  return `${lines.join('\n')}${extraBlank}`;
}

function rebuildItem(item: PowerTreeItem): string {
  if (item.kind === 'unknown') {
    return item.raw;
  }
  if (item.kind === 'tab') {
    return blockText(item.commentsBefore, 'tab', item.entries, item.raw);
  }
  return blockText(item.commentsBefore, item.kind, item.entries, item.raw);
}

export function parsePowerTree(text: string): PowerTreeFile {
  const source = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const endsWithNewline = source.endsWith('\n');
  const lines = splitLines(source);
  if (endsWithNewline && lines[lines.length - 1] === '') lines.pop();
  const items: PowerTreeItem[] = [];
  let headerEntries: KeyVal[] = [];
  let background = '';
  let headerRaw = '';
  let trailing = '';

  let i = 0;
  const headerLines: string[] = [];
  while (i < lines.length && !isSectionHeader(lines[i])) {
    headerLines.push(lines[i]);
    const kv = parseKeyVal(lines[i]);
    if (kv) {
      headerEntries.push(kv);
      if (kv.key === 'background') background = kv.value;
    }
    i += 1;
  }
  headerRaw = headerLines.length ? `${headerLines.join('\n')}${i < lines.length ? '\n' : ''}` : '';

  while (i < lines.length) {
    const commentStart = i;
    while (i < lines.length && !isSectionHeader(lines[i])) i += 1;
    if (i >= lines.length) {
      trailing = lines.slice(commentStart).join('\n');
      if (trailing !== '' && endsWithNewline) trailing += '\n';
      break;
    }
    const commentsBefore = commentStart === i ? '' : `${lines.slice(commentStart, i).join('\n')}\n`;
    const section = isSectionHeader(lines[i]) || 'unknown';
    const sectionStart = commentStart;
    i += 1;
    const bodyStart = i;
    while (i < lines.length && !isSectionHeader(lines[i])) i += 1;
    // Keep following blank/comment lines? No, they belong to the next item's commentsBefore
    // except we should include trailing blanks that are "inside" the section. Official files
    // put blanks after the last key, then maybe a comment for the next section.
    // comments for the next section start at the first comment or non-empty non-key? 
    // Safer: body is only key=value / empty / comments UNTIL we hit a blank line followed by a
    // comment that precedes the next section, or just take all lines until next [section]
    // and let commentsBefore of the next item include those comments.
    // That means this section's raw includes only up to last key (plus internal blanks)?
    // For exact unedited raw, raw must be lines[sectionStart..i) MINUS comments that will be
    // assigned to the next item.
    // Next item comments are lines after this section's last key=value (or [section] if none)
    // that come before the next [section]. But Empyrean has:
    //   requires_point=true
    //
    //   # shield bash
    //   [power]
    // If we give "# shield bash" to the next item, this item's raw should include the blank
    // after requires_point=true or not? Typically one blank stays with this section.
    // Split: trailing blanks after last content line stay in this raw; comment lines go to next.
    const untilNext = lines.slice(bodyStart, i);
    let cut = untilNext.length;
    // walk back comment/blank; keep at least the blanks immediately after the body as part of this block
    // Find last key=value or non-comment content
    let lastContent = -1;
    for (let j = 0; j < untilNext.length; j += 1) {
      const t = untilNext[j].trim();
      if (t && !t.startsWith('#')) lastContent = j;
    }
    if (lastContent >= 0) {
      // include one trailing blank if present
      cut = lastContent + 1;
      if (cut < untilNext.length && untilNext[cut].trim() === '') cut += 1;
    } else {
      cut = 0;
    }
    const bodyLines = untilNext.slice(0, cut);
    const raw = `${lines.slice(sectionStart, bodyStart).join('\n')}${bodyLines.length ? `\n${bodyLines.join('\n')}` : ''}\n`;
    const entries: KeyVal[] = [];
    for (const line of bodyLines) {
      const kv = parseKeyVal(line);
      if (kv) entries.push(kv);
    }
    // Rewind i so leftover comment lines are picked up as commentsBefore of the next item
    i = bodyStart + cut;
    if (section === 'tab') items.push(tabFromEntries(commentsBefore, raw, entries));
    else if (section === 'power' || section === 'upgrade') items.push(nodeFromEntries(section, commentsBefore, raw, entries));
    else items.push({ kind: 'unknown', section, raw, commentsBefore, body: bodyLines.join('\n') });
  }

  if (!trailing && String(text || '').endsWith('\n') && !headerRaw && items.length === 0) trailing = '';
  return { background, headerRaw, headerEntries, items, trailing };
}

function patchHeaderBackground(headerRaw: string, background: string): string {
  const lines = headerRaw ? splitLines(headerRaw) : [];
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  let found = false;
  const next = lines.map((line) => {
    const kv = parseKeyVal(line);
    if (!kv || kv.key !== 'background' || found) return line;
    found = true;
    return background ? `background=${background}` : null;
  }).filter((line): line is string => line !== null);
  if (!found && background) next.push(`background=${background}`);
  // If header was empty and we only added background, end with newline
  if (!next.length) return '';
  return `${next.join('\n')}\n`;
}

function itemDirty(item: PowerTreeItem): boolean {
  if (item.kind === 'unknown') return false;
  return item.raw !== rebuildItem(item);
}

export function serializePowerTree(tree: PowerTreeFile, opts?: { rebuildAll?: boolean }): string {
  const header = tree.background !== firstValue(tree.headerEntries, 'background') || opts?.rebuildAll
    ? patchHeaderBackground(tree.headerRaw, tree.background)
    : tree.headerRaw;
  const body = tree.items.map((item) => {
    if (opts?.rebuildAll && item.kind !== 'unknown') return rebuildItem(item);
    if (item.kind !== 'unknown' && itemDirty(item)) return rebuildItem(item);
    return item.raw;
  }).join('');
  let out = `${header}${body}${tree.trailing}`;
  if (out && !out.endsWith('\n')) out += '\n';
  return out;
}

export function listTreePaths(files: Record<string, string>): string[] {
  return Object.keys(files).filter((path) => /^powers\/trees\/.+\.txt$/i.test(path)).sort();
}

export function emptyTree(): PowerTreeFile {
  return { background: '', headerRaw: '', headerEntries: [], items: [], trailing: '' };
}

export function emptyTab(title = 'New tab'): PowerTreeTab {
  const entries = [{ key: 'title', value: title }];
  const item = tabFromEntries('', '', entries);
  item.raw = rebuildItem(item);
  return item;
}

export function emptyPower(tab = '0', position = '0,0'): PowerTreeNode {
  const entries: KeyVal[] = [
    { key: 'id', value: '' },
    { key: 'tab', value: tab },
    { key: 'position', value: position },
  ];
  const item = nodeFromEntries('power', '', '', entries);
  item.raw = rebuildItem(item);
  return item;
}

export function emptyUpgrade(id: string): PowerTreeNode {
  const entries: KeyVal[] = [{ key: 'id', value: id }];
  const item = nodeFromEntries('upgrade', '', '', entries);
  item.raw = rebuildItem(item);
  return item;
}

function withEntries(node: PowerTreeNode, entries: KeyVal[]): PowerTreeNode {
  return nodeFromEntries(node.kind, node.commentsBefore, node.raw, entries);
}

export function updateNode(node: PowerTreeNode, patch: Partial<Omit<PowerTreeNode, 'kind' | 'raw' | 'commentsBefore' | 'entries'>>): PowerTreeNode {
  let entries = node.entries;
  const apply = (key: string, values: string[]) => { entries = setValues(entries, key, values); };
  if (patch.id !== undefined) apply('id', [patch.id]);
  if (patch.tab !== undefined) apply('tab', node.kind === 'power' ? [patch.tab] : []);
  if (patch.position !== undefined) apply('position', node.kind === 'power' && patch.position ? [patch.position] : []);
  if (patch.requires_point !== undefined) apply('requires_point', patch.requires_point === undefined ? [] : [formatBool(patch.requires_point)]);
  if (Object.prototype.hasOwnProperty.call(patch, 'requires_point') && patch.requires_point === undefined) apply('requires_point', []);
  if (patch.requires_level !== undefined) apply('requires_level', patch.requires_level ? [patch.requires_level] : []);
  if (patch.requires_primary !== undefined) apply('requires_primary', patch.requires_primary);
  if (patch.requires_power !== undefined) apply('requires_power', patch.requires_power);
  if (patch.requires_status !== undefined) apply('requires_status', patch.requires_status);
  if (patch.requires_not_status !== undefined) apply('requires_not_status', patch.requires_not_status);
  if (patch.upgrades !== undefined) apply('upgrades', patch.upgrades.length ? [patch.upgrades.join(',')] : []);
  if (Object.prototype.hasOwnProperty.call(patch, 'visible')) {
    apply('visible', patch.visible === undefined ? [] : [formatBool(patch.visible)]);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'visible_check_locked')) {
    apply('visible_check_locked', patch.visible_check_locked === undefined ? [] : [formatBool(patch.visible_check_locked)]);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'visible_check_status')) {
    apply('visible_check_status', patch.visible_check_status === undefined ? [] : [formatBool(patch.visible_check_status)]);
  }
  const next = withEntries(node, entries);
  return next;
}

export function updateTab(tab: PowerTreeTab, patch: Partial<Pick<PowerTreeTab, 'title' | 'background'>>): PowerTreeTab {
  let entries = tab.entries;
  if (patch.title !== undefined) entries = setValues(entries, 'title', [patch.title]);
  if (patch.background !== undefined) entries = setValues(entries, 'background', patch.background ? [patch.background] : []);
  const next = tabFromEntries(tab.commentsBefore, tab.raw, entries);
  return next;
}

export function replaceItem(tree: PowerTreeFile, index: number, item: PowerTreeItem): PowerTreeFile {
  const items = tree.items.map((current, i) => (i === index ? item : current));
  return { ...tree, items };
}

export function parsePosition(value: string): { x: number; y: number } {
  const parts = String(value || '').split(',').map((part) => Number(part.trim()));
  return {
    x: Number.isFinite(parts[0]) ? parts[0] : 0,
    y: Number.isFinite(parts[1]) ? parts[1] : 0,
  };
}

export function formatPosition(x: number, y: number): string {
  return `${Math.round(x)},${Math.round(y)}`;
}

/** Pixel size of a power-tree icon square in the editor. */
export const POWER_TREE_NODE_SIZE = 32;

/** Place a new power to the right of the rightmost node, same row, by one icon width. */
export function nextPowerPosition(
  nodes: Array<{ position?: string }>,
  fallback = '0,0',
  size = POWER_TREE_NODE_SIZE,
): string {
  if (!nodes.length) return fallback;
  const rightmost = nodes
    .map((node) => parsePosition(node.position || ''))
    .reduce((best, point) => (point.x > best.x ? point : best));
  return formatPosition(rightmost.x + size, rightmost.y);
}

/** Consecutive [upgrade] blocks after a power whose ids are in that power's upgrades= list. */
export function ownedUpgradeIndexes(tree: PowerTreeFile, powerIndex: number): number[] {
  const power = tree.items[powerIndex];
  if (!power || power.kind !== 'power') return [];
  const want = new Set(power.upgrades);
  const out: number[] = [];
  for (let i = powerIndex + 1; i < tree.items.length; i += 1) {
    const item = tree.items[i];
    if (item.kind !== 'upgrade') break;
    if (want.has(item.id)) out.push(i);
    else break;
  }
  return out;
}

export function setPowerUpgrades(tree: PowerTreeFile, powerIndex: number, ids: string[]): PowerTreeFile {
  const power = tree.items[powerIndex];
  if (!power || power.kind !== 'power') return tree;
  const clean = ids.map((id) => String(id).trim()).filter(Boolean);
  const unique: string[] = [];
  for (const id of clean) if (!unique.includes(id)) unique.push(id);
  const owned = ownedUpgradeIndexes(tree, powerIndex);
  const byId = new Map<string, PowerTreeNode>();
  for (const index of owned) {
    const item = tree.items[index];
    if (item.kind === 'upgrade') byId.set(item.id, item);
  }
  // Keep existing upgrade blocks that are not in the owned range (shared / later)
  const existingElsewhere = new Map<string, PowerTreeNode>();
  tree.items.forEach((item, index) => {
    if (item.kind === 'upgrade' && !owned.includes(index) && !existingElsewhere.has(item.id)) {
      existingElsewhere.set(item.id, item);
    }
  });
  const nextOwned: PowerTreeNode[] = unique.map((id) => {
    const have = byId.get(id) || existingElsewhere.get(id);
    return have ? have : emptyUpgrade(id);
  });
  const items = [...tree.items];
  const updatedPower = updateNode(power, { upgrades: unique });
  items[powerIndex] = updatedPower;
  items.splice(powerIndex + 1, owned.length, ...nextOwned);
  return { ...tree, items };
}

export function isPower(item: PowerTreeItem): item is PowerTreeNode {
  return item.kind === 'power';
}

export function isUpgrade(item: PowerTreeItem): item is PowerTreeNode {
  return item.kind === 'upgrade';
}

export function isTab(item: PowerTreeItem): item is PowerTreeTab {
  return item.kind === 'tab';
}

export function tabItems(tree: PowerTreeFile): Array<PowerTreeTab & { index: number }> {
  return tree.items.flatMap((item, index) => (item.kind === 'tab' ? [{ ...item, index }] : []));
}

export function powersOnTab(tree: PowerTreeFile, tabIndex: number): Array<PowerTreeNode & { index: number }> {
  return tree.items.flatMap((item, index) => (
    item.kind === 'power' && Number(item.tab || 0) === tabIndex ? [{ ...item, index }] : []
  ));
}

export { STRUCTURED as POWER_TREE_STRUCTURED_KEYS };
