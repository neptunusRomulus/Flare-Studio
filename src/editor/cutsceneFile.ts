/** cutscenes/*.txt (GameStateCutscene). Global keys, then [scene] and [vscroll] blocks of ordered components, plus INCLUDE lines. */

export const CUTSCENES_DIR = 'cutscenes';

export type CutsceneComponent = { key: string; value: string };

export type CutscenePart =
  | { kind: 'include'; path: string; comment: string }
  | { kind: 'scene'; components: CutsceneComponent[]; comment: string }
  | { kind: 'vscroll'; components: CutsceneComponent[]; comment: string };

export type CutsceneFile = {
  header: string;
  caption_margins: string;
  caption_background: string;
  vscroll_speed: string;
  menu_backgrounds: string;
  music: string;
  extra: Array<{ key: string; value: string }>;
  parts: CutscenePart[];
};

export function emptyCutsceneFile(): CutsceneFile {
  return {
    header: '',
    caption_margins: '',
    caption_background: '',
    vscroll_speed: '',
    menu_backgrounds: '',
    music: '',
    extra: [],
    parts: [],
  };
}

export function cutsceneRelPath(name: string): string {
  const slug = String(name || 'cutscene').trim().replace(/\\/g, '/').replace(/^.*\//, '').replace(/\.txt$/i, '').replace(/[^A-Za-z0-9._-]+/g, '_') || 'cutscene';
  return `${CUTSCENES_DIR}/${slug}.txt`;
}

export function parseCutsceneFile(text: string): CutsceneFile {
  const file = emptyCutsceneFile();
  const header: string[] = [];
  let pending: string[] = [];
  let seen = false;
  let part: Extract<CutscenePart, { kind: 'scene' | 'vscroll' }> | null = null;

  const flush = () => {
    if (part) file.parts.push(part);
    part = null;
  };

  const commentOf = () => pending.join('\n').replace(/^\n+|\n+$/g, '');

  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      if (!seen) header.push(raw);
      else pending.push(raw);
      continue;
    }
    if (/^INCLUDE\s+/i.test(trimmed)) {
      flush();
      seen = true;
      file.parts.push({ kind: 'include', path: trimmed.replace(/^INCLUDE\s+/i, '').trim(), comment: commentOf() });
      pending = [];
      continue;
    }
    if (/^\[scene\]$/i.test(trimmed)) {
      flush();
      seen = true;
      part = { kind: 'scene', components: [], comment: commentOf() };
      pending = [];
      continue;
    }
    if (/^\[vscroll\]$/i.test(trimmed)) {
      flush();
      seen = true;
      part = { kind: 'vscroll', components: [], comment: commentOf() };
      pending = [];
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      if (!seen) header.push(raw);
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    if (!part) {
      if (key === 'caption_margins') file.caption_margins = value;
      else if (key === 'caption_background') file.caption_background = value;
      else if (key === 'vscroll_speed') file.vscroll_speed = value;
      else if (key === 'menu_backgrounds') file.menu_backgrounds = value;
      else if (key === 'music') file.music = value;
      else file.extra.push({ key, value });
    } else {
      part.components.push({ key, value });
    }
  }
  flush();
  while (header.length && header[header.length - 1].trim() === '') header.pop();
  file.header = header.join('\n');
  return file;
}

function emit(key: string, value: string): string | null {
  return value.trim() ? `${key}=${value}` : null;
}

export function serializeCutsceneFile(file: CutsceneFile, previous = ''): string {
  const header = (file.header || (previous ? parseCutsceneFile(previous).header : '')).replace(/\n+$/, '');
  const globalLines = [
    emit('caption_margins', file.caption_margins),
    emit('caption_background', file.caption_background),
    emit('vscroll_speed', file.vscroll_speed),
    emit('menu_backgrounds', file.menu_backgrounds),
    emit('music', file.music),
    ...file.extra.filter((row) => row.key.trim() && row.value.trim()).map((row) => `${row.key.trim()}=${row.value}`),
  ].filter((line): line is string => Boolean(line));
  const parts: string[] = [];
  if (header) parts.push(header);
  if (globalLines.length) parts.push(globalLines.join('\n'));
  for (const part of file.parts) {
    const comment = part.comment ? part.comment.replace(/\n+$/, '') : '';
    if (part.kind === 'include') {
      const block = [comment, `INCLUDE ${part.path}`.trim()].filter(Boolean).join('\n');
      if (block) parts.push(block);
      continue;
    }
    const keys = part.kind === 'scene' ? ['caption', 'image', 'pause', 'soundfx'] : ['text', 'image', 'separator'];
    const lines = [
      comment,
      `[${part.kind}]`,
      ...part.components.filter((row) => keys.includes(row.key) && row.value.trim()).map((row) => `${row.key}=${row.value}`),
      ...part.components.filter((row) => !keys.includes(row.key) && row.key.trim() && row.value.trim()).map((row) => `${row.key}=${row.value}`),
    ].filter((line): line is string => Boolean(line));
    if (lines.length > 1) parts.push(lines.join('\n'));
  }
  return parts.length ? `${parts.join('\n\n')}\n` : '';
}
