import React from 'react';
import ItemEditDialog from '@/components/ItemEditDialog';

type ItemEditDialogCtx = {
  showItemEditDialog: boolean;
  editingItem?: unknown;
  updateEditingItemField: (key: string, value: unknown) => void;
  handleCloseItemEdit: () => void;
  handleSaveItemEdit: () => void;
};

export default function ItemEditDialogContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as ItemEditDialogCtx;
  return (
    <ItemEditDialog
      showItemEditDialog={c.showItemEditDialog}
      editingItem={c.editingItem}
      updateEditingItemField={c.updateEditingItemField}
      handleCloseItemEdit={c.handleCloseItemEdit}
      handleSaveItemEdit={c.handleSaveItemEdit}
    />
  );
}
