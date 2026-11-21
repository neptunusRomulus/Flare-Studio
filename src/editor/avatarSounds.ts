/**
 * Hero body sounds: engine/avatar/<gfx_base>.txt (StatBlock::loadHeroSFX / loadSfxStat).
 * Step sets: items/step_sounds.txt (Avatar step definitions). engine/stats.txt sfx_step is an id in that file.
 */

import { candidateEnginePaths, loadEngineFileWithFallback, parseProjectRequires } from '@/editor/engineFileFallback';
import { projectRoot } from '@/editor/projectFiles';

export const AVATAR_SFX_DIR = 'engine/avatar';
export const STEP_SOUNDS_PATH = 'items/step_sounds.txt';
export const STEP_SOUND_LIST_ID = 'step-sound-suggestions';

export type AvatarAttackSfx = { animation: string; file: string };

export type AvatarSfxFile = {
  header: string;
  attacks: AvatarAttackSfx[];
  hit: string[];
  die: string[];
  critdie: string[];
  block: string[];
  levelup: string;
  lowhp: string;
};

export type StepSoundSet = { id: string; steps: string[] };

export function emptyAvatarSfx(): AvatarSfxFile {
  return { header: '', attacks: [], hit: [], die: [], critdie: [], block: [], levelup: '', lowhp: '' };
}

export function avatarSfxRelPath(base: string): string {
  const slug = String(base || 'body').trim().replace(/\\/g, '/').replace(/^.*\//, '').replace(/\.txt$/i, '').replace(/[^A-Za-z0-9._-]+/g, '_') || 'body';
  return `${AVATAR_SFX_DIR}/${slug}.txt`;
}

export function parseAvatarSfx(text: string): AvatarSfxFile {
  const file = emptyAvatarSfx();
  const header: string[] = [];
  let seen = false;
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) {
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
    if (key === 'sfx_attack') {
      const [animation, ...rest] = value.split(',');
      file.attacks.push({ animation: (animation || '').trim(), file: rest.join(',').trim() });
    } else if (key === 'sfx_hit') file.hit.push(value.trim());
    else if (key === 'sfx_die') file.die.push(value.trim());
    else if (key === 'sfx_critdie') file.critdie.push(value.trim());
    else if (key === 'sfx_block') file.block.push(value.trim());
    else if (key === 'sfx_levelup') file.levelup = value.trim();
    else if (key === 'sfx_lowhp') file.lowhp = value.trim();
  }
  while (header.length && header[header.length - 1].trim() === '') header.pop();
  file.header = header.join('\n');
  return file;
}

function emitList(key: string, values: string[]): string[] {
  return values.filter((value) => value.trim()).map((value) => `${key}=${value.trim()}`);
}

export function serializeAvatarSfx(file: AvatarSfxFile, previous = ''): string {
  const header = (file.header || (previous ? parseAvatarSfx(previous).header : '')).replace(/\n+$/, '');
  const lines = [
    ...(header ? [header] : []),
    ...file.attacks
      .filter((row) => row.animation.trim() && row.file.trim())
      .map((row) => `sfx_attack=${row.animation.trim()},${row.file.trim()}`),
    ...emitList('sfx_hit', file.hit),
    ...emitList('sfx_die', file.die),
    ...emitList('sfx_critdie', file.critdie),
    ...emitList('sfx_block', file.block),
    ...(file.levelup.trim() ? [`sfx_levelup=${file.levelup.trim()}`] : []),
    ...(file.lowhp.trim() ? [`sfx_lowhp=${file.lowhp.trim()}`] : []),
  ];
  return `${lines.join('\n')}\n`;
}

export function parseStepSounds(text: string): StepSoundSet[] {
  const sets: StepSoundSet[] = [];
  let current: StepSoundSet | null = null;
  for (const raw of String(text || '').split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key === 'id') {
      current = { id: value, steps: [] };
      sets.push(current);
    } else if (key === 'step' && current) {
      if (value) current.steps.push(value);
    }
  }
  return sets;
}

export function serializeStepSounds(sets: StepSoundSet[], previous = ''): string {
  const prefix: string[] = [];
  for (const line of String(previous || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) prefix.push(line);
    else break;
  }
  while (prefix.length && prefix[prefix.length - 1].trim() === '') prefix.pop();
  const body = sets
    .filter((set) => set.id.trim())
    .map((set) => [`id=${set.id.trim()}`, ...set.steps.filter((step) => step.trim()).map((step) => `step=${step.trim()}`)].join('\n'));
  const parts = [...(prefix.length ? [prefix.join('\n')] : []), ...body];
  return `${parts.join('\n\n')}\n`;
}

export const DEFAULT_STEP_SOUNDS = `id=cloth
step=soundfx/steps/step_cloth1.ogg
`;

type AvatarFs = {
  readFile: (absPath: string) => Promise<string | null | undefined>;
  readDir?: (absPath: string) => Promise<Array<{ name: string; isDirectory?: boolean }> | null | undefined>;
};

async function listTxtNames(absDir: string, readDir: AvatarFs['readDir']): Promise<string[]> {
  if (!readDir) return [];
  try {
    const entries = (await readDir(absDir)) || [];
    return entries
      .filter((entry) => !entry.isDirectory && String(entry.name || '').toLowerCase().endsWith('.txt'))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/** Project engine/avatar files, plus required-mod / default copies when the project has none of that name. */
export async function loadAvatarSfxFiles(opts: {
  projectPath: string;
  flarePath: string | null;
  fs: AvatarFs;
}): Promise<Record<string, string>> {
  const root = projectRoot(opts.projectPath);
  const requires = parseProjectRequires((await opts.fs.readFile(`${root}/project.json`).catch(() => '')) || '');
  const names = new Set<string>();
  const dirs = candidateEnginePaths({
    projectRoot: root,
    flarePath: opts.flarePath,
    requires,
    relative: AVATAR_SFX_DIR,
  });
  for (const dir of dirs) {
    for (const name of await listTxtNames(dir, opts.fs.readDir)) names.add(name);
  }
  const files: Record<string, string> = {};
  for (const name of [...names].sort()) {
    const loaded = await loadEngineFileWithFallback({
      projectPath: opts.projectPath,
      relative: `${AVATAR_SFX_DIR}/${name}`,
      flarePath: opts.flarePath,
      fs: opts.fs,
      requires,
    });
    if (loaded.text.trim()) files[`${AVATAR_SFX_DIR}/${name}`] = loaded.text;
  }
  return files;
}
