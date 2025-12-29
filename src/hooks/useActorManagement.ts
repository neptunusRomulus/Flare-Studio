import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ActorDialogState as CanonActorDialogState } from '@/editor/actorRoles';
import type { TileMapEditor } from '../editor/TileMapEditor';
import type { MapObject } from '../types';

type Params = {
  editor: TileMapEditor | null;
  actorDialogState: CanonActorDialogState | null;
  setActorDialogState: Dispatch<SetStateAction<CanonActorDialogState | null>>;
  setActorDialogError: (e: string | null) => void;
  currentProjectPath: string | null;
  handleCloseActorDialog: () => void;
  handleEditObject: (id: number) => void;
  syncMapObjects: () => void;
};

export default function useActorManagement({
  editor,
  actorDialogState,
  setActorDialogState,
  setActorDialogError,
  currentProjectPath,
  handleCloseActorDialog,
  handleEditObject,
  syncMapObjects
}: Params) {
  const handleActorFieldChange = useCallback((field: 'name' | 'tilesetPath' | 'portraitPath', value: string) => {
    setActorDialogState((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value } as CanonActorDialogState;
    });
    setActorDialogError(null);
  }, [setActorDialogError, setActorDialogState]);

  type RoleKey = 'isTalker' | 'isVendor' | 'isQuestGiver' | 'isMelee' | 'isRanged' | 'isCaster' | 'isSummoner' | 'isBoss' | 'isPassive' | 'isStationary';

  const handleActorRoleToggle = useCallback((role: RoleKey) => {
    setActorDialogState((prev) => {
      if (!prev) return prev;
      const curr = (prev as CanonActorDialogState)[role];
      return { ...prev, [role]: !curr } as CanonActorDialogState;
    });
  }, [setActorDialogState]);

  const handleActorTilesetBrowse = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electronAPI?.selectTilesetFile) {
      return;
    }

    try {
      const selected = await window.electronAPI.selectTilesetFile();
      if (selected) {
        handleActorFieldChange('tilesetPath', selected);
      }
    } catch (error) {
      console.error('Failed to select tileset file for actor:', error);
    }
  }, [handleActorFieldChange]);

  const handleActorPortraitBrowse = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electronAPI?.selectTilesetFile) {
      return;
    }

    try {
      const selected = await window.electronAPI.selectTilesetFile();
      if (selected) {
        if (window.electronAPI.readFileAsDataURL) {
          const dataUrl = await window.electronAPI.readFileAsDataURL(selected);
          if (dataUrl) {
            handleActorFieldChange('portraitPath', dataUrl);
          } else {
            handleActorFieldChange('portraitPath', selected);
          }
        } else {
          handleActorFieldChange('portraitPath', selected);
        }
      }
    } catch (error) {
      console.error('Failed to select portrait file for actor:', error);
    }
  }, [handleActorFieldChange]);

  const handleActorSubmit = useCallback(async (editAfter = false) => {
    if (!editor || !actorDialogState) {
      return;
    }

    if (!actorDialogState.name.trim()) {
      setActorDialogError('Name is required.');
      return;
    }

    const name = actorDialogState.name.trim();
    const tilesetPath = actorDialogState.tilesetPath.trim();
    const portraitPath = actorDialogState.portraitPath.trim();
    const {
      isTalker,
      isVendor,
      isQuestGiver,
      isMelee,
      isRanged,
      isCaster,
      isSummoner,
      isBoss,
      isPassive,
      isStationary
    } = actorDialogState;

    let npcFilename: string | undefined;
    if (actorDialogState.type === 'npc' && currentProjectPath && window.electronAPI?.createNpcFile) {
      const role = isVendor ? 'vendor' : isQuestGiver ? 'quest' : isTalker ? 'talker' : 'static';
      try {
        const result = await window.electronAPI.createNpcFile(currentProjectPath, {
          name,
          role,
          tilesetPath: tilesetPath || undefined,
          portraitPath: portraitPath || undefined,
        });
        if (result.success && result.filename) {
          npcFilename = result.filename;
          console.log('NPC file created:', result.filePath);
        } else if (result.error) {
          console.error('Failed to create NPC file:', result.error);
        }
      } catch (err) {
        console.error('Error creating NPC file:', err);
      }
    }

    const roleProperties: Record<string, string> = {};
    if (actorDialogState.type === 'npc') {
      if (isTalker) roleProperties.talker = 'true';
      if (isVendor) roleProperties.vendor = 'true';
      if (isQuestGiver) roleProperties.questGiver = 'true';
    } else {
      if (isMelee) roleProperties.melee = 'true';
      if (isRanged) roleProperties.ranged = 'true';
      if (isCaster) roleProperties.caster = 'true';
      if (isSummoner) roleProperties.summoner = 'true';
      if (isBoss) roleProperties.boss = 'true';
      if (isPassive) roleProperties.passive = 'true';
      if (isStationary) roleProperties.stationary = 'true';
    }

    const unplacedX = -1;
    const unplacedY = -1;

    const newObject: MapObject = editor.addMapObject('enemy', unplacedX, unplacedY, 1, 1);
    editor.updateMapObject(newObject.id, {
      name,
      x: unplacedX,
      y: unplacedY,
      type: actorDialogState.type,
      category: actorDialogState.type === 'npc' ? 'npc' : '',
      wander_radius: 0,
      properties: {
        ...(newObject.properties || {}),
        ...roleProperties,
        ...(tilesetPath ? { tilesetPath } : {}),
        ...(portraitPath ? { portraitPath } : {}),
        ...(npcFilename ? { npcFilename: `npcs/${npcFilename}` } : {}),
      }
    });

    syncMapObjects();
    const newObjectId = newObject.id;
    handleCloseActorDialog();

    if (editAfter) handleEditObject(newObjectId);

    try {
      editor.triggerAutoSave(true);
    } catch (e) {
      console.warn('Auto-save failed after actor creation:', e);
    }
  }, [actorDialogState, currentProjectPath, handleCloseActorDialog, handleEditObject, setActorDialogError, syncMapObjects, editor]);

  return {
    handleActorFieldChange,
    handleActorRoleToggle,
    handleActorTilesetBrowse,
    handleActorPortraitBrowse,
    handleActorSubmit
  };
}
