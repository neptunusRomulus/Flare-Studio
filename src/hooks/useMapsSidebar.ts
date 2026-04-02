/* eslint-disable @typescript-eslint/no-explicit-any */
export default function useMapsSidebar(params: any) {
  const p: any = params || {};

  const exportStatus = { isExporting: p.isExporting, exportProgress: p.exportProgress, isSaving: p.isManuallySaving, saveProgress: p.saveProgress };

  const controls = {
    currentProjectPath: p.currentProjectPath,
    onSaveAndQuit: p.onSaveAndQuit,
    onQuit: p.onQuit,
    onShowProjectFolder: p.onShowProjectFolder,
    onShowHelp: p.onShowHelp,
    onSaveAsCopy: p.onSaveAsCopy,
    onRestart: p.onRestart,
    onExport: p.onExport,
    onCheckUpdates: p.onCheckUpdates,
    handleManualSave: p.handleManualSave,
    isManuallySaving: p.isManuallySaving,
    isPreparingNewMap: p.isPreparingNewMap,
    hasUnsavedChanges: p.hasUnsavedChanges,
    setShowSettings: p.setShowSettings,
    uiHelpers: p.uiHelpers,
    toast: p.toast
  };

  return { exportStatus, controls } as any;
}
