# Auto-Save Timing Configuration

**Date**: January 30, 2026
**Status**: ✅ Complete
**Impact**: Users can now customize auto-save interval and debounce timing
**Files Modified**: 6
**Files Created**: 1
**Compilation Errors**: 0

## Problem

Auto-save interval was hardcoded to 5 seconds + 2 seconds debounce. This default doesn't suit all workflows:
- **Heavy editors**: May want slower saves (15-30s) to reduce disk I/O
- **Safety-conscious users**: May want faster saves (3s) for faster crash recovery
- **Different network conditions**: May need longer debounce for slower storage

## Solution

Added comprehensive UI settings for auto-save timing with:
- **Save Interval** (1s - 60s): How often to check for and save changes
- **Debounce Delay** (500ms - 10s): How long to wait after last change before saving
- **Preset buttons**: Quick access to common configurations
- **Persistent storage**: Settings saved with project data
- **Real-time synchronization**: Changes apply immediately

## Architecture

### 1. Settings Data Structure
**File**: [src/hooks/useSettingsPersistence.ts](src/hooks/useSettingsPersistence.ts)

Added to `UISettings` interface:
```typescript
autoSaveSettings: {
  enabled?: boolean;
  intervalMs?: number;      // Default 5000 (5s)
  debounceMs?: number;      // Default 2000 (2s)
};
```

### 2. Auto-Save Hook Updates
**File**: [src/hooks/useAutosave.ts](src/hooks/useAutosave.ts)

Enhanced to:
- Read timing settings from UISettings on mount
- Use `autoSaveIntervalMs` instead of prop `autoSaveInterval`
- Use `autoSaveDebounceMs` instead of prop `debounceMs`
- Save timing changes back to UISettings automatically
- Export timing state for UI consumption

```typescript
const {
  autoSaveEnabled,
  setAutoSaveEnabled,
  autoSaveIntervalMs,
  setAutoSaveIntervalMs,
  autoSaveDebounceMs,
  setAutoSaveDebounceMs,
  // ... other exports
} = useAutosave(opts);
```

### 3. Settings UI Component
**File**: [src/components/AutoSaveSettingsPanel.tsx](src/components/AutoSaveSettingsPanel.tsx) (NEW)

Provides user controls:
- Slider or input for interval (1000-60000ms)
- Slider or input for debounce (500-10000ms)
- Preset buttons for quick selection
- Real-time feedback showing values in both ms and seconds
- Helpful tooltips explaining each setting
- Info box with recommendations

```typescript
<AutoSaveSettingsPanel
  autoSaveEnabled={true}
  intervalMs={5000}
  debounceMs={2000}
  onIntervalChange={(ms) => setAutoSaveIntervalMs(ms)}
  onDebounceChange={(ms) => setAutoSaveDebounceMs(ms)}
/>
```

### 4. Settings Dialog Integration
**File**: [src/components/EngineSettingsDialog.tsx](src/components/EngineSettingsDialog.tsx)

Added:
- New props: `autoSaveIntervalMs`, `setAutoSaveIntervalMs`, `autoSaveDebounceMs`, `setAutoSaveDebounceMs`
- Conditional rendering: Settings panel appears only when auto-save is enabled
- Smooth integration: Panel expands/collapses with toggle

### 5. App Context Integration
**File**: [src/hooks/useAppMainBuilder.ts](src/hooks/useAppMainBuilder.ts)

Added state management:
```typescript
const [autoSaveIntervalMs, setAutoSaveIntervalMs] = useState<number>(5000);
const [autoSaveDebounceMs, setAutoSaveDebounceMs] = useState<number>(2000);
```

Exported in context for AppMain consumption.

### 6. Component Wiring
**File**: [src/components/AppMain.tsx](src/components/AppMain.tsx)

Passed timing settings from context to EngineSettingsDialog:
```typescript
<EngineSettingsDialog
  autoSaveIntervalMs={autoSaveIntervalMs}
  setAutoSaveIntervalMs={setAutoSaveIntervalMs}
  autoSaveDebounceMs={autoSaveDebounceMs}
  setAutoSaveDebounceMs={setAutoSaveDebounceMs}
  // ... other props
/>
```

## Data Flow

```
User Changes Timing Settings (UI)
  ↓
EngineSettingsDialog → setAutoSaveIntervalMs/setAutoSaveDebounceMs
  ↓
useAppMainBuilder updates state
  ↓
AppMain re-renders with new props
  ↓
useAutosave useEffect detects state change
  ↓
updateAutoSaveSettings() saves to UISettings
  ↓
useEffect updates timing in useAutosave intervals
  ↓
Next save uses new interval/debounce values
```

## Settings Persistence

Auto-save timing is saved with other UI settings:
- **Storage**: Persisted alongside UI state (brush settings, layer visibility, etc.)
- **Restore**: Loaded when project reopens
- **Format**: JSON in ui-settings.json file

```json
{
  "autoSaveSettings": {
    "enabled": true,
    "intervalMs": 5000,
    "debounceMs": 2000
  }
}
```

## Preset Configurations

### Save Interval Presets
| Preset | Value | Best For |
|--------|-------|----------|
| 3s | 3000ms | Fast feedback, small projects |
| 5s | 5000ms | **Default** - Balanced |
| 10s | 10000ms | Large projects, slower storage |
| 15s | 15000ms | Heavy editing, reducing I/O |
| 30s | 30000ms | Minimal overhead |

### Debounce Presets
| Preset | Value | Best For |
|--------|-------|----------|
| 500ms | 500ms | Very responsive saves |
| 1s | 1000ms | Fast save feedback |
| 2s | 2000ms | **Default** - Balanced |
| 5s | 5000ms | Heavy typing/drawing |

## UI Layout

```
┌─────────────────────────────────────────┐
│        Engine Settings Dialog           │
├─────────────────────────────────────────┤
│                                         │
│  Theme (Experimental) [Toggle]          │
│  Debug Mode            [Toggle]         │
│  Auto-Save             [Toggle]         │
│                                         │
│  ┌─ Auto-Save Settings (if enabled) ┐ │
│  │                                    │ │
│  │  Save Interval [Input] ms (5.0s)   │ │
│  │  [3s] [5s] [10s] [15s] [30s]       │ │
│  │                                    │ │
│  │  Change Debounce [Input] ms (2.0s) │ │
│  │  [500ms] [1s] [2s] [5s]            │ │
│  │                                    │ │
│  │  ℹ️ Recommendation box             │ │
│  │     Default settings (5s interval, │ │
│  │     2s debounce) work well...      │ │
│  │                                    │ │
│  └────────────────────────────────────┘ │
│                                         │
│  Active GID Indicator   [Toggle]        │
│  Sidebar Collapse Button [Toggle]       │
│                                         │
│                              [✕ Close] │
└─────────────────────────────────────────┘
```

## Usage Examples

### For Users
1. Open Engine Settings (via menu/gear icon)
2. Toggle "Auto-Save" if needed
3. Click "Save Interval" to expand settings
4. Either:
   - Click a preset button (3s, 5s, 10s, etc.)
   - Or manually enter value in milliseconds
5. Adjust "Change Debounce Delay" similarly
6. Settings save automatically with project

### For Developers
```typescript
// Read current settings
const { autoSaveIntervalMs, autoSaveDebounceMs } = useAutosave(opts);

// Update settings
setAutoSaveIntervalMs(3000);  // 3 seconds
setAutoSaveDebounceMs(1000);  // 1 second

// Settings persist automatically via:
updateAutoSaveSettings({
  intervalMs: 3000,
  debounceMs: 1000
});
```

## Configuration Constraints

| Setting | Min | Max | Step | Default |
|---------|-----|-----|------|---------|
| **Interval** | 1000ms | 60000ms | 500ms | 5000ms |
| **Debounce** | 500ms | 10000ms | 100ms | 2000ms |

## Performance Impact

### Disk I/O
- **3s interval**: ~20 saves/minute (higher I/O)
- **5s interval**: ~12 saves/minute (default)
- **30s interval**: ~2 saves/minute (lower I/O)

### Memory Usage
- Minimal: Settings stored as simple JSON object
- No additional memory per setting adjustment

### CPU Impact
- Negligible: Only affects timing, not save complexity
- Uses existing debounce/interval mechanisms

## Error Handling

Settings are gracefully handled:
- **Invalid values**: Clamped to valid range
- **Missing settings**: Falls back to defaults
- **Corrupted settings**: Resets to defaults
- **Type mismatches**: Converts safely if possible

## Testing Checklist

- [x] Settings panel renders when auto-save enabled
- [x] Settings panel hidden when auto-save disabled
- [x] Preset buttons update both display and state
- [x] Manual input accepts valid values
- [x] Invalid values are rejected
- [x] Settings persist across project reload
- [x] Changes apply immediately to save intervals
- [x] UISettings saves with project data
- [x] Tooltips display correctly
- [x] Recommendation box shows correctly

## Future Enhancements

1. **Per-project profiles**: Save different timing presets for different projects
2. **Adaptive timing**: Automatically adjust based on project size
3. **Network-aware**: Adjust for cloud/network storage
4. **Telemetry**: Track most common timing preferences
5. **Undo/Redo integration**: Coordinate with change tracking

## Migration Guide

### For Existing Projects
No migration needed:
- Defaults apply if settings missing
- Settings created on first save
- Users keep existing defaults until manually changed

### For New Projects
Settings initialized to defaults:
```typescript
autoSaveSettings: {
  enabled: true,
  intervalMs: 5000,
  debounceMs: 2000
}
```

## Summary

✅ **Flexible Configuration**: Users can adjust both interval and debounce
✅ **Preset Options**: Quick access to common configurations
✅ **Persistent Storage**: Settings saved with project
✅ **Zero Breaking Changes**: Backward compatible
✅ **Real-time Application**: Changes apply immediately
✅ **Constrained Inputs**: Valid ranges prevent problems
✅ **Clear UI**: Helpful tooltips and recommendations
✅ **Production Ready**: All files compile, 0 errors

**Result**: Users now have full control over auto-save timing to match their workflow needs.
