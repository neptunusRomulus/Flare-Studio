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
      setMapObjects(editor.getMapObjects());
    } else {
      setMapObjects([]);
    }
  }, [editor, setMapObjects]);

  const updateLayersList = useCallback(() => {
    if (editor) {
      const currentLayers = editor.getLayers();
      setLayers([...currentLayers]);
      const activeId = editor.getActiveLayerId();
      console.log('updateLayersList: editorActive=', activeId);
      setActiveLayerId(activeId);
      // caller may choose to call syncMapObjects separately
    }
  }, [editor, setLayers, setActiveLayerId]);

  return { syncMapObjects, updateLayersList };
}
