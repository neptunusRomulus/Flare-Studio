import { useCallback, useState } from 'react';
import type { DialogueTree, MapObject } from '@/types';
import { EMPTY_ACTOR_ROLES } from '@/editor/actorRoles';
import type { ActorDialogState, EnemyRoleKey } from '@/editor/actorRoles';
import { validateAndSanitizeObject } from '@/editor/objectValidation';

type UseObjectEditingOptions = {
  // Optional editor instance to perform editor-backed operations when available
  editor?: {
    addMapObject?: (type: string, x: number, y: number, w: number, h: number) => MapObject;
    updateMapObject?: (id: number, obj: Partial<MapObject>) => void;
    getMapObjects?: () => MapObject[];
    triggerAutoSave?: (b?: boolean) => void;
  } | null;
  // Optional callbacks
  syncMapObjects?: () => void;
  createTabFor?: (name: string, projectPath: string | null, config: Record<string, unknown>) => { id: string };
  switchToTab?: (id: string) => Promise<void>;
  currentProjectPath?: string | null;
  handleEditObject?: (id: number) => void;
};

const useObjectEditing = (opts?: UseObjectEditingOptions) => {
  const { editor = null, syncMapObjects, createTabFor, switchToTab, handleEditObject: externalHandleEditObject } = opts || {};

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

  const handleActorFieldChange = useCallback((field: 'name' | 'tilesetPath' | 'portraitPath', value: string) => {
    setActorDialogState((prev) => (prev ? { ...prev, [field]: value } : prev));
    setActorDialogError(null);
  }, []);

  const handleActorRoleToggle = useCallback((role: keyof ActorDialogState) => {
    setActorDialogState((prev) => (prev ? { ...prev, [role]: !prev[role] } : prev));
  }, []);

  const handleActorTilesetBrowse = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electronAPI?.selectTilesetFile) return;
    try {
      const selected = await window.electronAPI.selectTilesetFile();
      if (selected) handleActorFieldChange('tilesetPath', selected);
    } catch (err) {
      console.error('Failed to select tileset file for actor:', err);
    }
  }, [handleActorFieldChange]);

  const handleActorPortraitBrowse = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electronAPI?.selectTilesetFile) return;
    try {
      const selected = await window.electronAPI.selectTilesetFile();
      if (!selected) return;
      if (window.electronAPI.readFileAsDataURL) {
        try {
          const dataUrl = await window.electronAPI.readFileAsDataURL(selected);
          handleActorFieldChange('portraitPath', dataUrl || selected);
        } catch {
          handleActorFieldChange('portraitPath', selected);
        }
      } else {
        handleActorFieldChange('portraitPath', selected);
      }
    } catch (err) {
      console.error('Failed to select portrait file for actor:', err);
    }
  }, [handleActorFieldChange]);

  const handleActorSubmit = useCallback(async (editAfter = false) => {
    if (!actorDialogState) return;
    if (!actorDialogState.name?.trim()) {
      setActorDialogError('Name is required.');
      return;
    }

    const name = actorDialogState.name.trim();
    const tilesetPath = actorDialogState.tilesetPath?.trim() || '';
    const portraitPath = actorDialogState.portraitPath?.trim() || '';

    const roleProperties: Record<string, string> = {};
    if (actorDialogState.type === 'npc') {
      if (actorDialogState.isTalker) roleProperties.talker = 'true';
      if (actorDialogState.isVendor) roleProperties.vendor = 'true';
      if (actorDialogState.isQuestGiver) roleProperties.questGiver = 'true';
    } else {
      // enemy roles
      const roleKeys: EnemyRoleKey[] = ['isMelee','isRanged','isCaster','isSummoner','isBoss','isPassive','isStationary'];
      for (const k of roleKeys) {
        if (actorDialogState[k]) roleProperties[k.replace(/^is/, '').toLowerCase()] = 'true';
      }
    }

    // Create a new unplaced object
    const unplacedX = -1;
    const unplacedY = -1;

    let newObject: MapObject | null = null;
    try {
      if (editor && typeof editor.addMapObject === 'function') {
        newObject = editor.addMapObject('enemy', unplacedX, unplacedY, 1, 1);
        if (newObject && typeof editor.updateMapObject === 'function') {
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
              ...(portraitPath ? { portraitPath } : {})
            }
          });
        }
      } else {
        // Local fallback: append to local mapObjects list
        const id = Date.now();
        newObject = {
          id,
          name,
          type: actorDialogState.type,
          x: unplacedX,
          y: unplacedY,
          width: 1,
          height: 1,
          properties: {
            ...roleProperties,
            ...(tilesetPath ? { tilesetPath } : {}),
            ...(portraitPath ? { portraitPath } : {})
          }
        } as MapObject;
        setMapObjects(prev => [...prev, newObject as MapObject]);
      }
    } catch (err) {
      console.error('Failed to create actor object:', err);
      newObject = null;
    }

    // Run any provided sync callback
    console.log('[DEBUG-ActorSubmit] Created actor:', newObject?.id, newObject?.name, 'Calling syncMapObjects');
    console.log('[DEBUG-ActorSubmit] syncMapObjects type:', typeof syncMapObjects);
    if (typeof syncMapObjects === 'function') {
      console.log('[DEBUG-ActorSubmit] About to call syncMapObjects...');
      syncMapObjects();
      console.log('[DEBUG-ActorSubmit] syncMapObjects call completed');
    } else {
      console.log('[DEBUG-ActorSubmit] syncMapObjects is not a function!');
    }
    console.log('[DEBUG-ActorSubmit] syncMapObjects completed');

    handleCloseActorDialog();
    if (editAfter && newObject) {
      if (typeof externalHandleEditObject === 'function') {
        externalHandleEditObject(newObject.id);
      }
    }

    try {
      if (editor && typeof editor.triggerAutoSave === 'function') editor.triggerAutoSave(true);
    } catch (e) {
      console.warn('triggerAutoSave failed', e);
    }
  }, [actorDialogState, editor, syncMapObjects, externalHandleEditObject, handleCloseActorDialog]);

  const handleEditObject = useCallback((objectId: number) => {
    // If an editor instance is available use it to find the object
    const objects = editor && typeof editor.getMapObjects === 'function' ? editor.getMapObjects() : mapObjects;
    const obj = objects?.find(o => o.id === objectId) || null;
    if (!obj) return;

    // If enemy and createTabFor provided, open an edit tab
    if (obj.type === 'enemy' && typeof createTabFor === 'function') {
      try {
        const tab = createTabFor(obj.name || 'Enemy', null, { enemy: obj });
        if (tab && typeof switchToTab === 'function') void switchToTab(tab.id);
        return;
      } catch (err) {
        console.warn('Failed to create tab for enemy edit:', err);
      }
    }

    setEditingObject(obj);
    setShowObjectDialog(true);
  }, [createTabFor, editor, mapObjects, switchToTab]);

  const handleUpdateObject = useCallback((updatedObject: MapObject) => {
    try {
      if (editor && typeof editor.updateMapObject === 'function') {
        editor.updateMapObject(updatedObject.id, updatedObject);
      } else {
        setMapObjects(prev => prev.map(o => o.id === updatedObject.id ? updatedObject : o));
      }
    } catch (err) {
      console.error('Failed to update object:', err);
    }
    setEditingObject(null);
    setShowObjectDialog(false);
    setObjectValidationErrors([]);
    if (typeof syncMapObjects === 'function') syncMapObjects();
    try {
      if (editor && typeof editor.triggerAutoSave === 'function') editor.triggerAutoSave(true);
    } catch (e) {
      console.warn('triggerAutoSave failed', e);
    }
  }, [editor, syncMapObjects]);

  const handleObjectDialogClose = useCallback(() => {
    setShowObjectDialog(false);
    setEditingObject(null);
    setObjectValidationErrors([]);
    setShowDeleteNpcConfirm(false);
    setShowDeleteEnemyConfirm(false);
  }, []);

  const handleObjectDialogSave = useCallback(async () => {
    if (!editingObject) return;
    const { errors, sanitized } = validateAndSanitizeObject(editingObject);
    if (errors.length > 0) {
      setObjectValidationErrors(errors);
      return;
    }
    setObjectValidationErrors([]);

    // If NPC and a write API is available we could persist NPC file here
    // For now, just update the editor/local state
    handleUpdateObject({ ...editingObject, properties: sanitized });
  }, [editingObject, handleUpdateObject]);

  const updateEditingObjectProperty = useCallback((key: string, value: string | null) => {
    setEditingObject((prev) => {
      if (!prev) return prev;
      const properties = { ...(prev.properties || {}) };
      if (value === null || value === '') delete properties[key];
      else properties[key] = value;
      return { ...prev, properties };
    });
  }, []);

  const updateEditingObjectBoolean = useCallback((key: string, checked: boolean) => {
    setEditingObject((prev) => {
      if (!prev) return prev;
      const properties = { ...(prev.properties || {}) };
      properties[key] = checked ? 'true' : 'false';
      return { ...prev, properties };
    });
  }, []);

  const getEditingObjectProperty = useCallback((key: string, fallback = '') => {
    if (!editingObject || !editingObject.properties) return fallback;
    return editingObject.properties[key] ?? fallback;
  }, [editingObject]);

  const handleEditingTilesetBrowse = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electronAPI?.selectTilesetFile) return;
    try {
      const selected = await window.electronAPI.selectTilesetFile();
      if (selected) updateEditingObjectProperty('tilesetPath', selected);
    } catch (err) {
      console.error('Failed to select tileset for editing object:', err);
    }
  }, [updateEditingObjectProperty]);

  const handleEditingPortraitBrowse = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electronAPI?.selectTilesetFile) return;
    try {
      const selected = await window.electronAPI.selectTilesetFile();
      if (!selected) return;
      if (window.electronAPI.readFileAsDataURL) {
        try {
          const dataUrl = await window.electronAPI.readFileAsDataURL(selected);
          updateEditingObjectProperty('portraitPath', dataUrl || selected);
        } catch {
          updateEditingObjectProperty('portraitPath', selected);
        }
      } else {
        updateEditingObjectProperty('portraitPath', selected);
      }
    } catch (err) {
      console.error('Failed to select portrait for editing object:', err);
    }
  }, [updateEditingObjectProperty]);

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
    handleActorFieldChange,
    handleActorRoleToggle,
    handleActorTilesetBrowse,
    handleActorPortraitBrowse,
    handleActorSubmit,
    handleEditObject,
    handleUpdateObject,
    handleObjectDialogClose,
    handleObjectDialogSave,
    updateEditingObjectProperty,
    updateEditingObjectBoolean,
    getEditingObjectProperty,
    handleEditingTilesetBrowse,
    handleEditingPortraitBrowse,
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
