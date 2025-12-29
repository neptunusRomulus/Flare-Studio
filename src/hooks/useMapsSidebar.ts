/* eslint-disable @typescript-eslint/no-explicit-any */
export default function useMapsSidebar(params: any) {
  const p: any = params || {};

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

  return { exportStatus, controls } as any;
}
