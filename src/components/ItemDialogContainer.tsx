import React from 'react';
import ItemDialog from '@/components/ItemDialog';

export default function ItemDialogContainer({ ctx }: { ctx: any }) {
  const c = ctx as any;
  return (
    <ItemDialog
      itemDialogState={c.itemDialogState}
      itemDialogError={c.itemDialogError}
      pendingDuplicateItem={c.pendingDuplicateItem}
      onClose={c.handleCloseItemDialog}
      onFieldChange={c.handleItemFieldChange}
      onSubmit={c.handleItemSubmit}
      onConfirmDuplicate={c.handleConfirmDuplicateItem}
      onClearDuplicate={c.clearPendingDuplicate}
    />
  );
}
