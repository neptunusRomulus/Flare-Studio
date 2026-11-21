/** Project-root settings.txt (ModManager). This is the current mod's manifest: description, version, requires, game, engine version bounds. Play uses requires= (plus this folder name) as the --mods load order. */

export const MOD_SETTINGS_PATH = 'settings.txt';

export type ModRequire = { name: string; min: string; max: string };
export type LocaleLine = { lang: string; text: string };

export type ModSettingsFile = {
  header: string;
  description: string;
  locales: LocaleLine[];
  version: string;
  requires: ModRequire[];
  game: string;
  engine_version_min: string;
  engine_version_max: string;
  extra: Array<{ key: string; value: string }>;
};

export function emptyModSettings(): ModSettingsFile {
  return {
    header: '',
    description: '',
    locales: [],
    version: '',
    requires: [],
    game: '',
    engine_version_min: '',
    engine_version_max: '',
    extra: [],
  };
}

export function parseRequire(entry: string): ModRequire {
  const [name = '', min = '', max = ''] = String(entry || '').split(':').map((part) => part.trim());
  return { name, min, max };
}

export function serializeRequire(entry: ModRequire): string {
  if (!entry.name.trim()) return '';
  if (entry.max.trim()) return `${entry.name.trim()}:${entry.min.trim() || '0'}:${entry.max.trim()}`;
  if (entry.min.trim()) return `${entry.name.trim()}:${entry.min.trim()}`;
  return entry.name.trim();
}

export function parseModSettings(text: string): ModSettingsFile {
  const file = emptyModSettings();
  const header: string[] = [];
  let seen = false;
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#') || /^APPEND$/i.test(trimmed) || /^INCLUDE\s+/i.test(trimmed)) {
      if (!seen) header.push(raw);
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      if (!seen) header.push(raw);
      continue;
    }
    seen = true;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    if (key === 'description') file.description = value;
    else if (key === 'description_locale') {
      const [lang, ...rest] = value.split(',');
      file.locales.push({ lang: (lang || '').trim(), text: rest.join(',').trim() });
    } else if (key === 'version') file.version = value;
    else if (key === 'requires') file.requires.push(...value.split(/[,;]/).map(parseRequire).filter((row) => row.name));
    else if (key === 'game') file.game = value;
    else if (key === 'engine_version_min') file.engine_version_min = value;
    else if (key === 'engine_version_max') file.engine_version_max = value;
    else file.extra.push({ key, value });
  }
  while (header.length && header[header.length - 1].trim() === '') header.pop();
  file.header = header.join('\n');
  return file;
}

function emit(key: string, value: string): string | null {
  return value.trim() ? `${key}=${value}` : null;
}

export function serializeModSettings(file: ModSettingsFile, previous = ''): string {
  const header = (file.header || (previous ? parseModSettings(previous).header : '')).replace(/\n+$/, '');
  const requires = file.requires.map(serializeRequire).filter(Boolean);
  const lines = [
    ...(header ? [header] : []),
    emit('description', file.description),
    ...file.locales.filter((row) => row.lang.trim() && row.text.trim()).map((row) => `description_locale=${row.lang.trim()},${row.text}`),
    emit('version', file.version),
    requires.length ? `requires=${requires.join(',')}` : null,
    emit('game', file.game),
    emit('engine_version_min', file.engine_version_min),
    emit('engine_version_max', file.engine_version_max),
    ...file.extra.filter((row) => row.key.trim() && row.value.trim()).map((row) => `${row.key.trim()}=${row.value}`),
  ].filter((line): line is string => Boolean(line));
  return lines.length ? `${lines.join('\n')}\n` : '';
}

export function loadOrder(file: ModSettingsFile, projectModName: string): string[] {
  const names = file.requires.map((row) => row.name.trim()).filter((name) => name && name !== 'default' && name !== projectModName);
  const unique = [...new Set(names)];
  const project = projectModName.trim();
  if (project && project !== 'default') unique.push(project);
  return unique;
}
