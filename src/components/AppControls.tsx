import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import MainMenuDialog from '@/components/MainMenuDialog';
import { ChevronDown, Save } from 'lucide-react';
import BrandMark from '@/components/brand/BrandMark';

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
  /** @deprecated The menu button always shows the Flare Studio mark; kept for callers. */
  iconUrl?: string | null;
};

/** Title bar app menu: the Flare Studio mark opens the main menu (incl. Engine Settings); Save button next to it. */
const AppControls: React.FC<Props> = ({
  currentProjectPath, onSaveAndQuit, onQuit, onShowProjectFolder, onShowHelp, onSaveAsCopy, onRestart, onExport, onCheckUpdates,
  handleManualSave, isManuallySaving, isPreparingNewMap, hasUnsavedChanges, setShowSettings,
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
          className="group no-click-effect h-6 w-[30px] pl-0.5 inline-flex items-center gap-px rounded outline-none focus-visible:ring-1 focus-visible:ring-orange-500"
          onClick={() => {
            const btn = btnRef.current;
            if (btn) {
              const rect = btn.getBoundingClientRect();
              setMenuPos({ left: rect.left, top: rect.bottom + 4 });
            }
            setMenuOpen((s) => !s);
          }}
        >
          {/* Hover/press hint that a menu opens: flame lifts, square presses, caret slides in. Fixed width, so no layout shift. */}
          <BrandMark
            className="w-5 h-5 shrink-0 transition-transform duration-150 ease-out group-active:scale-90 motion-reduce:transition-none motion-reduce:transform-none"
            flameClassName="transition-transform duration-150 ease-out group-hover:scale-110 group-hover:-skew-x-3 group-aria-expanded:scale-110 motion-reduce:transition-none motion-reduce:transform-none"
          />
          <ChevronDown
            aria-hidden="true"
            className="w-2.5 h-2.5 shrink-0 text-muted-foreground opacity-0 -translate-y-0.5 transition duration-150 ease-out group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-aria-expanded:opacity-100 group-aria-expanded:translate-y-0 group-aria-expanded:rotate-180 motion-reduce:transition-none"
          />
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
