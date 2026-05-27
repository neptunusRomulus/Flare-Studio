import React from 'react';
import RuleDialogContainer from '@/components/RuleDialogContainer';
import AbilityDialogContainer from '@/components/AbilityDialogContainer';
import ActorDialogContainer from '@/components/ActorDialogContainer';
import ItemDialogContainer from '@/components/ItemDialogContainer';
import ItemEditDialogContainer from '@/components/ItemEditDialogContainer';
import LootGroupEditDialogContainer from '@/components/LootGroupEditDialogContainer';
import VendorDialogsContainer from '@/components/VendorDialogsContainer';
import ObjectManagementDialogContainer from '@/components/ObjectManagementDialogContainer';
import DialogueTreeDialogContainer from '@/components/DialogueTreeDialogContainer';
import MapDialogsContainer from '@/components/MapDialogsContainer';
import OverwriteExportDialogContainer from '@/components/OverwriteExportDialogContainer';
import ExportSuccessModalContainer from '@/components/ExportSuccessModalContainer';
import ImportReviewModalContainer from '@/components/ImportReviewModalContainer';
import SeparateBrushDialog from '@/components/SeparateBrushDialog';
import SaveErrorNotificationPanel from '@/components/SaveErrorNotificationPanel';
import EditEnemyWindow from '@/components/EditEnemyWindow';
import QuestEditDialogContainer from '@/components/QuestEditDialogContainer';

// The dialog context is a large, aggregated object assembled in App.tsx.
// It's acceptable to allow a broad shape here; keep the exception narrow.
export default function DialogsContainer({ ctx }: { ctx: unknown }) {
  // Allow a local cast here to avoid cascading type churn across many dialog props.
  type LocalSeparateCtx = {
    showSeparateDialog?: boolean;
    setShowSeparateDialog?: (open: boolean) => void;
    confirmSeparateBrush?: () => void;
    actorDialogState?: unknown;
    itemDialogState?: unknown;
  };
  const local = ctx as LocalSeparateCtx;

  const root = ctx as Record<string, unknown>;
  const dialogCtx = (root.dialogsCtx as unknown) ?? ctx;

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

      <VendorDialogsContainer ctx={dialogCtx as any} />

      <RuleDialogContainer ctx={dialogCtx as any} />

      <AbilityDialogContainer ctx={dialogCtx as any} />

      <ActorDialogContainer ctx={dialogCtx as any} />

      <ItemDialogContainer ctx={dialogCtx as any} />
      <ItemEditDialogContainer ctx={dialogCtx as any} />
      <LootGroupEditDialogContainer ctx={dialogCtx as any} />

      <ObjectManagementDialogContainer ctx={dialogCtx as any} />
      <QuestEditDialogContainer ctx={dialogCtx as any} />

      <DialogueTreeDialogContainer ctx={dialogCtx as any} />

      <MapDialogsContainer ctx={dialogCtx as any} />

      <ImportReviewModalContainer ctx={dialogCtx as any} />

      <OverwriteExportDialogContainer ctx={dialogCtx as any} />
      <ExportSuccessModalContainer ctx={dialogCtx as any} />

      <EditEnemyWindow
        open={(dialogCtx as any).showEnemyEditor}
        onOpenChange={(dialogCtx as any).setShowEnemyEditor}
        enemy={(dialogCtx as any).editingObject}
        onSave={(dialogCtx as any).handleUpdateObject}
        projectPath={(dialogCtx as any).currentProjectPath}
      />
    </>
  );
}
