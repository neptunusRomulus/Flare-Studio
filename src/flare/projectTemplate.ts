import { loadingOverlay } from '@/components/loadingOverlayStore';
/**
 * "Start with template": the Welcome screen queues the import for the new
 * project; AppMain runs it once that project's editor is ready.
 */
export type ProjectStart = 'scratch' | 'template';

const PROJECT_START_KEY = 'flare-studio.project-start';

/** Remember how a project was created so project-specific tools can respect its starting point. */
export function rememberProjectStart(projectPath: string, start: ProjectStart): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const saved = JSON.parse(localStorage.getItem(PROJECT_START_KEY) || '{}') as Record<string, ProjectStart>;
    localStorage.setItem(PROJECT_START_KEY, JSON.stringify({ ...saved, [projectPath]: start }));
  } catch { /* ignore unavailable or malformed local storage */ }
}

/** Remembered start mode, or null when this machine has no record. */
export function projectStartFor(projectPath: string | null | undefined): ProjectStart | null {
  if (!projectPath || typeof localStorage === 'undefined') return null;
  try {
    const saved = JSON.parse(localStorage.getItem(PROJECT_START_KEY) || '{}') as Record<string, ProjectStart>;
    const value = saved[projectPath];
    return value === 'template' || value === 'scratch' ? value : null;
  } catch { return null; }
}

/** Persist the start mode in project.json so it travels with the project, and keep a local fallback. */
export async function persistProjectStart(projectPath: string, start: ProjectStart): Promise<void> {
  rememberProjectStart(projectPath, start);
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (!api?.readFile || !api.writeFile) return;
  const file = `${projectPath.replace(/\\/g, '/')}/project.json`;
  try {
    const text = await api.readFile(file);
    if (text == null) return;
    const json = JSON.parse(text) as { meta?: Record<string, unknown> };
    json.meta = { ...(json.meta || {}), studioStart: start };
    await api.writeFile(file, `${JSON.stringify(json, null, 2)}\n`);
  } catch { /* leave the localStorage fallback if the project file cannot be updated */ }
}

let pending: { projectPath: string; flarePath: string } | null = null;

export function queueTemplateImport(projectPath: string, flarePath: string): void {
  pending = { projectPath, flarePath };
  loadingOverlay.begin('template');
}

// Editors that received template slots before any map existed: creating the first map keeps them.
const preMapEditors = new WeakSet<object>();
export function markPreMapSlots(editor: object): void { preMapEditors.add(editor); }
export function consumePreMapSlots(editor: object | null | undefined): boolean {
  if (!editor || !preMapEditors.has(editor)) return false;
  preMapEditors.delete(editor);
  return true;
}

/** Returns the Flare path to import from when this project has a queued template, and clears it. */
export function takeTemplateImport(projectPath: string | null | undefined): string | null {
  if (!pending || !projectPath || pending.projectPath !== projectPath) return null;
  const { flarePath } = pending;
  pending = null;
  return flarePath;
}

/** A template is available when the saved Flare path resolves to a fantasycore with tileset PNGs. */
export async function isTemplateAvailable(flarePath: string | null | undefined): Promise<boolean> {
  if (!flarePath || typeof window === 'undefined' || !window.electronAPI?.listTemplateTilesets) return false;
  try {
    const listing = await window.electronAPI.listTemplateTilesets(flarePath);
    return Boolean(listing.ok && listing.files.length > 0);
  } catch {
    return false;
  }
}
