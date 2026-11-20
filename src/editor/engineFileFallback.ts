import { dataPathFromFlareSelection } from '@/flare/playLaunch';
import { projectRoot } from '@/editor/projectFiles';
import { fileStartsWithAppend, stripAppend } from '@/editor/statsTitles';

export type EngineFileSource = {
  text: string;
  /** 'project' if the project already has a complete override; otherwise the fallback origin. */
  source: 'project' | 'mod' | 'empty';
  label: string;
};

export function parseProjectRequires(indexText: string): string[] {
  try {
    const parsed = JSON.parse(indexText) as { requires?: unknown; meta?: { requires?: unknown } };
    const raw = parsed.requires ?? parsed.meta?.requires;
    if (Array.isArray(raw)) return raw.map((entry) => String(entry).split(':')[0].trim()).filter(Boolean);
    if (typeof raw === 'string') return raw.split(/[,;]/).map((part) => part.trim().split(':')[0]).filter(Boolean);
  } catch { /* ignore */ }
  return [];
}

export function candidateModRoots(flarePath: string | null): string[] {
  const dataPath = flarePath ? dataPathFromFlareSelection(flarePath) : '';
  if (!dataPath) return [];
  const normalized = dataPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const parent = normalized.slice(0, normalized.lastIndexOf('/'));
  const roots = [
    `${normalized}/mods`,
    `${parent}/flare-game/mods`,
    `${parent}/flare-engine/mods`,
  ];
  return [...new Set(roots)];
}

export function candidateEnginePaths(opts: {
  projectRoot: string;
  flarePath: string | null;
  requires: string[];
  relative: string;
}): string[] {
  const relative = opts.relative.replace(/^\/+/, '');
  const paths = [`${opts.projectRoot.replace(/\\/g, '/').replace(/\/$/, '')}/${relative}`];
  const roots = candidateModRoots(opts.flarePath);
  const mods = [...opts.requires].reverse();
  if (!mods.includes('default')) mods.push('default');
  for (const mod of mods) {
    for (const root of roots) paths.push(`${root}/${mod}/${relative}`);
  }
  return [...new Set(paths)];
}

type Fs = {
  readFile: (absPath: string) => Promise<string | null | undefined>;
};

async function readText(fs: Fs, abs: string): Promise<string> {
  try {
    return (await fs.readFile(abs)) || '';
  } catch {
    return '';
  }
}

/** Load an engine/*.txt file: project first, then required mods / default. Later complete files replace; APPEND is merged. */
export async function loadEngineFileWithFallback(opts: {
  projectPath: string;
  relative: string;
  flarePath: string | null;
  fs: Fs;
  requires?: string[];
}): Promise<EngineFileSource> {
  const root = projectRoot(opts.projectPath);
  let requires = opts.requires;
  if (!requires) {
    requires = parseProjectRequires(await readText(opts.fs, `${root}/project.json`));
  }
  const paths = candidateEnginePaths({ projectRoot: root, flarePath: opts.flarePath, requires, relative: opts.relative });
  let text = '';
  let source: EngineFileSource['source'] = 'empty';
  let label = 'none';
  // Walk from the bottom of the stack (default / earlier requires) so a later complete file replaces, and APPEND adds.
  for (const path of [...paths].reverse()) {
    const raw = await readText(opts.fs, path);
    if (!raw.trim()) continue;
    const isProject = path === paths[0];
    if (fileStartsWithAppend(raw)) {
      const extra = stripAppend(raw).replace(/^\n+/, '');
      text = text ? `${text.replace(/\n+$/, '\n')}\n${extra}` : extra;
      source = isProject ? 'project' : (source === 'empty' ? 'mod' : source);
      label = isProject ? 'project (append)' : path;
    } else {
      text = raw;
      source = isProject ? 'project' : 'mod';
      label = isProject ? 'project' : path;
    }
  }
  return { text, source, label };
}

/** First existing copy of a mod-relative asset (project, then required mods, then default). */
export async function resolveExistingPath(opts: {
  projectPath: string;
  relative: string;
  flarePath: string | null;
  fileExists: (abs: string) => Promise<boolean>;
  readFile?: (abs: string) => Promise<string | null | undefined>;
  requires?: string[];
}): Promise<string | null> {
  const root = projectRoot(opts.projectPath);
  let requires = opts.requires;
  if (!requires) {
    requires = opts.readFile
      ? parseProjectRequires(await readText({ readFile: opts.readFile }, `${root}/project.json`))
      : [];
  }
  const paths = candidateEnginePaths({
    projectRoot: root,
    flarePath: opts.flarePath,
    requires,
    relative: opts.relative,
  });
  for (const path of paths) {
    try {
      if (await opts.fileExists(path)) return path;
    } catch {
      /* skip unreadable candidates */
    }
  }
  return null;
}
