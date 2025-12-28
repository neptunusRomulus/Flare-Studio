import { useCallback } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { EditorProjectData } from '@/editor/TileMapEditor';

export default function useLoadProjectData() {
  const loadProjectData = useCallback(async (newEditor: TileMapEditor, mapConfig: EditorProjectData) => {
    try {
      if (mapConfig.name) {
        newEditor.projectName = mapConfig.name;
      }

      console.log('=== LOAD PROJECT DATA DEBUG ===');
      console.log('Map config received:', {
        name: mapConfig.name,
        tilesets: mapConfig.tilesets ? mapConfig.tilesets.length : 0,
        tilesetImages: mapConfig.tilesetImages ? Object.keys(mapConfig.tilesetImages).length : 0,
        layers: mapConfig.layers ? mapConfig.layers.length : 0
      });

      console.log('=== CALLING EDITOR loadProjectData ===');
      newEditor.loadProjectData(mapConfig);

      console.log('Project data loading completed');
      return true;
    } catch (error) {
      console.error('Error loading project data:', error);
      return false;
    }
  }, []);

  return { loadProjectData };
}
