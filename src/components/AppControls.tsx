import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import MainMenuDialog from '@/components/MainMenuDialog';
import { Menu, Save } from 'lucide-react';

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
  toast?: typeof import('@/hooks/use-toast').toast;
  handleManualSave: () => void;
  isManuallySaving: boolean;
  isPreparingNewMap: boolean;
  hasUnsavedChanges: boolean;
  setShowSettings: (v: boolean) => void;
  /** Flare logo used as the menu button (falls back to a menu icon). */
  iconUrl?: string | null;
};

/** Title bar app menu: Flare icon opens the main menu (incl. Engine Settings); Save button next to it. */
const AppControls: React.FC<Props> = ({
  currentProjectPath, onSaveAndQuit, onQuit, onShowProjectFolder, onShowHelp, onSaveAsCopy, onRestart, onExport, onCheckUpdates,
  handleManualSave, isManuallySaving, isPreparingNewMap, hasUnsavedChanges, setShowSettings, iconUrl,
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);

  return (
    <div className="flex items-center gap-1 no-drag">
      <Tooltip content="Menu" side="bottom">
        <button
          ref={btnRef}
          type="button"
          aria-label="Menu"
          aria-expanded={menuOpen}
          className="h-6 px-0.5 inline-flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-neutral-800"
          onClick={() => {
            const btn = btnRef.current;
            if (btn) {
              const rect = btn.getBoundingClientRect();
              setMenuPos({ left: rect.left, top: rect.bottom + 4 });
            }
            setMenuOpen((s) => !s);
          }}
        >
          {iconUrl ? <img src={iconUrl} alt="Flare Studio menu" className="w-4 h-6" /> : <Menu className="w-4 h-4" />}
        </button>
      </Tooltip>

      <MainMenuDialog
        open={menuOpen}
        anchorPos={menuPos}
        placement="below"
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
        onOpenSettings={() => { setShowSettings(true); setMenuOpen(false); }}
      />

      <Tooltip content={hasUnsavedChanges ? 'Unsaved changes — click to save (Ctrl+S)' : 'All changes saved'} side="bottom">
        <div className="relative inline-flex">
          <Button
            onClick={handleManualSave}
            className="w-6 h-6 p-0"
            variant="ghost"
            disabled={isManuallySaving || isPreparingNewMap}
            size="sm"
            aria-label="Save project"
          >
            {isManuallySaving ? (
              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
          </Button>
          {hasUnsavedChanges && !isManuallySaving && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-background pointer-events-none" />
          )}
        </div>
      </Tooltip>
    </div>
  );
};

export default AppControls;
