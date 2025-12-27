import React from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import MapsDropdown from '@/components/MapsDropdown';
import { Menu, Save, Settings } from 'lucide-react';

type Props = {
  mapsButtonRef: React.RefObject<HTMLButtonElement>;
  mapsDropdownOpen: boolean;
  mapsDropdownPos: { left: number; top: number } | null;
  mapsPortalRef: React.RefObject<HTMLDivElement>;
  mapsSubOpen: boolean;
  currentProjectPath: string | null;
  projectMaps: string[];
  setMapsSubOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMapsDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleOpenCreateMapDialog: () => void;
  handleOpenMap: (path: string) => Promise<void>;
  toast: typeof import('@/hooks/use-toast').toast;
  handleManualSave: () => void;
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

const AppControls: React.FC<Props> = ({
  mapsButtonRef,
  mapsDropdownOpen,
  mapsDropdownPos,
  mapsPortalRef,
  mapsSubOpen,
  currentProjectPath,
  projectMaps,
  setMapsSubOpen,
  setMapsDropdownOpen,
  handleOpenCreateMapDialog,
  handleOpenMap,
  toast,
  handleManualSave,
  isManuallySaving,
  isPreparingNewMap,
  hasUnsavedChanges,
  setShowSettings,
  refreshProjectMaps
  ,
  uiHelpers: _uiHelpers
}) => {
  void _uiHelpers;
  return (
    <div className="flex items-center gap-2">
      <div>
        <Button
          ref={mapsButtonRef}
          size="sm"
          className="w-7 h-7 p-0 shadow-sm"
          onClick={async () => {
            if (!mapsDropdownOpen) await refreshProjectMaps();
            setMapsDropdownOpen((s) => !s);
          }}
          disabled={false}
        >
          <Menu className="w-3 h-3" />
        </Button>

        {mapsDropdownOpen && mapsDropdownPos && (
          <MapsDropdown
            mapsDropdownOpen={mapsDropdownOpen}
            mapsDropdownPos={mapsDropdownPos}
            mapsPortalRef={mapsPortalRef}
            mapsSubOpen={mapsSubOpen}
            currentProjectPath={currentProjectPath}
            projectMaps={projectMaps}
            setMapsSubOpen={setMapsSubOpen}
            setMapsDropdownOpen={setMapsDropdownOpen}
            handleOpenCreateMapDialog={handleOpenCreateMapDialog}
            handleOpenMap={handleOpenMap}
            toast={toast}
          />
        )}
      </div>

      <Tooltip content={hasUnsavedChanges ? 'Save changes' : 'All changes saved'}>
        <Button
          onClick={handleManualSave}
          className={`w-7 h-7 p-0 shadow-sm transition-colors ${
            isManuallySaving ? 'bg-blue-500 hover:bg-blue-600' : hasUnsavedChanges ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
          disabled={isManuallySaving || isPreparingNewMap}
          size="sm"
        >
          {isManuallySaving ? (
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-3 h-3" />
          )}
        </Button>
      </Tooltip>

      <Tooltip content="Engine Settings">
        <Button onClick={() => setShowSettings(true)} className="w-7 h-7 p-0 shadow-sm" variant="outline" size="sm">
          <Settings className="w-3 h-3" />
        </Button>
      </Tooltip>
    </div>
  );
};

export default AppControls;
