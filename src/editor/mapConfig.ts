interface MapConfig {
  name: string;
  width: number;
  height: number;
  tileSize: number;
  location: string;
  isStartingMap?: boolean;
}

export type { MapConfig };
