import React from 'react';
import AppControls from '@/components/AppControls';

type ControlsProps = {
  mapsButtonRef: React.RefObject<HTMLButtonElement>;
  mapsDropdownOpen: boolean;
  mapsDropdownPos: { left: number; top: number } | null;
  mapsPortalRef: React.RefObject<HTMLDivElement>;
  mapsSubOpen: boolean;
  currentProjectPath: string | null;
  projectMaps: string[];
  setMapsSubOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMapsDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMapsDropdownPos: React.Dispatch<React.SetStateAction<{ left: number; top: number } | null>>;
  handleOpenCreateMapDialog: () => void;
  handleOpenMapFromMapsFolder: (p: string) => Promise<void>;
  toast: typeof import('@/hooks/use-toast').toast;
  handleManualSave: () => Promise<void>;
  isManuallySaving: boolean;
  isPreparingNewMap: boolean;
  hasUnsavedChanges: boolean;
  setShowSettings: (v: boolean) => void;
  refreshProjectMaps: () => Promise<void>;
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
        mapsButtonRef={c.mapsButtonRef}
        mapsDropdownOpen={c.mapsDropdownOpen}
        mapsDropdownPos={c.mapsDropdownPos}
        mapsPortalRef={c.mapsPortalRef}
        mapsSubOpen={c.mapsSubOpen}
        currentProjectPath={c.currentProjectPath}
        projectMaps={c.projectMaps}
        setMapsSubOpen={c.setMapsSubOpen}
        setMapsDropdownOpen={c.setMapsDropdownOpen}
        setMapsDropdownPos={c.setMapsDropdownPos}
        handleOpenCreateMapDialog={c.handleOpenCreateMapDialog}
        handleOpenMap={c.handleOpenMapFromMapsFolder}
        toast={c.toast}
        handleManualSave={c.handleManualSave}
        isManuallySaving={c.isManuallySaving}
        isPreparingNewMap={c.isPreparingNewMap}
        hasUnsavedChanges={c.hasUnsavedChanges}
        setShowSettings={c.setShowSettings}
        refreshProjectMaps={c.refreshProjectMaps}
        uiHelpers={c.uiHelpers}
      />
    </div>
  );
};

export type { ControlsProps };
export default SidebarControlsArea;
