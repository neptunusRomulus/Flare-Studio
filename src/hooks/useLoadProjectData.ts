import { useCallback } from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import type { EditorProjectData } from '@/editor/TileMapEditor';

export default function useLoadProjectData() {
  const loadProjectData = useCallback(async (newEditor: TileMapEditor, mapConfig: EditorProjectData) => {
    try {
      if (mapConfig.name) {
        newEditor.projectName = mapConfig.name;
      }
      newEditor.loadProjectData(mapConfig);
      return true;
    } catch (error) {
      console.error('Error loading project data:', error);
      return false;
    }
  }, []);

  return { loadProjectData };
}
