import { useCallback } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { MapObject } from '@/types';
import type { EditorTab } from '@/hooks/useEditorTabs';
import type { EditorProjectData } from '@/editor/TileMapEditor';
import type { MapConfig } from '@/editor/mapConfig';

type TabsType = EditorTab[];

type UseObjectManagementParams = {
  editor: TileMapEditor | null;
  createTabFor: ((name: string, projectPath?: string | null, config?: EditorProjectData | MapConfig | { enemy: MapObject } | null) => EditorTab | void) | null;
  currentProjectPath: string | null;
  setActiveTabId: (id: string | null) => void;
  setTabs: (fn: (prev: TabsType) => TabsType) => void;
  tabs: TabsType;
  setEditingObject: (o: MapObject | null) => void;
  setShowObjectDialog: (v: boolean) => void;
  setObjectValidationErrors: (errs: string[]) => void;
  syncMapObjects?: () => void;
  setMapObjects?: (objs: MapObject[]) => void;
  switchToTab?: (id: string) => Promise<void>;
};

export default function useObjectManagement({
  editor,
  createTabFor,
  currentProjectPath,
  setActiveTabId,
  setTabs,
  tabs,
  setEditingObject,
  setShowObjectDialog,
  setObjectValidationErrors,
  syncMapObjects,
  setMapObjects,
  switchToTab
}: UseObjectManagementParams) {
  const handleEditObject = useCallback((objectId: number) => {
    if (!editor) return;

    setObjectValidationErrors([]);
    const obj = editor.getMapObjects().find((o: MapObject) => o.id === objectId);
    if (obj) {
      if (obj.type === 'enemy') {
        const existingTab = tabs.find(
          (tab) => tab.tabType === 'enemy' && (tab.config as { enemy?: MapObject } | null)?.enemy?.id === obj.id
        );
        if (existingTab) {
          void switchToTab?.(existingTab.id);
          return;
        }

        const tabName = obj.name || 'Enemy';
        if (createTabFor) {
          const tab = createTabFor(tabName, currentProjectPath, { enemy: obj });
          if (tab) {
            setActiveTabId(tab.id);
            setTabs(prev => prev.map((t: EditorTab) => t.id === tab.id ? { ...t, tabType: 'enemy' } : t));
          } else {
            const found = tabs.find(
              (t) => t.tabType === 'enemy' && (t.config as { enemy?: MapObject } | null)?.enemy?.id === obj.id
            );
            if (found) {
              setActiveTabId(found.id);
              setTabs(prev => prev.map((t: EditorTab) => t.id === found.id ? { ...t, tabType: 'enemy' } : t));
            }
          }
        }
      } else {
        setEditingObject(obj);
        setShowObjectDialog(true);
      }
    }
  }, [editor, tabs, createTabFor, currentProjectPath, setActiveTabId, setTabs, setEditingObject, setShowObjectDialog, setObjectValidationErrors, switchToTab]);

  const handleUpdateObject = useCallback((updatedObject: MapObject) => {
    if (!editor) return;

    editor.updateMapObject(updatedObject.id, updatedObject);
    setEditingObject(null);
    setShowObjectDialog(false);
    syncMapObjects?.();
    setObjectValidationErrors([]);
    try {
      editor.triggerAutoSave(true);
    } catch {
      // ignore
    }
  }, [editor, setEditingObject, setShowObjectDialog, setObjectValidationErrors, syncMapObjects]);

  const syncMapObjectsLocal = useCallback(() => {
    if (editor) {
      setMapObjects?.(editor.getMapObjects());
    } else {
      setMapObjects?.([]);
    }
  }, [editor, setMapObjects]);

  return {
    handleEditObject,
    handleUpdateObject,
    syncMapObjects: syncMapObjectsLocal
  };
}
