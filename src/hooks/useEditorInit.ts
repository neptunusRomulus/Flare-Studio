import { useCallback, useEffect } from 'react';
import { TileMapEditor } from '@/editor/TileMapEditor';
import type { EditorProjectData } from '@/editor/TileMapEditor';
import type { Stamp, MapObject } from '@/types';

type PrimaryTool = 'brush' | 'selection' | 'shape' | 'stamp' | 'eyedropper';
type BrushTool = 'brush' | 'eraser' | 'bucket' | 'clear';

type SetupParams = {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  showWelcome: boolean;
  editor: TileMapEditor | null;
  setEditor: (e: TileMapEditor | null) => void;
  isOpeningProject: boolean;
  pendingMapConfig: EditorProjectData | null;
  isDarkMode: boolean;
  mapInitialized: boolean;
  mapWidth: number;
  mapHeight: number;
  handleSelectTool: (tool: PrimaryTool) => void;
  setSelectedBrushTool: (t: BrushTool) => void;
  setStamps: (s: Stamp[]) => void;
  setMapObjects: (o: MapObject[]) => void;
  setNpcDeletePopup: (p: { npcId: number; screenX: number; screenY: number } | null) => void;
  setHeroEditData: (d: { currentX: number; currentY: number; mapWidth: number; mapHeight: number; onConfirm: (x: number, y: number) => void } | null) => void;
  setShowHeroEditDialog: (v: boolean) => void;
  setSaveStatus: (s: 'saving'|'saved'|'error'|'unsaved') => void;
  setHasUnsavedChanges: (v: boolean) => void;
  setLastSaveTime: (t: number) => void;
  autoSaveEnabled: boolean;
  setupAutoSaveRef: React.MutableRefObject<null | ((editor: TileMapEditor) => void)>;
};

export function useEditorInit(params: SetupParams) {
  const {
    canvasRef,
    showWelcome,
    editor,
    setEditor,
    isOpeningProject,
    pendingMapConfig,
    isDarkMode,
    mapInitialized,
    mapWidth,
    mapHeight,
    handleSelectTool,
    setSelectedBrushTool,
    setStamps,
    setMapObjects,
    setNpcDeletePopup,
    setHeroEditData,
    setShowHeroEditDialog,
    setSaveStatus,
    setHasUnsavedChanges,
    setLastSaveTime,
    autoSaveEnabled,
    setupAutoSaveRef
  } = params;

  const setupAutoSave = useCallback((editorInstance: TileMapEditor) => {
    editorInstance.setAutoSaveCallback(async () => {
      try {
        // persistence handled by App via project path; keep timestamp update here
      } catch (e) {
        console.warn('Auto-save to disk failed:', e);
      }
      setLastSaveTime(Date.now());
    });

    editorInstance.setSaveStatusCallback((status) => {
      setSaveStatus(status);
      setHasUnsavedChanges(status === 'unsaved' || status === 'error');
    });

    editorInstance.setAutoSaveEnabled(autoSaveEnabled);

    editorInstance.setEyedropperCallback(() => {
      handleSelectTool('brush');
      setSelectedBrushTool('brush');
    });

    editorInstance.setStampCallback((stampsList) => {
      setStamps(stampsList);
    });

    editorInstance.setObjectsChangedCallback((objects) => {
      setMapObjects(objects);
    });

    editorInstance.setNpcRightClickCallback((npcId, screenX, screenY) => {
      setNpcDeletePopup({ npcId, screenX, screenY });
    });

    editorInstance.setHeroEditCallback((currentX, currentY, w, h, onConfirm) => {
      setHeroEditData({ currentX, currentY, mapWidth: w, mapHeight: h, onConfirm });
      setShowHeroEditDialog(true);
    });
  }, [autoSaveEnabled, handleSelectTool, setHasUnsavedChanges, setHeroEditData, setLastSaveTime, setMapObjects, setNpcDeletePopup, setSaveStatus, setSelectedBrushTool, setShowHeroEditDialog, setStamps]);

  useEffect(() => {
    setupAutoSaveRef.current = setupAutoSave;
  }, [setupAutoSave, setupAutoSaveRef]);

  useEffect(() => {
    if (!canvasRef.current || showWelcome || editor || isOpeningProject || pendingMapConfig) return;

    const tileEditor = new TileMapEditor(canvasRef.current);
    tileEditor.setDarkMode(isDarkMode);
    setupAutoSave(tileEditor);

    tileEditor.resetForNewProject();
    if (mapInitialized && mapWidth > 0 && mapHeight > 0) {
      tileEditor.setMapSize(mapWidth, mapHeight);
    } else {
      tileEditor.setMapSize(0, 0);
    }

    setEditor(tileEditor);

    // intentionally minimal dependency set to mirror previous behavior
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, showWelcome, editor, isOpeningProject, pendingMapConfig, isDarkMode, mapInitialized, mapWidth, mapHeight, setupAutoSave]);
}

export default useEditorInit;
