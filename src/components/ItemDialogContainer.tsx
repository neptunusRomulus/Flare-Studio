import React from 'react';
import ItemDialog from '@/components/ItemDialog';

type ItemDialogCtx = {
  itemDialogState: unknown;
  itemDialogError?: string | null;
  pendingDuplicateItem?: unknown;
  handleCloseItemDialog: () => void;
  handleItemFieldChange: (field: string, value: unknown) => void;
  handleItemSubmit: (data: unknown) => void;
  handleConfirmDuplicateItem: () => void;
  clearPendingDuplicate: () => void;
};

export default function ItemDialogContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as ItemDialogCtx;
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
