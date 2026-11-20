/**
 * Map and editor model: tile layers, map objects, export parameters, the tile
 * tools, the tile-set asset registry and undo state.
 */
import type { FlareEvent, FlareEnemy, FlareNPC } from './flare';
export interface TileLayer {
  id: number;
  name: string;
  type: 'background' | 'object' | 'collision' | 'event' | 'enemy' | 'npc' | 'items' | 'books' | 'status' | 'rules' | 'actions' | 'gameSettings' | 'worldSettings' | 'strings' | 'titles' | 'stats' | 'powerTree' | (string & {});
  data: number[];
  visible: boolean;
  transparency?: number; // 0-1, where 1 is fully opaque
  opacity?: number;
  width?: number;
  height?: number;
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
  description?: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, string | string[]>;
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
  enemies: FlareEnemy[] | null;
  heroPos?: string;
  music?: string;
  title?: string;
  tilesetDefs?: string[]; // For [tilesets] section
}

export interface UndoRedoState {
  layerData: number[];
  collisionData: number[];
  objects: MapObject[];
  activeLayerId: number | null;
  timestamp: number;
}

export type Tool = 'tiles' | 'brush' | 'eraser' | 'bucket' | 'selection' | 'shape' | 'eyedropper' | 'stamp' | 'collision' | 'objects';

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

/** 
 * AssetRecord: Persistent definition of a tileset asset with metadata
 * Decouples visual dimensions from logical gameplay footprint and collision
 */
export interface AssetRecord {
  id: string;                    // Unique identifier for this asset within the project
  name?: string;
  profileId: string;             // Reference to parent TilesetProfile that defines this asset
  
  // Source rectangle within the tileset image
  sourceX: number;               // X offset in tileset (pixels)
  sourceY: number;               // Y offset in tileset (pixels)
  width: number;                 // Visual width in pixels
  height: number;                // Visual height in pixels
  
  // Rendering anchor and origin
  originX?: number;              // Render origin X (pixels, relative to top-left of asset)
  originY?: number;              // Render origin Y (pixels, relative to top-left of asset)
  anchorX: number;               // Anchor grid cell X for placement (e.g., 1 for 1x1 ground tile)
  anchorY: number;               // Anchor grid cell Y for placement (e.g., 1 for 1x1 ground tile)
  
  // Logical footprint (game grid occupancy, independent of pixel size)
  footprintWidth?: number;       // Grid cells occupied horizontally (default: 1)
  footprintHeight?: number;      // Grid cells occupied vertically (default: 1)
  
  // Collision override fields (separate from visual footprint for gameplay)
  collisionFootprintWidth?: number;  // Optional: override collision width (default: use footprintWidth)
  collisionFootprintHeight?: number; // Optional: override collision height (default: use footprintHeight)
  
  // Asset classification for paint mode targeting
  category?: 'ground' | 'object' | 'decoration' | 'collision';
  
  // Confidence metrics for import review
  detectionConfidence?: number;  // 0-1, how certain the auto-detect was
  userVerified?: boolean;        // True if user manually confirmed this asset
  
  createdAt?: string;            // ISO timestamp for profile tracking
  lastModified?: string;         // ISO timestamp for updates
}

/** 
 * ObjectInstance: A placed sprite object on the map
 * References an AssetRecord definition and stores placement + properties
 */
export interface ObjectInstance {
  id: string;                    // Unique instance ID (e.g., "obj_123")
  assetRecordId: string;         // Reference to the AssetRecord being placed
  
  // Placement on the map
  gridX: number;                 // Grid X coordinate
  gridY: number;                 // Grid Y coordinate
  layerId?: string;              // Which layer this instance is on
  
  // Instance-level overrides
  properties?: Record<string, string | number | boolean>;
  
  // Collision override (if different from asset record's footprint)
  collisionFootprintWidth?: number;
  collisionFootprintHeight?: number;
  
  // Rendering order hint (auto-calculated from isometric Y-sort, but can be overridden)
  renderDepth?: number;
  
  createdAt?: string;            // ISO timestamp
  lastModified?: string;         // ISO timestamp
}

/** 
 * TilesetProfile: Persistent registry of asset definitions for a tileset
 * Stored at project level to avoid re-detection on every load
 */
export interface TilesetProfile {
  id: string;                    // Unique profile ID (e.g., "tileset_stone_walls")
  tilesetFileName: string;       // Name of the PNG file this profile describes
  
  // Asset definitions within this tileset
  assets: AssetRecord[];         // All assets detected/defined for this tileset
  
  // Detection metadata
  autoDetected?: boolean;        // True if generated by auto-detect, false if manual
  columns?: number;              // Grid columns of the tileset
  rows?: number;                 // Grid rows of the tileset
  tileWidth?: number;            // Grid cell width (pixels)
  tileHeight?: number;           // Grid cell height (pixels)
  
  createdAt?: string;            // ISO timestamp
  lastModified?: string;         // ISO timestamp
}

/** 
 * PaintMode: Determines which structures are modified during painting
 */
export type PaintMode = 'ground' | 'object';
