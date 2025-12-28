import { useState } from 'react';
import useEnemyTabHandlers from './useEnemyTabHandlers';
import type { MapObject } from '@/types';

export default function useEnemyEditing(args: {
  closeEditorTab: (id: string) => void;
  handleUpdateObject: (obj: MapObject) => void;
  setTabs: (updater: (prev: any[]) => any[]) => void;
  activeTabId?: string | null;
}) {
  const { closeEditorTab, handleUpdateObject, setTabs, activeTabId } = args;
  const [pendingEnemyTabCloseId, setPendingEnemyTabCloseId] = useState<string | null>(null);

  const { handleEnemyTabCloseDecision, handleEnemyTabSave } = useEnemyTabHandlers({
    closeEditorTab,
    setPendingEnemyTabCloseId,
    handleUpdateObject,
    setTabs,
    activeTabId
  });

  return {
    pendingEnemyTabCloseId,
    setPendingEnemyTabCloseId,
    handleEnemyTabCloseDecision,
    handleEnemyTabSave
  };
}
