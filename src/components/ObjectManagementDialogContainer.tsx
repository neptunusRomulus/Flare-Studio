import React from 'react';
import ObjectManagementDialog from '@/components/ObjectManagementDialog';
import type { MapObject } from '@/types';

type ObjMgmtCtx = {
  showObjectDialog: boolean;
  editingObject?: MapObject | null;
  objectValidationErrors?: Record<string, string> | null;
  setEditingObject: (obj: MapObject | null) => void;
  handleObjectDialogClose: () => void;
  handleObjectDialogSave: () => void;
  updateEditingObjectProperty: (key: string, value: unknown) => void;
  updateEditingObjectBoolean: (key: string, value: boolean) => void;
  getEditingObjectProperty: (key: string) => unknown;
  editor?: unknown;
  syncMapObjects?: () => void;
  canUseTilesetDialog?: boolean;
  handleEditingTilesetBrowse?: () => void;
  handleEditingPortraitBrowse?: () => void;
  handleOpenVendorStockDialog?: () => void;
  handleOpenVendorUnlockDialog?: () => void;
  handleOpenVendorRandomDialog?: () => void;
  setDialogueTrees?: (t: unknown) => void;
  setActiveDialogueTab?: (id: string | null) => void;
  setShowDialogueTreeDialog?: (v: boolean) => void;
  showDeleteNpcConfirm?: boolean;
  setShowDeleteNpcConfirm?: (v: boolean) => void;
  showDeleteEnemyConfirm?: boolean;
  setShowDeleteEnemyConfirm?: (v: boolean) => void;
};

export default function ObjectManagementDialogContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as ObjMgmtCtx;
  return (
    <ObjectManagementDialog
      showObjectDialog={c.showObjectDialog}
      editingObject={c.editingObject}
      objectValidationErrors={c.objectValidationErrors}
      setEditingObject={c.setEditingObject}
      handleObjectDialogClose={c.handleObjectDialogClose}
      handleObjectDialogSave={c.handleObjectDialogSave}
      updateEditingObjectProperty={c.updateEditingObjectProperty}
      updateEditingObjectBoolean={c.updateEditingObjectBoolean}
      getEditingObjectProperty={c.getEditingObjectProperty}
      editor={c.editor}
      syncMapObjects={c.syncMapObjects}
      canUseTilesetDialog={c.canUseTilesetDialog}
      handleEditingTilesetBrowse={c.handleEditingTilesetBrowse}
      handleEditingPortraitBrowse={c.handleEditingPortraitBrowse}
      handleOpenVendorStockDialog={c.handleOpenVendorStockDialog}
      handleOpenVendorUnlockDialog={c.handleOpenVendorUnlockDialog}
      handleOpenVendorRandomDialog={c.handleOpenVendorRandomDialog}
      setDialogueTrees={c.setDialogueTrees}
      setActiveDialogueTab={c.setActiveDialogueTab}
      setShowDialogueTreeDialog={c.setShowDialogueTreeDialog}
      showDeleteNpcConfirm={c.showDeleteNpcConfirm}
      setShowDeleteNpcConfirm={c.setShowDeleteNpcConfirm}
      showDeleteEnemyConfirm={c.showDeleteEnemyConfirm}
      setShowDeleteEnemyConfirm={c.setShowDeleteEnemyConfirm}
    />
  );
}
