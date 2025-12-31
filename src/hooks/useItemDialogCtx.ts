/* eslint-disable @typescript-eslint/no-explicit-any */
type Params = {
  itemDialogState: unknown;
  itemDialogError: string | null;
  pendingDuplicateItem: unknown;
  handleCloseItemDialog: () => void;
  handleItemFieldChange: (field: any, value: any) => void;
  handleItemSubmit: () => void;
  handleConfirmDuplicateItem: (data: unknown) => void;
  clearPendingDuplicate: () => void;
  showItemEditDialog: boolean;
  editingItem: unknown;
  updateEditingItemField: (key: string, value: unknown) => void;
  handleCloseItemEdit: () => void;
  handleSaveItemEdit: () => void;
};

export default function useItemDialogCtx(params: Params) {
  return params as Params;
}
