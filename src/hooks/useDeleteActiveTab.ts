import { useCallback } from 'react';
import type { TileLayer } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { MutableRefObject } from 'react';

type ConfirmPayload = { layerType: string; tabId: number };
type ConfirmAction = { type: 'removeBrush' | 'removeTileset' | 'removeTab'; payload?: number | ConfirmPayload } | null;

export default function useDeleteActiveTab(args: {
  editor?: TileMapEditor | null;
  activeLayer?: TileLayer | null;
  toast: typeof import('@/hooks/use-toast').toast;
  confirmPayloadRef: MutableRefObject<ConfirmPayload | null>;
  setTabToDelete: React.Dispatch<React.SetStateAction<ConfirmPayload | null>>;
  setConfirmAction: React.Dispatch<React.SetStateAction<ConfirmAction>>;
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
    
    // Check if there's only one tab - prevent deletion
    const tabs = editor.getLayerTabs ? editor.getLayerTabs(layerType) : [];
    if (tabs && tabs.length <= 1) {
      toast({ title: 'Cannot delete tab', description: 'You must have at least one tileset tab.', variant: 'destructive' });
      return;
    }
    
    const payload = { layerType, tabId: activeTabId };
    confirmPayloadRef.current = payload;
    setTabToDelete(payload);
    setConfirmAction({ type: 'removeTab', payload });
  }, [editor, activeLayer?.type, toast, confirmPayloadRef, setTabToDelete, setConfirmAction]);

  return { handleDeleteActiveTab };
}
