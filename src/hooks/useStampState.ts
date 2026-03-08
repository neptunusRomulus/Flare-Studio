import { useCallback, useEffect, useState } from 'react';
import type { Stamp, StampMode } from '@/types';
import type { TileMapEditor } from '../editor/TileMapEditor';

type TilesetInfoMinimal = {
  fileName?: string;
  sourcePath?: string | null;
  tileWidth?: number;
  tileHeight?: number;
  columns?: number;
  rows?: number;
  id?: string | number;
};

const useStampState = () => {
  const [brushTool, setBrushTool] = useState<'none' | 'move' | 'merge' | 'separate' | 'remove'>('none');
  const [showSeparateDialog, setShowSeparateDialog] = useState(false);
  const [brushToSeparate, setBrushToSeparate] = useState<number | null>(null);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [selectedStamp, setSelectedStamp] = useState<string | null>(null);
  const [stampMode, setStampMode] = useState<StampMode>('select');
  const [showStampDialog, setShowStampDialog] = useState(false);
  const [newStampName, setNewStampName] = useState('');

  // Tileset / palette state
  const [tilesetInfos, setTilesetInfos] = useState<TilesetInfoMinimal[]>([]);
  const [activeTilesetFile, setActiveTilesetFile] = useState<string | null>(null);
  const [paletteTileIds, setPaletteTileIds] = useState<number[]>([]);

  const refreshTilesetInfos = useCallback((editor: TileMapEditor | null) => {
    if (!editor || typeof editor.getTilesetExportInfo !== 'function') {
      setTilesetInfos([]);
      return;
    }
    try {
      const info = editor.getTilesetExportInfo();
      setTilesetInfos((info || []) as TilesetInfoMinimal[]);
    } catch {
      setTilesetInfos([]);
    }
  }, []);

  const selectAndLoadTilesetFile = useCallback(async (editor: TileMapEditor | null) => {
    if (typeof window === 'undefined' || !window.electronAPI?.selectTilesetFile) return null;
    try {
      const selected = await window.electronAPI.selectTilesetFile();
      if (!selected) return null;
      // Try to read as DataURL and load into editor
      if (window.electronAPI.readFileAsDataURL && typeof editor?.loadTilesetFromDataURL === 'function') {
        const dataUrl = await window.electronAPI.readFileAsDataURL(selected);
        if (dataUrl) {
          const fileName = selected.split(/[\\/]/).pop() || selected;
          await editor.loadTilesetFromDataURL(dataUrl, fileName, selected);
          setActiveTilesetFile(fileName);
          refreshTilesetInfos(editor);
          return selected;
        }
      }
      // Fallback: just set active filename and refresh
      const f = selected.split(/[\\/]/).pop() || selected;
      setActiveTilesetFile(f);
      refreshTilesetInfos(editor);
      return selected;
    } catch {
      // ignore
      return null;
    }
  }, [refreshTilesetInfos]);

  const collectTilesetDataUrls = useCallback(async (editor: TileMapEditor | null) => {
    const out: Record<string, string | null> = {};
    if (!editor || typeof editor.getTilesetExportInfo !== 'function') return out;
    try {
      const infos = editor.getTilesetExportInfo() || [];
      for (const it of infos) {
        const key = (it && (it.fileName || it.sourcePath)) || String(it.id || Math.random());
        out[key] = null;
        // prefer resolving via sourcePath through electron API
        if (it && it.sourcePath && window.electronAPI?.readFileAsDataURL) {
          try {
            const d = await window.electronAPI.readFileAsDataURL(it.sourcePath);
            out[key] = d || null;
            continue;
          } catch {
            // ignore and try other methods
          }
        }
        // As a last resort try editor internal serialization
        try {
          // private helper available in editor
          if (typeof (editor as unknown as Record<string, unknown>).canvasToDataURL === 'function') {
            // try to find preloaded images in known private props
            const ed = editor as unknown as Record<string, unknown>;
            const preloaded = ed._preloadedTilesetImages as Record<string, HTMLImageElement> | undefined;
            const legacyImg = ed.tilesetImage as HTMLImageElement | undefined;
            const img = preloaded ? Object.values(preloaded)[0] : legacyImg;
              const canvasToDataURL = (editor as unknown as { canvasToDataURL?: (img: HTMLImageElement) => string }).canvasToDataURL;
              if (img && typeof canvasToDataURL === 'function') {
                out[key] = canvasToDataURL.call(editor, img as HTMLImageElement);
            }
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
    return out;
  }, []);

  useEffect(() => {
    // keep palette ids in sync when tilesets change (best-effort)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tilesetInfos.length === 0) setPaletteTileIds([]);
  }, [tilesetInfos]);

  return {
    brushTool,
    setBrushTool,
    showSeparateDialog,
    setShowSeparateDialog,
    brushToSeparate,
    setBrushToSeparate,
    stamps,
    setStamps,
    selectedStamp,
    setSelectedStamp,
    stampMode,
    setStampMode,
    showStampDialog,
    setShowStampDialog,
    newStampName,
    setNewStampName,
    // tileset / palette API
    tilesetInfos,
    activeTilesetFile,
    paletteTileIds,
    setPaletteTileIds,
    refreshTilesetInfos,
    selectAndLoadTilesetFile,
    collectTilesetDataUrls
  };
};

export default useStampState;
