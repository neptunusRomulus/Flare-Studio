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
  setMapsDropdownPos: React.Dispatch<React.SetStateAction<{ left: number; top: number } | null>>;
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
  setMapsDropdownPos,
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
            try {
              const btn = mapsButtonRef?.current;
              if (!btn) {
                setMapsDropdownOpen((s) => !s);
                return;
              }
              const rect = btn.getBoundingClientRect();
              // set position above the button
              setMapsDropdownPos({ left: rect.left, top: rect.top - 8 });
            } catch (e) {
              console.warn('Failed to compute maps dropdown position', e);
            }
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

      <Tooltip content={hasUnsavedChanges ? 'Unsaved changes — click to save (Ctrl+S)' : 'All changes saved'}>
        <div className="relative inline-flex">
          <Button
            onClick={handleManualSave}
            className="w-7 h-7 p-0 shadow-sm"
            variant="outline"
            disabled={isManuallySaving || isPreparingNewMap}
            size="sm"
          >
            {isManuallySaving ? (
              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
          </Button>
          {hasUnsavedChanges && !isManuallySaving && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-background pointer-events-none" />
          )}
        </div>
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
