/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import ItemEditDialog from '@/components/ItemEditDialog';

type ItemEditDialogCtx = {
  showItemEditDialog?: boolean;
  editingItem?: Record<string, unknown> | null;
  updateEditingItemField?: (key: string, value: unknown) => void;
  handleCloseItemEdit?: () => void;
  handleSaveItemEdit?: () => void;
};

export default function ItemEditDialogContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as ItemEditDialogCtx;
  return (
    <ItemEditDialog
      showItemEditDialog={!!c.showItemEditDialog}
      editingItem={c.editingItem ?? null}
      updateEditingItemField={(k, v) => (c.updateEditingItemField ? c.updateEditingItemField(k, v) : undefined)}
      handleCloseItemEdit={c.handleCloseItemEdit ?? (() => {})}
      handleSaveItemEdit={c.handleSaveItemEdit ?? (() => {})}
    />
  );
}
