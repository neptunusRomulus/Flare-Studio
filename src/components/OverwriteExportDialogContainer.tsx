import React from 'react';
import OverwriteExportDialog from '@/components/OverwriteExportDialog';

type OverwriteExportCtx = {
  showOverwriteDialog: boolean;
  handleOverwriteConfirm: () => void;
  handleOverwriteCancel: () => void;
};

export default function OverwriteExportDialogContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as OverwriteExportCtx;
  return (
    <OverwriteExportDialog
      open={c.showOverwriteDialog}
      onConfirm={c.handleOverwriteConfirm}
      onCancel={c.handleOverwriteCancel}
    />
  );
}
