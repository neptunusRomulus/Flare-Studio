import React from 'react';
import OverwriteExportDialog from '@/components/OverwriteExportDialog';

export default function OverwriteExportDialogContainer({ ctx }: { ctx: any }) {
  const c = ctx as any;
  return (
    <OverwriteExportDialog
      open={c.showOverwriteDialog}
      onConfirm={c.handleOverwriteConfirm}
      onCancel={c.handleOverwriteCancel}
    />
  );
}
