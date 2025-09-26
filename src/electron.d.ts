import type { EditorProjectData, SavedTilesetEntry } from './editor/TileMapEditor';
import type { TileLayer, MapObject } from './types';

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
      openMapProject: (projectPath: string) => Promise<EditorProjectData | null>;
      saveMapProject: (projectPath: string, mapData: ProjectMapData) => Promise<boolean>;
      saveExportFiles: (projectPath: string, mapName: string, mapTxt: string, tilesetDef: string, options?: { spawn?: { enabled: boolean; content: string; filename?: string } }) => Promise<boolean>;
      discoverTilesetImages: (projectPath: string) => Promise<{ tilesetImages: { [key: string]: string }; tilesets: { name: string; fileName: string }[] }>;
      listMaps: (projectPath: string) => Promise<string[]>;
      readMapFile: (projectPath: string, filename: string) => Promise<string | null>;
      updateSpawnFile: (projectPath: string, content: string) => Promise<boolean>;
      readSpawnFile: (projectPath: string) => Promise<string | null>;
      resolvePathRelative: (fromPath: string, toPath: string) => Promise<string>;
      getProjectThumbnail: (projectPath: string) => Promise<string | null>;
      checkProjectExists: (projectPath: string) => Promise<boolean>;
      // Menu event listeners
      onMenuNewMap: (callback: () => void) => void;
      onMenuOpenMap: (callback: () => void) => void;
      onMenuSaveMap: (callback: () => void) => void;
      onMenuUndo: (callback: () => void) => void;
      onMenuRedo: (callback: () => void) => void;
    };
  }
}

export {};





