import React, { useCallback } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { TileLayer, MapObject } from '@/types';

export default function useMapHandlers(args: {
  editor?: TileMapEditor | null;
  setMapObjects: React.Dispatch<React.SetStateAction<MapObject[]>>;
  setLayers: React.Dispatch<React.SetStateAction<TileLayer[]>>;
  setActiveLayerId: React.Dispatch<React.SetStateAction<number | null>>;
}) {
  const { editor, setMapObjects, setLayers, setActiveLayerId } = args;

  const syncMapObjects = useCallback(() => {
    if (editor) {
      const objects = editor.getMapObjects();
      console.log('[DEBUG-SyncMapObjects] Got objects from editor:', objects?.length || 0);
      setMapObjects(objects);
    } else {
      console.log('[DEBUG-SyncMapObjects] No editor available, clearing map objects');
      setMapObjects([]);
    }
  }, [editor, setMapObjects]);

  const updateLayersList = useCallback(() => {
    if (editor) {
      const currentLayers = editor.getLayers();
      setLayers([...currentLayers]);
      const activeId = editor.getActiveLayerId();
      setActiveLayerId(activeId);
      // caller may choose to call syncMapObjects separately
    }
  }, [editor, setLayers, setActiveLayerId]);

  return { syncMapObjects, updateLayersList };
}
