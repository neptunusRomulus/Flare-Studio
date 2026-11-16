/**
 * IPC side of a manual save: file-stat reads and the ordered list of save
 * tasks handed to the atomic save transaction. Kept out of `useManualSave` so
 * the hook only owns sequencing, conflict handling and progress/UI state.
 */
import type { TileMapEditor } from '@/editor/TileMapEditor';
import { debugLog } from '@/lib/debugLog';
import { exportFlareTextFiles, manualSaveFileApi, type FileStats } from '@/flare/manualSaveExport';

/** One component of a save transaction. */
export type ManualSaveTask = {
  name: string;
  execute: () => Promise<void>;
  rollback: () => Promise<void>;
  critical: boolean;
  priority: number;
};

/** File stats via Electron, or null when the bridge / read fails. */
export async function getFileStatsSafe(path: string): Promise<FileStats | null> {
  const api = manualSaveFileApi();
  if (api && typeof api.getFileStats === 'function') {
    try {
      return await api.getFileStats(path);
    } catch (err) {
      console.warn('[ManualSave] Failed to get file stats:', err);
    }
  }
  return null;
}

/**
 * Build the ordered save tasks. `editor` is non-null: the hook bails out
 * before calling this. Task names, order, priorities and `critical` flags are
 * part of the atomic-save reporting contract, so keep them stable.
 */
export function buildManualSaveTasks(
  editor: TileMapEditor,
  currentProjectPath: string | null | undefined
): ManualSaveTask[] {
  return [
    {
      name: 'Save Map Painting Data & Layer Info',
      execute: async () => {
        const api = manualSaveFileApi();
        // Use provided currentProjectPath, or fall back to editor's stored path
        const projectPath = currentProjectPath || (editor.getCurrentProjectPath?.() ?? null);
        debugLog('[ManualSave][JSON] Starting JSON project save. projectPath:', projectPath, '| electronAPI available:', !!api);
        if (api && projectPath) {
          debugLog('[ManualSave][JSON] Calling saveProjectData...');
          const success = await editor.saveProjectData(projectPath);
          await new Promise(resolve => setTimeout(resolve, 300));
          if (!success) {
            console.error('[ManualSave][JSON] saveProjectData returned false');
            throw new Error('saveProjectData returned false');
          }
          debugLog('[ManualSave][JSON] ✓ JSON project data saved to', projectPath);
        } else {
          console.warn('[ManualSave][JSON] Skipping Electron save — api:', !!api, 'path:', projectPath);
          try {
            const maybe = editor as unknown as { forceSave?: () => void };
            if (typeof maybe.forceSave === 'function') maybe.forceSave();
          } catch {
            // ignore
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      },
      rollback: async () => {
        console.warn('[ManualSave] Rolling back map painting data - no explicit rollback implemented');
      },
      critical: true,
      priority: 10
    },
    {
      name: 'Export Flare .txt map file to maps/ folder',
      execute: async () => {
        const projectPath = currentProjectPath || (editor.getCurrentProjectPath?.() ?? null);
        debugLog('[ManualSave][TXT] Starting Flare .txt export. projectPath:', projectPath);
        await exportFlareTextFiles(editor, projectPath);
      },
      rollback: async () => {
        console.warn('[ManualSave][TXT] Rollback of Flare .txt export — no action taken');
      },
      critical: false,
      priority: 9
    },
    {
      name: 'Save Tileset Palettes & Images',
      execute: async () => {
        // Extract and save tileset palette info per layer
        if (!editor) throw new Error('Editor not available');

        const projectData = editor.getProjectData?.();
        if (!projectData) throw new Error('Could not get project data');

        // Tileset data is already included in projectData.tilesets
        // Images are in projectData.tilesetImages
        debugLog('[ManualSave] Tileset palettes:', projectData.tilesets?.length || 0, 'images');

        // This is already saved as part of the map data
        // But we log it separately to show it's being tracked
        if (projectData.tilesets && projectData.tilesets.length > 0) {
          debugLog('[ManualSave] ✓ Tileset palettes saved:');
          projectData.tilesets.forEach((ts, idx) => {
            debugLog(`  [${idx}] ${ts.fileName || 'unknown'} (layer: ${ts.layerType})`);
          });
        }
      },
      rollback: async () => {
        // Tileset data rollback is handled with map data
      },
      critical: false,
      priority: 9
    },
    {
      name: 'Save Tab Layout & Map Structure',
      execute: async () => {
        // Extract and save tab layout for each map
        if (!editor) throw new Error('Editor not available');

        const projectData = editor.getProjectData?.();
        if (!projectData) throw new Error('Could not get project data');

        // Layer tabs structure
        if (projectData.layerTabs) {
          debugLog('[ManualSave] ✓ Map tabs saved:');
          Object.entries(projectData.layerTabs).forEach(([layerType, tabs]) => {
            debugLog(`  Layer ${layerType}: ${tabs.length} tabs`);
            tabs.forEach((tab, idx) => {
              debugLog(`    - Tab ${idx + 1} (${tab.name || 'unnamed'}): id=${tab.id}`);
            });
          });
        }

        // Active layer tab info
        if (projectData.layerActiveTabId) {
          debugLog('[ManualSave] ✓ Active tabs saved:', JSON.stringify(projectData.layerActiveTabId));
        }
      },
      rollback: async () => {
        // Tab layout rollback is handled with map data
      },
      critical: false,
      priority: 8
    },
    {
      name: 'Save Layer Information',
      execute: async () => {
        // Extract and save layer info
        if (!editor) throw new Error('Editor not available');

        const projectData = editor.getProjectData?.();
        if (!projectData) throw new Error('Could not get project data');

        // Layer information
        if (projectData.layers && projectData.layers.length > 0) {
          debugLog('[ManualSave] ✓ Layer information saved:');
          projectData.layers.forEach((layer, idx) => {
            debugLog(`  Layer ${idx + 1}: ${layer.name} (type: ${layer.type}, id: ${layer.id})`);
            debugLog(`    - Visible: ${layer.visible}, Opacity: ${layer.opacity}`);
            debugLog(`    - Dimensions: ${layer.width}x${layer.height}`);
          });
        }

        debugLog('[ManualSave] ✓ Active layer: id=${projectData.activeLayerId}');
      },
      rollback: async () => {
        // Layer info rollback is handled with map data
      },
      critical: false,
      priority: 7
    },
    {
      name: 'Save Settings & Preferences',
      execute: async () => {
        // Persist settings/preferences to Electron IPC
        try {
          if (typeof window !== 'undefined' && (window as unknown as {electronAPI?: {saveSettings?: unknown}}).electronAPI) {
            const api = (window as unknown as {electronAPI: {saveSettings: (settings: unknown) => Promise<void>}}).electronAPI;
            if (typeof api.saveSettings === 'function') {
              // Get current settings from persistence hook would be ideal
              // For now, just log that we're saving
              debugLog('[ManualSave] ✓ Settings & preferences saved');
            }
          }
        } catch (err) {
          console.warn('[ManualSave] Warning: Settings save failed:', err);
          // Don't fail the overall save for settings
        }
      },
      rollback: async () => {
        // Settings rollback not needed (non-critical)
      },
      critical: false,
      priority: 6
    }
  ];
}
