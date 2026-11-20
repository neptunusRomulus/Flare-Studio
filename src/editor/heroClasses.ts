/** Parse/serialize engine/classes.txt. Empty keys are omitted; comments before the first [class] are kept. */

export const CLASSES_PATH = 'engine/classes.txt';

export const CLASS_SCALAR_KEYS = [
  'name',
  'description',
  'currency',
  'equipment',
  'carried',
  'actionbar',
  'powers',
  'campaign',
  'power_tree',
  'hero_options',
  'default_power_tab',
] as const;

export type ClassScalarKey = (typeof CLASS_SCALAR_KEYS)[number];

export type ClassPrimary = { stat: string; value: string };
export type ClassEquipmentSet = { setId: string; items: string };

export type HeroClassEntry = {
  scalars: Record<ClassScalarKey, string>;
  primaries: ClassPrimary[];
  equipment_sets: ClassEquipmentSet[];
  extra: Array<{ key: string; value: string }>;
};

export type ClassesFile = {
  header: string;
  classes: HeroClassEntry[];
};

const SCALAR_SET = new Set<string>(CLASS_SCALAR_KEYS);

export function emptyHeroClass(): HeroClassEntry {
  return {
    scalars: {
      name: '',
      description: '',
      currency: '',
      equipment: '',
      carried: '',
      actionbar: '',
      powers: '',
      campaign: '',
      power_tree: '',
      hero_options: '',
      default_power_tab: '',
    },
    primaries: [],
    equipment_sets: [],
    extra: [],
  };
}

export function parseClassesFile(text: string): ClassesFile {
  const header: string[] = [];
  const classes: HeroClassEntry[] = [];
  let current: HeroClassEntry | null = null;
  let seenSection = false;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!seenSection) {
      if (/^\[class\]$/i.test(line)) {
        seenSection = true;
        current = emptyHeroClass();
        classes.push(current);
        continue;
      }
      header.push(raw);
      continue;
    }
    if (/^\[class\]$/i.test(line)) {
      current = emptyHeroClass();
      classes.push(current);
      continue;
    }
    if (!line || line.startsWith('#')) continue;
    if (/^\[[^\]]+\]/.test(line)) {
      current = null;
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0 || !current) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === 'primary') {
      const comma = value.indexOf(',');
      current.primaries.push({
        stat: (comma < 0 ? value : value.slice(0, comma)).trim(),
        value: (comma < 0 ? '' : value.slice(comma + 1)).trim(),
      });
    } else if (key === 'equipment_set') {
      const comma = value.indexOf(',');
      current.equipment_sets.push({
        setId: (comma < 0 ? value : value.slice(0, comma)).trim(),
        items: (comma < 0 ? '' : value.slice(comma + 1)).trim(),
      });
    } else if (SCALAR_SET.has(key)) {
      current.scalars[key as ClassScalarKey] = value;
    } else {
      current.extra.push({ key, value });
    }
  }
  while (header.length && header[header.length - 1].trim() === '') header.pop();
  return { header: header.join('\n'), classes };
}

/** Write [class] blocks in the engine's key order. Nameless classes are dropped. */
export function serializeClassesFile(file: ClassesFile, previous = ''): string {
  const header = file.header || parseClassesFile(previous).header;
  const blocks = file.classes
    .filter((entry) => entry.scalars.name.trim())
    .map((entry) => {
      const lines = ['[class]'];
      const push = (key: string, value: string) => {
        const trimmed = value.trim();
        if (key === 'name' || trimmed) lines.push(`${key}=${trimmed}`);
      };
      push('name', entry.scalars.name);
      push('description', entry.scalars.description);
      push('currency', entry.scalars.currency);
      push('equipment', entry.scalars.equipment);
      for (const set of entry.equipment_sets) {
        if (!set.setId.trim()) continue;
        lines.push(`equipment_set=${set.setId.trim()}${set.items.trim() ? `,${set.items.trim()}` : ''}`);
      }
      push('carried', entry.scalars.carried);
      for (const primary of entry.primaries) {
        if (!primary.stat.trim()) continue;
        lines.push(`primary=${primary.stat.trim()}${primary.value.trim() ? `,${primary.value.trim()}` : ''}`);
      }
      push('actionbar', entry.scalars.actionbar);
      push('powers', entry.scalars.powers);
      push('campaign', entry.scalars.campaign);
      push('power_tree', entry.scalars.power_tree);
      push('hero_options', entry.scalars.hero_options);
      push('default_power_tab', entry.scalars.default_power_tab);
      for (const extra of entry.extra) {
        if (!extra.key.trim()) continue;
        lines.push(`${extra.key.trim()}=${extra.value.trim()}`);
      }
      return lines.join('\n');
    });
  const parts: string[] = [];
  if (header.trim()) parts.push(header.replace(/\n+$/, ''));
  parts.push(...blocks);
  if (!parts.length) return previous.endsWith('\n') || !previous ? previous : `${previous}\n`;
  return `${parts.join('\n\n').replace(/\n+$/, '')}\n`;
}
