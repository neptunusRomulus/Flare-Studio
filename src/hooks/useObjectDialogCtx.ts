import type { Dispatch, SetStateAction } from 'react';
import type { MapObject, DialogueTree } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';

type Params = {
  showObjectDialog: boolean;
  editingObject: MapObject | null | undefined;
  objectValidationErrors: string[] | null | undefined;
  setEditingObject: Dispatch<SetStateAction<MapObject | null>>;
  handleObjectDialogClose: () => void;
  handleObjectDialogSave: () => void;
  updateEditingObjectProperty: (key: string, value: string | null) => void;
  updateEditingObjectBoolean: (key: string, checked: boolean) => void;
  getEditingObjectProperty: (key: string, fallback?: string) => string;
  editor?: TileMapEditor | null;
  syncMapObjects?: () => void;
  handleEditingTilesetBrowse?: () => Promise<void> | void;
  handleEditingPortraitBrowse?: () => Promise<void> | void;
  handleOpenVendorStockDialog?: () => void;
  handleOpenVendorUnlockDialog?: () => void;
  handleOpenVendorRandomDialog?: () => void;
  setDialogueTrees?: Dispatch<SetStateAction<DialogueTree[]>>;
  setActiveDialogueTab?: Dispatch<SetStateAction<number>>;
  setShowDialogueTreeDialog?: Dispatch<SetStateAction<boolean>>;
  showDeleteNpcConfirm: boolean;
  setShowDeleteNpcConfirm: Dispatch<SetStateAction<boolean>>;
  showDeleteEnemyConfirm: boolean;
  setShowDeleteEnemyConfirm: Dispatch<SetStateAction<boolean>>;
};

export default function useObjectDialogCtx(params: Params) {
  return params as Params;
}
