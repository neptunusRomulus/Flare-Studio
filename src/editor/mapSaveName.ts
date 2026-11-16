import { slugFileName } from '@/adapters/flare/flareAdapter.cjs';

/**
 * Choose the map identity to persist when leaving a tab.
 * If the editor's current name already slugs to the same file as the tab,
 * keep the editor display name. Otherwise prefer the tab name so a stale
 * editor.mapName cannot overwrite a different map's JSON.
 */
export function resolveSaveMapName(
  editorName: string | null | undefined,
  tabName: string | null | undefined
): string | undefined {
  const editor = String(editorName || '').trim();
  const tab = String(tabName || '').trim();
  if (editor && tab && slugFileName(editor) === slugFileName(tab)) return editor;
  if (tab) return tab;
  if (editor) return editor;
  return undefined;
}
