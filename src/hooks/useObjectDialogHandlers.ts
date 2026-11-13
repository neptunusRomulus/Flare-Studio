import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { validateAndSanitizeObject } from '../editor/objectValidation';
import { npcFileUpdate, npcFileContent as mergedNpcFileContent, npcFileBase, isStudioNpcAnimation } from '../utils/npcFileUpdate';
import {
  buildAnimationFileContent,
  buildSafeNpcAnimationFilename,
  getAnimationProps,
  isAnimationDefinitionFilePath,
  isImageFilePath,
} from '../utils/animationUtils';
import type { MapObject } from '../types';
import { propertyText } from '../editor/propertyText';
import { canonicalIdentity } from '../editor/identityRename';
import { renameIfNameChanged, uniqueSlugFromName } from '../editor/identityFromName';
import { loadProjectTextMap } from '../editor/projectFiles';

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

    let savedProperties = sanitized;
    if (editingObject.type === 'npc' && window.electronAPI?.writeNpcFile && currentProjectPath) {
      const existingFilename = sanitized.npcFilename || propertyText(editingObject.properties?.npcFilename);
      const npcName = sanitized.name || editingObject.name || '';
      let filename = existingFilename;
      try {
        if (existingFilename && npcName.trim()) {
          const renamed = await renameIfNameChanged(currentProjectPath, 'npc', existingFilename, npcName);
          if (renamed.ok && renamed.changed) {
            filename = canonicalIdentity('npc', renamed.nextId);
          }
        } else if (!existingFilename && npcName.trim()) {
          const files = await loadProjectTextMap(currentProjectPath);
          filename = canonicalIdentity('npc', uniqueSlugFromName(files, 'npc', npcName));
        }
        if (filename) {
          const animProps = getAnimationProps(sanitized);
          let gfxPath = sanitized.tilesetPath || undefined;
          let animationDefinitionPath: string | undefined;
          const rawTilesetPath = sanitized.tilesetPath || sanitized.tilesetSourcePath || '';
          const resolvedTilesetPath = rawTilesetPath.replace(/\\/g, '/');

          if (
            resolvedTilesetPath &&
            !isAnimationDefinitionFilePath(resolvedTilesetPath) &&
            isImageFilePath(resolvedTilesetPath) &&
            Object.keys(animProps).length > 0 &&
            window.electronAPI?.createFolderIfNotExists &&
            window.electronAPI?.writeFile
          ) {
            const animationFolder = `${currentProjectPath.replace(/\\/g, '/')}/animations/npcs`;
            await window.electronAPI.createFolderIfNotExists(animationFolder);
            const safeBaseName = buildSafeNpcAnimationFilename(sanitized.name || String(existingFilename || filename || '').replace(/^npcs\//, '') || `npc_${editingObject.id}`);
            let animationFileName = `${safeBaseName}.txt`;
            // Never overwrite a hand-made (multi-animation) file: use Studio's own name instead
            try {
              const api = window.electronAPI as unknown as { readFile?: (p: string) => Promise<string | null> };
              const current = api?.readFile ? await api.readFile(`${animationFolder}/${animationFileName}`) : null;
              const imageName = resolvedTilesetPath.split('/').pop() || '';
              const firstLine = current?.replace(/\r/g, '').split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#'));
              if (current && firstLine !== `image=${resolvedTilesetPath}` && !isStudioNpcAnimation(current, imageName)) animationFileName = animationFileName.replace(/\.txt$/, '_studio.txt');
            } catch { /* no existing file */ }
            const animationFilePath = `${animationFolder}/${animationFileName}`;
            const animationFileContent = buildAnimationFileContent(resolvedTilesetPath, animProps);
            const animationSaved = await window.electronAPI.writeFile(animationFilePath, animationFileContent);
            if (animationSaved) {
              animationDefinitionPath = `animations/npcs/${animationFileName}`;
              gfxPath = animationDefinitionPath;
            } else {
              console.warn('Failed to write NPC animation definition file:', animationFilePath);
            }
          }

          // Merge into the existing NPC file (keys/sections/dialog order Studio doesn't model survive)
          const npcFilenameClean = npcFileBase(filename);
          let existingNpcText: string | null = null;
          try {
            const api = window.electronAPI as unknown as { readFile?: (p: string) => Promise<string | null> };
            if (api?.readFile) existingNpcText = await api.readFile(`${currentProjectPath.replace(/\\/g, '/')}/npcs/${npcFilenameClean}`);
          } catch { /* new file */ }
          const relative = (p?: string) => (p && !p.startsWith('data:') && !/^[a-zA-Z]:|^\//.test(p) ? p.replace(/\\/g, '/') : undefined);
          const npcUpdate = npcFileUpdate(sanitized.name || '', editingObject.properties as Record<string, unknown> | undefined, {
            animations: relative(gfxPath),
            portrait: relative(sanitized.portraitPath),
          });
          const npcFileContent = mergedNpcFileContent(existingNpcText, npcUpdate);
          await window.electronAPI.writeNpcFile(currentProjectPath, npcFilenameClean, npcFileContent);
          if (filename !== existingFilename) {
            savedProperties = { ...sanitized, npcFilename: filename };
          }
        }
      } catch (error) {
        console.error('Failed to save NPC file:', error);
      }
    }

    if (editingObject) handleUpdateObject({ ...editingObject, properties: savedProperties });
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
