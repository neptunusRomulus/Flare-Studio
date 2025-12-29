import React from 'react';
import ItemEditDialog from '@/components/ItemEditDialog';

export default function ItemEditDialogContainer({ ctx }: { ctx: any }) {
  const c = ctx as any;
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
