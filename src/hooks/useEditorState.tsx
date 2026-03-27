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

  // read ref.current without invoking accessor getters (protect against malformed refs)
  const _safeReadSeen = new WeakSet<object>();
    const safeReadRefCurrent = (r: React.RefObject<unknown> | null | undefined) => {
    try {
      if (!r || typeof r !== 'object') return undefined;
      // avoid re-entering for the same object
          if (_safeReadSeen.has(r as object)) return undefined;
          _safeReadSeen.add(r as object);
      // If the ref is not a plain object (likely a Proxy or exotic object), bail out.
      const proto = Object.getPrototypeOf(r as object);
      if (proto !== Object.prototype && proto !== null) {
        _safeReadSeen.delete(r as object);
        return undefined;
      }
      // Accessing .current directly; if this throws or re-enters it'll be caught.
          const val = (r as React.RefObject<unknown>).current;
      _safeReadSeen.delete(r as object);
      return val;
    } catch (e) {
      return undefined;
    }
  };

  const setupAutoSaveRef = useRef<null | ((editor: TileMapEditorType) => void)>(null);
  const updateLayersListRef = useRef<null | (() => void)>(null);
  const syncMapObjectsRef = useRef<null | (() => void)>(null);
  const updateLayersListWrapperRef = useRef<(() => void) | null>(null);
  const syncMapObjectsWrapperRef = useRef<(() => void) | null>(null);

  const setupAutoSaveWrapper = useCallback((target: TileMapEditorType) => {
    setupAutoSaveRef.current?.(target);
  }, []);

  const updateLayersListWrapper = useCallback(() => {
    const fn = updateLayersListRef.current;
    if (fn && fn !== updateLayersListWrapperRef.current) {
      fn();
    }
  }, [updateLayersListRef, updateLayersListWrapperRef]);

  const syncMapObjectsWrapper = useCallback(() => {
    const fn = syncMapObjectsRef.current;
    console.log('[DEBUG-Wrapper] syncMapObjectsWrapper called, fn exists:', !!fn, 'fn type:', typeof fn);
    if (fn && typeof fn === 'function') {
      // Always call the function if it exists and is a function
      // Don't compare to wrapper to avoid skipping legitimate calls
      console.log('[DEBUG-Wrapper] Calling syncMapObjectsRef.current');
      fn();
      console.log('[DEBUG-Wrapper] syncMapObjectsRef.current completed');
    } else {
      console.log('[DEBUG-Wrapper] Skipped: fn is not a valid function', fn);
    }
  }, [syncMapObjectsRef]);

  updateLayersListWrapperRef.current = updateLayersListWrapper;
  syncMapObjectsWrapperRef.current = syncMapObjectsWrapper;

  // Editor command helpers — keep lifecycle and commands inside the hook
  const handlePlaceActorOnMap = useCallback((objectId: number, x?: number, y?: number) => {
    if (!editor) return;
    // safe read of optsRef.current to avoid recursive ref structures
    let opts: Partial<UseEditorStateOptions> = {};
    try {
          const cand = safeReadRefCurrent(optsRef) as Partial<UseEditorStateOptions> | undefined;
          if (cand === optsRef || (cand && (cand as React.RefObject<unknown>).current === optsRef)) {
        opts = {};
      } else {
        opts = cand ?? {};
      }
    } catch (e) {
      opts = {};
    }
    const spawnX = x !== undefined ? x : Math.floor((opts.mapWidth ?? 0) / 2);
    const spawnY = y !== undefined ? y : Math.floor((opts.mapHeight ?? 0) / 2);
    editor.updateMapObject(objectId, { x: spawnX, y: spawnY });
    syncMapObjectsWrapper();
  }, [editor, syncMapObjectsWrapper, optsRef]);

  const handleUnplaceActorFromMap = useCallback((objectId: number) => {
    if (!editor) return;
    editor.updateMapObject(objectId, { x: -1, y: -1 });
    syncMapObjectsWrapper();
  }, [editor, syncMapObjectsWrapper]);

  const handlePlaceEventOnMap = useCallback((eventId: string, x: number, y: number) => {
    // TODO: Integrate with EditorCore.events to update event position
    // For now, this is a placeholder that will be enhanced once EditorCore integration is complete
    console.log('[DEBUG] Event placed on map:', { eventId, x, y });
  }, []);

  const handleFillSelection = useCallback(() => {
    if (!editor) return;
    editor.fillSelection();
  }, [editor]);

  const handleClearSelection = useCallback(() => {
    if (!editor) return;
    editor.clearSelection();
  }, [editor]);

  const handleDeleteSelection = useCallback(() => {
    if (!editor) return;
    editor.deleteSelection();
  }, [editor]);

  // Implement setupAutoSave here using passed callbacks stored in optsRef
  const setupAutoSave = useCallback((editorInstance: TileMapEditorType) => {
    // safe read to avoid recursing into malformed refs
    let opts: Partial<UseEditorStateOptions> = {};
    try {
          const cand = safeReadRefCurrent(optsRef) as Partial<UseEditorStateOptions> | undefined;
          if (cand === optsRef || (cand && (cand as React.RefObject<unknown>).current === optsRef)) {
        opts = {};
      } else {
        opts = cand ?? {};
      }
    } catch (e) {
      opts = {};
    }
    editorInstance.setSaveStatusCallback((status) => {
      opts.setSaveStatus?.(status as 'saving' | 'saved' | 'error' | 'unsaved');
      opts.setHasUnsavedChanges?.(status === 'unsaved' || status === 'error');
    });

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
    // guard against malformed refs that recursively reference themselves
    let opts: Partial<UseEditorStateOptions> = {};
    try {
          const candidate = safeReadRefCurrent(optsRef) as Partial<UseEditorStateOptions> | undefined;
      if (candidate === optsRef) {
        console.warn('Detected recursive optsRef; ignoring to avoid stack overflow.');
        opts = {};
      } else {
        opts = candidate ?? {};
      }
    } catch (e) {
      opts = {};
    }
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
    ,
    handlePlaceActorOnMap,
    handleUnplaceActorFromMap,
    handlePlaceEventOnMap,
    handleFillSelection,
    handleClearSelection,
    handleDeleteSelection
  } as const;
}

export default useEditorState;
