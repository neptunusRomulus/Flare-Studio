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
import SaveErrorNotificationPanel from '@/components/SaveErrorNotificationPanel';

// The dialog context is a large, aggregated object assembled in App.tsx.
// It's acceptable to allow a broad shape here; keep the exception narrow.
export default function DialogsContainer({ ctx }: { ctx: unknown }) {
  // Allow a local cast here to avoid cascading type churn across many dialog props.
  type LocalSeparateCtx = {
    showSeparateDialog?: boolean;
    setShowSeparateDialog?: (open: boolean) => void;
    confirmSeparateBrush?: () => void;
  };
  const local = ctx as LocalSeparateCtx;
  // If no dialog context was assembled, avoid mounting dialog components
  // which expect many nested fields — return nothing until ctx is populated.
  if (!ctx || (typeof ctx === 'object' && Object.keys(ctx).length === 0)) return null;

  return (
    <>
      <SaveErrorNotificationPanel position="bottom" />

      <SeparateBrushDialog
        open={local.showSeparateDialog ?? false}
        onOpenChange={local.setShowSeparateDialog ?? (() => {})}
        onConfirm={local.confirmSeparateBrush ?? (() => {})}
      />

      <VendorDialogsContainer ctx={ctx as any} />

      <RuleDialogContainer ctx={ctx as any} />

      <AbilityDialogContainer ctx={ctx as any} />

      <ActorDialogContainer ctx={ctx as any} />

      <ItemDialogContainer ctx={ctx as any} />
      <ItemEditDialogContainer ctx={ctx as any} />

      <ObjectManagementDialogContainer ctx={ctx as any} />

      <DialogueTreeDialogContainer ctx={ctx as any} />

      <MapDialogsContainer ctx={ctx as any} />

      <OverwriteExportDialogContainer ctx={ctx as any} />
      <ExportSuccessModalContainer ctx={ctx as any} />
    </>
  );
}
