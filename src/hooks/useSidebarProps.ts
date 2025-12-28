/* eslint-disable @typescript-eslint/no-explicit-any */

export default function useSidebarProps(params: any) {
  const p: any = params || {};

  const actors = {
    isNpcLayer: p.isNpcLayer,
    isEnemyLayer: p.isEnemyLayer,
    actorEntries: p.actorEntries,
    draggingNpcId: p.draggingNpcId,
    handleEditObject: p.handleEditObject,
    setNpcHoverTooltip: p.setNpcHoverTooltip,
    handleNpcDragStart: p.handleNpcDragStart,
    handleNpcDragEnd: p.handleNpcDragEnd,
    handleOpenActorDialog: p.handleOpenActorDialog
  };

  const rules = { isRulesLayer: p.isRulesLayer, rulesList: p.rulesList, handleAddRule: p.handleAddRule };

  const items = {
    isItemsLayer: p.isItemsLayer,
    itemsList: p.itemsList,
    expandedItemCategories: p.expandedItemCategories,
    setExpandedItemCategories: p.setExpandedItemCategories,
    handleOpenItemEdit: p.handleOpenItemEdit,
    handleOpenItemDialog: p.handleOpenItemDialog
  };

  const tileset = {
    editor: p.editor,
    activeLayer: p.activeLayer,
    tabTick: p.tabTick,
    setTabTick: p.setTabTick,
    brushTool: p.brushTool,
    isCollisionLayer: p.isCollisionLayer,
    // brush toolbar visibility and node are handled by the BrushToolbar/useBrushToolbar hook
    handleFileUpload: p.handleFileUpload,
    handleToggleBrushTool: p.handleToggleBrushTool,
    handleDeleteActiveTab: p.handleDeleteActiveTab,
    toast: p.toast,
    handleOpenActorDialog: p.handleOpenActorDialogForTileset,
    stampsState: p.stampsState
  };

  const layersObj = {
    layers: p.layers,
    activeLayerId: p.activeLayerId,
    hoveredLayerId: p.hoveredLayerId,
    layersPanelExpanded: p.layersPanelExpanded,
    setLayersPanelExpanded: p.setLayersPanelExpanded,
    setHoveredLayerId: p.setHoveredLayerId,
    handleSetActiveLayer: p.handleSetActiveLayer,
    handleToggleLayerVisibility: p.handleToggleLayerVisibility,
    handleLayerTransparencyChange: p.handleLayerTransparencyChange,
    showTooltipWithDelay: p.showTooltipWithDelay,
    hideTooltip: p.hideTooltip,
    uiHelpers: p.uiHelpers,
    leftCollapsed: p.leftCollapsed
  };

  const exportStatus = { isExporting: p.isExporting, exportProgress: p.exportProgress };

  const controls = {
    mapsButtonRef: p.mapsButtonRef,
    mapsDropdownOpen: p.mapsDropdownOpen,
    mapsDropdownPos: p.mapsDropdownPos,
    mapsPortalRef: p.mapsPortalRef,
    mapsSubOpen: p.mapsSubOpen,
    currentProjectPath: p.currentProjectPath,
    projectMaps: p.projectMaps,
    setMapsSubOpen: p.setMapsSubOpen,
    setMapsDropdownOpen: p.setMapsDropdownOpen,
    handleOpenCreateMapDialog: p.handleOpenCreateMapDialog,
    handleOpenMapFromMapsFolder: p.handleOpenMapFromMapsFolder,
    handleManualSave: p.handleManualSave,
    isManuallySaving: p.isManuallySaving,
    isPreparingNewMap: p.isPreparingNewMap,
    hasUnsavedChanges: p.hasUnsavedChanges,
    setShowSettings: p.setShowSettings,
    refreshProjectMaps: p.refreshProjectMaps,
    uiHelpers: p.uiHelpers,
    toast: p.toast
  };

  return { actors, rules, items, tileset, layersObj, exportStatus, controls } as any;
}
