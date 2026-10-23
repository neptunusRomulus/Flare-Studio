import { useCallback } from 'react';
import type { MapObject } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import { toast } from '@/hooks/use-toast';

type CommandEditor = TileMapEditor | null;

type ItemCommands = {
  refreshItemsList: (projectPath: string | null) => Promise<unknown>;
};

export default function useAppMainObjectCommands({
  editor,
  realSyncMapObjects,
  showNpcActorArea,
  showEnemyActorArea,
  currentProjectPath,
  itemsHook,
}: {
  editor: CommandEditor;
  realSyncMapObjects: (() => void) | undefined;
  showNpcActorArea: boolean;
  showEnemyActorArea: boolean;
  currentProjectPath: string | null;
  itemsHook: ItemCommands;
}) {
  // --- Context menu handlers for duplicate / delete ---

  const handleDuplicateObject = useCallback((objectId: number) => {
    if (!editor) return;
    const objects = typeof editor.getMapObjects === 'function' ? editor.getMapObjects() : [];
    const source = objects.find((o: MapObject) => o.id === objectId);
    if (!source) return;
    const newObj = editor.addMapObject(source.type as 'npc' | 'enemy', -1, -1, source.width ?? 1, source.height ?? 1);
    if (newObj && typeof editor.updateMapObject === 'function') {
      editor.updateMapObject(newObj.id, {
        name: `${source.name || source.type} (copy)`,
        type: source.type,
        category: source.category,
        x: -1,
        y: -1,
        wander_radius: source.wander_radius,
        properties: { ...(source.properties || {}) },
      });
    }
    if (typeof realSyncMapObjects === 'function') realSyncMapObjects();
  }, [editor, realSyncMapObjects]);

  const handleDeleteObject = useCallback((objectId: number) => {
    if (!editor || typeof editor.removeMapObject !== 'function') return;
    editor.removeMapObject(objectId);
    if (typeof realSyncMapObjects === 'function') realSyncMapObjects();
  }, [editor, realSyncMapObjects]);

  const handleDuplicateEvent = useCallback((eventId: number) => {
    if (!editor) return;
    const objects = typeof editor.getMapObjects === 'function' ? editor.getMapObjects() : [];
    const source = objects.find((o: MapObject) => o.id === eventId);
    if (!source) return;
    const srcX = source.x ?? -1;
    const srcY = source.y ?? -1;
    const newObj = editor.addMapObject('event', srcX, srcY, source.width ?? 1, source.height ?? 1);
    if (newObj && typeof editor.updateMapObject === 'function') {
      editor.updateMapObject(newObj.id, {
        name: `${source.name || 'Event'} (copy)`,
        activate: source.activate,
        hotspot: source.hotspot,
        tooltip: source.tooltip,
        intermap: source.intermap,
        loot: source.loot,
        soundfx: source.soundfx,
        mapmod: source.mapmod,
        repeat: source.repeat,
        properties: { ...(source.properties || {}) },
        x: srcX,
        y: srcY,
      });
    }
    if (typeof realSyncMapObjects === 'function') realSyncMapObjects();
  }, [editor, realSyncMapObjects]);

  const handleDeleteEvent = useCallback((eventId: number) => {
    if (!editor || typeof editor.removeMapObject !== 'function') return;
    editor.removeMapObject(eventId);
    if (typeof realSyncMapObjects === 'function') realSyncMapObjects();
  }, [editor, realSyncMapObjects]);

  const handleReorderActors = useCallback((fromIndex: number, toIndex: number) => {
    if (!editor || typeof editor.reorderMapObjects !== 'function') return;
    // Map filtered actor indices to full objects array indices
    const actorTypes = showNpcActorArea ? ['npc'] : showEnemyActorArea ? ['enemy'] : [];
    const allObjects = editor.getMapObjects();
    const actorIndices = allObjects.reduce<number[]>((acc, obj, i) => {
      if (actorTypes.includes(obj.type)) acc.push(i);
      return acc;
    }, []);
    if (fromIndex < actorIndices.length && toIndex < actorIndices.length) {
      editor.reorderMapObjects(actorIndices[fromIndex], actorIndices[toIndex]);
      if (typeof realSyncMapObjects === 'function') realSyncMapObjects();
    }
  }, [editor, showNpcActorArea, showEnemyActorArea, realSyncMapObjects]);

  const handleReorderEvents = useCallback((fromIndex: number, toIndex: number) => {
    if (!editor || typeof editor.reorderMapObjects !== 'function') return;
    const allObjects = editor.getMapObjects();
    const eventIndices = allObjects.reduce<number[]>((acc, obj, i) => {
      if (obj.type === 'event') acc.push(i);
      return acc;
    }, []);
    if (fromIndex < eventIndices.length && toIndex < eventIndices.length) {
      editor.reorderMapObjects(eventIndices[fromIndex], eventIndices[toIndex]);
      if (typeof realSyncMapObjects === 'function') realSyncMapObjects();
    }
  }, [editor, realSyncMapObjects]);

  const handleDuplicateItem = useCallback(async (item: { id: number; name: string; category: string; filePath: string; fileName: string; role?: string; resourceSubtype?: string }) => {
    if (!currentProjectPath) return;
    try {
      let nextId = item.id + 1;
      if (window.electronAPI?.getNextItemId) {
        const idResult = await window.electronAPI.getNextItemId(currentProjectPath);
        if (idResult.success) nextId = idResult.nextId;
      }
      // Read original item data then create a copy
      let itemData: Record<string, unknown> = {};
      if (window.electronAPI?.readItemFile) {
        const readResult = await window.electronAPI.readItemFile(item.filePath);
        if (readResult.success && readResult.data) itemData = readResult.data;
      }
      if (window.electronAPI?.createItemFile) {
        const createResult = await window.electronAPI.createItemFile(currentProjectPath, {
          name: `${item.name} (copy)`,
          id: nextId,
          category: item.category,
          role: item.role,
          resourceSubtype: item.resourceSubtype
        });
        if (createResult.success && createResult.filePath && window.electronAPI?.writeItemFile) {
          await window.electronAPI.writeItemFile(createResult.filePath, { ...itemData, id: nextId, name: `${item.name} (copy)` });
        }
      }
      await itemsHook.refreshItemsList(currentProjectPath);
      toast({ title: 'Item Duplicated', description: `${item.name} has been duplicated.` });
    } catch (err) {
      console.error('Failed to duplicate item:', err);
      toast({ title: 'Error', description: 'Failed to duplicate item.', variant: 'destructive' });
    }
  }, [currentProjectPath, itemsHook, toast]);

  const handleDeleteItem = useCallback(async (item: { id: number; name: string; filePath: string }) => {
    if (!currentProjectPath) return;
    try {
      if (window.electronAPI?.deleteItemFile) {
        const result = await window.electronAPI.deleteItemFile(item.filePath);
        if (result.success) {
          await itemsHook.refreshItemsList(currentProjectPath);
          toast({ title: 'Item Deleted', description: `${item.name} has been deleted.` });
        } else {
          toast({ title: 'Error', description: result.error || 'Failed to delete item.', variant: 'destructive' });
        }
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
      toast({ title: 'Error', description: 'Failed to delete item file.', variant: 'destructive' });
    }
  }, [currentProjectPath, itemsHook, toast]);
  return {
    handleDuplicateObject,
    handleDeleteObject,
    handleDuplicateEvent,
    handleDeleteEvent,
    handleReorderActors,
    handleReorderEvents,
    handleDuplicateItem,
    handleDeleteItem,
  };
}
