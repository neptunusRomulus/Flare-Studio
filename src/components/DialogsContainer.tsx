import React from 'react';
import RuleDialogContainer from '@/components/RuleDialogContainer';
import AbilityDialogContainer from '@/components/AbilityDialogContainer';
import ActorDialogContainer from '@/components/ActorDialogContainer';
import ItemDialogContainer from '@/components/ItemDialogContainer';
import ItemEditDialogContainer from '@/components/ItemEditDialogContainer';
import VendorDialogsContainer from '@/components/VendorDialogsContainer';
import ObjectManagementDialogContainer from '@/components/ObjectManagementDialogContainer';
import DialogueTreeDialogContainer from '@/components/DialogueTreeDialogContainer';
import MapDialogsContainer from '@/components/MapDialogsContainer';
import OverwriteExportDialogContainer from '@/components/OverwriteExportDialogContainer';
import ExportSuccessModalContainer from '@/components/ExportSuccessModalContainer';
import SeparateBrushDialog from '@/components/SeparateBrushDialog';

// The dialog context is a large, aggregated object assembled in App.tsx.
// It's acceptable to allow a broad shape here; keep the exception narrow.
export default function DialogsContainer({ ctx }: { ctx: unknown }) {
  // Allow a local cast here to avoid cascading type churn across many dialog props.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = ctx as any;
  // If no dialog context was assembled, avoid mounting dialog components
  // which expect many nested fields — return nothing until ctx is populated.
  if (!c || (typeof c === 'object' && Object.keys(c).length === 0)) return null;

  return (
    <>
      <SeparateBrushDialog
        open={c.showSeparateDialog}
        onOpenChange={c.setShowSeparateDialog}
        onConfirm={c.confirmSeparateBrush}
      />

      <VendorDialogsContainer ctx={c} />

      <RuleDialogContainer ctx={c} />

      <AbilityDialogContainer ctx={c} />

      <ActorDialogContainer ctx={c} />

      <ItemDialogContainer ctx={c} />
      <ItemEditDialogContainer ctx={c} />

      <ObjectManagementDialogContainer ctx={c} />

      <DialogueTreeDialogContainer ctx={c} />

      <MapDialogsContainer ctx={c} />

      <OverwriteExportDialogContainer ctx={c} />
      <ExportSuccessModalContainer ctx={c} />
    </>
  );
}
