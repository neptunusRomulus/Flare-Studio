/** soundfx/subtitles.txt (Subtitles.cpp). One [style] block plus [subtitle] rows of id=sound file and text=. */

export const SUBTITLES_PATH = 'soundfx/subtitles.txt';
export const SOUND_FILE_LIST_ID = 'soundfx-file-suggestions';

export type SubtitleStyle = {
  text_pos: string;
  pos: string;
  align: string;
  background_color: string;
  extra: Array<{ key: string; value: string }>;
};

export type SubtitleRow = { id: string; text: string; comment: string };

export type SubtitlesFile = {
  header: string;
  style: SubtitleStyle;
  rows: SubtitleRow[];
};

const STYLE_KEYS = new Set(['text_pos', 'pos', 'align', 'background_color']);

export function emptySubtitleStyle(): SubtitleStyle {
  return { text_pos: '', pos: '', align: '', background_color: '', extra: [] };
}

export function emptySubtitlesFile(): SubtitlesFile {
  return { header: '', style: emptySubtitleStyle(), rows: [] };
}

export function parseSubtitlesFile(text: string): SubtitlesFile {
  const file = emptySubtitlesFile();
  const header: string[] = [];
  let section: 'none' | 'style' | 'subtitle' = 'none';
  let pending: string[] = [];
  let current: SubtitleRow | null = null;

  const flush = () => {
    if (current && (current.id.trim() || current.text.trim())) file.rows.push(current);
    current = null;
  };

  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      if (section === 'none') header.push(raw);
      else pending.push(raw);
      continue;
    }
    if (/^\[style\]$/i.test(trimmed)) {
      flush();
      section = 'style';
      pending = [];
      continue;
    }
    if (/^\[subtitle\]$/i.test(trimmed)) {
      flush();
      section = 'subtitle';
      current = { id: '', text: '', comment: pending.join('\n').replace(/^\n+|\n+$/g, '') };
      pending = [];
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      if (section === 'none') header.push(raw);
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    if (section === 'style') {
      if (key === 'text_pos') file.style.text_pos = value;
      else if (key === 'pos') file.style.pos = value;
      else if (key === 'align') file.style.align = value;
      else if (key === 'background_color') file.style.background_color = value;
      else file.style.extra.push({ key, value });
    } else if (section === 'subtitle' && current) {
      if (key === 'id') current.id = value;
      else if (key === 'text') current.text = value;
    }
  }
  flush();
  while (header.length && header[header.length - 1].trim() === '') header.pop();
  file.header = header.join('\n');
  return file;
}

function emitKey(key: string, value: string): string | null {
  return value.trim() ? `${key}=${value}` : null;
}

export function serializeSubtitlesFile(file: SubtitlesFile, previous = ''): string {
  const parsedPrev = previous ? parseSubtitlesFile(previous) : emptySubtitlesFile();
  const header = (file.header || parsedPrev.header).replace(/\n+$/, '');
  const style = file.style || emptySubtitleStyle();
  const styleLines = [
    emitKey('text_pos', style.text_pos),
    emitKey('pos', style.pos),
    emitKey('align', style.align),
    emitKey('background_color', style.background_color),
    ...style.extra.filter((row) => row.key.trim() && row.value.trim()).map((row) => `${row.key.trim()}=${row.value}`),
  ].filter((line): line is string => Boolean(line));

  const parts: string[] = [];
  if (header) parts.push(header);
  if (styleLines.length) parts.push(['[style]', ...styleLines].join('\n'));
  for (const row of file.rows) {
    if (!row.id.trim() && !row.text.trim()) continue;
    const block = [
      row.comment ? row.comment.replace(/\n+$/, '') : '',
      '[subtitle]',
      emitKey('id', row.id),
      emitKey('text', row.text),
    ].filter((line): line is string => Boolean(line)).join('\n');
    parts.push(block);
  }
  return parts.length ? `${parts.join('\n\n')}\n` : '';
}
