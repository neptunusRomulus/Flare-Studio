/**
 * Loading and writing the project files the power editor needs, plus the
 * Studio-only kind sidecar (.flare-studio/power-kinds.json). Flare files are
 * only rewritten line by line through sectionFile.
 */
import type { PowerKind, ProjectFile } from './powerProject';

export const POWER_SCAN_DIRS = ['powers', 'enemies', 'items', 'maps', 'npcs'];
export const POWER_SCAN_FILES = ['engine/classes.txt'];
export const KIND_SIDECAR = '.flare-studio/power-kinds.json';
export const EFFECTS_FILE = 'powers/effects.txt';

type Api = {
  readDir?: (dir: string) => Promise<Array<{ name: string; isDirectory: boolean }>>;
  readFile?: (path: string) => Promise<string | null>;
  writeFile?: (path: string, content: string) => Promise<boolean>;
};

export function joinPath(root: string, rel: string): string {
  const sep = root.includes('\\') && !root.includes('/') ? '\\' : '/';
  return `${root.replace(/[\\/]+$/, '')}${sep}${rel.split('/').join(sep)}`;
}

export async function loadPowerFiles(api: Api, root: string): Promise<ProjectFile[]> {
  return loadTextFiles(api, root, POWER_SCAN_DIRS, POWER_SCAN_FILES);
}

/** Every .txt under `dirs` (4 levels deep) plus the listed single files, as project-relative paths. */
export async function loadTextFiles(api: Api, root: string, dirs: string[], singles: string[] = []): Promise<ProjectFile[]> {
  if (!api.readDir || !api.readFile) return [];
  const out: ProjectFile[] = [];
  const walk = async (rel: string, depth: number) => {
    const entries = (await api.readDir!(joinPath(root, rel)).catch(() => [])) || [];
    for (const entry of entries) {
      const child = `${rel}/${entry.name}`;
      if (entry.isDirectory) {
        if (depth < 4) await walk(child, depth + 1);
      } else if (/\.txt$/i.test(entry.name)) {
        const text = await api.readFile!(joinPath(root, child)).catch(() => null);
        if (typeof text === 'string') out.push({ path: child, text });
      }
    }
  };
  for (const dir of dirs) await walk(dir, 0);
  for (const file of singles) {
    const text = await api.readFile(joinPath(root, file)).catch(() => null);
    if (typeof text === 'string') out.push({ path: file, text });
  }
  return out;
}

export function parseKindSidecar(text: string | null | undefined): Record<string, PowerKind> {
  try {
    const data = JSON.parse(text || '{}');
    const out: Record<string, PowerKind> = {};
    for (const [id, kind] of Object.entries(data?.powers || {})) {
      if (kind === 'skill' || kind === 'monster' || kind === 'item' || kind === 'trap') out[id] = kind;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeKindSidecar(kinds: Record<string, PowerKind>): string {
  const powers = Object.fromEntries(Object.entries(kinds).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })));
  return `${JSON.stringify({ note: 'Flare Studio only: the kind picked when a power was created. Flare ignores this file.', powers }, null, 2)}\n`;
}

/** File a new power goes into: an existing power file that matches the kind, else powers/powers.txt. */
export function fileForNewPower(kind: PowerKind, powerPaths: string[]): string {
  const want: Record<PowerKind, RegExp> = {
    skill: /powers\/(powers|categories\/(magician|warrior|ranger|player|skills?))\.txt$/i,
    monster: /enem|monster/i,
    item: /item|potion/i,
    trap: /environment|trap|map/i,
  };
  const paths = [...new Set(powerPaths)].sort();
  return paths.find((p) => want[kind].test(p)) || paths.find((p) => /^powers\/powers\.txt$/i.test(p)) || 'powers/powers.txt';
}

const LABELS: Record<string, string> = {
  requires_mp: 'Mana cost', requires_hp: 'HP cost', modifier_damage: 'Damage', target_range: 'Range', radius: 'Area size', count: 'Projectiles',
  speed: 'Speed', lifespan: 'Lasts', cooldown: 'Cooldown', soundfx: 'Sound', new_state: 'Caster animation', base_damage: 'Damage from',
  trait_elemental: 'Element', use_hazard: 'Can hit', spawn_type: 'Summons', post_effect: 'Applies on hit', post_effect_src: 'Applies to caster',
  buff: 'Targets caster', buff_teleport: 'Teleports caster', type: 'Works as', icon: 'Icon', animation: 'Animation', name: 'Name', description: 'Description',
  max_stacks: 'Max stacks', can_stack: 'Stacks', group_stack: 'Stacks as group',
};

/** Plain label for a Flare key (the raw key goes in the Tooltip). */
export function keyLabel(key: string): string {
  if (LABELS[key]) return LABELS[key];
  const words = key.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
