/** Gettext PO and Flare engine/languages.txt helpers (Flare-compatible). */

export type PoEntry = {
  comments: string[];
  flags: string[];
  msgctxt: string | null;
  msgid: string;
  msgstr: string;
  obsolete: boolean;
};

export type PoFile = {
  headerComments: string[];
  header: string;
  entries: PoEntry[];
};

export type CatalogString = {
  msgid: string;
  msgctxt?: string | null;
  comments?: string[];
};

export type LanguageEntry = { code: string; name: string };

export const LANGUAGES_TXT_PATH = 'engine/languages.txt';
export const DATA_POT_PATH = 'languages/data.pot';
export const SOURCE_LANGUAGE = 'en';

export function dataPoPath(code: string): string {
  return `languages/data.${code}.po`;
}

export function entryKey(msgctxt: string | null | undefined, msgid: string): string {
  return `${msgctxt ?? ''}\0${msgid}`;
}

export function escapePo(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

export function unescapePo(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === '\\' && i + 1 < value.length) {
      const next = value[i + 1];
      if (next === 'n') { out += '\n'; i += 1; continue; }
      if (next === 'r') { out += '\r'; i += 1; continue; }
      if (next === 't') { out += '\t'; i += 1; continue; }
      if (next === '"' || next === '\\') { out += next; i += 1; continue; }
    }
    out += value[i];
  }
  return out;
}

function parseQuoted(line: string): string | null {
  const start = line.indexOf('"');
  const end = line.lastIndexOf('"');
  if (start === -1 || end <= start) return null;
  return unescapePo(line.slice(start + 1, end));
}

function quoteLines(value: string): string[] {
  if (!value.includes('\n')) return [`"${escapePo(value)}"`];
  const lines = value.split('\n');
  const out = ['""'];
  for (let i = 0; i < lines.length; i += 1) {
    const last = i === lines.length - 1;
    const chunk = last ? lines[i] : `${lines[i]}\n`;
    if (!last || chunk) out.push(`"${escapePo(chunk)}"`);
  }
  if (out.length === 1) out.push('""');
  return out;
}

function writeField(keyword: string, value: string, obsolete: boolean): string[] {
  const prefix = obsolete ? '#~ ' : '';
  const quoted = quoteLines(value);
  return quoted.map((line, index) => `${prefix}${index === 0 ? `${keyword} ` : ''}${line}`);
}

function splitFlags(line: string): string[] {
  return line.replace(/^#,/, '').split(',').map((flag) => flag.trim()).filter(Boolean);
}

export function emptyPo(languageCode?: string): PoFile {
  const header = [
    'Content-Type: text/plain; charset=UTF-8\n',
    'Content-Transfer-Encoding: 8bit\n',
  ];
  if (languageCode) header.push(`Language: ${languageCode}\n`);
  return {
    headerComments: ['Translation file written by Flare Studio.'],
    header: header.join(''),
    entries: [],
  };
}

export function parsePo(text: string): PoFile {
  const file: PoFile = { headerComments: [], header: '', entries: [] };
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);

  let comments: string[] = [];
  let flags: string[] = [];
  let msgctxt: string | null = null;
  let msgid: string | null = null;
  let msgstr: string | null = null;
  let obsolete = false;
  let field: 'msgctxt' | 'msgid' | 'msgstr' | null = null;
  let sawHeader = false;

  const flush = () => {
    if (msgid === null && msgstr === null && msgctxt === null) {
      if (!sawHeader && comments.length) file.headerComments.push(...comments);
      comments = [];
      flags = [];
      return;
    }
    const id = msgid ?? '';
    const str = msgstr ?? '';
    if (!id && !sawHeader) {
      file.headerComments.push(...comments);
      file.header = str;
      sawHeader = true;
    } else if (id) {
      file.entries.push({
        comments: [...comments],
        flags: [...flags],
        msgctxt,
        msgid: id,
        msgstr: str,
        obsolete,
      });
    }
    comments = [];
    flags = [];
    msgctxt = null;
    msgid = null;
    msgstr = null;
    obsolete = false;
    field = null;
  };

  for (const raw of lines) {
    const line = raw;
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }

    const isObsolete = trimmed.startsWith('#~');
    const body = isObsolete ? trimmed.replace(/^#~\s?/, '') : trimmed;

    if (!isObsolete && body.startsWith('#')) {
      if (field || msgid !== null || msgstr !== null) flush();
      if (body.startsWith('#,')) flags = splitFlags(body);
      else comments.push(body);
      continue;
    }

    if (isObsolete && body.startsWith('#') && !body.startsWith('#~')) {
      if (field || msgid !== null || msgstr !== null) flush();
      comments.push(`#~ ${body}`);
      continue;
    }

    if (/^(msgctxt|msgid|msgstr)(\s|$)/.test(body)) {
      const keyword = body.startsWith('msgctxt') ? 'msgctxt' : body.startsWith('msgid') ? 'msgid' : 'msgstr';
      if (keyword === 'msgid' && (msgid !== null || msgstr !== null)) flush();
      if (keyword === 'msgctxt' && (msgid !== null || msgstr !== null || msgctxt !== null)) flush();
      obsolete = isObsolete;
      field = keyword;
      const parsed = parseQuoted(body);
      const value = parsed ?? '';
      if (keyword === 'msgctxt') msgctxt = value;
      else if (keyword === 'msgid') msgid = value;
      else msgstr = value;
      continue;
    }

    if (field && body.startsWith('"')) {
      const chunk = parseQuoted(body) ?? '';
      if (field === 'msgctxt') msgctxt = `${msgctxt ?? ''}${chunk}`;
      else if (field === 'msgid') msgid = `${msgid ?? ''}${chunk}`;
      else msgstr = `${msgstr ?? ''}${chunk}`;
      if (isObsolete) obsolete = true;
      continue;
    }
  }
  flush();
  return file;
}

export function serializePo(file: PoFile): string {
  const lines: string[] = [];
  for (const comment of file.headerComments || []) {
    const text = comment.startsWith('#') ? comment : `# ${comment}`;
    lines.push(text);
  }
  lines.push(...writeField('msgid', '', false));
  const header = file.header || 'Content-Type: text/plain; charset=UTF-8\n';
  lines.push(...writeField('msgstr', header, false));
  lines.push('');

  for (const entry of file.entries) {
    for (const comment of entry.comments || []) {
      const text = comment.startsWith('#') ? comment : `# ${comment}`;
      lines.push(entry.obsolete && !text.startsWith('#~') ? `#~ ${text.replace(/^#\s?/, '')}` : text);
    }
    if (entry.flags.length) {
      const flagLine = `#, ${entry.flags.join(', ')}`;
      lines.push(entry.obsolete ? `#~ ${flagLine}` : flagLine);
    }
    if (entry.msgctxt != null && entry.msgctxt !== '') {
      lines.push(...writeField('msgctxt', entry.msgctxt, entry.obsolete));
    }
    lines.push(...writeField('msgid', entry.msgid, entry.obsolete));
    lines.push(...writeField('msgstr', entry.msgstr, entry.obsolete));
    lines.push('');
  }

  return `${lines.join('\n').replace(/\n+$/, '\n')}`;
}

export function mergeCatalogIntoPo(existing: PoFile, catalog: CatalogString[]): PoFile {
  const byKey = new Map<string, PoEntry>();
  const unused = new Set<string>();
  for (const entry of existing.entries) {
    const key = entryKey(entry.msgctxt, entry.msgid);
    byKey.set(key, entry);
    unused.add(key);
  }

  const next: PoEntry[] = [];
  const seen = new Set<string>();

  const take = (wanted: CatalogString): PoEntry | undefined => {
    const exact = entryKey(wanted.msgctxt ?? null, wanted.msgid);
    if (byKey.has(exact) && unused.has(exact)) return byKey.get(exact);
    if (wanted.msgctxt) return undefined;
    const matches = [...unused].map((key) => byKey.get(key)!).filter((entry) => entry.msgid === wanted.msgid);
    if (matches.length === 1) return matches[0];
    return undefined;
  };

  for (const item of catalog) {
    const msgid = item.msgid;
    if (!msgid) continue;
    const key = entryKey(item.msgctxt ?? null, msgid);
    if (seen.has(key)) continue;
    seen.add(key);
    const prev = take(item);
    if (prev) {
      unused.delete(entryKey(prev.msgctxt, prev.msgid));
      next.push({ ...prev, obsolete: false });
    } else {
      next.push({
        comments: item.comments ? [...item.comments] : [],
        flags: [],
        msgctxt: item.msgctxt ?? null,
        msgid,
        msgstr: '',
        obsolete: false,
      });
    }
  }

  for (const key of unused) {
    const entry = byKey.get(key);
    if (entry) next.push({ ...entry, obsolete: true });
  }

  return {
    headerComments: existing.headerComments.length ? existing.headerComments : emptyPo().headerComments,
    header: existing.header || emptyPo().header,
    entries: next,
  };
}

export function translationProgress(file: PoFile): { total: number; done: number } {
  let total = 0;
  let done = 0;
  for (const entry of file.entries) {
    if (entry.obsolete || !entry.msgid) continue;
    total += 1;
    if (entry.msgstr.trim()) done += 1;
  }
  return { total, done };
}

export function defaultLanguageName(code: string): string {
  const names: Record<string, string> = {
    en: 'English',
    tr: 'Türkçe',
    de: 'Deutsch',
    fr: 'Français',
    es: 'Español',
    it: 'Italiano',
    pt: 'Português',
    pt_BR: 'Português (Brasil)',
    ru: 'Русский',
    ja: '日本語',
    zh: '中文',
    zh_CN: '简体中文',
    zh_TW: '繁體中文',
    ko: '한국어',
    pl: 'Polski',
    nl: 'Nederlands',
    sv: 'Svenska',
    fi: 'Suomi',
    uk: 'Українська',
    cs: 'Čeština',
    hu: 'Magyar',
    el: 'Ελληνικά',
    ar: 'العربية',
    hi: 'हिन्दी',
  };
  return names[code] || code;
}

export function normalizeLanguageCode(raw: string): string | null {
  const text = raw.trim().replace(/-/g, '_');
  const match = text.match(/^([A-Za-z]{2,3})(?:_([A-Za-z]{2}))?$/);
  if (!match) return null;
  const lang = match[1].toLowerCase();
  const region = match[2] ? `_${match[2].toUpperCase()}` : '';
  return `${lang}${region}`;
}

export function parseLanguagesTxt(text: string): LanguageEntry[] {
  const out: LanguageEntry[] = [];
  const seen = new Set<string>();
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line === 'APPEND') continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const code = normalizeLanguageCode(line.slice(0, eq));
    if (!code || seen.has(code)) continue;
    const name = line.slice(eq + 1).trim() || defaultLanguageName(code);
    seen.add(code);
    out.push({ code, name });
  }
  return ensureSourceLanguage(out);
}

export function ensureSourceLanguage(languages: LanguageEntry[]): LanguageEntry[] {
  const seen = new Set<string>();
  const out: LanguageEntry[] = [{ code: SOURCE_LANGUAGE, name: 'English' }];
  seen.add(SOURCE_LANGUAGE);
  for (const language of languages) {
    const code = normalizeLanguageCode(language.code);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, name: language.name.trim() || defaultLanguageName(code) });
  }
  return out;
}

export function serializeLanguagesTxt(languages: LanguageEntry[]): string {
  const lines = [
    '# Languages for this project. Flare reads engine/languages.txt.',
    '# Format: code=Display name',
    '# English is the source language and cannot be removed.',
    '# This file is a complete language list for this mod and replaces the engine default.',
  ];
  for (const language of ensureSourceLanguage(languages)) {
    lines.push(`${language.code}=${language.name}`);
  }
  return `${lines.join('\n')}\n`;
}
