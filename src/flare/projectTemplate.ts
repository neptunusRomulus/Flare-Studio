import { loadingOverlay } from '@/components/loadingOverlayStore';
/**
 * "Start with template": the Welcome screen queues the import for the new
 * project; AppMain runs it once that project's editor is ready.
 */
export type ProjectStart = 'scratch' | 'template';

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
