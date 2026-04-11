import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import MainMenuDialog from '@/components/MainMenuDialog';
import { Menu, Save, Settings } from 'lucide-react';

type Props = {
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
  handleManualSave: () => void;
  isManuallySaving: boolean;
  isPreparingNewMap: boolean;
  hasUnsavedChanges: boolean;
  setShowSettings: (v: boolean) => void;
  uiHelpers?: {
    showTooltipWithDelay: (text: React.ReactNode, target: HTMLElement) => void;
    hideTooltip: () => void;
  };
};

const AppControls: React.FC<Props> = ({
  currentProjectPath,
  onSaveAndQuit,
  onQuit,
  onShowProjectFolder,
  onShowHelp,
  onSaveAsCopy,
  onRestart,
  onExport,
  onCheckUpdates,
  handleManualSave,
  isManuallySaving,
  isPreparingNewMap,
  hasUnsavedChanges,
  setShowSettings,
  uiHelpers: _uiHelpers
}) => {
  void _uiHelpers;
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);

  return (
    <div className="flex items-center gap-2">
      <div>
        <Button
          ref={btnRef}
          size="sm"
          className="w-7 h-7 p-0 shadow-sm"
          onClick={() => {
            const btn = btnRef.current;
            if (btn) {
              const rect = btn.getBoundingClientRect();
              setMenuPos({ left: rect.left, top: rect.top - 8 });
            }
            setMenuOpen((s) => !s);
          }}
        >
          <Menu className="w-3 h-3" />
        </Button>

        <MainMenuDialog
          open={menuOpen}
          anchorPos={menuPos}
          onClose={() => setMenuOpen(false)}
          currentProjectPath={currentProjectPath}
          onSaveAndQuit={async () => { await onSaveAndQuit(); setMenuOpen(false); }}
          onQuit={() => { onQuit(); setMenuOpen(false); }}
          onShowProjectFolder={() => { onShowProjectFolder(); setMenuOpen(false); }}
          onShowHelp={() => { onShowHelp(); setMenuOpen(false); }}
          onSaveAsCopy={async () => { await onSaveAsCopy(); setMenuOpen(false); }}
          onRestart={onRestart}
          onExport={() => { onExport(); setMenuOpen(false); }}
          onCheckUpdates={() => { onCheckUpdates(); setMenuOpen(false); }}
        />
      </div>

      <Tooltip content={hasUnsavedChanges ? 'Unsaved changes — click to save (Ctrl+S)' : 'All changes saved'}>
        <div className="relative inline-flex">
          <Button
            onClick={handleManualSave}
            className="w-7 h-7 p-0 shadow-sm"
            variant="outline"
            disabled={isManuallySaving || isPreparingNewMap}
            size="sm"
            aria-label="Save project"
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
