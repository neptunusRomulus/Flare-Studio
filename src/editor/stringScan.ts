import { collectTranslatableStrings, TEXT_KEYS } from './studioDrafts';
import type { CatalogString } from './poFile';

export type DirEntry = { name: string; isDirectory: boolean };

export type ProjectFs = {
  readDir: (absPath: string) => Promise<DirEntry[] | null | undefined>;
  readFile: (absPath: string) => Promise<string | null | undefined>;
};

const JSON_ROOTS = ['content'];
const TEXT_ROOTS = ['content', 'items', 'npcs', 'enemies', 'quests', 'books', 'cutscenes', 'powers', 'engine', 'loot', 'vendors', 'menus', 'maps'];
const SKIP_DIRS = new Set(['languages', 'images', 'soundfx', 'animations', 'fonts', 'node_modules', '.git']);

export const SCAN_MAX_DEPTH = 8;
export const SCAN_MAX_FILES = 2000;

function join(root: string, rel: string): string {
  if (!rel) return root.replace(/\\/g, '/').replace(/\/$/, '');
  return `${root.replace(/\\/g, '/').replace(/\/$/, '')}/${rel.replace(/^\/+/, '')}`;
}

async function listDir(fs: ProjectFs, abs: string): Promise<DirEntry[]> {
  try {
    return (await fs.readDir(abs)) || [];
  } catch {
    return [];
  }
}

async function readText(fs: ProjectFs, abs: string): Promise<string> {
  try {
    return (await fs.readFile(abs)) || '';
  } catch {
    return '';
  }
}

async function walk(
  fs: ProjectFs,
  root: string,
  rel: string,
  depth: number,
  accept: (name: string) => boolean,
  into: string[],
  budget: { files: number; maxFiles: number; maxDepth: number },
): Promise<void> {
  if (depth > budget.maxDepth || budget.files >= budget.maxFiles) return;
  const entries = await listDir(fs, join(root, rel));
  for (const entry of entries) {
    if (budget.files >= budget.maxFiles) return;
    if (entry.name.startsWith('.')) continue;
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(fs, root, child, depth + 1, accept, into, budget);
      continue;
    }
    if (!accept(entry.name)) continue;
    budget.files += 1;
    into.push(child);
  }
}

function parseFlareTxtStrings(text: string, into: string[]): void {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('[')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!TEXT_KEYS.has(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2)
      || (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (value.trim()) into.push(value);
  }
}

function parseJsonStrings(text: string, into: string[]): void {
  try {
    collectTranslatableStrings(JSON.parse(text), into);
  } catch {
    /* ignore invalid JSON */
  }
}

/** Collect unique translatable strings from project content JSON and Flare .txt files. */
export async function scanProjectStrings(
  projectRoot: string,
  fs: ProjectFs,
  options?: { maxDepth?: number; maxFiles?: number },
): Promise<CatalogString[]> {
  const budget = {
    files: 0,
    maxFiles: options?.maxFiles ?? SCAN_MAX_FILES,
    maxDepth: options?.maxDepth ?? SCAN_MAX_DEPTH,
  };
  const jsonFiles: string[] = [];
  const textFiles: string[] = [];
  for (const dir of JSON_ROOTS) {
    await walk(fs, projectRoot, dir, 0, (name) => name.endsWith('.json'), jsonFiles, budget);
  }
  for (const dir of TEXT_ROOTS) {
    await walk(fs, projectRoot, dir, 0, (name) => name.endsWith('.txt'), textFiles, budget);
  }

  const seen = new Map<string, CatalogString>();
  const add = (msgid: string, source: string) => {
    const text = msgid.replace(/\r/g, '');
    if (!text.trim()) return;
    const current = seen.get(text);
    const comment = `#: ${source}`;
    if (current) {
      if (comment && !current.comments?.includes(comment)) current.comments = [...(current.comments || []), comment];
      return;
    }
    seen.set(text, { msgid: text, comments: [comment] });
  };

  for (const file of jsonFiles) {
    const found: string[] = [];
    parseJsonStrings(await readText(fs, join(projectRoot, file)), found);
    for (const msgid of found) add(msgid, file);
  }
  for (const file of textFiles) {
    if (file.startsWith('languages/')) continue;
    const found: string[] = [];
    parseFlareTxtStrings(await readText(fs, join(projectRoot, file)), found);
    for (const msgid of found) add(msgid, file);
  }

  return [...seen.values()];
}
