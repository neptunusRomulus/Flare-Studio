import { useCallback, useRef } from 'react';

/**
 * UI Settings that should be persisted with the autosave system
 */
export interface UISettings {
  // Toolbar states
  brushSettings: {
    selectedBrushTool?: 'brush' | 'bucket' | 'eraser' | 'clear';
    selectedTool?: 'brush' | 'selection' | 'shape' | 'stamp' | 'eyedropper';
    selectedSelectionTool?: 'rectangular' | 'multi-cell' | 'magic-wand' | 'same-tile' | 'circular';
    selectedShapeTool?: string;
  };

  // Layer visibility and transparency
  layerSettings: {
    [layerId: number]: {
      visible?: boolean;
      transparency?: number;
    };
  };

  // Panel expansion states
  panelStates: {
    layersPanelExpanded?: boolean;
    leftCollapsed?: boolean;
  };

  // Preferences
  preferences: {
    isDarkMode?: boolean;
    showSidebarToggle?: boolean;
  };

  // Viewport settings (per-project)
  viewport: {
    zoom?: number;
    scrollX?: number;
    scrollY?: number;
  };

  // Tab states
  tabs: {
    [layerType: string]: {
      activeTabId?: number;
    };
  };

  // Stamp state
  stamps: {
    selectedStamp?: string;
    stampMode?: 'paintStamp' | 'placeStamp' | 'none';
  };

  // Auto-save timing settings
  autoSaveSettings: {
    enabled?: boolean;
    intervalMs?: number; // Save interval in milliseconds (default 5000)
    debounceMs?: number; // Debounce delay in milliseconds (default 2000)
  };

  // Undo/Redo persistence settings
  undoPersistence: {
    enabled?: boolean; // Whether to persist undo stack to localStorage
  };
}

/**
 * Settings persistence hook for autosave integration
 */
export default function useSettingsPersistence() {
  const defaultSettings: UISettings = {
    brushSettings: {},
    layerSettings: {},
    panelStates: {},
    preferences: {},
    viewport: {},
    tabs: {},
    stamps: {},
    autoSaveSettings: {
      enabled: true,
      intervalMs: 5000,
      debounceMs: 2000
    },
    undoPersistence: {
      enabled: false
    }
  };
  const settingsRef = useRef<UISettings>(defaultSettings);

  /**
   * Update a specific settings category
   */
  const updateSettings = useCallback(<K extends keyof UISettings>(
    category: K,
    updates: Partial<UISettings[K]>
  ) => {
    settingsRef.current[category] = {
      ...settingsRef.current[category],
      ...updates
    };
  }, []);

  /**
   * Update brush settings
   */
  const updateBrushSettings = useCallback((updates: Partial<UISettings['brushSettings']>) => {
    updateSettings('brushSettings', updates);
  }, [updateSettings]);

  /**
   * Update layer visibility/transparency
   */
  const updateLayerSettings = useCallback((layerId: number, updates: UISettings['layerSettings'][number]) => {
    const current = settingsRef.current.layerSettings || {};
    settingsRef.current.layerSettings = {
      ...current,
      [layerId]: {
        ...current[layerId],
        ...updates
      }
    };
  }, []);

  /**
   * Update panel states (collapse, expand)
   */
  const updatePanelStates = useCallback((updates: Partial<UISettings['panelStates']>) => {
    updateSettings('panelStates', updates);
  }, [updateSettings]);

  /**
   * Update user preferences
   */
  const updatePreferences = useCallback((updates: Partial<UISettings['preferences']>) => {
    updateSettings('preferences', updates);
  }, [updateSettings]);

  /**
   * Update viewport (zoom, scroll position)
   */
  const updateViewport = useCallback((updates: Partial<UISettings['viewport']>) => {
    updateSettings('viewport', updates);
  }, [updateSettings]);

  /**
   * Update active tab for layer type
   */
  const updateActiveTab = useCallback((layerType: string, activeTabId: number | undefined) => {
    const current = settingsRef.current.tabs || {};
    settingsRef.current.tabs = {
      ...current,
      [layerType]: {
        ...current[layerType],
        activeTabId
      }
    };
  }, []);

  /**
   * Update stamp settings
   */
  const updateStampSettings = useCallback((updates: Partial<UISettings['stamps']>) => {
    updateSettings('stamps', updates);
  }, [updateSettings]);

  /**
   * Update auto-save timing settings
   */
  const updateAutoSaveSettings = useCallback((updates: Partial<UISettings['autoSaveSettings']>) => {
    updateSettings('autoSaveSettings', updates);
  }, [updateSettings]);

  /**
   * Update undo/redo persistence settings
   */
  const updateUndoPersistence = useCallback((updates: Partial<UISettings['undoPersistence']>) => {
    updateSettings('undoPersistence', updates);
  }, [updateSettings]);

  /**
   * Get all current settings
   */
  const getCurrentSettings = useCallback((): UISettings => {
    return JSON.parse(JSON.stringify(settingsRef.current));
  }, []);

  /**
   * Restore settings from saved data
   */
  const restoreSettings = useCallback((savedSettings: Partial<UISettings>) => {
    if (savedSettings.brushSettings) {
      settingsRef.current.brushSettings = { ...savedSettings.brushSettings };
    }
    if (savedSettings.layerSettings) {
      settingsRef.current.layerSettings = { ...savedSettings.layerSettings };
    }
    if (savedSettings.panelStates) {
      settingsRef.current.panelStates = { ...savedSettings.panelStates };
    }
    if (savedSettings.preferences) {
      settingsRef.current.preferences = { ...savedSettings.preferences };
    }
    if (savedSettings.viewport) {
      settingsRef.current.viewport = { ...savedSettings.viewport };
    }
    if (savedSettings.tabs) {
      settingsRef.current.tabs = { ...savedSettings.tabs };
    }
    if (savedSettings.stamps) {
      settingsRef.current.stamps = { ...savedSettings.stamps };
    }
  }, []);

  /**
   * Clear all settings
   */
  const clearSettings = useCallback(() => {
    settingsRef.current = {
      brushSettings: {},
      layerSettings: {},
      panelStates: {},
      preferences: {},
      viewport: {},
      tabs: {},
      stamps: {},
      autoSaveSettings: {
        enabled: true,
        intervalMs: 5000,
        debounceMs: 2000
      },
      undoPersistence: {
        enabled: false
      }
    };
  }, []);

  return {
    // Update functions
    updateSettings,
    updateBrushSettings,
    updateLayerSettings,
    updatePanelStates,
    updatePreferences,
    updateViewport,
    updateActiveTab,
    updateStampSettings,
    updateAutoSaveSettings,
    updateUndoPersistence,

    // Retrieval functions
    getCurrentSettings,
    restoreSettings,
    clearSettings,

    // Direct ref access for performance-critical updates
    settingsRef
  } as const;
}
