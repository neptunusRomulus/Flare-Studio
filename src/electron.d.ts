import type { EditorProjectData, SavedTilesetEntry } from './editor/TileMapEditor';
import type { TileLayer, MapObject } from './types';

// Session data stored per-project in .flare-session.json
interface SessionTab {
  id: string;
  name: string;
  projectPath?: string;
}

interface SessionData {
  tabs: SessionTab[];
  activeTabId: string | null;
  lastOpened?: string; // ISO timestamp
}

interface MapConfig {
  name: string;
  width: number;
  height: number;
  tileSize: number;
  location: string;
  isStartingMap?: boolean;
}

interface ProjectMapData extends EditorProjectData {
  name: string;
  width: number;
  height: number;
  tileSize: number;
  layers: TileLayer[];
  objects: MapObject[];
  tilesets: SavedTilesetEntry[];
  tilesetImages: Record<string, string>;
  version: string;
}
declare global {
  interface Window {
    electronAPI: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      confirmClose: (hasUnsavedChanges: boolean) => Promise<boolean>;
      onBeforeClose: (callback: () => void) => void;
      onSaveAndClose: (callback: () => void) => void;
      closeAfterSave: () => void;
      selectDirectory: () => Promise<string | null>;
      selectTilesetFile: () => Promise<string | null>;
      createMapProject: (config: MapConfig) => Promise<boolean>;
      openMapProject: (projectPath: string, mapName?: string) => Promise<EditorProjectData | null>;
      saveMapProject: (projectPath: string, mapData: ProjectMapData) => Promise<boolean>;
      // Phase 2: Tileset profile persistence
      saveTilesetProfiles: (projectPath: string, profiles: Record<string, any>) => Promise<{ success: boolean; path?: string; error?: string }>;
      loadTilesetProfiles: (projectPath: string) => Promise<Record<string, any> | null>;
      deleteMap: (projectPath: string, mapName: string) => Promise<{ success: boolean; message?: string }>;
      saveExportFiles: (projectPath: string, mapName: string, mapTxt: string, tilesetDef: string, options?: { spawn?: { enabled: boolean; content: string; filename?: string }; tilesetImages?: Record<string, string>; npcFiles?: Array<{ filename: string; content: string }>; portraitFiles?: Array<{ sourcePath: string; destFilename: string }>; npcTilesetImages?: Array<{ sourcePath: string; destFilename: string }>; npcAnimationFiles?: Array<{ filename: string; content: string }> }) => Promise<boolean>;
      discoverTilesetImages: (projectPath: string) => Promise<{ tilesetImages: { [key: string]: string }; tilesets: { name: string; fileName: string }[] }>;
      fileExists: (filePath: string) => Promise<boolean>;
      listMaps: (projectPath: string) => Promise<string[]>;
      readMapFile: (projectPath: string, filename: string) => Promise<string | null>;
      updateSpawnFile: (projectPath: string, content: string) => Promise<boolean>;
      readSpawnFile: (projectPath: string) => Promise<string | null>;
      resolvePathRelative: (fromPath: string, toPath: string) => Promise<string>;
      getProjectThumbnail: (projectPath: string) => Promise<string | null>;
      checkProjectExists: (projectPath: string) => Promise<boolean>;
      // Session management (per-project)
      readSession: (projectPath: string) => Promise<SessionData | null>;
      writeSession: (projectPath: string, sessionData: SessionData) => Promise<boolean>;
      saveCrashBackup: (projectPath: string, backupData: unknown) => Promise<boolean>;
      readCrashBackup: (projectPath: string) => Promise<unknown | null>;
      clearCrashBackup: (projectPath: string) => Promise<boolean>;
      readFileAsDataURL: (filePath: string) => Promise<string | null>;
      // NPC file management
      createNpcFile: (projectPath: string, npcData: {
        name: string;
        role: 'talker' | 'vendor' | 'quest' | 'static';
        tilesetPath?: string;
        portraitPath?: string;
      }) => Promise<{ success: boolean; filePath?: string; filename?: string; error?: string }>;
      writeNpcFile: (projectPath: string, filename: string, content: string) => Promise<boolean>;
      // Item file management
      createItemFile: (projectPath: string, itemData: {
        name: string;
        id: number;
        category?: string;
      }) => Promise<{ success: boolean; filePath?: string; filename?: string; error?: string }>;
      getItemCategories: (projectPath: string) => Promise<{ success: boolean; categories: string[]; error?: string }>;
      createItemCategory: (projectPath: string, categoryName: string) => Promise<{ success: boolean; categoryName?: string; categoryPath?: string; error?: string }>;
      ensureItemsFolders: (projectPath: string) => Promise<{ success: boolean; error?: string }>;
      getNextItemId: (projectPath: string) => Promise<{ success: boolean; nextId: number; error?: string }>;
      listItems: (projectPath: string) => Promise<{ success: boolean; items: Array<{ id: number; name: string; category: string; filePath: string; fileName: string }>; error?: string }>;
      readItemFile: (filePath: string) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>;
      writeItemFile: (filePath: string, itemData: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
      deleteItemFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      listEnemies: (projectPath: string) => Promise<string[]>;
      saveEnemyPreset: (projectPath: string, filename: string, content: string) => Promise<boolean>;
      // Generic filesystem helpers for renderer
      createFolderIfNotExists: (folderPath: string) => Promise<boolean>;
      writeFile: (filePath: string, content: string) => Promise<boolean>;
      readDir: (dirPath: string) => Promise<Array<{ name: string; isDirectory: boolean }>>;
      getProjectFolder: () => Promise<string | null>;
      // Menu event listeners
      onMenuNewMap: (callback: () => void) => void;
      onMenuOpenMap: (callback: () => void) => void;
      onMenuSaveMap: (callback: () => void) => void;
      onMenuUndo: (callback: () => void) => void;
      onMenuRedo: (callback: () => void) => void;
      // Graceful shutdown handlers
      onAppBeforeQuit: (callback: () => void) => void;
      appShutdownComplete: () => void;
    };
  }
}

export {};





