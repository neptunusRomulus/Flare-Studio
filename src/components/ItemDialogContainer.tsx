/* eslint-disable @typescript-eslint/no-explicit-any */
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
      itemDialogState={c.itemDialogState as any ?? null}
      itemDialogError={c.itemDialogError ?? null}
      pendingDuplicateItem={c.pendingDuplicateItem as any ?? null}
      onClose={c.handleCloseItemDialog ?? (() => {})}
      onFieldChange={(f, v) => (c.handleItemFieldChange ? c.handleItemFieldChange(f, v) : undefined)}
      onSubmit={() => (c.handleItemSubmit ? c.handleItemSubmit({} as any) : undefined)}
      onConfirmDuplicate={c.handleConfirmDuplicateItem ?? (() => {})}
      onClearDuplicate={c.clearPendingDuplicate ?? (() => {})}
    />
  );
}
