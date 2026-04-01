import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { validateAndSanitizeObject } from '../editor/objectValidation';
import { serializeNpcToFlare } from '../utils/flareNpcUtils';
import type { MapObject, FlareNPC } from '../types';

type Params = {
  editingObject: MapObject | null;
  setEditingObject: Dispatch<SetStateAction<MapObject | null>>;
  setObjectValidationErrors: Dispatch<SetStateAction<string[]>>;
  currentProjectPath: string | null;
  handleUpdateObject: (o: MapObject) => void;
};

export default function useObjectDialogHandlers({ editingObject, setEditingObject, setObjectValidationErrors, currentProjectPath, handleUpdateObject }: Params) {
  const handleObjectDialogSave = useCallback(async () => {
    if (!editingObject) return;

    const { errors, sanitized } = validateAndSanitizeObject(editingObject);
    if (errors.length > 0) {
      setObjectValidationErrors(errors);
      return;
    }

    setObjectValidationErrors([]);

    if (editingObject.type === 'npc' && window.electronAPI?.writeNpcFile && currentProjectPath) {
      const existingFilename = sanitized.npcFilename || editingObject.properties?.npcFilename;
      if (existingFilename) {
        try {
          const parsedDirection = sanitized.direction ? Math.max(0, Math.min(7, parseInt(sanitized.direction, 10))) as FlareNPC['direction'] : undefined;
          const parsedWander = sanitized.wander_radius ? parseInt(sanitized.wander_radius, 10) : undefined;

          const npcFull: FlareNPC = {
            id: editingObject.id,
            x: editingObject.x,
            y: editingObject.y,
            filename: existingFilename,
            name: sanitized.name || '',
            talker: sanitized.talker === 'true',
            vendor: sanitized.vendor === 'true',
            gfx: sanitized.tilesetPath || undefined,
            portrait: sanitized.portraitPath || undefined,
            direction: parsedDirection,
            waypoints: sanitized.waypoints || undefined,
            wander_radius: parsedWander,
            constant_stock: sanitized.constant_stock || undefined,
            random_stock: sanitized.random_stock || undefined,
            random_stock_count: sanitized.random_stock_count ? parseInt(sanitized.random_stock_count, 10) : undefined,
            vendor_requires_status: sanitized.vendor_requires_status || undefined,
            vendor_requires_not_status: sanitized.vendor_requires_not_status || undefined,
            customProperties: {}
          };

          for (const [key, value] of Object.entries(sanitized)) {
            if (!['npcFilename', 'name', 'talker', 'vendor', 'tilesetPath', 'portraitPath', 'direction', 'waypoints', 'wander_radius', 'constant_stock', 'random_stock', 'random_stock_count', 'vendor_requires_status', 'vendor_requires_not_status'].includes(key)) {
              npcFull.customProperties![key] = String(value || '');
            }
          }

          const { npcFileContent } = serializeNpcToFlare(npcFull);
          const npcFilenameClean = existingFilename.replace(/^npcs\//, '');
          await window.electronAPI.writeNpcFile(currentProjectPath, npcFilenameClean, npcFileContent);
        } catch (error) {
          console.error('Failed to save NPC file:', error);
        }
      } else {
        console.warn('NPC has no filename, skipping file save');
      }
    }

    if (editingObject) handleUpdateObject({ ...editingObject, properties: sanitized });
  }, [editingObject, setObjectValidationErrors, currentProjectPath, handleUpdateObject]);

  const updateEditingObjectProperty = useCallback((key: string, value: string | null) => {
    setEditingObject((prev) => {
      if (!prev) return prev;
      const properties = { ...(prev.properties || {}) } as Record<string, string>;
      if (value === null) {
        delete properties[key];
      } else {
        properties[key] = value;
      }
      return { ...prev, properties };
    });
  }, [setEditingObject]);

  const updateEditingObjectBoolean = useCallback((key: string, checked: boolean) => {
    setEditingObject((prev) => {
      if (!prev) return prev;
      const properties = { ...(prev.properties || {}) } as Record<string, string>;
      properties[key] = checked ? 'true' : 'false';
      return { ...prev, properties };
    });
  }, [setEditingObject]);

  const getEditingObjectProperty = useCallback((key: string, fallback = '') => {
    if (!editingObject || !editingObject.properties) return fallback;
    return (editingObject.properties[key] as string) ?? fallback;
  }, [editingObject]);

  return { handleObjectDialogSave, updateEditingObjectProperty, updateEditingObjectBoolean, getEditingObjectProperty };
}
