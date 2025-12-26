import { useCallback } from 'react';
import type { ItemRole, ItemResourceSubtype } from '@/editor/itemRoles';
import type { ActorDialogState } from '@/editor/actorRoles';
import type { Dispatch, SetStateAction } from 'react';

type ItemInfo = { id: number; name: string; category: string; filePath: string; fileName: string; role: ItemRole; resourceSubtype?: ItemResourceSubtype };

type UseObjectDialogsParams = {
  setActorDialogState: Dispatch<SetStateAction<ActorDialogState | null>>;
  setActorDialogError: Dispatch<SetStateAction<string | null>>;
  currentProjectPath: string | null;
  toast: (opts: { title: string; description?: string }) => void;
  itemsList: ItemInfo[];
  setItemsList: Dispatch<SetStateAction<ItemInfo[]>>;
  normalizeItemsForState: (items: Array<{ id: number; name: string; category: string; filePath: string; fileName: string; role?: string; resourceSubtype?: string }>) => ItemInfo[];
  itemDialogState: { name: string; role: ItemRole; resourceSubtype: ItemResourceSubtype } | null;
  setItemDialogState: Dispatch<SetStateAction<{ name: string; role: ItemRole; resourceSubtype: ItemResourceSubtype } | null>>;
  setItemDialogError: Dispatch<SetStateAction<string | null>>;
};

export default function useObjectDialogs({
  setActorDialogState,
  setActorDialogError,
  currentProjectPath,
  toast,
  itemsList,
  setItemsList,
  normalizeItemsForState,
  itemDialogState,
  setItemDialogState,
  setItemDialogError
}: UseObjectDialogsParams) {
  const handleActorFieldChange = useCallback((field: 'name' | 'tilesetPath' | 'portraitPath', value: string) => {
    setActorDialogState((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value } as ActorDialogState;
    });
    setActorDialogError(null);
  }, [setActorDialogError, setActorDialogState]);

  const handleActorRoleToggle = useCallback((role: string) => {
    setActorDialogState((prev: unknown) => {
      if (!prev || typeof prev !== 'object') return prev;
      const prevRec = prev as Record<string, unknown>;
      const toggled = !prevRec[role];
      return { ...prevRec, [role]: toggled };
    });
  }, [setActorDialogState]);

  const handleActorTilesetBrowse = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electronAPI?.selectTilesetFile) return;
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
    if (typeof window === 'undefined' || !window.electronAPI?.selectPortraitFile) return;
    try {
      const selected = await window.electronAPI.selectPortraitFile();
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

  // Item dialog
  const handleOpenItemDialog = useCallback(async () => {
    setItemDialogState({ name: '', role: 'equipment' as ItemRole, resourceSubtype: 'material' as ItemResourceSubtype });
    setItemDialogError(null);
  }, [setItemDialogState, setItemDialogError]);

  const handleCloseItemDialog = useCallback(() => {
    setItemDialogState(null);
    setItemDialogError(null);
  }, [setItemDialogState, setItemDialogError]);

  const handleItemFieldChange = useCallback((field: 'name' | 'role' | 'resourceSubtype', value: string) => {
    setItemDialogState((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value } as { name: string; role: ItemRole; resourceSubtype: ItemResourceSubtype };
    });
    setItemDialogError(null);
  }, [setItemDialogState, setItemDialogError]);

  const performCreateItem = useCallback(async (skipDuplicateCheck = false) => {
    if (!itemDialogState) return;
    const stateRec = itemDialogState as Record<string, unknown>;
    const nameVal = String(stateRec.name || '').trim();
    if (!nameVal) {
      setItemDialogError('Item name is required.');
      return;
    }
    if (!currentProjectPath) {
      setItemDialogError('No project path available.');
      return;
    }
    try {
      let latestItems = itemsList;
      if (window.electronAPI?.listItems) {
        const itemsResult = await window.electronAPI.listItems(currentProjectPath);
        if (itemsResult.success && itemsResult.items) {
          latestItems = normalizeItemsForState(itemsResult.items);
          setItemsList(latestItems);
        }
      }

      const selectedCategory = 'Default';
      const selectedRole = String(stateRec.role || 'unspecified');
      const normalizedName = nameVal.toLowerCase();
      if (!skipDuplicateCheck) {
        const sameCategory = latestItems.find((it) => {
          const rec = it as Record<string, unknown>;
          const cat = String(rec.category || 'Default');
          const nm = String(rec.name || '').trim().toLowerCase();
          const rl = String(rec.role || 'unspecified');
          return cat === selectedCategory && nm === normalizedName && rl === selectedRole;
        });
        if (sameCategory) {
          setItemDialogError(null);
          return { duplicate: true };
        }
        const otherRole = latestItems.find((it) => {
          const rec = it as Record<string, unknown>;
          const cat = String(rec.category || 'Default');
          const nm = String(rec.name || '').trim().toLowerCase();
          const rl = String(rec.role || 'unspecified');
          return cat === selectedCategory && nm === normalizedName && rl !== selectedRole;
        });
        if (otherRole) {
          return { conflict: true };
        }
      }

      let itemId = 1;
      if (window.electronAPI?.getNextItemId) {
        const idResult = await window.electronAPI.getNextItemId(currentProjectPath);
        if (idResult.success) {
          itemId = idResult.nextId;
        }
      }

      if (window.electronAPI?.createItemFile) {
        const payload = { name: nameVal, id: itemId, category: selectedCategory } as Record<string, unknown>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await window.electronAPI.createItemFile(currentProjectPath, payload as any);
        if (result.success) {
          toast({ title: 'Item Created', description: `${nameVal} (ID: ${itemId}) has been created.` });
          if (window.electronAPI?.listItems) {
            const itemsResult = await window.electronAPI.listItems(currentProjectPath);
            if (itemsResult.success && itemsResult.items) {
              setItemsList(normalizeItemsForState(itemsResult.items));
            }
          }
          handleCloseItemDialog();
          return { success: true };
        } else if (result.error) {
          setItemDialogError(String(result.error));
          return { error: result.error };
        }
      }
    } catch (err) {
      console.error('Error creating item:', err);
      setItemDialogError('Failed to create item file.');
      return { error: 'exception' };
    }
    return {};
  }, [itemDialogState, currentProjectPath, itemsList, normalizeItemsForState, setItemsList, toast, handleCloseItemDialog, setItemDialogError]);

  return {
    handleActorFieldChange,
    handleActorRoleToggle,
    handleActorTilesetBrowse,
    handleActorPortraitBrowse,
    handleOpenItemDialog,
    handleCloseItemDialog,
    handleItemFieldChange,
    performCreateItem
  };
}
