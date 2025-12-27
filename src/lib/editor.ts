import type { TileMapEditor as TileMapEditorType } from '@/editor/TileMapEditor';
import { TileMapEditor } from '@/editor/TileMapEditor';

export type Editor = TileMapEditorType;

export function createEditor(canvas: HTMLCanvasElement): Editor {
  return new TileMapEditor(canvas);
}

export async function ensureTilesetsLoaded(editor: Editor | null): Promise<void> {
  if (!editor) return;
  // some builds may attach ensureTilesetsLoaded as a method
  type Ext = { ensureTilesetsLoaded?: () => Promise<void> };
  const ext = editor as Editor & Ext;
  if (typeof ext.ensureTilesetsLoaded === 'function') {
    await ext.ensureTilesetsLoaded();
  }
}

export async function saveProjectData(editor: Editor | null, projectPath: string): Promise<void> {
  if (!editor) return;
  type Ext = { saveProjectData?: (path: string) => Promise<void> | Promise<boolean> };
  const ext = editor as Editor & Ext;
  if (typeof ext.saveProjectData === 'function') {
    await ext.saveProjectData(projectPath);
  }
}

export function setActiveGidCallback(editor: Editor | null, cb: ((gid: number) => void) | null) {
  if (!editor) return;
  type Ext = { setActiveGidCallback?: ((cb: ((gid: number) => void) | null) => void) };
  const ext = editor as Editor & Ext;
  if (typeof ext.setActiveGidCallback === 'function') ext.setActiveGidCallback(cb);
}

export default { createEditor, ensureTilesetsLoaded, saveProjectData, setActiveGidCallback };
