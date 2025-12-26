import React from 'react';
import EngineSettingsDialog from '@/components/EngineSettingsDialog';
import MapSettingsDialog from '@/components/MapSettingsDialog';
import ClearLayerDialog from '@/components/ClearLayerDialog';
import HelpDialog from '@/components/HelpDialog';
import EnemyTabPanel from '@/components/EnemyTabPanel';
import SeparateBrushDialog from '@/components/SeparateBrushDialog';
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

const AppDialogs: React.FC<any> = (p) => {
  const props = p as any;

  return (
    <>
      <EngineSettingsDialog
        open={props.showSettings}
        onClose={() => props.setShowSettings(false)}
        isDarkMode={props.isDarkMode}
        setIsDarkMode={props.setIsDarkMode}
        editor={props.editor}
        autoSaveEnabled={props.autoSaveEnabled}
        setAutoSaveEnabledState={props.setAutoSaveEnabledState}
        showActiveGid={props.showActiveGid}
        setShowActiveGid={props.setShowActiveGid}
        showSidebarToggle={props.showSidebarToggle}
        setShowSidebarToggle={props.setShowSidebarToggle}
      />

      <MapSettingsDialog
        open={props.showMapSettingsOnly}
        onClose={() => props.setShowMapSettingsOnly(false)}
        mapName={props.mapName}
        setMapName={props.setMapName}
        mapWidth={props.mapWidth}
        setMapWidth={props.setMapWidth}
        mapHeight={props.mapHeight}
        setMapHeight={props.setMapHeight}
        isStartingMap={props.isStartingMap}
        updateStartingMap={props.updateStartingMap}
        handleMapResize={props.handleMapResize}
      />

      <ClearLayerDialog
        open={props.showClearLayerDialog}
        onClose={() => props.setShowClearLayerDialog(false)}
        onConfirm={() => {
          if (props.editor) {
            props.editor.clearLayer();
          }
          props.setSelectedBrushTool('brush');
          props.setShowClearLayerDialog(false);
        }}
      />

      {props.confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 w-80">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Confirm</h3>
              <button
                className="w-8 h-8 p-0"
                onClick={() => props.setConfirmAction(null)}
              >
                ✕
              </button>
            </div>
            <div className="text-sm text-foreground mb-4">
              {props.confirmAction.type === 'removeBrush' && 'Are you sure you want to remove this brush?'}
              {props.confirmAction.type === 'removeTileset' && 'Are you sure you want to remove the tileset for this layer? This will clear the tileset but keep any placed tiles.'}
              {props.confirmAction.type === 'removeTab' && 'Are you sure you want to remove this tileset tab?'}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => props.setConfirmAction(null)}>Cancel</button>
              <button
                onClick={() => {
                  try {
                    if (props.confirmAction.type === 'removeBrush') {
                      const brushId = props.confirmAction.payload as number;
                      if (props.editor) props.editor.removeBrush(brushId);
                    } else if (props.confirmAction.type === 'removeTileset') {
                      if (props.editor) props.editor.removeLayerTileset();
                    } else if (props.confirmAction.type === 'removeTab') {
                      const payload = props.tabToDelete ?? props.confirmPayloadRef.current ?? (props.confirmAction.payload as { layerType: string; tabId: number } | undefined);
                      if (props.editor && payload && payload.layerType) {
                        const liveActive = props.editor.getActiveLayerTabId ? props.editor.getActiveLayerTabId(payload.layerType) : null;
                        const finalTabId = (typeof liveActive === 'number' && liveActive !== null) ? liveActive : payload.tabId;
                        if (typeof finalTabId === 'number') {
                          props.editor.removeLayerTab(payload.layerType, finalTabId);
                          props.setTabTick((t: number) => t + 1);
                          try { props.editor.refreshTilePalette(true); } catch (err) { console.warn('refreshTilePalette failed', err); }
                          try {
                            const newActive = props.editor.getActiveLayerTabId ? props.editor.getActiveLayerTabId(payload.layerType) : null;
                            if (typeof newActive === 'number') {
                              props.editor.setActiveLayerTab(payload.layerType, newActive);
                              props.setTabTick((t: number) => t + 1);
                              try { props.editor.refreshTilePalette(true); } catch (err) { console.warn('refreshTilePalette failed', err); }
                            }
                          } catch (e) {
                            console.warn('Post-remove setActiveLayerTab safeguard failed', e);
                          }
                        }
                      }
                      props.setTabToDelete(null);
                      props.confirmPayloadRef.current = null;
                    }
                  } catch (error) {
                    console.error('Confirm action failed:', error);
                  } finally {
                    props.setConfirmAction(null);
                  }
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <HelpDialog
        open={props.showHelp}
        activeTab={props.activeHelpTab}
        setActiveTab={props.setActiveHelpTab}
        onClose={() => props.setShowHelp(false)}
      />

      {props.isEnemyTabActive ? (
        <section className="flex-1 min-w-0 flex flex-col relative">
          <div className="p-6 h-full overflow-auto">
            <EnemyTabPanel
              enemy={(props.activeTab?.config as any | null)?.enemy}
              showCloseConfirm={props.pendingEnemyTabCloseId === props.activeTabId}
              onCloseDecision={(decision: string) => {
                if (decision === 'cancel') {
                  props.setPendingEnemyTabCloseId(null);
                  return;
                }
                props.setPendingEnemyTabCloseId(null);
                props.closeEditorTab(props.activeTabId ?? '');
              }}
              onSave={(updated: any) => {
                props.handleUpdateObject(updated);
                props.setTabs((prev: any[]) => prev.map(t => t.id === props.activeTabId ? { ...t, config: { ...t.config, enemy: updated } } : t));
              }}
            />
          </div>
        </section>
      ) : null}

      <SeparateBrushDialog
        open={props.showSeparateDialog}
        onOpenChange={props.setShowSeparateDialog}
        onConfirm={props.confirmSeparateBrush}
      />

      <VendorDialogs
        itemsList={props.itemsList}
        showVendorUnlockDialog={props.showVendorUnlockDialog}
        setShowVendorUnlockDialog={props.setShowVendorUnlockDialog}
        vendorUnlockEntries={props.vendorUnlockEntries}
        handleUpdateVendorUnlockRequirement={props.handleUpdateVendorUnlockRequirement}
        handleRemoveVendorUnlockRequirement={props.handleRemoveVendorUnlockRequirement}
        handleToggleVendorUnlockItem={props.handleToggleVendorUnlockItem}
        handleVendorUnlockQtyChange={props.handleVendorUnlockQtyChange}
        handleAddVendorUnlockRequirement={props.handleAddVendorUnlockRequirement}
        handleSaveVendorUnlock={props.handleSaveVendorUnlock}
        showVendorRandomDialog={props.showVendorRandomDialog}
        setShowVendorRandomDialog={props.setShowVendorRandomDialog}
        vendorRandomSelection={props.vendorRandomSelection}
        handleToggleVendorRandomItem={props.handleToggleVendorRandomItem}
        handleVendorRandomFieldChange={props.handleVendorRandomFieldChange}
        vendorRandomCount={props.vendorRandomCount}
        handleRandomCountChange={props.handleRandomCountChange}
        handleSaveVendorRandom={props.handleSaveVendorRandom}
        showVendorStockDialog={props.showVendorStockDialog}
        setShowVendorStockDialog={props.setShowVendorStockDialog}
        vendorStockSelection={props.vendorStockSelection}
        handleToggleVendorStockItem={props.handleToggleVendorStockItem}
        handleVendorStockQtyChange={props.handleVendorStockQtyChange}
        handleSaveVendorStock={props.handleSaveVendorStock}
      />

      <RuleDialog
        open={props.showRuleDialog}
        ruleDialogStep={props.ruleDialogStep}
        ruleDialogError={props.ruleDialogError}
        ruleNameInput={props.ruleNameInput}
        setRuleNameInput={props.setRuleNameInput}
        ruleStartType={props.ruleStartType}
        setRuleStartType={props.setRuleStartType}
        ruleTriggerId={props.ruleTriggerId}
        setRuleTriggerId={props.setRuleTriggerId}
        ruleActionSelection={props.ruleActionSelection}
        setRuleActionSelection={props.setRuleActionSelection}
        availableRuleTriggers={props.availableRuleTriggers}
        onClose={() => {
          props.setShowRuleDialog(false);
          props.setRuleDialogError(null);
          props.setRuleDialogStep('start');
          props.setRuleStartType(null);
          props.setRuleTriggerId('');
          props.setRuleActionSelection(null);
        }}
        onSave={props.handleSaveRule}
        onSetStep={props.setRuleDialogStep}
      />

      <AbilityDialog
        open={props.showAbilityDialog}
        abilityNameInput={props.abilityNameInput}
        onNameChange={props.setAbilityNameInput}
        onClose={props.handleCloseAbilityDialog}
        onCreate={props.handleCreateAbility}
      />

      <ActorDialog
        actorDialogState={props.actorDialogState}
        actorDialogError={props.actorDialogError}
        canUseTilesetDialog={props.canUseTilesetDialog}
        onClose={props.handleCloseActorDialog}
        onFieldChange={props.handleActorFieldChange}
        onRoleToggle={props.handleActorRoleToggle}
        onTilesetBrowse={() => { void props.handleActorTilesetBrowse(); }}
        onPortraitBrowse={() => { void props.handleActorPortraitBrowse(); }}
        onSubmit={props.handleActorSubmit}
      />

      <ItemDialog
        itemDialogState={props.itemDialogState}
        itemDialogError={props.itemDialogError}
        pendingDuplicateItem={props.pendingDuplicateItem}
        onClose={props.handleCloseItemDialog}
        onFieldChange={props.handleItemFieldChange}
        onSubmit={() => { void props.performCreateItem(false); }}
        onConfirmDuplicate={props.handleConfirmDuplicateItem}
        onClearDuplicate={() => props.setPendingDuplicateItem(null)}
      />

      <ItemEditDialog
        showItemEditDialog={props.showItemEditDialog}
        editingItem={props.editingItem}
        updateEditingItemField={props.updateEditingItemField}
        handleCloseItemEdit={props.handleCloseItemEdit}
        handleSaveItemEdit={props.handleSaveItemEdit}
      />

      <ObjectManagementDialog
        showObjectDialog={props.showObjectDialog}
        editingObject={props.editingObject}
        objectValidationErrors={props.objectValidationErrors}
        setEditingObject={props.setEditingObject}
        handleObjectDialogClose={props.handleObjectDialogClose}
        handleObjectDialogSave={props.handleObjectDialogSave}
        updateEditingObjectProperty={props.updateEditingObjectProperty}
        updateEditingObjectBoolean={props.updateEditingObjectBoolean}
        getEditingObjectProperty={props.getEditingObjectProperty}
        editor={props.editor}
        syncMapObjects={props.syncMapObjects}
        canUseTilesetDialog={props.canUseTilesetDialog}
        handleEditingTilesetBrowse={props.handleEditingTilesetBrowse}
        handleEditingPortraitBrowse={props.handleEditingPortraitBrowse}
        handleOpenVendorStockDialog={props.handleOpenVendorStockDialog}
        handleOpenVendorUnlockDialog={props.handleOpenVendorUnlockDialog}
        handleOpenVendorRandomDialog={props.handleOpenVendorRandomDialog}
        dialogueTrees={props.dialogueTrees}
        setDialogueTrees={props.setDialogueTrees}
        setActiveDialogueTab={props.setActiveDialogueTab}
        setShowDialogueTreeDialog={props.setShowDialogueTreeDialog}
        showDeleteNpcConfirm={props.showDeleteNpcConfirm}
        setShowDeleteNpcConfirm={props.setShowDeleteNpcConfirm}
        showDeleteEnemyConfirm={props.showDeleteEnemyConfirm}
        setShowDeleteEnemyConfirm={props.setShowDeleteEnemyConfirm}
      />

      <DialogueTreeDialog
        showDialogueTreeDialog={props.showDialogueTreeDialog}
        dialogueTrees={props.dialogueTrees}
        setDialogueTrees={props.setDialogueTrees}
        activeDialogueTab={props.activeDialogueTab}
        setActiveDialogueTab={props.setActiveDialogueTab}
        dialogueTabToDelete={props.dialogueTabToDelete}
        setDialogueTabToDelete={props.setDialogueTabToDelete}
        editingObject={props.editingObject}
        updateEditingObjectProperty={props.updateEditingObjectProperty}
        onClose={() => {
          props.setShowDialogueTreeDialog(false);
          props.setDialogueTabToDelete(null);
        }}
      />

      <MapDialogs
        showCreateMapDialog={props.showCreateMapDialog}
        setShowCreateMapDialog={props.setShowCreateMapDialog}
        newMapName={props.newMapName}
        setNewMapName={props.setNewMapName}
        newMapWidth={props.newMapWidth}
        setNewMapWidth={props.setNewMapWidth}
        newMapHeight={props.newMapHeight}
        setNewMapHeight={props.setNewMapHeight}
        newMapStarting={props.newMapStarting}
        setNewMapStarting={props.setNewMapStarting}
        createMapError={props.createMapError}
        setCreateMapError={props.setCreateMapError}
        isPreparingNewMap={props.isPreparingNewMap}
        handleConfirmCreateMap={props.handleConfirmCreateMap}
        showHeroEditDialog={props.showHeroEditDialog}
        setShowHeroEditDialog={props.setShowHeroEditDialog}
        heroEditData={props.heroEditData}
        setHeroEditData={props.setHeroEditData}
        handleHeroEditCancel={props.handleHeroEditCancel}
        handleHeroEditConfirm={props.handleHeroEditConfirm}
      />

      <OverwriteExportDialog
        open={props.showOverwriteDialog}
        onConfirm={props.handleOverwriteConfirm}
        onCancel={props.handleOverwriteCancel}
      />

      {props.showExportSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-black rounded-lg shadow-xl p-6 max-w-md mx-4 relative">
            <button
              onClick={() => props.setShowExportSuccess(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-200 transition-colors"
            >
              ✕
            </button>
            <h3 className="text-lg font-semibold text-white mb-2">Export Successful</h3>
            <p className="text-sm text-white/90">Your export has completed successfully.</p>
          </div>
        </div>
      )}
    </>
  );
};

export default AppDialogs;
