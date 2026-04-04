/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import useBrushActions from './useBrushActions';
import useActorManagement from './useActorManagement';
import useRuleHandlers from './useRuleHandlers';
import useNpcDrag from './useNpcDrag';
import useObjectDialogClose from './useObjectDialogClose';
import useObjectDialogHandlers from './useObjectDialogHandlers';
import useEditingBrowseHandlers from './useEditingBrowseHandlers';
import useVendorDialogs from './useVendorDialogs';
import useLayerHandlers from './useLayerHandlers';
import useUndoRedoZoom from './useUndoRedoZoom';
import useManualSave from './useManualSave';

type UseAppHandlersParams = {
  editor?: TileMapEditor | null;
  setConfirmAction?: (...args: any[]) => any;
  actorDialogState?: any;
  setActorDialogState?: React.Dispatch<any>;
  setActorDialogError?: React.Dispatch<any>;
  currentProjectPath?: string | null;
  handleCloseActorDialog?: (...args: any[]) => any;
  handleEditObject?: (...args: any[]) => any;
  syncMapObjects?: () => void;
  updateLayersList?: () => void;
  openRuleDialog?: () => void;
  closeRuleDialog?: () => void;
  rulesList?: any[];
  ruleNameInput?: any;
  setRuleNameInput?: React.Dispatch<any>;
  ruleStartType?: any;
  setRuleDialogError?: React.Dispatch<any>;
  setRuleStartType?: React.Dispatch<any>;
  setRuleTriggerId?: React.Dispatch<any>;
  setRuleActionSelection?: React.Dispatch<any>;
  setRuleDialogStep?: React.Dispatch<any>;
  setRulesList?: React.Dispatch<any>;
  setDraggingNpcId?: React.Dispatch<any>;
  setShowObjectDialog?: React.Dispatch<any>;
  setEditingObject?: React.Dispatch<any>;
  setObjectValidationErrors?: React.Dispatch<any>;
  setShowDeleteNpcConfirm?: React.Dispatch<any>;
  setShowDeleteEnemyConfirm?: React.Dispatch<any>;
  editingObject?: any;
  handleUpdateObject?: (...args: any[]) => any;
  vendorStockSelection?: any;
  setVendorStockSelection?: React.Dispatch<any>;
  vendorUnlockEntries?: any;
  setVendorUnlockEntries?: React.Dispatch<any>;
  vendorRandomSelection?: any;
  setVendorRandomSelection?: React.Dispatch<any>;
  vendorRandomCount?: number;
  setVendorRandomCount?: React.Dispatch<any>;
  setShowVendorStockDialog?: React.Dispatch<any>;
  setShowVendorUnlockDialog?: React.Dispatch<any>;
  setShowVendorRandomDialog?: React.Dispatch<any>;
  layers?: any[];
  setLayers?: React.Dispatch<any>;
  setActiveLayerId?: React.Dispatch<any>;
  setItemsList?: React.Dispatch<any>;
  normalizeItemsForState?: (...args: any[]) => any;
  setIsManuallySaving?: React.Dispatch<React.SetStateAction<boolean>>;
  setLastSaveTime?: React.Dispatch<React.SetStateAction<number>>;
  handleManualSaveRef?: { current?: () => Promise<void> } | undefined;
};

export default function useAppHandlers(params: UseAppHandlersParams) {
  const p = params as UseAppHandlersParams;

  const brushActionsParams: Parameters<typeof useBrushActions>[0] = {
    editor: p.editor ?? null,
    setConfirmAction: p.setConfirmAction ?? (() => {}) as any
  };
  const { removeBrush: handleRemoveBrush, reorderBrush: handleBrushReorder } = useBrushActions(brushActionsParams);

  const actorManagementParams: Parameters<typeof useActorManagement>[0] = {
    editor: p.editor ?? null,
    actorDialogState: p.actorDialogState,
    setActorDialogState: p.setActorDialogState ?? (() => {}) as any,
    setActorDialogError: p.setActorDialogError ?? (() => {}) as any,
    currentProjectPath: p.currentProjectPath ?? null,
    handleCloseActorDialog: p.handleCloseActorDialog ?? (() => {}),
    handleEditObject: p.handleEditObject ?? (() => {}),
    syncMapObjects: p.syncMapObjects ?? (() => {})
  };

  const {
    handleActorFieldChange,
    handleActorRoleToggle,
    handleActorSubmit
  } = useActorManagement(actorManagementParams as any);

  const ruleHandlersParams: Parameters<typeof useRuleHandlers>[0] = {
    openRuleDialog: p.openRuleDialog ?? (() => {}),
    closeRuleDialog: p.closeRuleDialog ?? (() => {}),
    rulesListLength: (p.rulesList || []).length,
    ruleNameInput: (p.ruleNameInput as string) ?? '',
    setRuleNameInput: p.setRuleNameInput ?? (() => {}) as any,
    ruleStartType: p.ruleStartType,
    setRuleDialogError: p.setRuleDialogError ?? (() => {}) as any,
    setRuleStartType: p.setRuleStartType ?? (() => {}) as any,
    setRuleTriggerId: p.setRuleTriggerId ?? (() => {}) as any,
    setRuleActionSelection: p.setRuleActionSelection ?? (() => {}) as any,
    setRuleDialogStep: p.setRuleDialogStep ?? (() => {}) as any,
    setRulesList: p.setRulesList ?? (() => {}) as any
  };
  const { handleAddRule, handleSaveRule } = useRuleHandlers(ruleHandlersParams as any);

  const npcDragParams: Parameters<typeof useNpcDrag>[0] = {
    editor: p.editor ?? null,
    setDraggingNpcId: p.setDraggingNpcId ?? (() => {}) as any
  };
  const { handleNpcDragStart, handleNpcDragEnd } = useNpcDrag(npcDragParams as any);

  const objectDialogCloseParams: Parameters<typeof useObjectDialogClose>[0] = {
    setShowObjectDialog: p.setShowObjectDialog ?? (() => {}),
    setEditingObject: p.setEditingObject ?? (() => {}) as any,
    setObjectValidationErrors: p.setObjectValidationErrors ?? (() => {}) as any,
    setShowDeleteNpcConfirm: p.setShowDeleteNpcConfirm ?? (() => {}),
    setShowDeleteEnemyConfirm: p.setShowDeleteEnemyConfirm ?? (() => {})
  };
  const { handleObjectDialogClose } = useObjectDialogClose(objectDialogCloseParams as any);

  const objectDialogHandlersParams: Parameters<typeof useObjectDialogHandlers>[0] = {
    editingObject: p.editingObject,
    setEditingObject: p.setEditingObject ?? (() => {}) as any,
    setObjectValidationErrors: p.setObjectValidationErrors ?? (() => {}) as any,
    currentProjectPath: p.currentProjectPath ?? null,
    handleUpdateObject: p.handleUpdateObject ?? (() => {})
  };
  const { handleObjectDialogSave, updateEditingObjectProperty, updateEditingObjectBoolean, getEditingObjectProperty } = useObjectDialogHandlers(objectDialogHandlersParams as any);

  const editingBrowseParams: Parameters<typeof useEditingBrowseHandlers>[0] = { updateEditingObjectProperty, getEditingObjectProperty } as any;
  const { handleEditingTilesetBrowse, handleEditingPortraitBrowse, handleAutoDetectAnim } = useEditingBrowseHandlers(editingBrowseParams as any);

  const vendorDialogsParams: Parameters<typeof useVendorDialogs>[0] = {
    editingObject: p.editingObject,
    setEditingObject: p.setEditingObject ?? (() => {}) as any,
    vendorStockSelection: p.vendorStockSelection ?? {},
    setVendorStockSelection: p.setVendorStockSelection ?? (() => {}) as any,
    vendorUnlockEntries: p.vendorUnlockEntries ?? [],
    setVendorUnlockEntries: p.setVendorUnlockEntries ?? (() => {}) as any,
    vendorRandomSelection: p.vendorRandomSelection ?? {},
    setVendorRandomSelection: p.setVendorRandomSelection ?? (() => {}) as any,
    vendorRandomCount: (p.vendorRandomCount as any) ?? { min: 1, max: 1 },
    setVendorRandomCount: p.setVendorRandomCount ?? (() => {}) as any,
    setShowVendorStockDialog: p.setShowVendorStockDialog ?? (() => {}),
    setShowVendorUnlockDialog: p.setShowVendorUnlockDialog ?? (() => {}),
    setShowVendorRandomDialog: p.setShowVendorRandomDialog ?? (() => {})
  };
  const {
    handleOpenVendorStockDialog,
    handleOpenVendorUnlockDialog,
    handleOpenVendorRandomDialog,
    handleToggleVendorStockItem,
    handleVendorStockQtyChange,
    handleSaveVendorStock,
    handleAddVendorUnlockRequirement,
    handleUpdateVendorUnlockRequirement,
    handleToggleVendorUnlockItem,
    handleVendorUnlockQtyChange,
    handleRemoveVendorUnlockRequirement,
    handleSaveVendorUnlock,
    handleToggleVendorRandomItem,
    handleVendorRandomFieldChange,
    handleRandomCountChange,
    handleSaveVendorRandom
  } = useVendorDialogs(vendorDialogsParams as any);

  const layerHandlersParams: Parameters<typeof useLayerHandlers>[0] = {
    editor: p.editor ?? null,
    layers: p.layers ?? [],
    setLayers: p.setLayers ?? (() => {}),
    setActiveLayerId: p.setActiveLayerId ?? (() => {}),
    setItemsList: p.setItemsList ?? (() => {}),
    normalizeItemsForState: p.normalizeItemsForState ?? (() => []),
    currentProjectPath: p.currentProjectPath ?? null,
    updateLayersList: p.updateLayersList ?? (() => {})
  };
  const { handleFileUpload, handleSetActiveLayer, handleToggleLayerVisibility, handleLayerTransparencyChange } = useLayerHandlers(layerHandlersParams as any);

  const undoRedoParams: Parameters<typeof useUndoRedoZoom>[0] = { editor: p.editor ?? null, updateLayersList: p.updateLayersList ?? (() => {}), syncMapObjects: p.syncMapObjects ?? (() => {}) };
  const { handleUndo, handleRedo, handleZoomIn, handleZoomOut, handleResetZoom } = useUndoRedoZoom(undoRedoParams);

  const manualSaveParams: Parameters<typeof useManualSave>[0] = {
    editor: p.editor ?? null,
    currentProjectPath: p.currentProjectPath ?? null,
    setIsManuallySaving: p.setIsManuallySaving ?? (() => {}),
    setLastSaveTime: p.setLastSaveTime ?? (() => {}),
    manualSaveRef: (p.handleManualSaveRef as any)
  };
  const { handleManualSave } = useManualSave(manualSaveParams as any);

  return {
    handleRemoveBrush,
    handleBrushReorder,
    handleActorFieldChange,
    handleActorRoleToggle,
    handleActorSubmit,
    handleAddRule,
    handleSaveRule,
    handleNpcDragStart,
    handleNpcDragEnd,
    handleObjectDialogClose,
    handleObjectDialogSave,
    updateEditingObjectProperty,
    updateEditingObjectBoolean,
    getEditingObjectProperty,
    handleEditingTilesetBrowse,
    handleEditingPortraitBrowse,
    handleAutoDetectAnim,
    handleOpenVendorStockDialog,
    handleOpenVendorUnlockDialog,
    handleOpenVendorRandomDialog,
    handleToggleVendorStockItem,
    handleVendorStockQtyChange,
    handleSaveVendorStock,
    handleAddVendorUnlockRequirement,
    handleUpdateVendorUnlockRequirement,
    handleToggleVendorUnlockItem,
    handleVendorUnlockQtyChange,
    handleRemoveVendorUnlockRequirement,
    handleSaveVendorUnlock,
    handleToggleVendorRandomItem,
    handleVendorRandomFieldChange,
    handleRandomCountChange,
    handleSaveVendorRandom,
    handleFileUpload,
    handleSetActiveLayer,
    handleToggleLayerVisibility,
    handleLayerTransparencyChange,
    handleUndo,
    handleRedo,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleManualSave
  };
}
