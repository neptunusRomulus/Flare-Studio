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
  const handleActorFieldChange = useCallback((field: 'name' | 'tilesetPath' | 'portraitPath' | 'locationX' | 'locationY', value: string) => {
    setActorDialogState((prev) => {
      if (!prev) return prev;
      if (field === 'locationX' || field === 'locationY') {
        return { ...prev, [field]: parseInt(value, 10) || 0 } as CanonActorDialogState;
      }
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

    // Use location from dialog state
    const actorX = actorDialogState.locationX ?? 0;
    const actorY = actorDialogState.locationY ?? 0;

    // For NPCs, auto-place at next free diagonal cell if coordinates are 0,0
    let spawnX = actorX;
    let spawnY = actorY;
    if (actorDialogState.type === 'npc') {
      const existingObjects = editor.getMapObjects();
      let candidate = 0;
      while (existingObjects.some(o => o.type === 'npc' && o.x === candidate && o.y === candidate)) {
        candidate++;
      }
      spawnX = candidate;
      spawnY = candidate;
    }

    const newObject: MapObject = editor.addMapObject('enemy', spawnX, spawnY, 1, 1);
    editor.updateMapObject(newObject.id, {
      name,
      x: spawnX,
      y: spawnY,
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
    handleActorSubmit
  };
}
