import React from 'react';
import { AnchoredConfirm } from '@/components/ui/inline-confirm';

type OverwriteExportCtx = {
  showOverwriteDialog: boolean;
  handleOverwriteConfirm: () => void;
  handleOverwriteCancel: () => void;
};

export default function OverwriteExportDialogContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as OverwriteExportCtx;
  return (
    <AnchoredConfirm
      open={!!c.showOverwriteDialog}
      message="Overwrite old export?"
      onConfirm={c.handleOverwriteConfirm}
      onCancel={c.handleOverwriteCancel}
    />
  );
}
