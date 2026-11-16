import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import MainMenuDialog from '@/components/MainMenuDialog';
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
  /** Save state from the editor; only used for the button tooltip (was the title-bar Saving… text). */
  saveStatus?: 'saving' | 'saved' | 'unsaved' | 'error';
  /** @deprecated The menu button always shows the Flare Studio mark; kept for callers. */
  iconUrl?: string | null;
};

/** Tooltip text for the logo button; the old title-bar "Saving… / Save Error" text moved here. */
export function menuTooltip(hasUnsavedChanges: boolean, saveStatus?: 'saving' | 'saved' | 'unsaved' | 'error'): string {
  if (saveStatus === 'saving') return 'Saving…';
  if (saveStatus === 'error') return 'Save failed — open the menu to try again';
  if (hasUnsavedChanges) return 'Unsaved changes — open the menu to save (Ctrl+S)';
  return 'Menu — all changes saved';
}

/** Floating round Flare Studio mark: opens the main app menu (Save, Engine Settings, help…). */
const AppControls: React.FC<Props> = ({
  currentProjectPath, onSaveAndQuit, onQuit, onShowProjectFolder, onShowHelp, onSaveAsCopy, onRestart, onExport, onCheckUpdates,
  handleManualSave, isManuallySaving, isPreparingNewMap, hasUnsavedChanges, setShowSettings, saveStatus,
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);

  return (
    <div className="no-drag">
      <Tooltip content={menuTooltip(hasUnsavedChanges, saveStatus)} side="bottom">
        <Button
          ref={btnRef}
          type="button"
          variant="outline"
          size="icon"
          aria-label="Menu"
          aria-expanded={menuOpen}
          className="relative group no-click-effect h-9 w-9 rounded-full border-border bg-white/90 shadow-lg outline-none focus-visible:ring-1 focus-visible:ring-orange-500 hover:bg-white dark:bg-neutral-900/90 dark:hover:bg-neutral-900"
          onClick={() => {
            const btn = btnRef.current;
            if (btn) {
              const rect = btn.getBoundingClientRect();
              setMenuPos({ left: rect.left, top: rect.bottom + 4 });
            }
            setMenuOpen((s) => !s);
          }}
        >
          {/* Hover/press hint that a menu opens: flame lifts, mark presses. Fixed size, so no layout shift. */}
          <BrandMark
            className="w-5 h-5 shrink-0 transition-transform duration-150 ease-out group-active:scale-90 motion-reduce:transition-none motion-reduce:transform-none"
            flameClassName="transition-transform duration-150 ease-out group-hover:scale-110 group-hover:-skew-x-3 group-aria-expanded:scale-110 motion-reduce:transition-none motion-reduce:transform-none"
          />
          {hasUnsavedChanges ? (
            <span
              className="absolute -right-0.5 -top-0.5 w-2 h-2 bg-red-500 rounded-full border border-background pointer-events-none"
              role="img"
              aria-label="Unsaved changes"
              data-save-state="unsaved"
            />
          ) : (
            <span
              className="absolute -right-0.5 -top-0.5 w-2 h-2 bg-green-500 rounded-full border border-background pointer-events-none"
              role="img"
              aria-label="All changes saved"
              data-save-state="saved"
            />
          )}
        </Button>
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
        onSave={handleManualSave}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isManuallySaving || isPreparingNewMap}
      />
    </div>
  );
};

export default AppControls;
