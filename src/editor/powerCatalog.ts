import { candidateModRoots, parseProjectRequires } from '@/editor/engineFileFallback';
import { projectRoot } from '@/editor/projectFiles';
import { appendBlock, blockFirst, parseSectionFile, setBlockValue } from '@/editor/powers/sectionFile';

export const POWER_DEFINITIONS_PATH = 'powers/powers.txt';

export type PowerRef = {
  id: string;
  name: string;
  path?: string;
  source?: 'project' | 'mod';
};

export function isPowerDefinitionPath(path: string): boolean {
  return /^powers\//i.test(path) && !/^powers\/trees\//i.test(path) && /\.txt$/i.test(path);
}

export function isPlaceholderPowerName(name: string | undefined): boolean {
  const value = String(name || '').trim();
  return !value || /^power$/i.test(value) || /^new power(?: \d+)?$/i.test(value);
}

/** Visible label: "Cleave (#5)", "Unnamed (#5)", or "Unnamed" when there is no id yet. */
export function formatPowerLabel(ref: { id?: string; name?: string }): string {
  const id = String(ref.id || '').trim();
  const name = String(ref.name || '').trim();
  if (name && id) return `${name} (#${id})`;
  if (name) return name;
  if (id) return `Unnamed (#${id})`;
  return 'Unnamed';
}

export function nextNumericPowerId(ids: Array<string | undefined>): string {
  const max = ids.reduce((current, id) => Math.max(current, Number(id) || 0), 0);
  return String(max + 1);
}

export function defaultPowerName(id: string): string {
  return `New Power ${id}`;
}

export function parsePowerRefs(text: string, path: string, source: PowerRef['source'] = 'project'): PowerRef[] {
  const byId = new Map<string, PowerRef>();
  for (const section of ['upgrade', 'power'] as const) {
    for (const block of parseSectionFile(text, section).blocks) {
      if (!block.id) continue;
      byId.set(block.id, { id: block.id, name: blockFirst(block, 'name'), path, source });
    }
  }
  return [...byId.values()];
}

export function collectPowerRefs(files: Record<string, string>, source: PowerRef['source'] = 'project'): PowerRef[] {
  const byId = new Map<string, PowerRef>();
  for (const [path, text] of Object.entries(files)) {
    if (!isPowerDefinitionPath(path)) continue;
    for (const ref of parsePowerRefs(text, path, source)) byId.set(ref.id, ref);
  }
  return [...byId.values()];
}

/** Later layers replace the same id. Use mods first, then the project. */
export function mergePowerRefs(layers: PowerRef[][]): PowerRef[] {
  const byId = new Map<string, PowerRef>();
  for (const layer of layers) {
    for (const ref of layer) {
      if (ref.id) byId.set(ref.id, ref);
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

export function applyPowerName(text: string, id: string, name: string): string {
  const index = parseSectionFile(text, 'power').blocks.findIndex((block) => block.id === id);
  if (index >= 0) return setBlockValue(text, 'power', index, 'name', name);
  return appendBlock(text, 'power', [['id', id], ['name', name]]);
}

export function appendNewPowerDefinition(text: string, id: string, name: string): string {
  return appendBlock(text, 'power', [['id', id], ['name', name], ['type', 'fixed']]);
}

type Fs = {
  readFile: (abs: string) => Promise<string | null | undefined>;
  readDir?: (abs: string) => Promise<Array<{ name: string; isDirectory: boolean }> | null | undefined>;
};

async function readText(fs: Fs, abs: string): Promise<string> {
  try {
    return (await fs.readFile(abs)) || '';
  } catch {
    return '';
  }
}

async function readPowerFilesFromRoot(fs: Fs, root: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!fs.readDir) {
    const text = await readText(fs, `${root}/${POWER_DEFINITIONS_PATH}`);
    if (text.trim()) out[POWER_DEFINITIONS_PATH] = text;
    return out;
  }
  const walk = async (rel: string, depth: number) => {
    const entries = (await fs.readDir?.(`${root}/${rel}`).catch(() => [])) || [];
    for (const entry of entries) {
      const child = `${rel}/${entry.name}`;
      if (entry.isDirectory) {
        if (/^powers\/trees$/i.test(child)) continue;
        if (depth < 3) await walk(child, depth + 1);
      } else if (/\.txt$/i.test(entry.name)) {
        const text = await readText(fs, `${root}/${child}`);
        if (text) out[child] = text;
      }
    }
  };
  await walk('powers', 0);
  return out;
}

/** Project power files plus required mods / default, with project names winning. */
export async function loadPowerRefs(opts: {
  projectPath: string;
  flarePath: string | null;
  projectFiles: Record<string, string>;
  fs: Fs;
  requires?: string[];
}): Promise<PowerRef[]> {
  const root = projectRoot(opts.projectPath);
  const requires = opts.requires ?? parseProjectRequires(await readText(opts.fs, `${root}/project.json`));
  const layers: PowerRef[][] = [];
  const seenRoots = new Set<string>();
  const mods = ['default', ...requires.filter((mod) => mod !== 'default')];
  for (const mod of mods) {
    for (const base of candidateModRoots(opts.flarePath)) {
      const abs = `${base}/${mod}`;
      if (seenRoots.has(abs)) continue;
      seenRoots.add(abs);
      const files = await readPowerFilesFromRoot(opts.fs, abs);
      const refs = collectPowerRefs(files, 'mod');
      if (refs.length) layers.push(refs);
    }
  }
  layers.push(collectPowerRefs(opts.projectFiles, 'project'));
  return mergePowerRefs(layers);
}

export function projectPathForPower(ref: PowerRef | undefined): string {
  if (ref?.source === 'project' && ref.path) return ref.path;
  return POWER_DEFINITIONS_PATH;
}
