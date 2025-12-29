type Params = {
  itemDialogState: unknown;
  itemDialogError: string | null;
  pendingDuplicateItem: unknown;
  handleCloseItemDialog: (...args: any[]) => any;
  handleItemFieldChange: (...args: any[]) => any;
  handleItemSubmit: (...args: any[]) => any;
  handleConfirmDuplicateItem: (...args: any[]) => any;
  clearPendingDuplicate: (...args: any[]) => any;
  showItemEditDialog: boolean;
  editingItem: unknown;
  updateEditingItemField: (...args: any[]) => any;
  handleCloseItemEdit: (...args: any[]) => any;
  handleSaveItemEdit: (...args: any[]) => any;
};

export default function useItemDialogCtx(params: Params) {
  return params as any;
}
