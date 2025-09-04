interface MapConfig {
  name: string;
  width: number;
  height: number;
  tileSize: number;
  location: string;
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
    };
  }
}

export {};
