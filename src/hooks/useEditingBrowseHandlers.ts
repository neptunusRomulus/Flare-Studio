import { useCallback } from 'react';

/**
 * Load an image from an absolute file path via Electron and return its pixel dimensions.
 */
const loadImageDimensions = (filePath: string): Promise<{ width: number; height: number } | null> => {
  const api = (window as any)?.electronAPI;
  if (!api || typeof api.readFileAsDataURL !== 'function') return Promise.resolve(null);
  return api.readFileAsDataURL(filePath).then((dataUrl: string | null) => {
    if (!dataUrl) return null;
    return new Promise<{ width: number; height: number } | null>((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }).catch(() => null);
};

/**
 * Compute default animation properties from sprite sheet dimensions.
 * Only populates keys that are not already present in `existing`.
 */
export function computeAnimDefaults(
  imgW: number,
  imgH: number,
  existing: Record<string, string>
): Record<string, string> {
  const frameW = imgH > 0 && imgW > imgH && imgW % imgH === 0 ? imgH : imgW;
  const frameH = imgH;
  const frameCount = Math.max(1, Math.floor(imgW / frameW));
  const offsetX = Math.floor(frameW / 2);
  const offsetY = frameH - 2;

  const defaults: Record<string, string> = {
    anim_image_width: String(imgW),
    anim_image_height: String(imgH),
    anim_render_width: String(frameW),
    anim_render_height: String(frameH),
    anim_render_offset_x: String(offsetX),
    anim_render_offset_y: String(offsetY),
    anim_frames: String(frameCount),
    anim_duration: frameCount > 1 ? '1200ms' : '1s',
    anim_type: 'looped',
    anim_blend_mode: 'normal',
    anim_alpha_mod: '255',
    anim_color_mod: '255,255,255',
  };

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(defaults)) {
    // Always overwrite image dimensions (they reflect the actual file)
    if (key === 'anim_image_width' || key === 'anim_image_height') {
      result[key] = value;
    } else if (!existing[key]) {
      result[key] = value;
    }
  }
  return result;
}

export default function useEditingBrowseHandlers(args: {
  updateEditingObjectProperty: (k: string, v: string | null) => void;
  getEditingObjectProperty?: (k: string, fallback?: string) => string;
}) {
  const { updateEditingObjectProperty, getEditingObjectProperty } = args;

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

        // Auto-detect sprite dimensions and populate animation defaults
        const dims = await loadImageDimensions(selected);
        if (dims) {
          const existing: Record<string, string> = {};
          if (getEditingObjectProperty) {
            for (const key of [
              'anim_render_width', 'anim_render_height',
              'anim_render_offset_x', 'anim_render_offset_y',
              'anim_frames', 'anim_duration', 'anim_type',
              'anim_blend_mode', 'anim_alpha_mod', 'anim_color_mod',
            ]) {
              const v = getEditingObjectProperty(key, '');
              if (v) existing[key] = v;
            }
          }
          const defaults = computeAnimDefaults(dims.width, dims.height, existing);
          for (const [key, value] of Object.entries(defaults)) {
            updateEditingObjectProperty(key, value);
          }
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to select tileset for editing object:', error);
    }
  }, [updateEditingObjectProperty, getEditingObjectProperty]);

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
