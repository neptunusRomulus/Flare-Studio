import React from 'react';
import VendorDialogs from '@/components/VendorDialogs';
import RuleDialog from '@/components/RuleDialog';
import AbilityDialog from '@/components/AbilityDialog';
import ActorDialog from '@/components/ActorDialog';
import ItemDialog from '@/components/ItemDialog';
import ItemEditDialog from '@/components/ItemEditDialog';
import ObjectManagementDialog from '@/components/ObjectManagementDialog';
import DialogueTreeDialog from '@/components/dialogue/DialogueTreeDialog';
import MapDialogs from '@/components/MapDialogs';
import OverwriteExportDialog from '@/components/OverwriteExportDialog';
import ExportSuccessModal from '@/components/ExportSuccessModal';
import SeparateBrushDialog from '@/components/SeparateBrushDialog';

// The dialog context is a large, aggregated object assembled in App.tsx.
// It's acceptable to allow a broad shape here; keep the exception narrow.
export default function DialogsContainer({ ctx }: { ctx: unknown }) {
  // Allow a local cast here to avoid cascading type churn across many dialog props.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = ctx as any;

  return (
    <>
      <SeparateBrushDialog
        open={c.showSeparateDialog}
        onOpenChange={c.setShowSeparateDialog}
        onConfirm={c.confirmSeparateBrush}
      />

      <VendorDialogs vendorState={c.vendorState} vendorHandlers={c.vendorHandlers} />

      <RuleDialog
        open={c.showRuleDialog}
        ruleDialogStep={c.ruleDialogStep}
        ruleDialogError={c.ruleDialogError}
        ruleNameInput={c.ruleNameInput}
        setRuleNameInput={c.setRuleNameInput}
        ruleStartType={c.ruleStartType}
        setRuleStartType={c.setRuleStartType}
        ruleTriggerId={c.ruleTriggerId}
        setRuleTriggerId={c.setRuleTriggerId}
        ruleActionSelection={c.ruleActionSelection}
        setRuleActionSelection={c.setRuleActionSelection}
        availableRuleTriggers={c.availableRuleTriggers}
        onClose={c.onRuleClose}
        onSave={c.handleSaveRule}
        onSetStep={c.setRuleDialogStep}
      />

      <AbilityDialog
        open={c.showAbilityDialog}
        abilityNameInput={c.abilityNameInput}
        onNameChange={c.setAbilityNameInput}
        onClose={c.handleCloseAbilityDialog}
        onCreate={c.handleCreateAbility}
      />

      <ActorDialog
        actorDialogState={c.actorDialogState}
        actorDialogError={c.actorDialogError}
        canUseTilesetDialog={c.canUseTilesetDialog}
        onClose={c.handleCloseActorDialog}
        onFieldChange={c.handleActorFieldChange}
        onRoleToggle={c.handleActorRoleToggle}
        onTilesetBrowse={c.handleActorTilesetBrowse}
        onPortraitBrowse={c.handleActorPortraitBrowse}
        onSubmit={c.handleActorSubmit}
      />

      <ItemDialog
        itemDialogState={c.itemDialogState}
        itemDialogError={c.itemDialogError}
        pendingDuplicateItem={c.pendingDuplicateItem}
        onClose={c.handleCloseItemDialog}
        onFieldChange={c.handleItemFieldChange}
        onSubmit={c.handleItemSubmit}
        onConfirmDuplicate={c.handleConfirmDuplicateItem}
        onClearDuplicate={c.clearPendingDuplicate}
      />

      <ItemEditDialog
        showItemEditDialog={c.showItemEditDialog}
        editingItem={c.editingItem}
        updateEditingItemField={c.updateEditingItemField}
        handleCloseItemEdit={c.handleCloseItemEdit}
        handleSaveItemEdit={c.handleSaveItemEdit}
      />

      <ObjectManagementDialog
        showObjectDialog={c.showObjectDialog}
        editingObject={c.editingObject}
        objectValidationErrors={c.objectValidationErrors}
        setEditingObject={c.setEditingObject}
        handleObjectDialogClose={c.handleObjectDialogClose}
        handleObjectDialogSave={c.handleObjectDialogSave}
        updateEditingObjectProperty={c.updateEditingObjectProperty}
        updateEditingObjectBoolean={c.updateEditingObjectBoolean}
        getEditingObjectProperty={c.getEditingObjectProperty}
        editor={c.editor}
        syncMapObjects={c.syncMapObjects}
        canUseTilesetDialog={c.canUseTilesetDialog}
        handleEditingTilesetBrowse={c.handleEditingTilesetBrowse}
        handleEditingPortraitBrowse={c.handleEditingPortraitBrowse}
        handleOpenVendorStockDialog={c.handleOpenVendorStockDialog}
        handleOpenVendorUnlockDialog={c.handleOpenVendorUnlockDialog}
        handleOpenVendorRandomDialog={c.handleOpenVendorRandomDialog}
        setDialogueTrees={c.setDialogueTrees}
        setActiveDialogueTab={c.setActiveDialogueTab}
        setShowDialogueTreeDialog={c.setShowDialogueTreeDialog}
        showDeleteNpcConfirm={c.showDeleteNpcConfirm}
        setShowDeleteNpcConfirm={c.setShowDeleteNpcConfirm}
        showDeleteEnemyConfirm={c.showDeleteEnemyConfirm}
        setShowDeleteEnemyConfirm={c.setShowDeleteEnemyConfirm}
      />

      <DialogueTreeDialog
        showDialogueTreeDialog={c.showDialogueTreeDialog}
        dialogueTrees={c.dialogueTrees}
        setDialogueTrees={c.setDialogueTrees}
        activeDialogueTab={c.activeDialogueTab}
        setActiveDialogueTab={c.setActiveDialogueTab}
        dialogueTabToDelete={c.dialogueTabToDelete}
        setDialogueTabToDelete={c.setDialogueTabToDelete}
        editingObject={c.editingObject}
        updateEditingObjectProperty={c.updateEditingObjectProperty}
        onClose={c.onDialogueClose}
      />

      <MapDialogs
        showCreateMapDialog={c.showCreateMapDialog}
        setShowCreateMapDialog={c.setShowCreateMapDialog}
        newMapName={c.newMapName}
        setNewMapName={c.setNewMapName}
        newMapWidth={c.newMapWidth}
        setNewMapWidth={c.setNewMapWidth}
        newMapHeight={c.newMapHeight}
        setNewMapHeight={c.setNewMapHeight}
        newMapStarting={c.newMapStarting}
        setNewMapStarting={c.setNewMapStarting}
        createMapError={c.createMapError}
        setCreateMapError={c.setCreateMapError}
        isPreparingNewMap={c.isPreparingNewMap}
        handleConfirmCreateMap={c.handleConfirmCreateMap}
        showHeroEditDialog={c.showHeroEditDialog}
        setShowHeroEditDialog={c.setShowHeroEditDialog}
        heroEditData={c.heroEditData}
        setHeroEditData={c.setHeroEditData}
        handleHeroEditCancel={c.handleHeroEditCancel}
        handleHeroEditConfirm={c.handleHeroEditConfirm}
      />

      <OverwriteExportDialog
        open={c.showOverwriteDialog}
        onConfirm={c.handleOverwriteConfirm}
        onCancel={c.handleOverwriteCancel}
      />

      <ExportSuccessModal open={c.showExportSuccess} onClose={c.closeExportSuccess} />
    </>
  );
}
