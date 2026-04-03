import { useCallback } from 'react';

export default function useEditingBrowseHandlers(args: { updateEditingObjectProperty: (k: string, v: string | null) => void; }) {
  const { updateEditingObjectProperty } = args;

  const handleEditingTilesetBrowse = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electronAPI?.selectTilesetFile) {
      return;
    }

    try {
      const selected = await window.electronAPI.selectTilesetFile();
      if (selected) {
        // Store the original absolute path so we can copy the image on save
        updateEditingObjectProperty('tilesetSourcePath', selected);
        updateEditingObjectProperty('tilesetPath', selected);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to select tileset for editing object:', error);
    }
  }, [updateEditingObjectProperty]);

  const handleEditingPortraitBrowse = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electronAPI?.selectTilesetFile) {
      return;
    }

    try {
      const selected = await window.electronAPI.selectTilesetFile();
      if (selected) {
        // Store the original absolute path so we can copy the file on save
        updateEditingObjectProperty('portraitSourcePath', selected);
        if (window.electronAPI.readFileAsDataURL) {
          const dataUrl = await window.electronAPI.readFileAsDataURL(selected);
          if (dataUrl) {
            updateEditingObjectProperty('portraitPath', dataUrl);
          } else {
            updateEditingObjectProperty('portraitPath', selected);
          }
        } else {
          updateEditingObjectProperty('portraitPath', selected);
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to select portrait for editing object:', error);
    }
  }, [updateEditingObjectProperty]);

  return { handleEditingTilesetBrowse, handleEditingPortraitBrowse };
}
