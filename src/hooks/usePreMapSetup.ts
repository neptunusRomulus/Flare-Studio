import { useEffect, useRef } from 'react';
import { importTemplateTilesets, type TilesetImportEditor } from '@/editor/importTileset';
import { takeTemplateImport, markPreMapSlots } from '@/flare/projectTemplate';
import { loadingOverlay } from '@/components/loadingOverlayStore';
import { toast } from '@/hooks/use-toast';

export type PreMapLayer = { id: string; type: string };

/** The first background layer, or undefined when the map has none yet. */
export function findBackgroundLayer(layers: PreMapLayer[] | undefined | null): PreMapLayer | undefined {
  return (layers ?? []).find((layer) => layer.type === 'background');
}

type LayerHost = {
  layers?: PreMapLayer[];
  handleSetActiveLayer?: (id: string) => unknown;
} | undefined | null;

type TileHost = { setTabTick?: (tick: (t?: number) => number) => void } | undefined | null;

type Options = {
  editor: (object & { getLayers?: () => PreMapLayer[] }) | null | undefined;
  hasMap: boolean;
  projectPath: string | null;
  layersObj: LayerHost;
  tileset: TileHost;
};

/**
 * The two things that must happen before the first map exists: select the background so the palette
 * has something to paint on, and import the template tilesets when the project was started from one.
 */
export default function usePreMapSetup({ editor, hasMap, projectPath, layersObj, tileset }: Options) {
  const initializedFor = useRef<unknown>(null);

  useEffect(() => {
    if (!editor || hasMap || !projectPath || initializedFor.current === editor) return;
    initializedFor.current = editor;
    const background = findBackgroundLayer(typeof editor.getLayers === 'function' ? editor.getLayers() : []);
    if (background) { try { void layersObj?.handleSetActiveLayer?.(background.id); } catch { /* ignore */ } }
  }, [editor, hasMap, projectPath, layersObj]);

  useEffect(() => {
    if (!editor || !projectPath) return;
    const background = findBackgroundLayer(typeof editor.getLayers === 'function' ? editor.getLayers() : []);
    if (!background) return;
    const flarePath = takeTemplateImport(projectPath);
    if (!flarePath) return;
    if (!hasMap) markPreMapSlots(editor);
    void (async () => {
      let result: Awaited<ReturnType<typeof importTemplateTilesets>>;
      try {
        loadingOverlay.begin('template');
        result = await importTemplateTilesets(editor as TilesetImportEditor, flarePath, projectPath, 'background',
          (done, total) => loadingOverlay.progress('template', done, total, 'Loading tilesets…'));
      } catch (err) {
        console.warn('[Template] import failed', err);
        result = { imported: [], skipped: [], failed: [], misfit: [] };
      }
      loadingOverlay.end('template');
      try { await layersObj?.handleSetActiveLayer?.(background.id); } catch { /* ignore */ }
      try { tileset?.setTabTick?.((tick) => (tick || 0) + 1); } catch { /* ignore */ }
      if (result.imported.length > 0) {
        const notes = [
          result.skipped.length > 0 ? `${result.skipped.length} skipped (slot limit)` : '',
          result.failed.length > 0 ? `${result.failed.length} failed` : '',
          result.misfit.length > 0 ? `${result.misfit.length} don't fit the tile size` : '',
        ].filter(Boolean).join(', ');
        toast({ title: 'Template tilesets imported', description: notes || undefined });
      } else {
        toast({ title: 'Template import failed', variant: 'destructive' });
      }
    })();
  }, [editor, hasMap, projectPath, layersObj, tileset]);
}
