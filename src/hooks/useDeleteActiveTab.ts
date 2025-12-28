import { useCallback } from 'react';
import type { TileLayer } from '@/types';

export default function useDeleteActiveTab(args: {
  editor?: any;
  activeLayer?: TileLayer | null;
  toast: (...args: any[]) => any;
  confirmPayloadRef: { current: any };
  setTabToDelete: (p: any) => void;
  setConfirmAction: (a: any) => void;
}) {
  const { editor, activeLayer, toast, confirmPayloadRef, setTabToDelete, setConfirmAction } = args;

  const handleDeleteActiveTab = useCallback(() => {
    if (!editor) {
      toast({ title: 'No editor', description: 'Editor is not initialized yet.', variant: 'destructive' });
      return;
    }
    const layerType = activeLayer?.type;
    if (!layerType) {
      toast({ title: 'No active layer', description: 'Please select a layer first.', variant: 'destructive' });
      return;
    }
    const activeTabId = editor.getActiveLayerTabId ? editor.getActiveLayerTabId(layerType) : null;
    if (typeof activeTabId !== 'number' || activeTabId === null) {
      toast({ title: 'No tab selected', description: 'There is no active tileset tab to delete for this layer.', variant: 'destructive' });
      return;
    }
    const payload = { layerType, tabId: activeTabId };
    confirmPayloadRef.current = payload;
    setTabToDelete(payload);
    setConfirmAction({ type: 'removeTab', payload });
  }, [editor, activeLayer?.type, toast, confirmPayloadRef, setTabToDelete, setConfirmAction]);

  return { handleDeleteActiveTab };
}
