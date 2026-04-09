/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import ObjectManagementDialog from '@/components/ObjectManagementDialog';
import type { MapObject, DialogueTree } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';

type ObjMgmtCtx = {
  showObjectDialog?: boolean;
  editingObject?: MapObject | null;
  objectValidationErrors?: string[] | null;
  setEditingObject?: (obj: MapObject | null) => void;
  handleObjectDialogClose?: () => void;
  handleObjectDialogSave?: () => void;
  updateEditingObjectProperty?: (key: string, value: string | null) => void;
  updateEditingObjectBoolean?: (key: string, value: boolean) => void;
  getEditingObjectProperty?: (key: string, fallback?: string) => string;
  editor?: TileMapEditor | null;
  syncMapObjects?: () => void;
  canUseTilesetDialog?: boolean;
  handleEditingTilesetBrowse?: () => Promise<void> | void;
  handleEditingPortraitBrowse?: () => Promise<void> | void;
  handleAutoDetectAnim?: () => Promise<void> | void;
  handleOpenVendorStockDialog?: () => void;
  handleOpenVendorUnlockDialog?: () => void;
  handleOpenVendorRandomDialog?: () => void;
  handleOpenVendorSettingsDialog?: () => void;
  handleCloseVendorSettingsDialog?: () => void;
  showVendorSettingsDialog?: boolean;
  handleOpenQuestSettingsDialog?: () => void;
  handleCloseQuestSettingsDialog?: () => void;
  showQuestSettingsDialog?: boolean;
  setDialogueTrees?: (t: DialogueTree[]) => void;
  setActiveDialogueTab?: (id: number) => void;
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
      objectValidationErrors={c.objectValidationErrors ?? []}
      setEditingObject={(obj) => (c.setEditingObject ? c.setEditingObject(obj) : undefined)}
      handleObjectDialogClose={c.handleObjectDialogClose ?? (() => {})}
      handleObjectDialogSave={c.handleObjectDialogSave ?? (() => {})}
      updateEditingObjectProperty={(k, v) => (c.updateEditingObjectProperty ? c.updateEditingObjectProperty(k, v) : undefined)}
      updateEditingObjectBoolean={(k, v) => (c.updateEditingObjectBoolean ? c.updateEditingObjectBoolean(k, v) : undefined)}
      getEditingObjectProperty={(k, fallback) => (c.getEditingObjectProperty ? c.getEditingObjectProperty(k, fallback) : (fallback ?? ''))}
      editor={c.editor ?? null}
      syncMapObjects={c.syncMapObjects ?? (() => {})}
      canUseTilesetDialog={!!c.canUseTilesetDialog}
      handleEditingTilesetBrowse={c.handleEditingTilesetBrowse ?? (() => {})}
      handleEditingPortraitBrowse={c.handleEditingPortraitBrowse ?? (() => {})}
      handleAutoDetectAnim={c.handleAutoDetectAnim ?? (() => {})}
      handleOpenVendorStockDialog={c.handleOpenVendorStockDialog ?? (() => {})}
      handleOpenVendorUnlockDialog={c.handleOpenVendorUnlockDialog ?? (() => {})}
      handleOpenVendorRandomDialog={c.handleOpenVendorRandomDialog ?? (() => {})}
      handleOpenVendorSettingsDialog={c.handleOpenVendorSettingsDialog ?? (() => {})}
      handleCloseVendorSettingsDialog={c.handleCloseVendorSettingsDialog ?? (() => {})}
      showVendorSettingsDialog={!!c.showVendorSettingsDialog}
      handleOpenQuestSettingsDialog={c.handleOpenQuestSettingsDialog ?? (() => {})}
      handleCloseQuestSettingsDialog={c.handleCloseQuestSettingsDialog ?? (() => {})}
      showQuestSettingsDialog={!!c.showQuestSettingsDialog}
      setDialogueTrees={(trees) => (c.setDialogueTrees ? c.setDialogueTrees(trees) : undefined)}
      setActiveDialogueTab={(idx) => (c.setActiveDialogueTab ? c.setActiveDialogueTab(idx) : undefined)}
      setShowDialogueTreeDialog={(v) => (c.setShowDialogueTreeDialog ? c.setShowDialogueTreeDialog(v) : undefined)}
      showDeleteNpcConfirm={!!c.showDeleteNpcConfirm}
      setShowDeleteNpcConfirm={(v) => (c.setShowDeleteNpcConfirm ? c.setShowDeleteNpcConfirm(v) : undefined)}
      showDeleteEnemyConfirm={!!c.showDeleteEnemyConfirm}
      setShowDeleteEnemyConfirm={(v) => (c.setShowDeleteEnemyConfirm ? c.setShowDeleteEnemyConfirm(v) : undefined)}
    />
  );
}
