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
  version: string;
}

declare global {
  interface Window {
    electronAPI: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      selectDirectory: () => Promise<string | null>;
      createMapProject: (config: MapConfig) => Promise<boolean>;
      openMapProject: (projectPath: string) => Promise<MapConfig | null>;
      saveMapProject: (projectPath: string, mapData: ProjectMapData) => Promise<boolean>;
  discoverTilesetImages: (projectPath: string) => Promise<{ tilesetImages: { [key: string]: string }; tilesets: { name: string; fileName: string }[] }>;
    };
  }
}

export {};
