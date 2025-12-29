import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { MapObject } from '@/types';
import type { EditorTab } from './useEditorTabs';

export default function useEnemyTabHandlers(args: {
  closeEditorTab: (id: string) => void;
  setPendingEnemyTabCloseId: (id: string | null) => void;
  handleUpdateObject: (obj: MapObject) => void;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
  activeTabId?: string | null;
}) {
  const { closeEditorTab, setPendingEnemyTabCloseId, handleUpdateObject, setTabs, activeTabId } = args;

  const handleEnemyTabCloseDecision = useCallback((decision: string) => {
    if (decision === 'cancel') {
      setPendingEnemyTabCloseId(null);
      return;
    }
    setPendingEnemyTabCloseId(null);
    closeEditorTab(activeTabId ?? '');
  }, [setPendingEnemyTabCloseId, closeEditorTab, activeTabId]);

  const handleEnemyTabSave = useCallback((updated: MapObject) => {
    handleUpdateObject(updated);
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, config: { ...t.config, enemy: updated } } : t));
  }, [handleUpdateObject, setTabs, activeTabId]);

  return { handleEnemyTabCloseDecision, handleEnemyTabSave };
}
