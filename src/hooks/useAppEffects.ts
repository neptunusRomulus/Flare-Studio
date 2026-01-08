/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react';
import type { Tool } from '../types';

type RefOrNull<T> = { current: T | null };

type AppEffectsParams = {
  createTabForRef: RefOrNull<(...args: unknown[]) => unknown>;
  createTabFor: (...args: unknown[]) => unknown;
  beforeCreateMapRef: RefOrNull<(...args: any[]) => any>;
  handleBeforeCreateMap: () => Promise<void> | void;
  tabs: Array<{ id: string | number; name?: string; projectPath?: string }>;
  activeTabId: string | number | null;
  currentProjectPath: string | null;
  setActiveTabId: (id: string | number | null) => void;
  toast?: unknown;
  editor?: {
    setCurrentTool?: (t: unknown) => void;
    setCurrentSelectionTool?: (t: unknown) => void;
    setCurrentShapeTool?: (t: unknown) => void;
    setEyedropperTool?: () => void;
    setStampTool?: () => void;
    setCurrentStampMode?: (m: unknown) => void;
    setActiveStamp?: (s: unknown) => void;
    getSelection?: () => unknown[];
    hasActiveSelection?: () => boolean;
    setNpcDragHover?: (x: number, y: number) => void;
    clearNpcDragHover?: () => void;
    screenToTile?: (x: number, y: number) => { x: number; y: number } | null;
  } | null;
  selectedTool?: Tool | string;
  selectedBrushTool?: string;
  selectedSelectionTool?: string;
  selectedShapeTool?: string;
  stampMode?: unknown;
  selectedStamp?: unknown;
  setSelectionCount: (n: number) => void;
  setHasSelection: (v: boolean) => void;
  updateLayersList: () => void;
  updateLayersListRef: RefOrNull<(...args: unknown[]) => unknown>;
  syncMapObjects: () => void;
  syncMapObjectsRef: RefOrNull<(...args: unknown[]) => unknown>;
  showAddLayerDropdown: boolean;
  setShowAddLayerDropdown: (v: boolean) => void;
  loadProjectData: (...args: unknown[]) => unknown;
  setupAutoSaveWrapper: (...args: unknown[]) => unknown;
  handleOpenMap?: (...args: unknown[]) => unknown;
  handleUndo?: (...args: unknown[]) => unknown;
  handleRedo?: (...args: unknown[]) => unknown;
  handleOpenMapRef: RefOrNull<(...args: unknown[]) => unknown>;
  handleUndoRef: RefOrNull<(...args: unknown[]) => unknown>;
  handleRedoRef: RefOrNull<(...args: unknown[]) => unknown>;
  switchToTabHelpersRef: RefOrNull<unknown>;
};

export default function useAppEffects(params: unknown) {
  const p = params as AppEffectsParams;
  const {
    createTabForRef,
    createTabFor,
    beforeCreateMapRef,
    handleBeforeCreateMap,
    tabs,
    activeTabId,
    currentProjectPath,
    setActiveTabId,
    toast,
    editor,
    selectedTool,
    selectedBrushTool,
    selectedSelectionTool,
    selectedShapeTool,
    stampMode,
    selectedStamp,
    setSelectionCount,
    setHasSelection,
    updateLayersList,
    updateLayersListRef,
    syncMapObjects,
    syncMapObjectsRef,
    showAddLayerDropdown,
    setShowAddLayerDropdown,
    loadProjectData,
    setupAutoSaveWrapper,
    handleOpenMap,
    handleUndo,
    handleRedo,
    handleOpenMapRef,
    handleUndoRef,
    handleRedoRef,
    switchToTabHelpersRef
  } = p;

  useEffect(() => {
    if (createTabForRef) {
      try {
        createTabForRef.current = createTabFor;
      } catch (e) {
        console.warn('Failed to assign createTabForRef.current', e);
      }
    }
  }, [createTabFor, createTabForRef]);

  useEffect(() => {
    // Intentionally do not assign `beforeCreateMapRef.current` here to avoid
    // overwriting any external handler. The app-level `beforeCreateMapRef`
    // should be set by the component that provides the real pre-create
    // callback (e.g. map config). `handleBeforeCreateMap` below will call
    // whatever is stored in that ref when needed.
  }, [handleBeforeCreateMap, beforeCreateMapRef]);

  useEffect(() => {
    if (tabs.length > 0 && !activeTabId) {
      if (currentProjectPath) {
        const normalizedProjectPath = currentProjectPath.replace(/\\/g, '/').toLowerCase();
        const projectTabs = tabs.filter((t) => {
          const normalizedTabPath = t.projectPath?.replace(/\\/g, '/').toLowerCase() || '';
          return normalizedTabPath === normalizedProjectPath;
        });
        if (projectTabs.length > 0) {
          console.log('Auto-selecting first project tab:', projectTabs[0].name);
          setActiveTabId(projectTabs[0].id);
        }
      } else if (tabs.length > 0) {
        console.log('Auto-selecting first available tab:', tabs[0].name);
        setActiveTabId(tabs[0].id);
      }
    }
  }, [activeTabId, currentProjectPath, setActiveTabId, tabs]);

  useEffect(() => {
    // Keep 'toast' referenced to avoid unused variable errors while toasts are suppressed.
    void toast;
    return () => {
      // no-op cleanup
    };
  }, [toast]);

  useEffect(() => {
    const editorLocal = editor;
    if (editorLocal && selectedTool === 'brush') {
      const toolMap: { [key: string]: 'brush' | 'eraser' | 'bucket' } = {
        'brush': 'brush',
        'bucket': 'bucket',
        'eraser': 'eraser'
      };
      const editorTool = toolMap[selectedBrushTool as string] || 'brush';
      editorLocal.setCurrentTool?.(editorTool);
    } else if (editorLocal && selectedTool === 'selection') {
      const selectionToolMap: { [key: string]: 'rectangular' | 'magic-wand' | 'same-tile' | 'circular' } = {
        'rectangular': 'rectangular',
        'magic-wand': 'magic-wand',
        'same-tile': 'same-tile',
        'circular': 'circular'
      };
      const editorSelectionTool = selectionToolMap[selectedSelectionTool as string] || 'rectangular';
      editorLocal.setCurrentSelectionTool?.(editorSelectionTool);
    } else if (editorLocal && selectedTool === 'shape') {
      const shapeToolMap: { [key: string]: 'rectangle' | 'circle' | 'line' } = {
        'rectangle': 'rectangle',
        'circle': 'circle',
        'line': 'line'
      };
      const editorShapeTool = shapeToolMap[selectedShapeTool as string] || 'rectangle';
      editorLocal.setCurrentShapeTool?.(editorShapeTool);
    } else if (editorLocal && selectedTool === 'eyedropper') {
      editorLocal.setEyedropperTool?.();
    } else if (editorLocal && selectedTool === 'stamp') {
      editorLocal.setStampTool?.();
    }
  }, [editor, selectedTool, selectedBrushTool, selectedSelectionTool, selectedShapeTool]);

  useEffect(() => {
    if (!editor || selectedTool !== 'stamp') return;
    editor.setCurrentStampMode?.(stampMode);
  }, [editor, selectedTool, stampMode]);

  useEffect(() => {
    if (!editor || selectedTool !== 'stamp') return;
    editor.setActiveStamp?.(selectedStamp);
  }, [editor, selectedTool, selectedStamp]);

  useEffect(() => {
    const editorLocal = editor;
    if (!editorLocal) return;

    const updateSelection = () => {
      const selection = editorLocal.getSelection?.() || [];
      const hasActiveSelection = editorLocal.hasActiveSelection?.() || false;
      setSelectionCount(selection.length);
      setHasSelection(hasActiveSelection);
    };

    const intervalId = setInterval(updateSelection, 100);

    return () => clearInterval(intervalId);
  }, [editor, setSelectionCount, setHasSelection]);

  useEffect(() => {
    if (updateLayersListRef) {
      try {
        updateLayersListRef.current = updateLayersList;
      } catch (e) {
        console.warn('Failed to assign updateLayersListRef.current', e);
      }
    }
  }, [updateLayersList, updateLayersListRef]);

  useEffect(() => {
    if (syncMapObjectsRef) {
      try {
        syncMapObjectsRef.current = syncMapObjects;
      } catch (e) {
        console.warn('Failed to assign syncMapObjectsRef.current', e);
      }
    }
  }, [syncMapObjects, syncMapObjectsRef]);

  useEffect(() => {
    if (editor) {
      try {
        if (typeof updateLayersList === 'function') updateLayersList();
      } catch (e) {
        console.warn('updateLayersList invocation failed', e);
      }
    }
  }, [editor, updateLayersList]);

  useEffect(() => {
    try {
      if (typeof syncMapObjects === 'function') syncMapObjects();
    } catch (e) {
      console.warn('syncMapObjects invocation failed', e);
    }
  }, [syncMapObjects]);

  useEffect(() => {
    const handleClickOutside = (_event: MouseEvent) => {
      if (showAddLayerDropdown) {
        setShowAddLayerDropdown(false);
      }
    };

    if (showAddLayerDropdown) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showAddLayerDropdown, setShowAddLayerDropdown]);

  useEffect(() => {
    if (handleUndo && handleUndoRef) {
      try { handleUndoRef.current = handleUndo; } catch (e) { console.warn('Failed to assign handleUndoRef.current', e); }
    }
  }, [handleUndo, handleUndoRef]);

  useEffect(() => {
    if (handleRedo && handleRedoRef) {
      try { handleRedoRef.current = handleRedo; } catch (e) { console.warn('Failed to assign handleRedoRef.current', e); }
    }
  }, [handleRedo, handleRedoRef]);

  useEffect(() => {
    if (handleOpenMap && handleOpenMapRef) {
      try { handleOpenMapRef.current = handleOpenMap; } catch (e) { console.warn('Failed to assign handleOpenMapRef.current', e); }
    }
  }, [handleOpenMap, handleOpenMapRef]);

  useEffect(() => {
    if (switchToTabHelpersRef) {
      try {
        switchToTabHelpersRef.current = {
          handleOpenMap: handleOpenMap,
          loadProjectData: loadProjectData,
          setupAutoSave: setupAutoSaveWrapper,
          syncMapObjects: syncMapObjects,
          updateLayersList: updateLayersList,
        };
      } catch (e) {
        console.warn('Failed to assign switchToTabHelpersRef.current', e);
      }
    }
  }, [handleOpenMap, loadProjectData, setupAutoSaveWrapper, syncMapObjects, updateLayersList, switchToTabHelpersRef]);
}
