import { useCallback } from 'react';
import type React from 'react';
import type { TileLayer } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { RawItem, ItemSummary } from '@/utils/items';

type UseLayerHandlersOptions = {
  editor: TileMapEditor | null;
  layers: TileLayer[];
  setLayers: (v: TileLayer[]) => void;
  setActiveLayerId: (id: number | null) => void;
  setItemsList: React.Dispatch<React.SetStateAction<ItemSummary[]>>;
  normalizeItemsForState: (items: RawItem[]) => ItemSummary[];
  currentProjectPath: string | null;
  updateLayersList: () => void;
};

export default function useLayerHandlers({ editor, layers, setLayers, setActiveLayerId, setItemsList, normalizeItemsForState, currentProjectPath, updateLayersList }: UseLayerHandlersOptions) {
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>, type: 'tileset' | 'layerTileset') => {
    const file = event.target.files?.[0];
    if (file && editor?.handleFileUpload) {
      editor.handleFileUpload(file, type);
    }
  }, [editor]);

  const handleSetActiveLayer = useCallback(async (layerId: number) => {
    // Always update the active layer id in app state so the UI reflects
    // the user's click even if the editor instance isn't available yet.
    console.log('handleSetActiveLayer: requested', layerId);
    setActiveLayerId(layerId);

    if (editor) {
      try {
        editor.setActiveLayer(layerId);
      } catch (err) {
        console.warn('editor.setActiveLayer failed', err);
      }

      // Ensure the layers/list state is refreshed from the editor after changing active layer
      try {
        updateLayersList();
        if (editor && typeof editor.getActiveLayerId === 'function') console.log('handleSetActiveLayer: after updateLayersList, editorActive=', editor.getActiveLayerId());
      } catch (err) {
        console.warn('updateLayersList failed after setActiveLayer', err);
      }

      const layer = layers.find(l => l.id === layerId);
      if (layer?.type === 'items' && currentProjectPath && window.electronAPI?.ensureItemsFolders) {
        try {
          await window.electronAPI.ensureItemsFolders(currentProjectPath);
          if (window.electronAPI.listItems) {
            const itemsResult = await window.electronAPI.listItems(currentProjectPath);
            if (itemsResult.success && itemsResult.items) {
              setItemsList(normalizeItemsForState(itemsResult.items));
            }
          }
        } catch (err) {
          console.error('Error ensuring items folders:', err);
        }
      }
    }
  }, [editor, layers, setActiveLayerId, setItemsList, normalizeItemsForState, currentProjectPath, updateLayersList]);

  const handleToggleLayerVisibility = useCallback((layerId: number) => {
    if (editor) {
      editor.toggleLayerVisibility(layerId);
      const currentLayers = editor.getLayers();
      setLayers([...currentLayers]);
    }
  }, [editor, setLayers]);

  const handleLayerTransparencyChange = useCallback((layerId: number, delta: number) => {
    if (editor) {
      const layer = layers.find(l => l.id === layerId);
      if (layer) {
        const currentTransparency = layer.transparency || 0;
        const newTransparency = Math.max(0, Math.min(1, currentTransparency + delta));
        editor.setLayerTransparency(layerId, newTransparency);
        updateLayersList();
      }
    }
  }, [editor, layers, updateLayersList]);

  return {
    handleFileUpload,
    handleSetActiveLayer,
    handleToggleLayerVisibility,
    handleLayerTransparencyChange
  };
}
