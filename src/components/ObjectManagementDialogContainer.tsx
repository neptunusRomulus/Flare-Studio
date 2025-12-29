import React from 'react';
import ObjectManagementDialog from '@/components/ObjectManagementDialog';

export default function ObjectManagementDialogContainer({ ctx }: { ctx: any }) {
  const c = ctx as any;
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
