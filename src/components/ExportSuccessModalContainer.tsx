import React from 'react';
import ExportSuccessModal from '@/components/ExportSuccessModal';

type ExportSuccessCtx = {
  showExportSuccess: boolean;
  closeExportSuccess: () => void;
};

export default function ExportSuccessModalContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as ExportSuccessCtx;
  return <ExportSuccessModal open={c.showExportSuccess} onClose={c.closeExportSuccess} />;
}
