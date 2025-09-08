interface MapConfig {
  name: string;
  width: number;
  height: number;
  tileSize: number;
  location: string;
}

interface ProjectMapData {
  name: string;
  width: number;
  height: number;
  tileSize: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layers: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  objects: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tilesets: any[];
  tilesetImages: { [key: string]: string };
  heroX?: number;
  heroY?: number;
  version: string;
  // Optional editor-specific fields to preserve brush mapping and settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detectedTileData?: Array<[number, any]>;
  tileContentThreshold?: number;
  objectSeparationSensitivity?: number;
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
      createMapProject: (config: MapConfig) => Promise<boolean>;
      openMapProject: (projectPath: string) => Promise<MapConfig | null>;
      saveMapProject: (projectPath: string, mapData: ProjectMapData) => Promise<boolean>;
      saveExportFiles: (projectPath: string, projectName: string, mapTxt: string, tilesetDef: string) => Promise<boolean>;
      discoverTilesetImages: (projectPath: string) => Promise<{ tilesetImages: { [key: string]: string }; tilesets: { name: string; fileName: string }[] }>;
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
