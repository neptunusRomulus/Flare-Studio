import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TileMapEditor } from '../editor/TileMapEditor';
import type { TileMapEditor as TileMapEditorType } from '../editor/TileMapEditor';

export type HeroEditData = {
  currentX: number;
  currentY: number;
  mapWidth: number;
  mapHeight: number;
  onConfirm: (x: number, y: number) => void;
};

export type NpcDeletePopup = { npcId: number; screenX: number; screenY: number } | null;

type UseEditorStateOptions = {
  autoSaveEnabled: boolean;
  currentProjectPath: string | null;
  isDarkMode: boolean;
  showWelcome: boolean;
  isOpeningProject: boolean;
  pendingMapConfig: unknown | null;
  mapInitialized: boolean;
  mapWidth: number;
  mapHeight: number;
  // Callbacks from App that setupAutoSave needs
  handleSelectTool: (tool: string) => void;
  setSelectedBrushTool: (t: string) => void;
  setStamps: (s: unknown) => void;
  setMapObjects: (objs: unknown[]) => void;
  setNpcDeletePopup: (p: NpcDeletePopup) => void;
  setHeroEditData: (d: HeroEditData | null) => void;
  setShowHeroEditDialog: (v: boolean) => void;
  setSaveStatus: (s: 'saving' | 'saved' | 'error' | 'unsaved') => void;
  setHasUnsavedChanges: (b: boolean) => void;
  setLastSaveTime: (t: number) => void;
};
export function useEditorState(optsRef: React.RefObject<Partial<UseEditorStateOptions>>) {
  const [editor, setEditor] = useState<TileMapEditorType | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const setupAutoSaveRef = useRef<null | ((editor: TileMapEditorType) => void)>(null);
  const updateLayersListRef = useRef<null | (() => void)>(null);
  const syncMapObjectsRef = useRef<null | (() => void)>(null);

  const setupAutoSaveWrapper = useCallback((target: TileMapEditorType) => {
    setupAutoSaveRef.current?.(target);
  }, []);

  const updateLayersListWrapper = useCallback(() => {
    updateLayersListRef.current?.();
  }, []);

  const syncMapObjectsWrapper = useCallback(() => {
    syncMapObjectsRef.current?.();
  }, []);

  // Implement setupAutoSave here using passed callbacks stored in optsRef
  const setupAutoSave = useCallback((editorInstance: TileMapEditorType) => {
    const opts = optsRef.current ?? {};
    editorInstance.setAutoSaveCallback(async () => {
      try {
        if (window.electronAPI && opts.currentProjectPath) {
          await editorInstance.saveProjectData(opts.currentProjectPath);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Auto-save to disk failed:', e);
      }
      opts.setLastSaveTime?.(Date.now());
    });

    editorInstance.setSaveStatusCallback((status) => {
      opts.setSaveStatus?.(status as 'saving' | 'saved' | 'error' | 'unsaved');
      opts.setHasUnsavedChanges?.(status === 'unsaved' || status === 'error');
    });

    editorInstance.setAutoSaveEnabled(Boolean(opts.autoSaveEnabled));

    editorInstance.setEyedropperCallback(() => {
      opts.handleSelectTool?.('brush');
      opts.setSelectedBrushTool?.('brush');
    });

    editorInstance.setStampCallback((stampsList) => {
      opts.setStamps?.(stampsList);
    });

    editorInstance.setObjectsChangedCallback((objects) => {
      opts.setMapObjects?.(objects);
    });

    editorInstance.setNpcRightClickCallback((npcId, screenX, screenY) => {
      opts.setNpcDeletePopup?.({ npcId, screenX, screenY });
    });

    editorInstance.setHeroEditCallback((currentX, currentY, mapW, mapH, onConfirm) => {
      opts.setHeroEditData?.({ currentX, currentY, mapWidth: mapW, mapHeight: mapH, onConfirm });
      opts.setShowHeroEditDialog?.(true);
    });
  }, [optsRef]);

  // keep ref up-to-date so App can call setupAutoSaveRef.current
  useEffect(() => {
    setupAutoSaveRef.current = setupAutoSave;
  }, [setupAutoSave]);

  // Editor instantiation effect reads options from optsRef
  useEffect(() => {
    const opts = optsRef.current ?? {};
    if (
      canvasRef.current &&
      !opts.showWelcome &&
      !editor &&
      !opts.isOpeningProject &&
      !opts.pendingMapConfig
    ) {
      const tileEditor = new TileMapEditor(canvasRef.current);
      tileEditor.setDarkMode(Boolean(opts.isDarkMode));
      setupAutoSave(tileEditor);

      tileEditor.resetForNewProject();
      if (opts.mapInitialized && (opts.mapWidth ?? 0) > 0 && (opts.mapHeight ?? 0) > 0) {
        tileEditor.setMapSize(opts.mapWidth ?? 0, opts.mapHeight ?? 0);
      } else {
        tileEditor.setMapSize(0, 0);
      }

      setEditor(tileEditor);
    }
    // cleanup when unmounting
    return () => {
      if (editor) {
        const maybe = editor as unknown as Record<string, unknown>;
        if (typeof maybe.dispose === 'function') {
          try {
            (maybe.dispose as () => void)();
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('Error disposing editor:', err);
          }
        }
      }
    };
  }, [canvasRef, editor, setupAutoSave, optsRef]);

  return {
    editor,
    setEditor,
    canvasRef,
    setupAutoSaveRef,
    updateLayersListRef,
    syncMapObjectsRef,
    setupAutoSaveWrapper,
    updateLayersListWrapper,
    syncMapObjectsWrapper
  } as const;
}

export default useEditorState;
