type Params = {
  showObjectDialog: boolean;
  editingObject: unknown;
  objectValidationErrors: string[];
  setEditingObject: (...args: any[]) => any;
  handleObjectDialogClose: (...args: any[]) => any;
  handleObjectDialogSave: (...args: any[]) => any;
  updateEditingObjectProperty: (...args: any[]) => any;
  updateEditingObjectBoolean: (...args: any[]) => any;
  getEditingObjectProperty: (...args: any[]) => any;
  editor: unknown;
  syncMapObjects: (...args: any[]) => any;
  handleEditingTilesetBrowse: (...args: any[]) => any;
  handleEditingPortraitBrowse: (...args: any[]) => any;
  handleOpenVendorStockDialog: (...args: any[]) => any;
  handleOpenVendorUnlockDialog: (...args: any[]) => any;
  handleOpenVendorRandomDialog: (...args: any[]) => any;
  setDialogueTrees: (...args: any[]) => any;
  setActiveDialogueTab: (...args: any[]) => any;
  setShowDialogueTreeDialog: (...args: any[]) => any;
  showDeleteNpcConfirm: boolean;
  setShowDeleteNpcConfirm: (...args: any[]) => any;
  showDeleteEnemyConfirm: boolean;
  setShowDeleteEnemyConfirm: (...args: any[]) => any;
};

export default function useObjectDialogCtx(params: Params) {
  return params as any;
}
