import { useCallback, useState } from 'react';
import type { DialogueTree, MapObject } from '@/types';
import { EMPTY_ACTOR_ROLES } from '@/editor/actorRoles';
import type { ActorDialogState } from '@/editor/actorRoles';

const useObjectEditing = () => {
  const [showObjectDialog, setShowObjectDialog] = useState(false);
  const [editingObject, setEditingObject] = useState<MapObject | null>(null);
  const [objectValidationErrors, setObjectValidationErrors] = useState<string[]>([]);
  const [mapObjects, setMapObjects] = useState<MapObject[]>([]);
  const [showDeleteNpcConfirm, setShowDeleteNpcConfirm] = useState(false);
  const [showDeleteEnemyConfirm, setShowDeleteEnemyConfirm] = useState(false);
  const [actorDialogState, setActorDialogState] = useState<ActorDialogState | null>(null);
  const [actorDialogError, setActorDialogError] = useState<string | null>(null);
  const [showDialogueTreeDialog, setShowDialogueTreeDialog] = useState(false);
  const [dialogueTrees, setDialogueTrees] = useState<DialogueTree[]>([]);
  const [activeDialogueTab, setActiveDialogueTab] = useState(0);
  const [dialogueTabToDelete, setDialogueTabToDelete] = useState<number | null>(null);

  const handleOpenActorDialog = useCallback((type: 'npc' | 'enemy') => {
    setActorDialogState({
      type,
      name: '',
      tilesetPath: '',
      portraitPath: '',
      ...EMPTY_ACTOR_ROLES,
      ...(type === 'npc'
        ? { isTalker: true }
        : { isMelee: true })
    });
    setActorDialogError(null);
  }, []);

  const handleCloseActorDialog = useCallback(() => {
    setActorDialogState(null);
    setActorDialogError(null);
  }, []);

  return {
    showObjectDialog,
    setShowObjectDialog,
    editingObject,
    setEditingObject,
    objectValidationErrors,
    setObjectValidationErrors,
    mapObjects,
    setMapObjects,
    showDeleteNpcConfirm,
    setShowDeleteNpcConfirm,
    showDeleteEnemyConfirm,
    setShowDeleteEnemyConfirm,
    actorDialogState,
    setActorDialogState,
    actorDialogError,
    setActorDialogError,
    handleOpenActorDialog,
    handleCloseActorDialog,
    showDialogueTreeDialog,
    setShowDialogueTreeDialog,
    dialogueTrees,
    setDialogueTrees,
    activeDialogueTab,
    setActiveDialogueTab,
    dialogueTabToDelete,
    setDialogueTabToDelete
  };
};

export default useObjectEditing;
