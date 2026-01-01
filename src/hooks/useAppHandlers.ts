/* eslint-disable @typescript-eslint/no-explicit-any */
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

export default function useAppHandlers(params: Record<string, unknown>) {
  const p = params as any;

  const { removeBrush: handleRemoveBrush, reorderBrush: handleBrushReorder } = useBrushActions({ editor: p.editor, setConfirmAction: p.setConfirmAction });

  const {
    handleActorFieldChange,
    handleActorRoleToggle,
    handleActorTilesetBrowse,
    handleActorPortraitBrowse,
    handleActorSubmit
  } = useActorManagement({
    editor: p.editor,
    actorDialogState: p.actorDialogState,
    setActorDialogState: p.setActorDialogState,
    setActorDialogError: p.setActorDialogError,
    currentProjectPath: p.currentProjectPath,
    handleCloseActorDialog: p.handleCloseActorDialog,
    handleEditObject: p.handleEditObject,
    syncMapObjects: p.syncMapObjects
  });

  const { handleAddRule, handleSaveRule } = useRuleHandlers({
    openRuleDialog: p.openRuleDialog,
    closeRuleDialog: p.closeRuleDialog,
    rulesListLength: (p.rulesList || []).length,
    ruleNameInput: p.ruleNameInput,
    setRuleNameInput: p.setRuleNameInput,
    ruleStartType: p.ruleStartType,
    setRuleDialogError: p.setRuleDialogError,
    setRuleStartType: p.setRuleStartType,
    setRuleTriggerId: p.setRuleTriggerId,
    setRuleActionSelection: p.setRuleActionSelection,
    setRuleDialogStep: p.setRuleDialogStep,
    setRulesList: p.setRulesList
  });

  const { handleNpcDragStart, handleNpcDragEnd } = useNpcDrag({ editor: p.editor, setDraggingNpcId: p.setDraggingNpcId });

  const { handleObjectDialogClose } = useObjectDialogClose({ setShowObjectDialog: p.setShowObjectDialog, setEditingObject: p.setEditingObject, setObjectValidationErrors: p.setObjectValidationErrors, setShowDeleteNpcConfirm: p.setShowDeleteNpcConfirm, setShowDeleteEnemyConfirm: p.setShowDeleteEnemyConfirm });

  const { handleObjectDialogSave, updateEditingObjectProperty, updateEditingObjectBoolean, getEditingObjectProperty } = useObjectDialogHandlers({
    editingObject: p.editingObject,
    setEditingObject: p.setEditingObject,
    setObjectValidationErrors: p.setObjectValidationErrors,
    currentProjectPath: p.currentProjectPath,
    handleUpdateObject: p.handleUpdateObject
  });

  const { handleEditingTilesetBrowse, handleEditingPortraitBrowse } = useEditingBrowseHandlers({ updateEditingObjectProperty });

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
  } = useVendorDialogs({
    editingObject: p.editingObject,
    setEditingObject: p.setEditingObject,
    vendorStockSelection: p.vendorStockSelection,
    setVendorStockSelection: p.setVendorStockSelection,
    vendorUnlockEntries: p.vendorUnlockEntries,
    setVendorUnlockEntries: p.setVendorUnlockEntries,
    vendorRandomSelection: p.vendorRandomSelection,
    setVendorRandomSelection: p.setVendorRandomSelection,
    vendorRandomCount: p.vendorRandomCount,
    setVendorRandomCount: p.setVendorRandomCount,
    setShowVendorStockDialog: p.setShowVendorStockDialog,
    setShowVendorUnlockDialog: p.setShowVendorUnlockDialog,
    setShowVendorRandomDialog: p.setShowVendorRandomDialog
  });

  const { handleFileUpload, handleSetActiveLayer, handleToggleLayerVisibility, handleLayerTransparencyChange } = useLayerHandlers({
    editor: p.editor,
    layers: p.layers,
    setLayers: p.setLayers,
    setActiveLayerId: p.setActiveLayerId,
    setItemsList: p.setItemsList,
    normalizeItemsForState: p.normalizeItemsForState,
    currentProjectPath: p.currentProjectPath,
    updateLayersList: p.updateLayersList
  });

  const { handleUndo, handleRedo, handleZoomIn, handleZoomOut, handleResetZoom } = useUndoRedoZoom({ editor: p.editor, updateLayersList: p.updateLayersList, syncMapObjects: p.syncMapObjects });

  const { handleManualSave } = useManualSave({ editor: p.editor, currentProjectPath: p.currentProjectPath, setIsManuallySaving: p.setIsManuallySaving, setLastSaveTime: p.setLastSaveTime, manualSaveRef: p.handleManualSaveRef });

  return {
    handleRemoveBrush,
    handleBrushReorder,
    handleActorFieldChange,
    handleActorRoleToggle,
    handleActorTilesetBrowse,
    handleActorPortraitBrowse,
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
