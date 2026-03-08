import { useCallback, useMemo } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { TileLayer } from '@/types';

export default function useTileset(editor: TileMapEditor | null, activeLayer: TileLayer | null, setTabTick?: React.Dispatch<React.SetStateAction<number>>) {
  const layerType = activeLayer?.type || null;

  const getTabs = useCallback(() => {
    if (!editor || !layerType) return [] as Array<{ id: number; name?: string }>;
    try { return editor.getLayerTabs ? editor.getLayerTabs(layerType) : []; } catch { return []; }
  }, [editor, layerType]);

  const activeTabId = useMemo(() => {
    if (!editor || !layerType) return null;
    try { return editor.getActiveLayerTabId ? editor.getActiveLayerTabId(layerType) : null; } catch { return null; }
  }, [editor, layerType]);

  const setActiveTab = useCallback((tabId: number) => {
    if (!editor || !layerType) return;
    try {
      editor.setActiveLayerTab(layerType, tabId);
      try { editor.refreshTilePalette(true); } catch { /* ignore */ }
      if (setTabTick) setTabTick(t => t + 1);
    } catch { /* ignore */ }
  }, [editor, layerType, setTabTick]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>, type: 'tileset' | 'layerTileset') => {
    // Importing is currently disabled per request — keep as a no-op to avoid accidental imports.
    const file = event.target.files?.[0];
    if (!file) return;
    return;
  }, [editor]);

  const deleteActiveTab = useCallback(() => {
    if (!editor || !layerType) return false;
    try {
      const active = editor.getActiveLayerTabId ? editor.getActiveLayerTabId(layerType) : null;
      if (active === null) return false;
      editor.removeLayerTab(layerType, active);
      try { editor.refreshTilePalette(true); } catch { /* ignore */ }
      if (setTabTick) setTabTick(t => t + 1);
      return true;
    } catch {
      return false;
    }
  }, [editor, layerType, setTabTick]);

  const refreshTilePalette = useCallback((force = false) => {
    if (!editor) return;
    try { editor.refreshTilePalette(force); } catch { /* ignore */ }
  }, [editor]);

  type TilesetExportInfo = { id?: string | number; fileName?: string; sourcePath?: string | null; tileWidth?: number; tileHeight?: number; spacing?: number; margin?: number };
  const tilesetExportInfo = useMemo(() => {
    if (!editor) return [] as TilesetExportInfo[];
    try { return editor.getTilesetExportInfo() as TilesetExportInfo[]; } catch { return []; }
  }, [editor]);

  const selectTilesetFile = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electronAPI?.selectTilesetFile) return null;
    try {
      const selected = await window.electronAPI.selectTilesetFile();
      if (!selected) return null;
      if (window.electronAPI.readFileAsDataURL && editor && typeof editor.loadTilesetFromDataURL === 'function') {
        const dataUrl = await window.electronAPI.readFileAsDataURL(selected);
        if (dataUrl) {
          const fileName = selected.split(/[\\/]/).pop() || selected;
          await editor.loadTilesetFromDataURL(dataUrl, fileName, selected);
          refreshTilePalette(true);
        }
      }
      return selected;
    } catch {
      return null;
    }
  }, [editor, refreshTilePalette]);

  return {
    getTabs,
    activeTabId,
    setActiveTab,
    handleFileUpload,
    deleteActiveTab,
    refreshTilePalette,
    tilesetExportInfo,
    selectTilesetFile
  } as const;
}
