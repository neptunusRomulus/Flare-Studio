/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import ItemDialog from '@/components/ItemDialog';

type ItemDialogProps = React.ComponentProps<typeof ItemDialog>;
type ItemDialogCtx = {
  itemDialogState?: ItemDialogProps['itemDialogState'];
  itemDialogError?: ItemDialogProps['itemDialogError'];
  pendingDuplicateItem?: ItemDialogProps['pendingDuplicateItem'];
  handleCloseItemDialog?: ItemDialogProps['onClose'];
  handleItemFieldChange?: ItemDialogProps['onFieldChange'];
  handleItemSubmit?: ItemDialogProps['onSubmit'];
  handleConfirmDuplicateItem?: ItemDialogProps['onConfirmDuplicate'];
  clearPendingDuplicate?: ItemDialogProps['onClearDuplicate'];
};

export default function ItemDialogContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as ItemDialogCtx;
  return (
    <ItemDialog
      itemDialogState={c.itemDialogState ?? null}
      itemDialogError={c.itemDialogError ?? null}
      pendingDuplicateItem={c.pendingDuplicateItem ?? null}
      onClose={c.handleCloseItemDialog ?? (() => {})}
      onFieldChange={(f, v) => (c.handleItemFieldChange ? c.handleItemFieldChange(f, v) : undefined)}
      onSubmit={() => (c.handleItemSubmit ? c.handleItemSubmit() : undefined)}
      onConfirmDuplicate={c.handleConfirmDuplicateItem ?? (() => {})}
      onClearDuplicate={c.clearPendingDuplicate ?? (() => {})}
    />
  );
}
