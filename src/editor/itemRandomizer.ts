/** items/random/*.txt (ItemManager::loadRandomizerDef). Options pick quality, bonus count and item level; [bonuses] is the pool those options draw from. */

export const ITEM_RANDOM_DIR = 'items/random';
export const RANDOMIZER_DEF_LIST_ID = 'item-randomizer-suggestions';

export type RandomizerOption = {
  chance: string;
  quality: string;
  bonus_count: string;
  level_src: string;
  level_range: string;
  extra: Array<{ key: string; value: string }>;
  comment: string;
};

export type RandomizerBonus = {
  kind: 'bonus' | 'bonus_power_level';
  value: string;
  comment: string;
};

export type ItemRandomizerFile = {
  header: string;
  options: RandomizerOption[];
  bonuses: RandomizerBonus[];
};

export function emptyRandomizerOption(): RandomizerOption {
  return { chance: '', quality: '', bonus_count: '', level_src: '', level_range: '', extra: [], comment: '' };
}

export function emptyItemRandomizer(): ItemRandomizerFile {
  return { header: '', options: [], bonuses: [] };
}

export function itemRandomizerRelPath(name: string): string {
  const slug = String(name || 'table').trim().replace(/\\/g, '/').replace(/^.*\//, '').replace(/\.txt$/i, '').replace(/[^A-Za-z0-9._-]+/g, '_') || 'table';
  return `${ITEM_RANDOM_DIR}/${slug}.txt`;
}

export function itemRandomizerDisplayName(path: string): string {
  return path.replace(/\\/g, '/').replace(/^.*\//, '').replace(/\.txt$/i, '');
}

export function parseItemRandomizer(text: string): ItemRandomizerFile {
  const file = emptyItemRandomizer();
  const header: string[] = [];
  let section: 'none' | 'option' | 'bonuses' = 'none';
  let pending: string[] = [];
  let current: RandomizerOption | null = null;

  const flushOption = () => {
    if (current) file.options.push(current);
    current = null;
  };

  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      if (section === 'none') header.push(raw);
      else pending.push(raw);
      continue;
    }
    if (/^\[option\]$/i.test(trimmed)) {
      flushOption();
      section = 'option';
      current = { ...emptyRandomizerOption(), comment: pending.join('\n').replace(/^\n+|\n+$/g, '') };
      pending = [];
      continue;
    }
    if (/^\[bonuses\]$/i.test(trimmed)) {
      flushOption();
      section = 'bonuses';
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      if (section === 'none') header.push(raw);
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    if (section === 'option' && current) {
      if (key === 'chance') current.chance = value;
      else if (key === 'quality') current.quality = value;
      else if (key === 'bonus_count') current.bonus_count = value;
      else if (key === 'level_src') current.level_src = value;
      else if (key === 'level_range') current.level_range = value;
      else current.extra.push({ key, value });
    } else if (section === 'bonuses') {
      if (key === 'bonus' || key === 'bonus_power_level') {
        file.bonuses.push({
          kind: key,
          value,
          comment: pending.join('\n').replace(/^\n+|\n+$/g, ''),
        });
        pending = [];
      }
    }
  }
  flushOption();
  while (header.length && header[header.length - 1].trim() === '') header.pop();
  file.header = header.join('\n');
  return file;
}

function emit(key: string, value: string): string | null {
  return value.trim() ? `${key}=${value}` : null;
}

export function serializeItemRandomizer(file: ItemRandomizerFile, previous = ''): string {
  const header = (file.header || (previous ? parseItemRandomizer(previous).header : '')).replace(/\n+$/, '');
  const parts: string[] = [];
  if (header) parts.push(header);
  for (const option of file.options) {
    const lines = [
      option.comment ? option.comment.replace(/\n+$/, '') : '',
      '[option]',
      emit('chance', option.chance),
      emit('quality', option.quality),
      emit('bonus_count', option.bonus_count),
      emit('level_src', option.level_src),
      emit('level_range', option.level_range),
      ...option.extra.filter((row) => row.key.trim() && row.value.trim()).map((row) => `${row.key.trim()}=${row.value}`),
    ].filter((line): line is string => Boolean(line));
    if (lines.length > 1) parts.push(lines.join('\n'));
  }
  const bonusLines: string[] = [];
  for (const bonus of file.bonuses) {
    if (!bonus.value.trim()) continue;
    if (bonus.comment) bonusLines.push(bonus.comment.replace(/\n+$/, ''));
    bonusLines.push(`${bonus.kind}=${bonus.value}`);
  }
  if (bonusLines.length) parts.push(['[bonuses]', ...bonusLines].join('\n'));
  return parts.length ? `${parts.join('\n\n')}\n` : '';
}
