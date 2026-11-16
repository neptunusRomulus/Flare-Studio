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
import { AnchoredConfirm } from '@/components/ui/inline-confirm';
import SaveErrorNotificationPanel from '@/components/SaveErrorNotificationPanel';
import EditEnemyWindow from '@/components/EditEnemyWindow';
import QuestEditDialogContainer from '@/components/QuestEditDialogContainer';
import type { MapObject } from '@/types';


/** Nested dialogsCtx drops top-level handlers like onDeleteItem; copy them back. */
export function dialogCtxForContainers(ctx: unknown): unknown {
  if (!ctx || typeof ctx !== 'object') return ctx;
  const root = ctx as Record<string, unknown>;
  const nested = root.dialogsCtx;
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return ctx;
  const n = nested as Record<string, unknown>;
  return { ...n, onDeleteItem: n.onDeleteItem ?? root.onDeleteItem };
}

// The dialog context is a large, aggregated object assembled in App.tsx.
// Only the fields this file reads are typed; each dialog container narrows its
// own slice internally.
export default function DialogsContainer({ ctx }: { ctx: unknown }) {
  // Allow a local cast here to avoid cascading type churn across many dialog props.
  type LocalSeparateCtx = {
    showSeparateDialog?: boolean;
    setShowSeparateDialog?: (open: boolean) => void;
    confirmSeparateBrush?: () => void;
    actorDialogState?: unknown;
    itemDialogState?: unknown;
  };
  /** The fields EditEnemyWindow reads out of the aggregated dialog context. */
  type EnemyEditorCtx = {
    showEnemyEditor?: boolean;
    setShowEnemyEditor?: (open: boolean) => void;
    editingObject?: MapObject | null;
    handleUpdateObject?: (obj: MapObject) => void;
    currentProjectPath?: string | null;
  };
  const local = ctx as LocalSeparateCtx;
  const dialogCtx = dialogCtxForContainers(ctx);
  const enemyCtx = dialogCtx as EnemyEditorCtx;

  // If no dialog context was assembled, avoid mounting dialog components
  // which expect many nested fields — return nothing until ctx is populated.
  if (!ctx || (typeof ctx === 'object' && Object.keys(ctx).length === 0)) return null;

  return (
    <>
      <SaveErrorNotificationPanel position="bottom" />

      <AnchoredConfirm
        open={local.showSeparateDialog ?? false}
        onCancel={() => local.setShowSeparateDialog?.(false)}
        onConfirm={local.confirmSeparateBrush ?? (() => {})}
      />

      <VendorDialogsContainer ctx={dialogCtx} />

      <RuleDialogContainer ctx={dialogCtx} />

      <AbilityDialogContainer ctx={dialogCtx} />

      <ActorDialogContainer ctx={dialogCtx} />

      <ItemDialogContainer ctx={dialogCtx} />
      <ItemEditDialogContainer ctx={dialogCtx} />
      <LootGroupEditDialogContainer ctx={dialogCtx} />

      <ObjectManagementDialogContainer ctx={dialogCtx} />
      <QuestEditDialogContainer ctx={dialogCtx} />

      <DialogueTreeDialogContainer ctx={dialogCtx} />

      <MapDialogsContainer ctx={dialogCtx} />

      <ImportReviewModalContainer ctx={dialogCtx} />

      <OverwriteExportDialogContainer ctx={dialogCtx} />
      <ExportSuccessModalContainer ctx={dialogCtx} />

      <EditEnemyWindow
        open={enemyCtx.showEnemyEditor ?? false}
        onOpenChange={enemyCtx.setShowEnemyEditor}
        enemy={enemyCtx.editingObject}
        onSave={enemyCtx.handleUpdateObject}
        projectPath={enemyCtx.currentProjectPath ?? undefined}
      />
    </>
  );
}
