/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import ObjectManagementDialog from '@/components/ObjectManagementDialog';
import type { MapObject } from '@/types';

type ObjMgmtCtx = {
  showObjectDialog: boolean;
  editingObject?: MapObject | null;
  objectValidationErrors?: Record<string, string> | null;
  setEditingObject: (obj: MapObject | null) => void;
  handleObjectDialogClose: () => void;
  handleObjectDialogSave: () => void;
  updateEditingObjectProperty: (key: string, value: unknown) => void;
  updateEditingObjectBoolean: (key: string, value: boolean) => void;
  getEditingObjectProperty: (key: string) => unknown;
  editor?: unknown;
  syncMapObjects?: () => void;
  canUseTilesetDialog?: boolean;
  handleEditingTilesetBrowse?: () => void;
  handleEditingPortraitBrowse?: () => void;
  handleOpenVendorStockDialog?: () => void;
  handleOpenVendorUnlockDialog?: () => void;
  handleOpenVendorRandomDialog?: () => void;
  setDialogueTrees?: (t: unknown) => void;
  setActiveDialogueTab?: (id: string | null) => void;
  setShowDialogueTreeDialog?: (v: boolean) => void;
  showDeleteNpcConfirm?: boolean;
  setShowDeleteNpcConfirm?: (v: boolean) => void;
  showDeleteEnemyConfirm?: boolean;
  setShowDeleteEnemyConfirm?: (v: boolean) => void;
};

export default function ObjectManagementDialogContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as ObjMgmtCtx;
  return (
    <ObjectManagementDialog
      showObjectDialog={!!c.showObjectDialog}
      editingObject={c.editingObject ?? null}
      objectValidationErrors={(c.objectValidationErrors as unknown as string[]) ?? []}
      setEditingObject={(obj) => (c.setEditingObject ? c.setEditingObject(obj) : undefined)}
      handleObjectDialogClose={c.handleObjectDialogClose ?? (() => {})}
      handleObjectDialogSave={c.handleObjectDialogSave ?? (() => {})}
      updateEditingObjectProperty={(k, v) => (c.updateEditingObjectProperty ? c.updateEditingObjectProperty(k, v) : undefined)}
      updateEditingObjectBoolean={(k, v) => (c.updateEditingObjectBoolean ? c.updateEditingObjectBoolean(k, v) : undefined)}
      getEditingObjectProperty={(k, fallback) => String(c.getEditingObjectProperty ? c.getEditingObjectProperty(k) ?? fallback ?? '' : (fallback ?? ''))}
      editor={c.editor as any ?? null}
      syncMapObjects={c.syncMapObjects ?? (() => {})}
      canUseTilesetDialog={!!c.canUseTilesetDialog}
      handleEditingTilesetBrowse={c.handleEditingTilesetBrowse ?? (() => {})}
      handleEditingPortraitBrowse={c.handleEditingPortraitBrowse ?? (() => {})}
      handleOpenVendorStockDialog={c.handleOpenVendorStockDialog ?? (() => {})}
      handleOpenVendorUnlockDialog={c.handleOpenVendorUnlockDialog ?? (() => {})}
      handleOpenVendorRandomDialog={c.handleOpenVendorRandomDialog ?? (() => {})}
      setDialogueTrees={(trees) => (c.setDialogueTrees ? c.setDialogueTrees(trees) : undefined)}
      setActiveDialogueTab={(idx) => (c.setActiveDialogueTab ? c.setActiveDialogueTab(String(idx)) : undefined)}
      setShowDialogueTreeDialog={(v) => (c.setShowDialogueTreeDialog ? c.setShowDialogueTreeDialog(v) : undefined)}
      showDeleteNpcConfirm={!!c.showDeleteNpcConfirm}
      setShowDeleteNpcConfirm={(v) => (c.setShowDeleteNpcConfirm ? c.setShowDeleteNpcConfirm(v) : undefined)}
      showDeleteEnemyConfirm={!!c.showDeleteEnemyConfirm}
      setShowDeleteEnemyConfirm={(v) => (c.setShowDeleteEnemyConfirm ? c.setShowDeleteEnemyConfirm(v) : undefined)}
    />
  );
}
