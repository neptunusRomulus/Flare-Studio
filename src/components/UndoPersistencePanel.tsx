import React, { useState, useEffect } from 'react';
import { HelpCircle, Trash2 } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';

export interface UndoPersistencePanelProps {
  /**
   * Whether undo persistence is enabled
   */
  enabled: boolean;

  /**
   * Callback when enabled state changes
   */
  onEnabledChange: (enabled: boolean) => void;

  /**
   * Optional callback to clear saved undo history
   */
  onClearHistory?: () => void;

  /**
   * Optional info about storage (for display)
   */
  storageSizeKB?: number;
}

/**
 * UI Panel for configuring undo/redo persistence settings
 *
 * Features:
 * - Toggle to enable/disable persistence
 * - Information about what gets saved
 * - Clear saved history button
 * - Storage size display
 * - Explanatory tooltips
 */
export default function UndoPersistencePanel({
  enabled,
  onEnabledChange,
  onClearHistory,
  storageSizeKB
}: UndoPersistencePanelProps) {
  const [localEnabled, setLocalEnabled] = useState(enabled);

  useEffect(() => {
    setLocalEnabled(enabled);
  }, [enabled]);

  const handleToggle = () => {
    const newValue = !localEnabled;
    setLocalEnabled(newValue);
    onEnabledChange(newValue);
  };

  return (
    <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
      <div className="space-y-3">
        {/* Header with toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900">
              Undo History Persistence
            </h4>
            <Tooltip content="Save undo/redo history to browser storage so you can undo changes after reloading the page">
              <HelpCircle className="w-4 h-4 text-slate-500 cursor-help" />
            </Tooltip>
          </div>
          <button
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              localEnabled
                ? 'bg-orange-500 hover:bg-orange-600'
                : 'bg-slate-300 hover:bg-slate-400'
            }`}
            aria-pressed={localEnabled}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                localEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Info when enabled */}
        {localEnabled && (
          <div className="space-y-2 text-sm">
            <p className="text-slate-600">
              ✓ Undo history is saved automatically on every change
            </p>
            <p className="text-slate-600">
              ✓ History persists across page reloads and browser restarts
            </p>
            <p className="text-slate-600">
              ✓ Closes when you open a different project
            </p>

            {/* Storage size indicator */}
            {storageSizeKB !== undefined && (
              <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                <p className="text-xs text-blue-700">
                  Storage used: <span className="font-semibold">{storageSizeKB} KB</span> (Max 5 MB)
                </p>
              </div>
            )}

            {/* Clear button */}
            {onClearHistory && (
              <button
                onClick={onClearHistory}
                className="mt-2 flex items-center gap-2 px-3 py-1 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Clear Saved History
              </button>
            )}
          </div>
        )}

        {/* Info when disabled */}
        {!localEnabled && (
          <p className="text-sm text-slate-500">
            Undo history will not be saved. History is lost when you reload the page.
          </p>
        )}
      </div>

      {/* Benefits box */}
      <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-100">
        <p className="text-xs font-semibold text-blue-900 mb-1">💡 Benefits:</p>
        <ul className="text-xs text-blue-800 space-y-0.5">
          <li>• Recover from accidental edits after reloading</li>
          <li>• Undo/redo works across session restarts</li>
          <li>• Useful for crash recovery</li>
        </ul>
      </div>

      {/* Limitations box */}
      <div className="mt-2 p-3 bg-amber-50 rounded border border-amber-100">
        <p className="text-xs font-semibold text-amber-900 mb-1">⚠️ Limitations:</p>
        <ul className="text-xs text-amber-800 space-y-0.5">
          <li>• Limited to ~50 undo states (default history limit)</li>
          <li>• Storage cleared when switching projects</li>
          <li>• Not a substitute for saving your project</li>
        </ul>
      </div>
    </div>
  );
}
