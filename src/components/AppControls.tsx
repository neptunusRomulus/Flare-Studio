import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import MainMenuDialog from '@/components/MainMenuDialog';
import BrandMark, { BRAND_MARK_RADIUS_CLASS, BRAND_MARK_SIZE_CLASS } from '@/components/brand/BrandMark';
import { deriveLogoState, logoTooltip, type LogoSaveMark, type MapSaveStatus } from '@/editor/saveHealth';

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
  saveStatus?: MapSaveStatus;
  editorDirty?: boolean;
  saveError?: string | null;
  /** @deprecated The menu button always shows the Flare Studio mark; kept for callers. */
  iconUrl?: string | null;
};

/** Tooltip text for the logo button. */
export function menuTooltip(
  hasUnsavedChanges: boolean,
  saveStatus?: MapSaveStatus,
  extras?: { editorDirty?: boolean; saveError?: string | null },
): string {
  if (saveStatus === 'saving') return 'Saving…';
  const state = deriveLogoState({
    mapStatus: saveStatus ?? (hasUnsavedChanges ? 'unsaved' : 'saved'),
    editorDirty: extras?.editorDirty ?? false,
  });
  return logoTooltip(state, extras?.saveError);
}

export function logoMarkClass(_mark: LogoSaveMark): string {
  return 'bg-red-500';
}

export function logoMarkLabel(mark: LogoSaveMark): string {
  if (mark === 'error') return 'Save failed';
  return 'Unsaved changes';
}

/** Floating rounded-square Flare Studio mark: the mark itself is the menu button (Save, Engine Settings, help…). */
const AppControls: React.FC<Props> = ({
  currentProjectPath, onSaveAndQuit, onQuit, onShowProjectFolder, onShowHelp, onSaveAsCopy, onRestart, onExport, onCheckUpdates,
  handleManualSave, isManuallySaving, isPreparingNewMap, hasUnsavedChanges, setShowSettings, saveStatus,
  editorDirty = false, saveError = null,
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const mapStatus = saveStatus ?? (hasUnsavedChanges ? 'unsaved' : 'saved');
  const logo = deriveLogoState({
    mapStatus,
    editorDirty,
  });
  const tooltip = mapStatus === 'saving' ? 'Saving…' : logoTooltip(logo, saveError);

  return (
    <div className="no-drag">
      <div className="relative inline-flex">
      <Tooltip content={tooltip} side="bottom">
        <Button
          ref={btnRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Menu"
          aria-expanded={menuOpen}
          className={`relative group no-click-effect ${BRAND_MARK_SIZE_CLASS} ${BRAND_MARK_RADIUS_CLASS} border-0 bg-transparent p-0 shadow-none outline-none hover:bg-transparent hover:brightness-110 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2`}
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
            className={`${BRAND_MARK_SIZE_CLASS} shrink-0 ${BRAND_MARK_RADIUS_CLASS} transition-transform duration-150 ease-out group-active:scale-90 motion-reduce:transition-none motion-reduce:transform-none`}
            flameClassName="transition-transform duration-150 ease-out group-hover:scale-110 group-hover:-skew-x-3 group-aria-expanded:scale-110 motion-reduce:transition-none motion-reduce:transform-none"
          />
          {logo.mark !== 'none' ? (
            <span
              className={`absolute -right-0.5 -top-0.5 w-2 h-2 ${logoMarkClass(logo.mark)} rounded-full border border-background pointer-events-none`}
              role="img"
              aria-label={logoMarkLabel(logo.mark)}
              data-save-state={logo.mark}
            />
          ) : null}
        </Button>
      </Tooltip>
      </div>

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
