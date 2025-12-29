import React from 'react';
import ExportSuccessModal from '@/components/ExportSuccessModal';

export default function ExportSuccessModalContainer({ ctx }: { ctx: any }) {
  const c = ctx as any;
  return <ExportSuccessModal open={c.showExportSuccess} onClose={c.closeExportSuccess} />;
}
