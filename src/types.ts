// Type definitions for the Isometric Tile Map Editor

export interface TileLayer {
  id: number;
  name: string;
<<<<<<< HEAD
  type: 'background' | 'object' | 'collision' | 'event' | 'enemy' | 'npc';
  data: number[];
  visible: boolean;
  transparency?: number; // 0-1, where 1 is fully opaque
=======
  data: number[];
  visible: boolean;
>>>>>>> 7bd82e7 (typescript transfer succelfully finished.)
}

export interface TilesetInfo {
  name: string;
  image: HTMLImageElement;
  columns: number;
  rows: number;
  tileCount: number;
  firstgid: number;
}

export interface MapObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, string>;
<<<<<<< HEAD
  // Flare-specific extensions
  category?: string;      // For enemies: antlion, antlion_hatchling, etc.
  level?: number;         // For enemies: difficulty level
  number?: number;        // For enemies: spawn count
  wander_radius?: number; // For enemies: movement range
  activate?: string;      // For events: on_trigger, on_load, etc.
  hotspot?: string;       // For events: location, click, etc.
  intermap?: string;      // For events: map transitions
  loot?: string;          // For events: treasure/loot table
  soundfx?: string;       // For events: sound effects
  mapmod?: string;        // For events: map modifications
  repeat?: boolean;       // For events: can be triggered multiple times
  tooltip?: string;       // For events: hover text
=======
>>>>>>> 7bd82e7 (typescript transfer succelfully finished.)
}

export interface ExportTMXParams {
  mapWidth: number;
  mapHeight: number;
  tileWidth: number;
  tileHeight: number;
  layers: TileLayer[];
  tilesetRef: string | null;
}

export interface ExportTSXParams {
  tileWidth: number;
  tileHeight: number;
  imageWidth: number;
  imageHeight: number;
  tilesetPngName: string;
}

export interface ExportFlareTXTParams {
  mapWidth: number;
  mapHeight: number;
  tileWidth: number;
  tileHeight: number;
  layers: TileLayer[];
  collisionLayer: number[] | null;
  tilesets: TilesetInfo[] | null;
  events: FlareEvent[] | null;
  npcs: FlareNPC[] | null;
  heroPos?: string;
  music?: string;
  title?: string;
<<<<<<< HEAD
  tilesetDefs?: string[]; // For [tilesets] section
=======
>>>>>>> 7bd82e7 (typescript transfer succelfully finished.)
}

export interface FlareEvent {
  x: number;
  y: number;
  width: number;
  height: number;
  targetMap?: string;
}

export interface FlareNPC {
  x: number;
  y: number;
  width: number;
  height: number;
  filename?: string;
}

export interface UndoRedoState {
  layerData: number[];
  collisionData: number[];
  objects: MapObject[];
  activeLayerId: number | null;
  timestamp: number;
}

<<<<<<< HEAD
export type Tool = 'tiles' | 'brush' | 'eraser' | 'bucket' | 'selection' | 'shape' | 'eyedropper' | 'stamp';
=======
export type Tool = 'tiles' | 'collision' | 'objects';
>>>>>>> 7bd82e7 (typescript transfer succelfully finished.)

export type Orientation = 'isometric';

// DOM Element types for better type safety
export interface EditorElements {
  tilesetFileInput: HTMLInputElement;
  extraTilesetFileInput: HTMLInputElement;
  tilesContainer: HTMLDivElement;
  activeGidSpan: HTMLSpanElement;
  mapCanvas: HTMLCanvasElement;
  hoverInfo: HTMLDivElement;
  mapWidthInput: HTMLInputElement;
  mapHeightInput: HTMLInputElement;
  resizeMapBtn: HTMLButtonElement;
  clearMapBtn: HTMLButtonElement;
  exportTMXBtn: HTMLButtonElement;
  exportTSXBtn: HTMLButtonElement;
  exportFlareTXTBtn: HTMLButtonElement;
  undoBtn: HTMLButtonElement;
  redoBtn: HTMLButtonElement;
  importTMXFile: HTMLInputElement;
  importTSXFile: HTMLInputElement;
  layersListEl: HTMLDivElement;
  newLayerNameInput: HTMLInputElement;
  addLayerBtn: HTMLButtonElement;
  objectListEl: HTMLDivElement;
  selectedObjectInfo: HTMLDivElement;
  propertiesForm: HTMLFormElement;
  addPropertyBtn: HTMLButtonElement;
  miniMapCanvas: HTMLCanvasElement;
}
<<<<<<< HEAD

// Stamp-related types
export interface StampTile {
  tileId: number;
  layerId: number;
  x: number;
  y: number;
}

export interface Stamp {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: StampTile[];
  thumbnail?: string; // Base64 encoded image for preview
}

export type StampMode = 'select' | 'create' | 'place';
=======
>>>>>>> 7bd82e7 (typescript transfer succelfully finished.)
