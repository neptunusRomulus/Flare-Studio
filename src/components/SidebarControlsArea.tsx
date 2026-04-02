import React from 'react';
import AppControls from '@/components/AppControls';

type ControlsProps = {
  currentProjectPath: string | null;
  onSaveAndQuit: () => Promise<void>;
  onQuit: () => void;
  onShowProjectFolder: () => void;
  onShowHelp: () => void;
  onSaveAsCopy: () => Promise<void>;
  onRestart: () => void;
  onExport: () => void;
  onCheckUpdates: () => void;
  toast: typeof import('@/hooks/use-toast').toast;
  handleManualSave: () => Promise<void>;
  isManuallySaving: boolean;
  isPreparingNewMap: boolean;
  hasUnsavedChanges: boolean;
  setShowSettings: (v: boolean) => void;
  uiHelpers?: {
    showTooltipWithDelay: (text: React.ReactNode, target: HTMLElement) => void;
    hideTooltip: () => void;
  };
};

const SidebarControlsArea: React.FC<{ controls: ControlsProps }> = ({ controls }) => {
  const c = controls;
  return (
    <div className={`flex gap-2 justify-center`}>
      <AppControls
        currentProjectPath={c.currentProjectPath}
        onSaveAndQuit={c.onSaveAndQuit}
        onQuit={c.onQuit}
        onShowProjectFolder={c.onShowProjectFolder}
        onShowHelp={c.onShowHelp}
        onSaveAsCopy={c.onSaveAsCopy}
        onRestart={c.onRestart}
        onExport={c.onExport}
        onCheckUpdates={c.onCheckUpdates}
        toast={c.toast}
        handleManualSave={c.handleManualSave}
        isManuallySaving={c.isManuallySaving}
        isPreparingNewMap={c.isPreparingNewMap}
        hasUnsavedChanges={c.hasUnsavedChanges}
        setShowSettings={c.setShowSettings}
        uiHelpers={c.uiHelpers}
      />
    </div>
  );
};

export type { ControlsProps };
export default SidebarControlsArea;
