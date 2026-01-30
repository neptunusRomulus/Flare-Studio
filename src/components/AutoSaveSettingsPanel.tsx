import React, { useState, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import Tooltip from '@/components/ui/tooltip';

type AutoSaveSettingsPanelProps = {
  autoSaveEnabled: boolean;
  intervalMs: number;
  debounceMs: number;
  onEnabledChange: (enabled: boolean) => void;
  onIntervalChange: (intervalMs: number) => void;
  onDebounceChange: (debounceMs: number) => void;
};

const AutoSaveSettingsPanel = ({
  autoSaveEnabled,
  intervalMs,
  debounceMs,
  onEnabledChange: _onEnabledChange,
  onIntervalChange,
  onDebounceChange
}: AutoSaveSettingsPanelProps) => {
  const [localInterval, setLocalInterval] = useState(intervalMs);
  const [localDebounce, setLocalDebounce] = useState(debounceMs);

  // Sync local state when props change
  useEffect(() => {
    setLocalInterval(intervalMs);
  }, [intervalMs]);

  useEffect(() => {
    setLocalDebounce(debounceMs);
  }, [debounceMs]);

  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1000 && value <= 60000) {
      setLocalInterval(value);
      onIntervalChange(value);
    }
  };

  const handleDebounceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 500 && value <= 10000) {
      setLocalDebounce(value);
      onDebounceChange(value);
    }
  };

  const presetIntervals = [
    { label: '3s', value: 3000 },
    { label: '5s', value: 5000 },
    { label: '10s', value: 10000 },
    { label: '15s', value: 15000 },
    { label: '30s', value: 30000 }
  ];

  const presetDebounces = [
    { label: '500ms', value: 500 },
    { label: '1s', value: 1000 },
    { label: '2s', value: 2000 },
    { label: '5s', value: 5000 }
  ];

  return (
    <div className="space-y-5 pt-2">
      <div>
        <label className="text-sm font-medium mb-3 flex items-center gap-2">
          Save Interval
          <Tooltip content="How often the editor automatically saves your work">
            <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
          </Tooltip>
        </label>
        
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={localInterval}
              onChange={handleIntervalChange}
              disabled={!autoSaveEnabled}
              min={1000}
              max={60000}
              step={500}
              className="w-24 px-2 py-1 border border-border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-muted-foreground">milliseconds</span>
            <span className="text-sm text-muted-foreground">
              ({(localInterval / 1000).toFixed(1)}s)
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {presetIntervals.map(preset => (
              <button
                key={preset.value}
                onClick={() => {
                  setLocalInterval(preset.value);
                  onIntervalChange(preset.value);
                }}
                disabled={!autoSaveEnabled}
                className={`px-3 py-1 text-xs border border-border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  localInterval === preset.value
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Faster saves use more disk I/O. Slower saves may lose more recent work if app crashes.
        </p>
      </div>

      <div>
        <label className="text-sm font-medium mb-3 flex items-center gap-2">
          Change Debounce Delay
          <Tooltip content="Waits for this duration of no changes before saving. Prevents excessive saves during rapid edits.">
            <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
          </Tooltip>
        </label>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={localDebounce}
              onChange={handleDebounceChange}
              disabled={!autoSaveEnabled}
              min={500}
              max={10000}
              step={100}
              className="w-24 px-2 py-1 border border-border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-muted-foreground">milliseconds</span>
            <span className="text-sm text-muted-foreground">
              ({(localDebounce / 1000).toFixed(2)}s)
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {presetDebounces.map(preset => (
              <button
                key={preset.value}
                onClick={() => {
                  setLocalDebounce(preset.value);
                  onDebounceChange(preset.value);
                }}
                disabled={!autoSaveEnabled}
                className={`px-3 py-1 text-xs border border-border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  localDebounce === preset.value
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Shorter delays = more responsive saves. Longer delays = fewer saves during active editing.
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded p-3">
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
          ℹ️ Recommendation
        </h4>
        <p className="text-xs text-blue-800 dark:text-blue-200">
          Default settings (5s interval, 2s debounce) work well for most workflows.
          Adjust only if you notice excessive disk usage or want faster recovery from crashes.
        </p>
      </div>
    </div>
  );
};

export default AutoSaveSettingsPanel;
